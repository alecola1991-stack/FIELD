-- Timed matches: results below 5 are accepted, ties and absurd scores are not. Everything is rolled back.
-- Run after online-tiempo.sql.
begin;
do $$
declare me uuid:=gen_random_uuid(); r jsonb; room uuid; game uuid;
begin
 insert into auth.users(id) values(me);
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',me::text,true);
 r:=public.field_online('claim_username',jsonb_build_object('username','qt'||substr(replace(me::text,'-',''),1,8)));
 if (r->>'version')::int<7 then raise exception 'Version 7 expected'; end if;
 r:=public.field_online('queue','{"kind":"ranked"}'); room:=(r->'lobby'->>'id')::uuid;
 execute 'reset role'; update field_private.lobbies set created_at=now()-interval '20 seconds' where id=room; execute 'set local role authenticated';
 r:=public.field_online('bots',jsonb_build_object('lobbyId',room)); game:=(r->'lobby'->'matches'->0->>'id')::uuid;
 -- A tie is never a final result (extra time settles it).
 begin perform public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',2,'opponentScore',2)); raise exception 'Tie accepted';
 exception when others then if sqlerrm not like '%Marcador inválido%' then raise; end if; end;
 begin perform public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',31,'opponentScore',0)); raise exception 'Absurd score accepted';
 exception when others then if sqlerrm not like '%Marcador inválido%' then raise; end if; end;
 -- Full time 2-1: accepted and settled (the bot confirms).
 r:=public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',2,'opponentScore',1));
 if r->'lobby'->'matches'->0->>'state'<>'finished' or (r->'lobby'->'matches'->0->>'score1')::int<>2 or (r->'lobby'->'matches'->0->>'score2')::int<>1 then raise exception 'Timed result not settled: %',r->'lobby'->'matches'; end if;
end $$;
rollback;
