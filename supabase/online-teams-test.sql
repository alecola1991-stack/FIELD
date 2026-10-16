-- 2v2 and 4/6/8-player tournament test with temporary accounts; everything is rolled back.
-- Run after online.sql, online-rematch.sql and online-teams.sql.
begin;
do $$
declare ids uuid[]; prefix text:='qt_'||substr(replace(gen_random_uuid()::text,'-',''),1,7);
 r jsonb; room uuid; game uuid; code text; m jsonb; i integer; j integer; lefts uuid[]; rights uuid[]; host uuid; elo_before int; winners int; next_room uuid;
begin
 ids:=array(select gen_random_uuid() from generate_series(1,9));
 for i in 1..9 loop insert into auth.users(id) values(ids[i]); end loop;
 execute 'set local role authenticated';
 for i in 1..9 loop
  perform set_config('request.jwt.claim.sub',ids[i]::text,true);
  r:=public.field_online('claim_username',jsonb_build_object('username',prefix||i));
 end loop;
 if (r->>'version')::int<>2 then raise exception 'Version flag missing'; end if;

 -- Invalid sizes.
 begin perform public.field_online('queue','{"kind":"quick","size":3}'); raise exception 'Bad size accepted';
 exception when others then if sqlerrm='Bad size accepted' then raise; end if; end;
 begin perform public.field_online('queue','{"kind":"tournament","size":2}'); raise exception 'Bad tournament size accepted';
 exception when others then if sqlerrm='Bad tournament size accepted' then raise; end if; end;

 -- Public ranked 2v2: random 2-2 teams, one match with four players.
 for i in 1..4 loop
  perform set_config('request.jwt.claim.sub',ids[i]::text,true);
  r:=public.field_online('queue','{"kind":"ranked","size":4}');
  if i<4 and r->'lobby'->>'state'<>'waiting' then raise exception 'Ranked 2v2 started early'; end if;
 end loop;
 -- A 1v1 ranked search must not land in the 2v2 room.
 room:=(r->'lobby'->>'id')::uuid;
 if r->'lobby'->>'state'<>'playing' or (r->'lobby'->>'size')::int<>4 then raise exception 'Ranked 2v2 did not start'; end if;
 if (select count(*) from jsonb_array_elements(r->'lobby'->'players') p where p->>'team'='1')<>2 then raise exception 'Teams not 2-2'; end if;
 m:=r->'lobby'->'matches'->0; game:=(m->>'id')::uuid;
 if m->>'p3' is null or m->>'p4' is null then raise exception '2v2 match lacks teammates'; end if;
 lefts:=array[(m->>'p1')::uuid,(m->>'p3')::uuid]; rights:=array[(m->>'p2')::uuid,(m->>'p4')::uuid];
 if (select count(*) from jsonb_array_elements(r->'lobby'->'players') p where (p->>'id')::uuid=any(lefts) and p->>'team'='1')<>2 then raise exception 'Left team does not match team 1'; end if;
 perform set_config('request.jwt.claim.sub',lefts[2]::text,true);
 if not field_private.channel_access('field-v3-match-'||game) then raise exception 'Teammate blocked from channel'; end if;
 perform set_config('request.jwt.claim.sub',ids[9]::text,true);
 if field_private.channel_access('field-v3-match-'||game) then raise exception 'Outsider can join 2v2 channel'; end if;
 begin perform public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',5,'opponentScore',1)); raise exception 'Outsider report accepted';
 exception when others then if sqlerrm='Outsider report accepted' then raise; end if; end;
 -- Non-captains report for their teams; left wins 5-3.
 perform set_config('request.jwt.claim.sub',lefts[2]::text,true);
 r:=public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',5,'opponentScore',3));
 if r->'lobby'->>'state'<>'playing' then raise exception 'One team report settled the match'; end if;
 perform set_config('request.jwt.claim.sub',rights[2]::text,true);
 r:=public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',3,'opponentScore',5));
 if r->'lobby'->>'state'<>'finished' or (r->'lobby'->>'champion')::uuid<>lefts[1] then raise exception '2v2 not settled'; end if;
 if (r->'identity'->>'elo')::int<>484 or (r->'identity'->>'played')::int<>1 then raise exception 'Loser ELO wrong: %',r->'identity'; end if;
 execute 'set local role postgres';
 select count(*) into winners from field_private.players where user_id=any(lefts) and elo=516 and ranked_wins=1;
 if winners<>2 then raise exception 'Both winners must gain ELO'; end if;
 if (select count(*) from field_private.players where user_id=any(rights) and elo=484 and ranked_wins=0)<>2 then raise exception 'Both losers must lose ELO'; end if;
 execute 'set local role authenticated';

 -- 2v2 rematch needs all four votes and keeps the teams.
 for i in 1..4 loop
  perform set_config('request.jwt.claim.sub',(case i when 1 then lefts[1] when 2 then lefts[2] when 3 then rights[1] else rights[2] end)::text,true);
  r:=public.field_online('rematch',jsonb_build_object('lobbyId',room));
  if i<4 and (r->'lobby'->>'id')::uuid<>room then raise exception 'Rematch started before every vote'; end if;
 end loop;
 next_room:=(r->'lobby'->>'id')::uuid; m:=r->'lobby'->'matches'->0;
 if next_room=room or r->'lobby'->>'state'<>'playing' or r->'lobby'->>'kind'<>'ranked' then raise exception '2v2 rematch not started'; end if;
 if not (array[(m->>'p1')::uuid,(m->>'p3')::uuid] @> lefts and array[(m->>'p2')::uuid,(m->>'p4')::uuid] @> rights) then raise exception 'Rematch changed the teams'; end if;
 -- Leaving forfeits for the whole team: a right-side player leaves, left wins 5-0.
 perform set_config('request.jwt.claim.sub',rights[2]::text,true);
 perform public.field_online('leave',jsonb_build_object('lobbyId',next_room));
 perform set_config('request.jwt.claim.sub',lefts[1]::text,true);
 r:=public.field_online('poll',jsonb_build_object('lobbyId',next_room));
 if r->'lobby'->>'state'<>'finished' or (r->'lobby'->'matches'->0->>'score1')::int<>5 then raise exception 'Team forfeit failed'; end if;
 for i in 1..4 loop perform set_config('request.jwt.claim.sub',ids[i]::text,true); perform public.field_online('leave',jsonb_build_object('lobbyId',next_room)); end loop;

 -- Private quick 2v2: auto-balanced teams, switching, creator-only start.
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 r:=public.field_online('create','{"kind":"quick","size":4}'); room:=(r->'lobby'->>'id')::uuid; code:=r->'lobby'->>'code';
 for i in 2..4 loop
  perform set_config('request.jwt.claim.sub',ids[i]::text,true);
  r:=public.field_online('join',jsonb_build_object('kind','quick','code',code));
 end loop;
 if r->'lobby'->>'state'<>'waiting' then raise exception 'Private 2v2 started without the creator'; end if;
 if (select count(*) from jsonb_array_elements(r->'lobby'->'players') p where p->>'team'='2')<>2 then raise exception 'Private teams not balanced'; end if;
 begin perform public.field_online('start',jsonb_build_object('lobbyId',room)); raise exception 'Non-creator started';
 exception when others then if sqlerrm='Non-creator started' then raise; end if; end;
 -- Player 4 is on team 2 (join order 1,2,1,2 -> 1:1,2:2,3:1,4:2); team 1 is full.
 begin perform public.field_online('team',jsonb_build_object('lobbyId',room,'team',1)); raise exception 'Joined a full team';
 exception when others then if sqlerrm='Joined a full team' then raise; end if; end;
 -- Player 3 moves to team 2? Full as well. Player 2 moves to team 1 after player 3 leaves it.
 perform set_config('request.jwt.claim.sub',ids[3]::text,true);
 begin perform public.field_online('team',jsonb_build_object('lobbyId',room,'team',2)); raise exception 'Joined a full team 2';
 exception when others then if sqlerrm='Joined a full team 2' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 begin perform public.field_online('team',jsonb_build_object('lobbyId',room,'team',2)); raise exception 'Switch into full team';
 exception when others then if sqlerrm='Switch into full team' then raise; end if; end;
 r:=public.field_online('start',jsonb_build_object('lobbyId',room));
 m:=r->'lobby'->'matches'->0;
 if r->'lobby'->>'state'<>'playing' or (m->>'p1')::uuid<>ids[1] or (m->>'p3')::uuid<>ids[3] or (m->>'p2')::uuid<>ids[2] or (m->>'p4')::uuid<>ids[4] then raise exception 'Private 2v2 seats wrong: %',m; end if;
 -- Host disappears for 90 s: the host's team forfeits when a rival polls.
 execute 'set local role postgres';
 update field_private.members set last_seen=now()-interval '2 minutes' where lobby_id=room and user_id=ids[1];
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 elo_before:=(public.field_online('state')->'identity'->>'elo')::int;
 r:=public.field_online('poll',jsonb_build_object('lobbyId',room));
 if r->'lobby'->>'state'<>'finished' or (r->'lobby'->>'champion')::uuid<>ids[2] then raise exception 'Stale host did not forfeit'; end if;
 if (r->'identity'->>'elo')::int<>elo_before then raise exception 'Quick 2v2 changed ELO'; end if;
 for i in 1..4 loop perform set_config('request.jwt.claim.sub',ids[i]::text,true); perform public.field_online('leave',jsonb_build_object('lobbyId',room)); end loop;

 -- Six-player tournament: two quarterfinals, two byes, semifinals, final.
 for i in 1..6 loop
  perform set_config('request.jwt.claim.sub',ids[i]::text,true);
  r:=public.field_online('queue','{"kind":"tournament","size":6}');
 end loop;
 room:=(r->'lobby'->>'id')::uuid;
 if r->'lobby'->>'state'<>'playing' or jsonb_array_length(r->'lobby'->'matches')<>2 then raise exception '6-player tournament did not create 2 quarterfinals'; end if;
 if (select string_agg(p->>'round'||'.'||(p->>'position'),',' order by p->>'position') from jsonb_array_elements(r->'lobby'->'matches') p)<>'1.2,1.4' then raise exception 'Quarterfinal positions wrong'; end if;
 for j in 1..3 loop
  -- Play every open match: p1 wins.
  for m in select value from jsonb_array_elements(r->'lobby'->'matches') where value->>'state'='playing' loop
   perform set_config('request.jwt.claim.sub',m->>'p1',true);
   perform public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',m->>'id','playerScore',5,'opponentScore',2));
   perform set_config('request.jwt.claim.sub',m->>'p2',true);
   r:=public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',m->>'id','playerScore',2,'opponentScore',5));
  end loop;
  if j=1 and (jsonb_array_length(r->'lobby'->'matches')<>4 or (select count(*) from jsonb_array_elements(r->'lobby'->'matches') p where p->>'round'='2')<>2) then raise exception 'Semifinals with byes not created'; end if;
 end loop;
 if r->'lobby'->>'state'<>'finished' or jsonb_array_length(r->'lobby'->'matches')<>5 then raise exception '6-player tournament did not finish in 5 matches'; end if;
 if r->'lobby'->>'champion'<>(select p->>'winner' from jsonb_array_elements(r->'lobby'->'matches') p where p->>'round'='3') then raise exception 'Champion is not the final winner'; end if;
 for i in 1..6 loop perform set_config('request.jwt.claim.sub',ids[i]::text,true); perform public.field_online('leave',jsonb_build_object('lobbyId',room)); end loop;

 -- Eight-player private tournament: 4 quarterfinals, 2 semifinals, 1 final; a size-4 search does not enter it.
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 r:=public.field_online('create','{"kind":"tournament","size":8}'); room:=(r->'lobby'->>'id')::uuid; code:=r->'lobby'->>'code';
 perform set_config('request.jwt.claim.sub',ids[9]::text,true);
 r:=public.field_online('queue','{"kind":"tournament","size":4}');
 if (r->'lobby'->>'id')::uuid=room then raise exception 'Size-4 search joined an 8-player room'; end if;
 perform public.field_online('leave',jsonb_build_object('lobbyId',r->'lobby'->>'id'));
 for i in 2..8 loop
  perform set_config('request.jwt.claim.sub',ids[i]::text,true);
  r:=public.field_online('join',jsonb_build_object('kind','tournament','code',code));
  if i<8 and r->'lobby'->>'state'<>'waiting' then raise exception '8-player tournament started early'; end if;
 end loop;
 if jsonb_array_length(r->'lobby'->'matches')<>4 then raise exception 'Expected 4 quarterfinals'; end if;
 -- Player in quarterfinal 1 (slot 1) leaves: rival advances; others play.
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 perform public.field_online('leave',jsonb_build_object('lobbyId',room));
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 r:=public.field_online('poll',jsonb_build_object('lobbyId',room));
 for j in 1..3 loop
  for m in select value from jsonb_array_elements(r->'lobby'->'matches') where value->>'state'='playing' loop
   perform set_config('request.jwt.claim.sub',m->>'p2',true);
   perform public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',m->>'id','playerScore',5,'opponentScore',4));
   perform set_config('request.jwt.claim.sub',m->>'p1',true);
   r:=public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',m->>'id','playerScore',4,'opponentScore',5));
  end loop;
 end loop;
 if r->'lobby'->>'state'<>'finished' or jsonb_array_length(r->'lobby'->'matches')<>7 then raise exception '8-player tournament did not finish in 7 matches: %',r->'lobby'->>'state'; end if;
 if (r->'lobby'->>'champion')::uuid<>ids[8] then raise exception 'Wrong 8-player champion'; end if;
 raise notice 'ONLINE TEAMS TEST PASSED';
end $$;
rollback;
