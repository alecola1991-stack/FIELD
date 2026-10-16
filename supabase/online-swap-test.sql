-- Team swap test with temporary accounts; everything is rolled back.
-- Run after online.sql, online-rematch.sql, online-teams.sql and online-swap.sql.
begin;
do $$
declare ids uuid[]; prefix text:='qs_'||substr(replace(gen_random_uuid()::text,'-',''),1,7); r jsonb; room uuid; code text; i integer;
begin
 ids:=array(select gen_random_uuid() from generate_series(1,5));
 for i in 1..5 loop insert into auth.users(id) values(ids[i]); end loop;
 execute 'set local role authenticated';
 for i in 1..5 loop perform set_config('request.jwt.claim.sub',ids[i]::text,true); r:=public.field_online('claim_username',jsonb_build_object('username',prefix||i)); end loop;
 if (r->>'version')::int<3 then raise exception 'Version 3 expected'; end if;
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 r:=public.field_online('create','{"kind":"quick","size":4}'); room:=(r->'lobby'->>'id')::uuid; code:=r->'lobby'->>'code';
 for i in 2..4 loop perform set_config('request.jwt.claim.sub',ids[i]::text,true); r:=public.field_online('join',jsonb_build_object('kind','quick','code',code)); end loop;
 -- Teams: 1,3 vs 2,4. Player 3 swaps with player 4.
 perform set_config('request.jwt.claim.sub',ids[3]::text,true);
 begin perform public.field_online('team',jsonb_build_object('lobbyId',room,'team',2)); raise exception 'Full team accepted';
 exception when others then if sqlerrm='Full team accepted' then raise; end if; end;
 begin perform public.field_online('team',jsonb_build_object('lobbyId',room,'swapWith',ids[1])); raise exception 'Same-team swap accepted';
 exception when others then if sqlerrm='Same-team swap accepted' then raise; end if; end;
 begin perform public.field_online('team',jsonb_build_object('lobbyId',room,'swapWith',ids[5])); raise exception 'Outsider swap accepted';
 exception when others then if sqlerrm='Outsider swap accepted' then raise; end if; end;
 r:=public.field_online('team',jsonb_build_object('lobbyId',room,'swapWith',ids[4]));
 if (select string_agg(p->>'team',',' order by (p->>'slot')::int) from jsonb_array_elements(r->'lobby'->'players') p)<>'1,2,2,1' then raise exception 'Swap failed: %',r->'lobby'->'players'; end if;
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 r:=public.field_online('start',jsonb_build_object('lobbyId',room));
 if (r->'lobby'->'matches'->0->>'p3')::uuid<>ids[4] or (r->'lobby'->'matches'->0->>'p4')::uuid<>ids[3] then raise exception 'Swapped teams not used: %',r->'lobby'->'matches'->0; end if;
 raise notice 'ONLINE SWAP TEST PASSED';
end $$;
rollback;
