-- Identity, social actions, matchmaking and four-player tournaments.
-- Only the authenticated RPC is exposed; clients cannot write ratings or participants.
create schema if not exists field_private;
revoke all on schema field_private from public, anon;
grant usage on schema field_private to authenticated;
create table field_private.players (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
 elo integer not null default 500 check (elo>=0), ranked_played integer not null default 0, ranked_wins integer not null default 0
);
create index players_rank_idx on field_private.players(elo desc,ranked_wins desc,username);
create table field_private.friends (
 a uuid not null references field_private.players(user_id) on delete cascade,
 b uuid not null references field_private.players(user_id) on delete cascade,
 requested_by uuid not null, accepted boolean not null default false, created_at timestamptz not null default now(),
 primary key(a,b), check(a<b), check(requested_by in(a,b))
);
create index friends_requested_idx on field_private.friends(requested_by) where not accepted;
create index friends_b_idx on field_private.friends(b);
create table field_private.lobbies (
 id uuid primary key default gen_random_uuid(), code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
 kind text not null check(kind in('quick','ranked','tournament')), is_public boolean not null,
 host_id uuid not null references field_private.players(user_id), state text not null default 'waiting' check(state in('waiting','playing','finished','cancelled')),
 created_at timestamptz not null default now(), champion uuid references field_private.players(user_id)
);
create index lobbies_queue_idx on field_private.lobbies(kind,created_at) where state='waiting' and is_public;
create table field_private.members (
 lobby_id uuid references field_private.lobbies(id) on delete cascade, user_id uuid references field_private.players(user_id) on delete cascade,
 slot integer not null check(slot between 1 and 4), active boolean not null default true, profile jsonb not null default '{}', last_seen timestamptz not null default now(),
 primary key(lobby_id,user_id), unique(lobby_id,slot)
);
create index members_user_idx on field_private.members(user_id);
create table field_private.matches (
 id uuid primary key default gen_random_uuid(), lobby_id uuid not null references field_private.lobbies(id) on delete cascade,
 round integer not null, position integer not null, p1 uuid not null references field_private.players(user_id), p2 uuid not null references field_private.players(user_id),
 state text not null default 'playing' check(state in('playing','finished','disputed')), report1 jsonb, report2 jsonb,
 score1 integer, score2 integer, winner uuid references field_private.players(user_id), elo_delta integer, created_at timestamptz not null default now(),
 unique(lobby_id,round,position), check(p1<>p2)
);
create index matches_p1_idx on field_private.matches(p1);
create index matches_p2_idx on field_private.matches(p2);
create table field_private.invites (
 id uuid primary key default gen_random_uuid(), sender uuid not null references field_private.players(user_id), recipient uuid not null references field_private.players(user_id),
 lobby_id uuid not null references field_private.lobbies(id) on delete cascade, state text not null default 'pending' check(state in('pending','accepted','declined','expired')),
 created_at timestamptz not null default now(), check(sender<>recipient)
);
create index invites_recipient_idx on field_private.invites(recipient,created_at);
create index invites_sender_idx on field_private.invites(sender,created_at);
alter table field_private.players enable row level security;
alter table field_private.friends enable row level security;
alter table field_private.lobbies enable row level security;
alter table field_private.members enable row level security;
alter table field_private.matches enable row level security;
alter table field_private.invites enable row level security;
revoke all on all tables in schema field_private from public,anon,authenticated;

create function field_private.room_data(room_id uuid) returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('id',l.id,'code',l.code,'kind',l.kind,'public',l.is_public,'state',l.state,'champion',l.champion,
 'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'username',p.username,'elo',p.elo,'slot',m.slot,'active',m.active,'profile',m.profile) order by m.slot) from field_private.members m join field_private.players p on p.user_id=m.user_id where m.lobby_id=l.id),'[]'::jsonb),
 'matches',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'round',g.round,'position',g.position,'p1',g.p1,'p2',g.p2,'state',g.state,'winner',g.winner,'score1',g.score1,'score2',g.score2,'eloDelta',g.elo_delta,'reported1',g.report1 is not null,'reported2',g.report2 is not null) order by g.round,g.position) from field_private.matches g where g.lobby_id=l.id),'[]'::jsonb))
 from field_private.lobbies l where l.id=room_id;
$$;
create function field_private.finish_match(match_key uuid, first_score integer, second_score integer) returns void language plpgsql set search_path='' as $$
declare g field_private.matches; l field_private.lobbies; winner_id uuid; r1 integer; r2 integer; delta integer; final1 uuid; final2 uuid; final_game uuid; first_active boolean; second_active boolean;
begin
 select * into g from field_private.matches where id=match_key for update;
 if g.state='finished' then return; end if;
 select * into l from field_private.lobbies where id=g.lobby_id for update;
 winner_id:=case when first_score>second_score then g.p1 else g.p2 end;
 if l.kind='ranked' then
  perform 1 from field_private.players where user_id in(g.p1,g.p2) order by user_id for update;
  select elo into r1 from field_private.players where user_id=g.p1;
  select elo into r2 from field_private.players where user_id=g.p2;
  delta:=round(32*((case when winner_id=g.p1 then 1 else 0 end)-1/(1+power(10::numeric,(r2-r1)/400::numeric))));
  update field_private.players set elo=greatest(0,elo+delta),ranked_played=ranked_played+1,ranked_wins=ranked_wins+case when winner_id=user_id then 1 else 0 end where user_id=g.p1;
  update field_private.players set elo=greatest(0,elo-delta),ranked_played=ranked_played+1,ranked_wins=ranked_wins+case when winner_id=user_id then 1 else 0 end where user_id=g.p2;
 end if;
 update field_private.matches set state='finished',score1=first_score,score2=second_score,winner=winner_id,elo_delta=delta where id=g.id;
 if l.kind<>'tournament' or g.round=2 then
  update field_private.lobbies set state='finished',champion=winner_id where id=l.id;
 else
  select winner into final1 from field_private.matches where lobby_id=l.id and round=1 and position=1 and state='finished';
  select winner into final2 from field_private.matches where lobby_id=l.id and round=1 and position=2 and state='finished';
  if final1 is not null and final2 is not null then
   insert into field_private.matches(lobby_id,round,position,p1,p2) values(l.id,2,1,final1,final2) on conflict do nothing;
   select id into final_game from field_private.matches where lobby_id=l.id and round=2 and position=1;
   select active into first_active from field_private.members where lobby_id=l.id and user_id=final1;
   select active into second_active from field_private.members where lobby_id=l.id and user_id=final2;
   if not first_active and not second_active then update field_private.lobbies set state='cancelled' where id=l.id;
   elsif not first_active then perform field_private.finish_match(final_game,0,5);
   elsif not second_active then perform field_private.finish_match(final_game,5,0); end if;
  end if;
 end if;
end; $$;
create function field_private.launch_room(room_id uuid) returns void language plpgsql set search_path='' as $$
declare l field_private.lobbies; players uuid[]; capacity integer;
begin
 select * into l from field_private.lobbies where id=room_id for update;
 capacity:=case when l.kind='tournament' then 4 else 2 end;
 select array_agg(user_id order by slot) into players from field_private.members where lobby_id=l.id;
 if l.state<>'waiting' or coalesce(array_length(players,1),0)<>capacity then return; end if;
 update field_private.lobbies set state='playing' where id=l.id;
 insert into field_private.matches(lobby_id,round,position,p1,p2) values(l.id,1,1,players[1],players[2]);
 if capacity=4 then insert into field_private.matches(lobby_id,round,position,p1,p2) values(l.id,1,2,players[3],players[4]); end if;
end; $$;
create function field_private.channel_access(topic text) returns boolean language sql security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from field_private.matches where id=case when topic ~ '^field-v3-match-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then substring(topic from 16)::uuid else null end and (select auth.uid()) in(p1,p2) and state='playing');
$$;

create function field_private.action(command text, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); target uuid; name text; rid uuid; existing uuid; l field_private.lobbies; g field_private.matches; inv field_private.invites;
 capacity integer; num integer; lobby_kind text; state_data jsonb; first_score integer; second_score integer; opponent uuid; first_profile jsonb;
begin
 if uid is null then raise exception 'Inicia sesión para usar el online.'; end if;
 if command='claim_username' then
  name:=lower(trim(payload->>'username'));
  if name is null or name !~ '^[a-z0-9_]{3,20}$' then raise exception 'Usa entre 3 y 20 letras, números o guiones bajos.'; end if;
  if exists(select 1 from field_private.players where user_id=uid) then raise exception 'Ya tienes un nombre de usuario.'; end if;
  begin insert into field_private.players(user_id,username) values(uid,name); exception when unique_violation then raise exception 'Ese nombre de usuario ya está ocupado.'; end;
 elsif command='username_available' then
  name:=lower(trim(payload->>'username'));
  return jsonb_build_object('available',name ~ '^[a-z0-9_]{3,20}$' and not exists(select 1 from field_private.players where username=name));
 end if;
 if not exists(select 1 from field_private.players where user_id=uid) then return jsonb_build_object('identity',null,'friends','[]'::jsonb,'invites','[]'::jsonb,'lobby',null); end if;
 -- Serialize each user's mutations and each queue/room admission.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
 if command='friend_request' then
  select user_id into target from field_private.players where username=lower(trim(payload->>'username'));
  if target is null then raise exception 'No existe ese nombre de usuario.'; end if;
  if target=uid then raise exception 'No puedes añadirte a ti mismo.'; end if;
  if (select count(*) from field_private.friends where requested_by=uid and not accepted)>50 then raise exception 'Tienes demasiadas solicitudes pendientes.'; end if;
  insert into field_private.friends(a,b,requested_by) values(least(uid,target),greatest(uid,target),uid) on conflict do nothing;
 elsif command in('friend_accept','friend_decline','friend_remove') then
  target:=(payload->>'userId')::uuid;
  if command='friend_accept' then update field_private.friends set accepted=true where a=least(uid,target) and b=greatest(uid,target) and requested_by<>uid;
  else delete from field_private.friends where a=least(uid,target) and b=greatest(uid,target) and (command='friend_remove' or requested_by<>uid); end if;
 elsif command in('queue','create','join','invite') then
  lobby_kind:=coalesce(payload->>'kind','quick');
  if lobby_kind not in('quick','ranked','tournament') or (lobby_kind='ranked' and command<>'queue') then raise exception 'Modo de juego inválido.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('field-queue-'||lobby_kind,2));
  -- Clear abandoned waiting seats; active matches retain their participants.
  delete from field_private.members m using field_private.lobbies q where m.lobby_id=q.id and q.state='waiting' and m.last_seen<now()-interval '45 seconds';
  update field_private.lobbies q set state='cancelled' where q.state='waiting' and not exists(select 1 from field_private.members m where m.lobby_id=q.id);
  select q.id into existing from field_private.lobbies q join field_private.members m on m.lobby_id=q.id where m.user_id=uid and m.active and q.state in('waiting','playing') limit 1;
  if existing is not null then raise exception 'Ya estás en una sala. Sal de ella antes de buscar otra.'; end if;
  capacity:=case when lobby_kind='tournament' then 4 else 2 end;
  if command='join' then
   select * into l from field_private.lobbies where code=upper(trim(payload->>'code')) and not is_public and state='waiting' for update;
   if l.id is null then raise exception 'Código no encontrado o sala ya iniciada.'; end if;
   if l.kind<>lobby_kind then raise exception 'El código corresponde a otro modo de juego.'; end if;
  elsif command='queue' then
   select * into l from field_private.lobbies q where q.kind=lobby_kind and q.is_public and q.state='waiting' and (select count(*) from field_private.members m where m.lobby_id=q.id)<capacity order by q.created_at for update limit 1;
  end if;
  if l.id is null then insert into field_private.lobbies(kind,is_public,host_id) values(lobby_kind,command='queue',uid) returning * into l; end if;
  rid:=l.id;
  select s into num from generate_series(1,capacity) s where not exists(select 1 from field_private.members where lobby_id=rid and slot=s) order by s limit 1;
  if num is null then raise exception 'La sala está llena.'; end if;
  first_profile:=jsonb_build_object('name',left(coalesce(payload->'profile'->>'name','JUGADOR'),16),'number',least(99,greatest(0,coalesce((payload->'profile'->>'number')::integer,10))), 'teamId',left(coalesce(payload->'profile'->>'teamId',''),60),'level',least(100,greatest(1,coalesce((payload->'profile'->>'level')::integer,1))));
  insert into field_private.members(lobby_id,user_id,slot,profile) values(rid,uid,num,first_profile);
  if command='invite' then
   target:=(payload->>'userId')::uuid;
   if not exists(select 1 from field_private.friends where a=least(uid,target) and b=greatest(uid,target) and accepted) then raise exception 'Solo puedes invitar a tus amigos.'; end if;
   if lobby_kind<>'quick' then raise exception 'Las invitaciones directas son a un partido rápido privado.'; end if;
   insert into field_private.invites(sender,recipient,lobby_id) values(uid,target,rid);
  end if;
  perform field_private.launch_room(rid);
 elsif command in('invite_accept','invite_decline') then
  select * into inv from field_private.invites where id=(payload->>'inviteId')::uuid and recipient=uid and state='pending' for update;
  if inv.id is null or inv.created_at<now()-interval '5 minutes' then raise exception 'Esta invitación ha caducado.'; end if;
  select * into l from field_private.lobbies where id=inv.lobby_id and state='waiting' for update;
  if l.id is null then raise exception 'La sala ya no está disponible.'; end if;
  if command='invite_accept' then
   if exists(select 1 from field_private.members m join field_private.lobbies q on q.id=m.lobby_id where m.user_id=uid and m.active and q.state in('waiting','playing')) then raise exception 'Sal de tu sala actual antes de aceptar.'; end if;
   if not exists(select 1 from field_private.members where lobby_id=l.id and user_id=inv.sender and last_seen>now()-interval '45 seconds') then raise exception 'Tu amigo ya no está esperando.'; end if;
   insert into field_private.members(lobby_id,user_id,slot,profile) values(l.id,uid,2,coalesce(payload->'profile','{}'));
   update field_private.invites set state='accepted' where id=inv.id;
   rid:=l.id; perform field_private.launch_room(rid);
  else update field_private.invites set state='declined' where id=inv.id; update field_private.lobbies set state='cancelled' where id=l.id; end if;
 elsif command in('poll','leave','report') then
  rid:=nullif(payload->>'lobbyId','')::uuid;
  if rid is not null then
   select * into l from field_private.lobbies where id=rid for update;
   if not exists(select 1 from field_private.members where lobby_id=rid and user_id=uid) then raise exception 'No perteneces a esta sala.'; end if;
   update field_private.members set last_seen=now() where lobby_id=rid and user_id=uid;
   if command='report' then
    select * into g from field_private.matches where id=(payload->>'matchId')::uuid and lobby_id=rid and uid in(p1,p2) for update;
    if g.id is null then raise exception 'No perteneces a este partido.'; end if;
    first_score:=(payload->>'playerScore')::integer; second_score:=(payload->>'opponentScore')::integer;
    if first_score is null or second_score is null or first_score<0 or second_score<0 or first_score>5 or second_score>5 or greatest(first_score,second_score)<>5 or first_score=second_score then raise exception 'Marcador inválido.'; end if;
    if g.state='playing' then
     if uid=g.p1 then update field_private.matches set report1=jsonb_build_array(first_score,second_score) where id=g.id and report1 is null;
     else update field_private.matches set report2=jsonb_build_array(second_score,first_score) where id=g.id and report2 is null; end if;
     select * into g from field_private.matches where id=g.id;
     if g.report1 is not null and g.report2 is not null then
      if g.report1=g.report2 then perform field_private.finish_match(g.id,(g.report1->>0)::integer,(g.report1->>1)::integer);
      else update field_private.matches set state='disputed' where id=g.id; update field_private.lobbies set state='cancelled' where id=rid; end if;
     end if;
    end if;
   elsif command='leave' then
    if l.state='waiting' then
     delete from field_private.members where lobby_id=rid and user_id=uid;
     if not l.is_public or not exists(select 1 from field_private.members where lobby_id=rid) then update field_private.lobbies set state='cancelled' where id=rid; end if;
    else
     for g in select * from field_private.matches where lobby_id=rid and state='playing' and uid in(p1,p2) loop
      perform field_private.finish_match(g.id,case when uid=g.p1 then 0 else 5 end,case when uid=g.p2 then 0 else 5 end);
     end loop;
    end if;
    update field_private.members set active=false where lobby_id=rid and user_id=uid;
    update field_private.invites set state='expired' where lobby_id=rid and state='pending';
   elsif l.state='playing' then
    for g in select * from field_private.matches where lobby_id=rid and state='playing' and uid in(p1,p2) loop
     opponent:=case when uid=g.p1 then g.p2 else g.p1 end;
     if exists(select 1 from field_private.members where lobby_id=rid and user_id=opponent and last_seen<now()-interval '90 seconds') then
      perform field_private.finish_match(g.id,case when uid=g.p1 then 5 else 0 end,case when uid=g.p2 then 5 else 0 end);
     end if;
    end loop;
   end if;
  end if;
 elsif command='leaderboard' then
  return coalesce((select jsonb_agg(to_jsonb(p)) from(select username,elo,ranked_played,ranked_wins from field_private.players order by elo desc,ranked_wins desc,username limit 50)p),'[]'::jsonb);
 elsif command not in('state','claim_username') then raise exception 'Acción desconocida.';
 end if;
 update field_private.invites set state='expired' where state='pending' and created_at<now()-interval '5 minutes' and uid in(sender,recipient);
 if rid is null and command<>'leave' then select q.id into rid from field_private.lobbies q join field_private.members m on m.lobby_id=q.id where m.user_id=uid and m.active and q.state in('waiting','playing') order by q.created_at desc limit 1; end if;
 return jsonb_build_object('identity',(select jsonb_build_object('id',user_id,'username',username,'elo',elo,'played',ranked_played,'wins',ranked_wins) from field_private.players where user_id=uid),
 'friends',coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'username',p.username,'elo',p.elo,'accepted',f.accepted,'incoming',f.requested_by<>uid)) from field_private.friends f join field_private.players p on p.user_id=case when f.a=uid then f.b else f.a end where uid in(f.a,f.b)),'[]'::jsonb),
 'invites',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'sender',i.sender,'recipient',i.recipient,'username',p.username,'state',i.state,'lobbyId',i.lobby_id,'incoming',i.recipient=uid)) from field_private.invites i join field_private.players p on p.user_id=case when i.sender=uid then i.recipient else i.sender end where uid in(i.sender,i.recipient) and i.created_at>now()-interval '5 minutes'),'[]'::jsonb),
 'lobby',case when command='leave' then null else field_private.room_data(rid) end);
end; $$;

create function public.field_online(action text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select field_private.action(action,payload); $$;
revoke all on all functions in schema field_private from public,anon,authenticated;
grant execute on function field_private.action(text,jsonb) to authenticated;
grant execute on function field_private.channel_access(text) to authenticated;
revoke all on function public.field_online(text,jsonb) from public,anon;
grant execute on function public.field_online(text,jsonb) to authenticated;
create policy field_match_read on realtime.messages for select to authenticated using(field_private.channel_access((select realtime.topic())));
create policy field_match_write on realtime.messages for insert to authenticated with check(field_private.channel_access((select realtime.topic())));
notify pgrst,'reload schema';
