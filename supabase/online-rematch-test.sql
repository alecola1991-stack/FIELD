-- Rematch flow test with temporary accounts; everything is rolled back.
-- Run after online.sql and online-rematch.sql (or with them inside the same transaction).
begin;
do $$
declare ids uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()]; prefix text:='qr_'||substr(replace(gen_random_uuid()::text,'-',''),1,7);
 r jsonb; room uuid; game uuid; next_room uuid; next_game uuid; elo_before int;
begin
 for i in 1..3 loop insert into auth.users(id) values(ids[i]); end loop;
 execute 'set local role authenticated';
 for i in 1..3 loop
  perform set_config('request.jwt.claim.sub',ids[i]::text,true);
  perform public.field_online('claim_username',jsonb_build_object('username',prefix||i));
 end loop;
 -- Quick match between 1 and 2, confirmed by both.
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 r:=public.field_online('create','{"kind":"quick"}'); room:=(r->'lobby'->>'id')::uuid;
 if r->'lobby'->'rematch'->'votes'<>'[]'::jsonb then raise exception 'New room starts with rematch votes'; end if;
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 r:=public.field_online('join',jsonb_build_object('kind','quick','code',r->'lobby'->>'code')); game:=(r->'lobby'->'matches'->0->>'id')::uuid;
 begin perform public.field_online('rematch',jsonb_build_object('lobbyId',room)); raise exception 'Rematch allowed mid-match';
 exception when others then if sqlerrm='Rematch allowed mid-match' then raise; end if; end;
 perform public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',3,'opponentScore',5));
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 r:=public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',5,'opponentScore',3));
 if r->'lobby'->>'state'<>'finished' then raise exception 'Match not settled'; end if;
 -- Outsider cannot vote.
 perform set_config('request.jwt.claim.sub',ids[3]::text,true);
 begin perform public.field_online('rematch',jsonb_build_object('lobbyId',room)); raise exception 'Outsider voted';
 exception when others then if sqlerrm='Outsider voted' then raise; end if; end;
 -- First vote waits, second vote starts a private quick room with the same seats.
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 r:=public.field_online('rematch',jsonb_build_object('lobbyId',room));
 if (r->'lobby'->>'id')::uuid<>room or jsonb_array_length(r->'lobby'->'rematch'->'votes')<>1 then raise exception 'First vote should wait on the old room'; end if;
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 r:=public.field_online('rematch',jsonb_build_object('lobbyId',room)); next_room:=(r->'lobby'->>'id')::uuid;
 if next_room=room or r->'lobby'->>'state'<>'playing' or r->'lobby'->>'kind'<>'quick' or (r->'lobby'->>'public')::boolean then raise exception 'Rematch room not started correctly'; end if;
 if jsonb_array_length(r->'lobby'->'players')<>2 or jsonb_array_length(r->'lobby'->'matches')<>1 then raise exception 'Rematch seats wrong'; end if;
 -- The first player, still polling the old room, is moved to the new one.
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 r:=public.field_online('poll',jsonb_build_object('lobbyId',room));
 if (r->'lobby'->>'id')::uuid<>next_room then raise exception 'Poll did not redirect to the rematch'; end if;
 r:=public.field_online('rematch',jsonb_build_object('lobbyId',room));
 if (r->'lobby'->>'id')::uuid<>next_room then raise exception 'Repeated vote created another room'; end if;
 perform public.field_online('leave',jsonb_build_object('lobbyId',next_room));
 -- Ranked rematch settles ELO again.
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 r:=public.field_online('queue','{"kind":"ranked"}'); room:=(r->'lobby'->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 r:=public.field_online('queue','{"kind":"ranked"}'); game:=(r->'lobby'->'matches'->0->>'id')::uuid;
 perform public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',5,'opponentScore',1));
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 perform public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',1,'opponentScore',5));
 perform public.field_online('rematch',jsonb_build_object('lobbyId',room));
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 r:=public.field_online('rematch',jsonb_build_object('lobbyId',room)); next_room:=(r->'lobby'->>'id')::uuid; next_game:=(r->'lobby'->'matches'->0->>'id')::uuid;
 if r->'lobby'->>'kind'<>'ranked' then raise exception 'Ranked rematch changed mode'; end if;
 elo_before:=(r->'identity'->>'elo')::int;
 perform public.field_online('report',jsonb_build_object('lobbyId',next_room,'matchId',next_game,'playerScore',5,'opponentScore',2));
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 perform public.field_online('report',jsonb_build_object('lobbyId',next_room,'matchId',next_game,'playerScore',2,'opponentScore',5));
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 r:=public.field_online('state');
 if (r->'identity'->>'elo')::int<=elo_before or (r->'identity'->>'played')::int<>2 then raise exception 'Ranked rematch did not settle ELO'; end if;
 -- A player who left blocks the rematch.
 perform public.field_online('leave',jsonb_build_object('lobbyId',next_room));
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 begin perform public.field_online('rematch',jsonb_build_object('lobbyId',next_room)); raise exception 'Rematch with a departed rival';
 exception when others then if sqlerrm='Rematch with a departed rival' then raise; end if; end;
 raise notice 'ONLINE REMATCH TEST PASSED';
end $$;
rollback;
