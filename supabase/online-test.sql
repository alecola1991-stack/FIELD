begin;
do $$
declare ids uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()]; prefix text:='qa_'||substr(replace(gen_random_uuid()::text,'-',''),1,7); r jsonb; room uuid; game uuid; code text; matches jsonb; i integer;
begin
 for i in 1..5 loop insert into auth.users(id) values(ids[i]); end loop;
 execute 'set local role authenticated';
 for i in 1..4 loop
  perform set_config('request.jwt.claim.sub',ids[i]::text,true);
  r:=public.field_online('claim_username',jsonb_build_object('username',prefix||i));
  if r->'identity'->>'elo'<>'500' then raise exception 'Initial ELO is not 500'; end if;
 end loop;
 perform set_config('request.jwt.claim.sub',ids[5]::text,true);
 if public.field_online('state')->'identity'<>'null'::jsonb then raise exception 'Legacy account not gated'; end if;
 begin
  perform public.field_online('claim_username',jsonb_build_object('username',upper(prefix||1)));
  raise exception 'Duplicate name accepted';
 exception when others then if sqlerrm='Duplicate name accepted' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 begin execute 'update field_private.players set elo=9999'; raise exception 'Direct rating write allowed'; exception when insufficient_privilege then null; end;
 perform public.field_online('friend_request',jsonb_build_object('username',prefix||2));
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 r:=public.field_online('friend_accept',jsonb_build_object('userId',ids[1]));
 if not (r->'friends'->0->>'accepted')::boolean then raise exception 'Friend acceptance failed'; end if;
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 r:=public.field_online('invite',jsonb_build_object('kind','quick','userId',ids[2])); room:=(r->'lobby'->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 r:=public.field_online('state'); game:=(r->'invites'->0->>'id')::uuid;
 r:=public.field_online('invite_decline',jsonb_build_object('inviteId',game));
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 r:=public.field_online('poll',jsonb_build_object('lobbyId',room));
 if r->'lobby'->>'state'<>'cancelled' then raise exception 'Declined invitation remains active'; end if;
 r:=public.field_online('invite',jsonb_build_object('kind','quick','userId',ids[2])); room:=(r->'lobby'->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 r:=public.field_online('state');
 select (value->>'id')::uuid into game from jsonb_array_elements(r->'invites') where value->>'state'='pending';
 r:=public.field_online('invite_accept',jsonb_build_object('inviteId',game));
 if r->'lobby'->>'state'<>'playing' then raise exception 'Accepted invitation did not start match'; end if;
 perform public.field_online('leave',jsonb_build_object('lobbyId',room));
 -- Ranked pairing: two matching reports and one settlement only.
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 r:=public.field_online('queue','{"kind":"ranked"}'); room:=(r->'lobby'->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 r:=public.field_online('queue','{"kind":"ranked"}'); game:=(r->'lobby'->'matches'->0->>'id')::uuid;
 if (r->'lobby'->>'id')::uuid<>room then raise exception 'Queue did not pair users'; end if;
 perform set_config('request.jwt.claim.sub',ids[3]::text,true);
 if field_private.channel_access('field-v3-match-'||game) then raise exception 'Outsider can join private channel'; end if;
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 if not field_private.channel_access('field-v3-match-'||game) then raise exception 'Participant blocked from channel'; end if;
 r:=public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',5,'opponentScore',2));
 if r->'identity'->>'elo'<>'500' then raise exception 'Unconfirmed report changes ELO'; end if;
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 r:=public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',2,'opponentScore',5));
 if r->'identity'->>'elo'<>'484' then raise exception 'Loser ELO wrong'; end if;
 r:=public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',2,'opponentScore',5));
 if r->'identity'->>'played'<>'1' then raise exception 'Duplicate settlement'; end if;
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 r:=public.field_online('state'); if r->'identity'->>'elo'<>'516' then raise exception 'Winner ELO wrong'; end if;
 -- Four entrants, two simultaneous semifinals, one final, one champion.
 for i in 1..4 loop
  perform set_config('request.jwt.claim.sub',ids[i]::text,true);
  r:=public.field_online('queue','{"kind":"tournament"}');
 end loop;
 room:=(r->'lobby'->>'id')::uuid; matches:=r->'lobby'->'matches';
 if jsonb_array_length(matches)<>2 then raise exception 'Tournament did not create 2 semifinals'; end if;
 for i in 0..1 loop
  game:=(matches->i->>'id')::uuid;
  perform set_config('request.jwt.claim.sub',matches->i->>'p1',true);
  perform public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',5,'opponentScore',1));
  perform set_config('request.jwt.claim.sub',matches->i->>'p2',true);
  r:=public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',1,'opponentScore',5));
 end loop;
 if jsonb_array_length(r->'lobby'->'matches')<>3 then raise exception 'Final not generated'; end if;
 matches:=r->'lobby'->'matches'->2; game:=(matches->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',matches->>'p1',true);
 perform public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',5,'opponentScore',3));
 perform set_config('request.jwt.claim.sub',matches->>'p2',true);
 r:=public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',3,'opponentScore',5));
 if r->'lobby'->>'state'<>'finished' or r->'lobby'->>'champion'<>matches->>'p1' then raise exception 'Wrong tournament champion'; end if;
 -- Private codes select the correct mode and require all four tournament participants.
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 r:=public.field_online('create','{"kind":"quick"}'); room:=(r->'lobby'->>'id')::uuid; code:=r->'lobby'->>'code';
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 begin perform public.field_online('join',jsonb_build_object('kind','tournament','code',code)); raise exception 'Wrong mode code accepted'; exception when others then if sqlerrm='Wrong mode code accepted' then raise; end if; end;
 r:=public.field_online('join',jsonb_build_object('kind','quick','code',lower(code)));
 if r->'lobby'->>'state'<>'playing' then raise exception 'Private quick match failed'; end if;
 perform public.field_online('leave',jsonb_build_object('lobbyId',room));
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 r:=public.field_online('create','{"kind":"tournament"}'); room:=(r->'lobby'->>'id')::uuid; code:=r->'lobby'->>'code';
 for i in 2..4 loop
  perform set_config('request.jwt.claim.sub',ids[i]::text,true);
  r:=public.field_online('join',jsonb_build_object('kind','tournament','code',code));
  if i<4 and r->'lobby'->>'state'<>'waiting' then raise exception 'Tournament launched before four players'; end if;
 end loop;
 if jsonb_array_length(r->'lobby'->'matches')<>2 then raise exception 'Private tournament failed'; end if;
 perform set_config('request.jwt.claim.sub',ids[1]::text,true); perform public.field_online('leave',jsonb_build_object('lobbyId',room));
 r:=public.field_online('queue','{"kind":"quick"}');
 perform public.field_online('leave',jsonb_build_object('lobbyId',r->'lobby'->>'id'));
 perform set_config('request.jwt.claim.sub',ids[3]::text,true); perform public.field_online('leave',jsonb_build_object('lobbyId',room));
 perform set_config('request.jwt.claim.sub',ids[2]::text,true); r:=public.field_online('leave',jsonb_build_object('lobbyId',room));
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 r:=public.field_online('poll',jsonb_build_object('lobbyId',room));
 if r->'lobby'->>'state'<>'finished' or (r->'lobby'->>'champion')::uuid<>ids[4] then raise exception 'Tournament forfeits did not advance correctly'; end if;
 if r->'identity'->>'elo'<>'516' then raise exception 'Friendly tournament changed ELO'; end if;
 -- Discrepant Ranked reports do not award points.
 r:=public.field_online('queue','{"kind":"ranked"}'); room:=(r->'lobby'->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 r:=public.field_online('queue','{"kind":"ranked"}'); game:=(r->'lobby'->'matches'->0->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',ids[3]::text,true);
 begin perform public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',5,'opponentScore',1)); raise exception 'Outsider report accepted'; exception when others then if sqlerrm='Outsider report accepted' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 perform public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',5,'opponentScore',1));
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 r:=public.field_online('report',jsonb_build_object('lobbyId',room,'matchId',game,'playerScore',5,'opponentScore',1));
 if r->'lobby'->>'state'<>'cancelled' or r->'identity'->>'elo'<>'484' then raise exception 'Discrepant reports changed ranking'; end if;
 execute 'set local role postgres';
end $$;
select 'PASS: identities, unique names, friends, invites, permissions, ranked confirmation and four-player tournament' as verification;
rollback;
