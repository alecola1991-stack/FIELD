-- Online bots test with temporary accounts; everything is rolled back.
-- Run after online-bots.sql (and the earlier online-*.sql files).
begin;
do $$
declare ids uuid[]; prefix text:='qb'||substr(replace(gen_random_uuid()::text,'-',''),1,6); r jsonb; room uuid; game uuid; i integer; bot uuid;
 human_elo integer; bot_elo integer; bot_name text; n integer; t jsonb; winner uuid;
begin
 ids:=array(select gen_random_uuid() from generate_series(1,4));
 for i in 1..4 loop insert into auth.users(id) values(ids[i]); end loop;
 -- Humans still need an account.
 begin insert into field_private.players(user_id,username) values(gen_random_uuid(),prefix||'_ghost'); raise exception 'Human without account accepted';
 exception when others then if sqlerrm not like '%Usuario desconocido%' then raise; end if; end;
 execute 'set local role authenticated';
 for i in 1..4 loop perform set_config('request.jwt.claim.sub',ids[i]::text,true); r:=public.field_online('claim_username',jsonb_build_object('username',prefix||'_'||i)); end loop;
 if (r->>'version')::int<5 then raise exception 'Version 5 expected'; end if;

 -- 1v1 ranked: too early, then bots after the wait.
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 r:=public.field_online('queue',jsonb_build_object('kind','ranked','profile',jsonb_build_object('name','UNO','level',30))); room:=(r->'lobby'->>'id')::uuid;
 begin perform public.field_online('bots',jsonb_build_object('lobbyId',room)); raise exception 'Bots before 15 s';
 exception when others then if sqlerrm not like '%Seguimos buscando%' then raise; end if; end;
 execute 'reset role'; update field_private.lobbies set created_at=now()-interval '20 seconds' where id=room; execute 'set local role authenticated';
 r:=public.field_online('bots',jsonb_build_object('lobbyId',room));
 if r->'lobby'->>'state'<>'playing' then raise exception 'Room did not start with a bot: %',r->'lobby'; end if;
 game:=(r->'lobby'->'matches'->0->>'id')::uuid;
 if (r->'lobby'->'matches'->0->>'p1')::uuid<>ids[1] then raise exception 'The human must host (p1)'; end if;
 execute 'reset role'; select p.user_id,p.elo,p.username into bot,bot_elo,bot_name from field_private.players p where p.user_id=(r->'lobby'->'matches'->0->>'p2')::uuid;
 if not (select is_bot from field_private.players where user_id=bot) then raise exception 'Rival is not a bot'; end if; execute 'set local role authenticated';
 if bot_elo not between 500-80 and 500-10 then raise exception 'Bot ELO % not a little below 500',bot_elo; end if;
 if bot_name !~ '^[A-Za-z0-9_]{3,20}$' then raise exception 'Bad bot name %',bot_name; end if;
 if not exists(select 1 from jsonb_array_elements(r->'lobby'->'players') x where (x->>'bot')::boolean and (x->'profile'->>'level')::int between 25 and 35 and x->'profile'->>'teamId' like '%-%') then raise exception 'Bot profile wrong: %',r->'lobby'->'players'; end if;
 -- Nobody polls for the bot: no forfeit after 90 s.
 execute 'reset role'; update field_private.members set last_seen=now()-interval '2 minutes' where lobby_id=room and user_id=bot; execute 'set local role authenticated';
 r:=public.field_online('poll',jsonb_build_object('lobbyId',room));
 if r->'lobby'->>'state'<>'playing' then raise exception 'Bot side forfeited'; end if;
 -- The human's report settles it; ranked ELO moves for both.
 r:=public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',5,'opponentScore',3));
 if r->'lobby'->>'state'<>'finished' or r->'lobby'->'matches'->0->>'state'<>'finished' then raise exception 'Report did not settle: %',r->'lobby'; end if;
 execute 'reset role'; select elo into human_elo from field_private.players where user_id=ids[1];
 if human_elo<=500 or (select elo from field_private.players where user_id=bot)>=bot_elo then raise exception 'ELO did not move'; end if; execute 'set local role authenticated';
 -- Rematch: the bot accepts at once.
 r:=public.field_online('rematch',jsonb_build_object('lobbyId',room));
 if r->'lobby'->>'state'<>'playing' or r->'lobby'->>'id'=room::text or (r->'lobby'->'matches'->0->>'p1')::uuid<>ids[1] then raise exception 'Bot rematch failed: %',r->'lobby'; end if;
 perform public.field_online('leave',jsonb_build_object('lobbyId',(r->'lobby'->>'id')::uuid));

 -- Names: unique ignoring case; search finds bots, the leaderboard does not list them.
 perform set_config('request.jwt.claim.sub',ids[4]::text,true);
 r:=public.field_online('username_available',jsonb_build_object('username',lower(bot_name)));
 if (r->>'available')::boolean then raise exception 'Bot name available in lowercase'; end if;
 r:=public.field_online('search',jsonb_build_object('query',lower(bot_name)));
 if r->0->>'id'<>bot::text then raise exception 'Bot not found by search: %',r; end if;
 r:=public.field_online('profile',jsonb_build_object('username',lower(bot_name)));
 if r->>'id'<>bot::text or (r->>'played')::int<1 then raise exception 'Bot profile missing: %',r; end if;
 if public.field_online('leaderboard','{}')::text like '%'||bot_name||'%' then raise exception 'Bot in leaderboard'; end if;

 -- A bot near that ELO that is not playing is reused.
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 execute 'reset role'; update field_private.players set elo=human_elo where user_id=ids[2]; update field_private.players set elo=human_elo-45 where user_id=bot; execute 'set local role authenticated';
 execute 'reset role'; n:=(select count(*) from field_private.players where is_bot); execute 'set local role authenticated';
 r:=public.field_online('queue','{"kind":"quick"}'); room:=(r->'lobby'->>'id')::uuid;
 execute 'reset role'; update field_private.lobbies set created_at=now()-interval '20 seconds' where id=room; execute 'set local role authenticated';
 r:=public.field_online('bots',jsonb_build_object('lobbyId',room));
 execute 'reset role'; if (select count(*) from field_private.players where is_bot)<>n or (r->'lobby'->'matches'->0->>'p2')::uuid<>bot then raise exception 'Bot not reused'; end if; execute 'set local role authenticated';
 perform public.field_online('leave',jsonb_build_object('lobbyId',room));

 -- 2v2 ranked with two humans: two bots, the left team has a human who hosts.
 perform set_config('request.jwt.claim.sub',ids[3]::text,true);
 r:=public.field_online('queue','{"kind":"ranked","size":4}'); room:=(r->'lobby'->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',ids[4]::text,true);
 r:=public.field_online('queue','{"kind":"ranked","size":4}');
 execute 'reset role'; update field_private.lobbies set created_at=now()-interval '20 seconds' where id=room; execute 'set local role authenticated';
 r:=public.field_online('bots',jsonb_build_object('lobbyId',room));
 if r->'lobby'->>'state'<>'playing' or jsonb_array_length(r->'lobby'->'players')<>4 then raise exception '2v2 did not start: %',r->'lobby'; end if;
 if (r->'lobby'->'matches'->0->>'p1')::uuid not in(ids[3],ids[4]) then raise exception '2v2 host is not human'; end if;
 game:=(r->'lobby'->'matches'->0->>'id')::uuid;
 -- Humans on both sides: both must report (the usual check). Same side: one report is enough.
 execute 'reset role'; n:=(select count(*) from field_private.matches where id=game and ids[3] in(p1,p3) and ids[4] in(p1,p3)); execute 'set local role authenticated';
 if n>0 then
  r:=public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',5,'opponentScore',1));
  if r->'lobby'->>'state'<>'finished' then raise exception '2v2 vs bots not settled'; end if;
 else
  r:=public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',5,'opponentScore',1));
  if r->'lobby'->>'state'<>'playing' then raise exception '2v2 settled with one human report'; end if;
  perform set_config('request.jwt.claim.sub',ids[3]::text,true);
  r:=public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',1,'opponentScore',5));
  if r->'lobby'->>'state'<>'finished' then raise exception '2v2 not settled'; end if;
 end if;

 -- Tournament of 8 with one human: seven bots; bot matches are settled at once.
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 r:=public.field_online('queue','{"kind":"tournament","size":8}'); room:=(r->'lobby'->>'id')::uuid;
 execute 'reset role'; update field_private.lobbies set created_at=now()-interval '20 seconds' where id=room; execute 'set local role authenticated';
 r:=public.field_online('bots',jsonb_build_object('lobbyId',room));
 if jsonb_array_length(r->'lobby'->'players')<>8 or r->'lobby'->>'state'<>'playing' then raise exception 'Tournament did not start'; end if;
 execute 'reset role'; if (select count(*) from field_private.matches where lobby_id=room and round=1 and state='finished')<>3 then raise exception 'Bot quarter-finals not settled'; end if; execute 'set local role authenticated';
 for i in 1..3 loop
  select * into t from jsonb_array_elements(public.field_online('poll',jsonb_build_object('lobbyId',room))->'lobby'->'matches') x where x->>'state'='playing' and ids[1]::text in(x->>'p1',x->>'p2') limit 1;
  exit when t is null;
  if (t->>'p1')::uuid<>ids[1] then raise exception 'Human not hosting against a bot'; end if;
  perform public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',(t->>'id')::uuid,'playerScore',5,'opponentScore',2));
 end loop;
 execute 'reset role'; select l.champion into winner from field_private.lobbies l where l.id=room;
 if winner is distinct from ids[1] then raise exception 'Tournament champion wrong: %',winner; end if;
end $$;
rollback;
