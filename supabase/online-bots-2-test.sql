-- Online bots, second part: rematch answer and bots quitting. Everything is rolled back.
-- Run after online-bots-2.sql.
begin;
do $$
declare me uuid:=gen_random_uuid(); mate uuid:=gen_random_uuid(); r jsonb; room uuid; game uuid; i integer; accepted integer:=0; left_room integer:=0; before integer; after integer;
begin
 insert into auth.users(id) values(me),(mate);
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',mate::text,true); perform public.field_online('claim_username',jsonb_build_object('username','qc'||substr(replace(mate::text,'-',''),1,8)));
 perform set_config('request.jwt.claim.sub',me::text,true);
 r:=public.field_online('claim_username',jsonb_build_object('username','qc'||substr(replace(me::text,'-',''),1,8)));
 if (r->>'version')::int<6 then raise exception 'Version 6 expected'; end if;
 -- Rematch against bots: about one time in three it is accepted; otherwise the bot leaves.
 for i in 1..45 loop
  r:=public.field_online('queue','{"kind":"quick"}'); room:=(r->'lobby'->>'id')::uuid;
  execute 'reset role'; update field_private.lobbies set created_at=now()-interval '20 seconds' where id=room; execute 'set local role authenticated';
  r:=public.field_online('bots',jsonb_build_object('lobbyId',room)); game:=(r->'lobby'->'matches'->0->>'id')::uuid;
  perform public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',5,'opponentScore',1));
  r:=public.field_online('rematch',jsonb_build_object('lobbyId',room));
  if r->'lobby'->>'id'<>room::text then accepted:=accepted+1; perform public.field_online('leave',jsonb_build_object('lobbyId',(r->'lobby'->>'id')::uuid));
  elsif exists(select 1 from jsonb_array_elements(r->'lobby'->'players') x where (x->>'bot')::boolean and not (x->>'active')::boolean) then left_room:=left_room+1;
  else raise exception 'Rematch answer missing: %',r->'lobby'; end if;
  -- A second vote finds the rival gone.
  if r->'lobby'->>'id'=room::text then
   begin perform public.field_online('rematch',jsonb_build_object('lobbyId',room)); raise exception 'Second vote accepted';
   exception when others then if sqlerrm not like '%ha salido%' then raise; end if; end;
  end if;
 end loop;
 if accepted<4 or accepted>27 or accepted+left_room<>45 then raise exception 'Rematch acceptance off: % of 45',accepted; end if;
 -- A bot quits a ranked match: its side forfeits 5-0, ELO moves and it leaves the room.
 execute 'reset role'; select elo into before from field_private.players where user_id=me; execute 'set local role authenticated';
 r:=public.field_online('queue','{"kind":"ranked"}'); room:=(r->'lobby'->>'id')::uuid;
 execute 'reset role'; update field_private.lobbies set created_at=now()-interval '20 seconds' where id=room; execute 'set local role authenticated';
 r:=public.field_online('bots',jsonb_build_object('lobbyId',room)); game:=(r->'lobby'->'matches'->0->>'id')::uuid;
 r:=public.field_online('bot_leave',jsonb_build_object('lobbyId',room,'matchId',game));
 if r->'lobby'->'matches'->0->>'state'<>'finished' or (r->'lobby'->'matches'->0->>'score1')::int<>5 or (r->'lobby'->'matches'->0->>'score2')::int<>0 then raise exception 'Bot quit not settled: %',r->'lobby'->'matches'; end if;
 if not exists(select 1 from jsonb_array_elements(r->'lobby'->'players') x where (x->>'bot')::boolean and not (x->>'active')::boolean) then raise exception 'Quitting bot still in the room'; end if;
 execute 'reset role'; select elo into after from field_private.players where user_id=me; execute 'set local role authenticated';
 if after<=before then raise exception 'ELO did not move on the forfeit'; end if;
 -- Never against people: 2v2 with a human on the rival side.
 r:=public.field_online('queue','{"kind":"quick","size":4}'); room:=(r->'lobby'->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',mate::text,true); perform public.field_online('queue','{"kind":"quick","size":4}');
 execute 'reset role'; update field_private.lobbies set created_at=now()-interval '20 seconds' where id=room; execute 'set local role authenticated';
 r:=public.field_online('bots',jsonb_build_object('lobbyId',room)); game:=(r->'lobby'->'matches'->0->>'id')::uuid;
 execute 'reset role'; i:=(select count(*) from field_private.matches where id=game and mate in(p2,p4)); execute 'set local role authenticated';
 if i=1 then
  perform set_config('request.jwt.claim.sub',me::text,true);
  if (r->'lobby'->'matches'->0->>'p1')::uuid<>me then perform set_config('request.jwt.claim.sub',mate::text,true); end if;
  r:=public.field_online('bot_leave',jsonb_build_object('lobbyId',room,'matchId',game));
  if r->'lobby'->'matches'->0->>'state'<>'playing' then raise exception 'Bots quit a side with a human'; end if;
 end if;
end $$;
rollback;
