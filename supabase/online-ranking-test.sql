-- Ranked ladder with bots. Everything is rolled back. Run after online-ranking.sql.
begin;
do $$
declare me uuid:=gen_random_uuid(); r jsonb; bot uuid; before integer; changed integer; n integer;
begin
 insert into auth.users(id) values(me);
 -- 300 anchored bots: pyramid from ~1200 to under 300.
 select count(*) into n from field_private.players where is_bot and ladder_target is not null;
 if n<300 then raise exception 'Expected 300 ladder bots, got %',n; end if;
 if (select max(elo) from field_private.players where ladder_target is not null)<1150 or (select min(elo) from field_private.players where ladder_target is not null)>300 then raise exception 'ELO range off'; end if;
 if (select count(*) from field_private.players where ladder_target is not null and elo>=1000)>12 then raise exception 'Too many at the top'; end if;
 if exists(select 1 from field_private.players where ladder_target is not null and (ranked_wins>ranked_played or ranked_wins<0)) then raise exception 'Bad record'; end if;
 if field_private.seed_ladder(300)<>0 then raise exception 'Seeding twice'; end if;
 -- Names: no two bots share the same letters, and no format dominates.
 if (select count(*)<>count(distinct regexp_replace(lower(username),'[^a-z]','','g')) from field_private.players where is_bot) then raise exception 'Bots look alike'; end if;
 if (select count(*) from field_private.players where lower(username) like 'soydel%')>8 or (select count(*) from field_private.players where lower(username) like 'thereal%')>8 then raise exception 'One format dominates'; end if;
 if exists(select 1 from field_private.players where is_bot and username !~ '^[A-Za-z0-9_]{3,20}$') then raise exception 'Bad bot username'; end if;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',me::text,true);
 r:=public.field_online('claim_username',jsonb_build_object('username','qr'||substr(replace(me::text,'-',''),1,8)));
 if (r->>'version')::int<8 then raise exception 'Version 8 expected'; end if;
 -- Leaderboard: top 100, total and my place.
 r:=public.field_online('leaderboard','{}');
 if jsonb_array_length(r->'rows')<>100 then raise exception 'Top 100 expected: %',jsonb_array_length(r->'rows'); end if;
 if (r->>'total')::int<301 then raise exception 'Total missing'; end if;
 if (r->'rows'->0->>'elo')::int<(r->'rows'->99->>'elo')::int then raise exception 'Not sorted'; end if;
 if r->'me'->>'username' is null or (r->'me'->>'position')::int not between 2 and (r->>'total')::int then raise exception 'My place: %',r->'me'; end if;
 if (r->'me'->>'position')::int<>1+(select count(*) from jsonb_array_elements(r->'rows') x where (x->>'elo')::int>500) and (r->'me'->>'position')::int<=100 then raise exception 'Position mismatch'; end if;
 -- A bot profile has ten recent games, a team and friends.
 bot:=(r->'rows'->5->>'id')::uuid;
 r:=public.field_online('profile',jsonb_build_object('userId',bot));
 if jsonb_array_length(r->'recent')<>10 then raise exception 'Bot history: %',r->'recent'; end if;
 if r->'profile'->>'teamId' is null then raise exception 'Bot team missing'; end if;
 if (r->'online'->>'played')::int<(r->>'played')::int then raise exception 'Casual games missing'; end if;
 -- Stable within the day.
 if r->'recent'<>(public.field_online('profile',jsonb_build_object('userId',bot)))->'recent' then raise exception 'History not stable'; end if;
 -- Daily drift: going back three days makes bots play.
 execute 'reset role';
 select sum(ranked_played) into before from field_private.players where ladder_target is not null;
 update field_private.ladder_state set day=current_date-3;
 execute 'set local role authenticated';
 perform public.field_online('leaderboard','{}');
 execute 'reset role';
 select sum(ranked_played)-before into changed from field_private.players where ladder_target is not null;
 if changed<150 then raise exception 'Drift too small: % games',changed; end if;
 if (select day from field_private.ladder_state)<>current_date then raise exception 'Day not stored'; end if;
 if exists(select 1 from field_private.players where ladder_target is not null and (elo<250 or elo>1250 or ranked_wins>ranked_played)) then raise exception 'Drift out of bounds'; end if;
 -- Same day: no more drift.
 select sum(ranked_played) into before from field_private.players where ladder_target is not null;
 execute 'set local role authenticated'; perform public.field_online('leaderboard','{}'); execute 'reset role';
 if (select sum(ranked_played) from field_private.players where ladder_target is not null)<>before then raise exception 'Drift ran twice'; end if;
end $$;
rollback;
