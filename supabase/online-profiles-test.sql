-- Search and public profile test with temporary accounts; everything is rolled back.
-- Run after online.sql, online-rematch.sql, online-teams.sql, online-swap.sql and online-profiles.sql.
begin;
do $$
declare ids uuid[]; prefix text:='qp'||substr(replace(gen_random_uuid()::text,'-',''),1,6); r jsonb; room uuid; game uuid; i integer;
begin
 ids:=array(select gen_random_uuid() from generate_series(1,3));
 for i in 1..3 loop insert into auth.users(id) values(ids[i]); end loop;
 execute 'set local role authenticated';
 for i in 1..3 loop perform set_config('request.jwt.claim.sub',ids[i]::text,true); r:=public.field_online('claim_username',jsonb_build_object('username',prefix||'_'||i)); end loop;
 if (r->>'version')::int<4 then raise exception 'Version 4 or later expected'; end if;
 -- Search: prefix, never yourself, friendship state, short queries return nothing.
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 r:=public.field_online('search',jsonb_build_object('query',upper(prefix)));
 if jsonb_array_length(r)<>2 or r::text like '%'||ids[1]||'%' then raise exception 'Search wrong: %',r; end if;
 if public.field_online('search','{"query":"q"}')<>'[]'::jsonb then raise exception 'Short query returned results'; end if;
 if jsonb_array_length(public.field_online('search',jsonb_build_object('query',prefix||'_3')))<>1 then raise exception 'Exact search failed'; end if;
 perform public.field_online('friend_request',jsonb_build_object('username',prefix||'_2'));
 r:=public.field_online('search',jsonb_build_object('query',prefix||'_2'));
 if r->0->>'friend'<>'sent' then raise exception 'Friend state not sent: %',r; end if;
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 r:=public.field_online('profile',jsonb_build_object('username',prefix||'_1'));
 if r->>'friend'<>'received' or (r->>'me')::boolean then raise exception 'Profile friendship wrong: %',r; end if;
 perform public.field_online('friend_accept',jsonb_build_object('userId',ids[1]));
 -- A ranked match between 1 and 2: the profile shows the result and ELO change.
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 r:=public.field_online('queue','{"kind":"ranked"}'); room:=(r->'lobby'->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 r:=public.field_online('queue','{"kind":"ranked"}'); game:=(r->'lobby'->'matches'->0->>'id')::uuid;
 perform public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',2,'opponentScore',5));
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 perform public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',5,'opponentScore',2));
 perform set_config('request.jwt.claim.sub',ids[3]::text,true);
 r:=public.field_online('profile',jsonb_build_object('userId',ids[1]));
 if (r->>'elo')::int<>516 or (r->'online'->>'wins')::int<>1 or (r->>'friends')::int<>1 or r->>'friend' is not null then raise exception 'Profile data wrong: %',r; end if;
 if jsonb_array_length(r->'recent')<>1 or not (r->'recent'->0->>'won')::boolean or (r->'recent'->0->>'elo')::int<>16 or (r->'recent'->0->>'for')::int<>5 then raise exception 'Recent results wrong: %',r->'recent'; end if;
 if r->'profile'->>'teamId' is null then raise exception 'Last profile missing'; end if;
 r:=public.field_online('profile',jsonb_build_object('userId',ids[2]));
 if (r->'recent'->0->>'won')::boolean or (r->'recent'->0->>'elo')::int<>-16 then raise exception 'Loser view wrong: %',r->'recent'; end if;
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 if not (public.field_online('profile',jsonb_build_object('userId',ids[1]))->>'me')::boolean then raise exception 'Own profile not flagged'; end if;
 begin perform public.field_online('profile','{"username":"nadie_existe_xyz"}'); raise exception 'Missing profile accepted';
 exception when others then if sqlerrm='Missing profile accepted' then raise; end if; end;
 raise notice 'ONLINE PROFILES TEST PASSED';
end $$;
rollback;
