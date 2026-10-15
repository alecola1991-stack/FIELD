-- Online rematch (quick and ranked). Run once in the SQL Editor AFTER online.sql.
-- Additive and backward compatible: two new columns with defaults, room_data
-- gains a `rematch` field and field_private.action gains the `rematch` command
-- (and redirects polls of a finished room to its rematch room).
alter table field_private.members add column if not exists rematch boolean not null default false;
alter table field_private.lobbies add column if not exists rematch_lobby uuid references field_private.lobbies(id) on delete set null;

create or replace function field_private.room_data(room_id uuid) returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('id',l.id,'code',l.code,'kind',l.kind,'public',l.is_public,'state',l.state,'champion',l.champion,
 'rematch',jsonb_build_object('next',l.rematch_lobby,'votes',coalesce((select jsonb_agg(m.user_id) from field_private.members m where m.lobby_id=l.id and m.rematch),'[]'::jsonb)),
 'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'username',p.username,'elo',p.elo,'slot',m.slot,'active',m.active,'profile',m.profile) order by m.slot) from field_private.members m join field_private.players p on p.user_id=m.user_id where m.lobby_id=l.id),'[]'::jsonb),
 'matches',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'round',g.round,'position',g.position,'p1',g.p1,'p2',g.p2,'state',g.state,'winner',g.winner,'score1',g.score1,'score2',g.score2,'eloDelta',g.elo_delta,'reported1',g.report1 is not null,'reported2',g.report2 is not null) order by g.round,g.position) from field_private.matches g where g.lobby_id=l.id),'[]'::jsonb))
 from field_private.lobbies l where l.id=room_id;
$$;

create or replace function field_private.action(command text, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
   elsif command='poll' and l.rematch_lobby is not null and exists(select 1 from field_private.members where lobby_id=l.rematch_lobby and user_id=uid) then
    rid:=l.rematch_lobby;
   elsif l.state='playing' then
    for g in select * from field_private.matches where lobby_id=rid and state='playing' and uid in(p1,p2) loop
     opponent:=case when uid=g.p1 then g.p2 else g.p1 end;
     if exists(select 1 from field_private.members where lobby_id=rid and user_id=opponent and last_seen<now()-interval '90 seconds') then
      perform field_private.finish_match(g.id,case when uid=g.p1 then 5 else 0 end,case when uid=g.p2 then 5 else 0 end);
     end if;
    end loop;
   end if;
  end if;
 elsif command='rematch' then
  -- Both players of a finished quick/ranked room ask for a rematch; the second
  -- vote creates a private room of the same kind with the same seats and
  -- starts it. Ranked rematches settle ELO like any other ranked match.
  rid:=nullif(payload->>'lobbyId','')::uuid;
  select * into l from field_private.lobbies where id=rid for update;
  if l.id is null or not exists(select 1 from field_private.members where lobby_id=rid and user_id=uid) then raise exception 'No perteneces a esta sala.'; end if;
  if l.rematch_lobby is not null then rid:=l.rematch_lobby;
  else
   if l.kind not in('quick','ranked') or l.state<>'finished' then raise exception 'La revancha solo está disponible al terminar un partido rápido o Ranked.'; end if;
   if exists(select 1 from field_private.members where lobby_id=rid and not active) then raise exception 'Tu rival ha salido de la sala.'; end if;
   if exists(select 1 from field_private.members m join field_private.lobbies q on q.id=m.lobby_id where m.user_id=uid and m.active and q.state in('waiting','playing')) then raise exception 'Ya estás en otra sala.'; end if;
   update field_private.members set rematch=true,last_seen=now() where lobby_id=rid and user_id=uid;
   if (select count(*) from field_private.members where lobby_id=rid and rematch)=2 then
    insert into field_private.lobbies(kind,is_public,host_id) values(l.kind,false,l.host_id) returning id into existing;
    insert into field_private.members(lobby_id,user_id,slot,profile) select existing,m.user_id,m.slot,m.profile from field_private.members m where m.lobby_id=rid;
    update field_private.lobbies set rematch_lobby=existing where id=rid;
    perform field_private.launch_room(existing);
    rid:=existing;
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

revoke all on all functions in schema field_private from public,anon,authenticated;
grant execute on function field_private.action(text,jsonb) to authenticated;
grant execute on function field_private.channel_access(text) to authenticated;
notify pgrst,'reload schema';
