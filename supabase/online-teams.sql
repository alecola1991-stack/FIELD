-- 2v2 matches (quick and ranked) and tournaments of 4, 6 or 8 players.
-- Run once in the SQL Editor AFTER online.sql and online-rematch.sql.
-- Additive: new nullable columns, a wider seat range, and new versions of the
-- room functions. Existing 1v1 rooms and four-player tournaments keep working
-- (a NULL size means the old default: 2, or 4 for tournaments).
--
-- Model
--  * lobbies.size: seats in the room. quick/ranked: 2 (1v1) or 4 (2v2);
--    tournament: 4, 6 or 8.
--  * members.team: 1 (left) or 2 (right) in 2v2 rooms. Public 2v2 rooms get
--    random teams when they fill; private 2v2 rooms let each player pick a
--    team ('team') and the creator starts the match ('start').
--  * matches.p3/p4: 2v2 teammates. Left team = p1+p3, right team = p2+p4.
--    p1 is the host of the real-time match. Any member of a team may report;
--    the left team fills report1 and the right team report2, as in 1v1.
--  * lobbies.seeds: tournament bracket leaves (8 for 6/8 players, 4 for 4).
--    NULL leaves are byes. Matches are (round, position) nodes of that tree;
--    a node whose sibling is a bye is skipped and its player advances.
alter table field_private.lobbies add column if not exists size integer;
alter table field_private.lobbies add column if not exists seeds uuid[];
alter table field_private.members add column if not exists team integer;
alter table field_private.matches add column if not exists p3 uuid references field_private.players(user_id);
alter table field_private.matches add column if not exists p4 uuid references field_private.players(user_id);
alter table field_private.members drop constraint if exists members_slot_check;
alter table field_private.members add constraint members_slot_check check(slot between 1 and 8);
alter table field_private.members drop constraint if exists members_team_check;
alter table field_private.members add constraint members_team_check check(team is null or team in(1,2));
alter table field_private.lobbies drop constraint if exists lobbies_size_check;
alter table field_private.lobbies add constraint lobbies_size_check check(size is null or (kind='tournament' and size in(4,6,8)) or (kind in('quick','ranked') and size in(2,4)));
create index if not exists matches_p3_idx on field_private.matches(p3);
create index if not exists matches_p4_idx on field_private.matches(p4);

create or replace function field_private.room_size(l field_private.lobbies) returns integer language sql immutable set search_path='' as $$
 select coalesce(l.size,case when l.kind='tournament' then 4 else 2 end);
$$;

create or replace function field_private.room_data(room_id uuid) returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('id',l.id,'code',l.code,'kind',l.kind,'public',l.is_public,'state',l.state,'champion',l.champion,
 'size',field_private.room_size(l),'host',l.host_id,
 'rematch',jsonb_build_object('next',l.rematch_lobby,'votes',coalesce((select jsonb_agg(m.user_id) from field_private.members m where m.lobby_id=l.id and m.rematch),'[]'::jsonb)),
 'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'username',p.username,'elo',p.elo,'slot',m.slot,'team',m.team,'active',m.active,'profile',m.profile) order by m.slot) from field_private.members m join field_private.players p on p.user_id=m.user_id where m.lobby_id=l.id),'[]'::jsonb),
 'matches',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'round',g.round,'position',g.position,'p1',g.p1,'p2',g.p2,'p3',g.p3,'p4',g.p4,'state',g.state,'winner',g.winner,'score1',g.score1,'score2',g.score2,'eloDelta',g.elo_delta,'reported1',g.report1 is not null,'reported2',g.report2 is not null) order by g.round,g.position) from field_private.matches g where g.lobby_id=l.id),'[]'::jsonb))
 from field_private.lobbies l where l.id=room_id;
$$;

-- Creates every tournament match whose two entrants are known, skips byes and
-- crowns the champion. Safe to call repeatedly (and recursively through
-- finish_match when an entrant has already left).
create or replace function field_private.advance_bracket(room_id uuid) returns void language plpgsql set search_path='' as $$
declare l field_private.lobbies; g field_private.matches; cur uuid[]; nxt uuid[]; empty boolean[]; nxt_empty boolean[];
 n integer; r integer:=0; k integer; a uuid; b uuid; a_active boolean; b_active boolean;
begin
 select * into l from field_private.lobbies where id=room_id for update;
 if l.state<>'playing' then return; end if;
 cur:=coalesce(l.seeds,(select array_agg(user_id order by slot) from field_private.members where lobby_id=l.id));
 n:=coalesce(array_length(cur,1),0);
 empty:=array(select x is null from unnest(cur) x);
 while n>1 loop
  r:=r+1; nxt:='{}'; nxt_empty:='{}';
  for k in 1..n/2 loop
   a:=cur[2*k-1]; b:=cur[2*k];
   if empty[2*k-1] and empty[2*k] then nxt:=array_append(nxt,null::uuid); nxt_empty:=array_append(nxt_empty,true);
   elsif empty[2*k-1] then nxt:=array_append(nxt,b); nxt_empty:=array_append(nxt_empty,false);
   elsif empty[2*k] then nxt:=array_append(nxt,a); nxt_empty:=array_append(nxt_empty,false);
   else
    nxt_empty:=array_append(nxt_empty,false);
    select * into g from field_private.matches where lobby_id=l.id and round=r and position=k;
    if g.id is null and a is not null and b is not null then
     insert into field_private.matches(lobby_id,round,position,p1,p2) values(l.id,r,k,a,b) returning * into g;
     select active into a_active from field_private.members where lobby_id=l.id and user_id=a;
     select active into b_active from field_private.members where lobby_id=l.id and user_id=b;
     if not a_active then perform field_private.finish_match(g.id,0,5);
     elsif not b_active then perform field_private.finish_match(g.id,5,0); end if;
     select * into g from field_private.matches where id=g.id;
    end if;
    nxt:=array_append(nxt,case when g.state='finished' then g.winner end);
   end if;
  end loop;
  cur:=nxt; empty:=nxt_empty; n:=n/2;
 end loop;
 if cur[1] is not null then update field_private.lobbies set state='finished',champion=cur[1] where id=l.id and state='playing'; end if;
end; $$;

create or replace function field_private.finish_match(match_key uuid, first_score integer, second_score integer) returns void language plpgsql set search_path='' as $$
declare g field_private.matches; l field_private.lobbies; winner_id uuid; left_won boolean; r1 numeric; r2 numeric; delta integer;
begin
 select * into g from field_private.matches where id=match_key for update;
 if g.state='finished' then return; end if;
 select * into l from field_private.lobbies where id=g.lobby_id for update;
 left_won:=first_score>second_score;
 winner_id:=case when left_won then g.p1 else g.p2 end;
 if l.kind='ranked' then
  -- 1v1: individual ratings. 2v2: team averages; all four players move by the same amount.
  perform 1 from field_private.players where user_id in(g.p1,g.p2,g.p3,g.p4) order by user_id for update;
  select avg(elo) into r1 from field_private.players where user_id in(g.p1,g.p3);
  select avg(elo) into r2 from field_private.players where user_id in(g.p2,g.p4);
  delta:=round(32*((case when left_won then 1 else 0 end)-1/(1+power(10::numeric,(r2-r1)/400::numeric))));
  update field_private.players set elo=greatest(0,elo+delta),ranked_played=ranked_played+1,ranked_wins=ranked_wins+case when left_won then 1 else 0 end where user_id in(g.p1,g.p3);
  update field_private.players set elo=greatest(0,elo-delta),ranked_played=ranked_played+1,ranked_wins=ranked_wins+case when left_won then 0 else 1 end where user_id in(g.p2,g.p4);
 end if;
 update field_private.matches set state='finished',score1=first_score,score2=second_score,winner=winner_id,elo_delta=delta where id=g.id;
 if l.kind='tournament' then perform field_private.advance_bracket(l.id);
 else update field_private.lobbies set state='finished',champion=winner_id where id=l.id; end if;
end; $$;

-- Starts a full room. Private 2v2 rooms only start through the 'start'
-- command (manual=true) once both teams have two players.
drop function if exists field_private.launch_room(uuid);
create or replace function field_private.launch_room(room_id uuid, manual boolean default false) returns void language plpgsql set search_path='' as $$
declare l field_private.lobbies; players uuid[]; capacity integer; lefts uuid[]; rights uuid[]; picks integer[]; leaves uuid[]; byes uuid[]; rest uuid[];
begin
 select * into l from field_private.lobbies where id=room_id for update;
 capacity:=field_private.room_size(l);
 select array_agg(user_id order by slot) into players from field_private.members where lobby_id=l.id;
 if l.state<>'waiting' or coalesce(array_length(players,1),0)<>capacity then return; end if;
 if l.kind in('quick','ranked') and capacity=4 then
  if l.is_public then
   update field_private.members m set team=t.team from (select user_id,case when row_number() over(order by random())<=2 then 1 else 2 end team from field_private.members where lobby_id=l.id) t where m.lobby_id=l.id and m.user_id=t.user_id;
  elsif not manual then return;
  end if;
  select array_agg(user_id order by slot) into lefts from field_private.members where lobby_id=l.id and team=1;
  select array_agg(user_id order by slot) into rights from field_private.members where lobby_id=l.id and team=2;
  if coalesce(array_length(lefts,1),0)<>2 or coalesce(array_length(rights,1),0)<>2 then return; end if;
  update field_private.lobbies set state='playing' where id=l.id;
  insert into field_private.matches(lobby_id,round,position,p1,p2,p3,p4) values(l.id,1,1,lefts[1],rights[1],lefts[2],rights[2]);
 elsif l.kind='tournament' then
  if capacity=6 then
   -- Two random players get a bye into the semifinals.
   select array_agg(x order by random()) into byes from unnest(players) x;
   byes:=byes[1:2];
   rest:=array(select x from unnest(players) with ordinality u(x,i) where not x=any(byes) order by i);
   leaves:=array[byes[1],null,rest[1],rest[2],byes[2],null,rest[3],rest[4]];
  else leaves:=players; end if;
  update field_private.lobbies set state='playing',seeds=leaves where id=l.id;
  perform field_private.advance_bracket(l.id);
 else
  update field_private.lobbies set state='playing' where id=l.id;
  insert into field_private.matches(lobby_id,round,position,p1,p2) values(l.id,1,1,players[1],players[2]);
 end if;
end; $$;

create or replace function field_private.channel_access(topic text) returns boolean language sql security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from field_private.matches where id=case when topic ~ '^field-v3-match-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then substring(topic from 16)::uuid else null end and (select auth.uid()) in(p1,p2,p3,p4) and state='playing');
$$;

create or replace function field_private.action(command text, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); target uuid; name text; rid uuid; existing uuid; l field_private.lobbies; g field_private.matches; inv field_private.invites;
 capacity integer; num integer; lobby_kind text; first_score integer; second_score integer; first_profile jsonb; on_left boolean; pick integer;
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
 if not exists(select 1 from field_private.players where user_id=uid) then return jsonb_build_object('identity',null,'friends','[]'::jsonb,'invites','[]'::jsonb,'lobby',null,'version',2); end if;
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
  capacity:=coalesce(nullif(payload->>'size','')::integer,case when lobby_kind='tournament' then 4 else 2 end);
  if command<>'join' and not ((lobby_kind='tournament' and capacity in(4,6,8)) or (lobby_kind<>'tournament' and capacity in(2,4))) then raise exception 'Tamaño de sala inválido.'; end if;
  if command='invite' and (lobby_kind<>'quick' or capacity<>2) then raise exception 'Las invitaciones directas son a un partido rápido privado.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('field-queue-'||lobby_kind||'-'||capacity,2));
  -- Clear abandoned waiting seats; active matches retain their participants.
  delete from field_private.members m using field_private.lobbies q where m.lobby_id=q.id and q.state='waiting' and m.last_seen<now()-interval '45 seconds';
  update field_private.lobbies q set state='cancelled' where q.state='waiting' and not exists(select 1 from field_private.members m where m.lobby_id=q.id);
  select q.id into existing from field_private.lobbies q join field_private.members m on m.lobby_id=q.id where m.user_id=uid and m.active and q.state in('waiting','playing') limit 1;
  if existing is not null then raise exception 'Ya estás en una sala. Sal de ella antes de buscar otra.'; end if;
  if command='join' then
   select * into l from field_private.lobbies where code=upper(trim(payload->>'code')) and not is_public and state='waiting' for update;
   if l.id is null then raise exception 'Código no encontrado o sala ya iniciada.'; end if;
   if l.kind<>lobby_kind then raise exception 'El código corresponde a otro modo de juego.'; end if;
   capacity:=field_private.room_size(l);
  elsif command='queue' then
   select * into l from field_private.lobbies q where q.kind=lobby_kind and field_private.room_size(q)=capacity and q.is_public and q.state='waiting' and (select count(*) from field_private.members m where m.lobby_id=q.id)<capacity order by q.created_at for update limit 1;
  end if;
  if l.id is null then insert into field_private.lobbies(kind,is_public,host_id,size) values(lobby_kind,command='queue',uid,capacity) returning * into l; end if;
  rid:=l.id;
  select s into num from generate_series(1,capacity) s where not exists(select 1 from field_private.members where lobby_id=rid and slot=s) order by s limit 1;
  if num is null then raise exception 'La sala está llena.'; end if;
  -- Private 2v2: join the team with fewer players (players can switch later).
  if lobby_kind<>'tournament' and capacity=4 and not l.is_public then
   pick:=case when (select count(*) from field_private.members where lobby_id=rid and team=1)<=(select count(*) from field_private.members where lobby_id=rid and team=2) then 1 else 2 end;
  else pick:=null; end if;
  first_profile:=jsonb_build_object('name',left(coalesce(payload->'profile'->>'name','JUGADOR'),16),'number',least(99,greatest(0,coalesce((payload->'profile'->>'number')::integer,10))), 'teamId',left(coalesce(payload->'profile'->>'teamId',''),60),'level',least(100,greatest(1,coalesce((payload->'profile'->>'level')::integer,1))));
  insert into field_private.members(lobby_id,user_id,slot,profile,team) values(rid,uid,num,first_profile,pick);
  if command='invite' then
   target:=(payload->>'userId')::uuid;
   if not exists(select 1 from field_private.friends where a=least(uid,target) and b=greatest(uid,target) and accepted) then raise exception 'Solo puedes invitar a tus amigos.'; end if;
   insert into field_private.invites(sender,recipient,lobby_id) values(uid,target,rid);
  end if;
  perform field_private.launch_room(rid);
 elsif command in('team','start') then
  -- Private 2v2 rooms: pick a side while waiting; the creator starts the match.
  rid:=nullif(payload->>'lobbyId','')::uuid;
  select * into l from field_private.lobbies where id=rid for update;
  if l.id is null or not exists(select 1 from field_private.members where lobby_id=rid and user_id=uid) then raise exception 'No perteneces a esta sala.'; end if;
  if l.state<>'waiting' or l.is_public or l.kind='tournament' or field_private.room_size(l)<>4 then raise exception 'Solo puedes elegir equipo en una sala 2v2 privada que aún no ha empezado.'; end if;
  update field_private.members set last_seen=now() where lobby_id=rid and user_id=uid;
  if command='team' then
   pick:=(payload->>'team')::integer;
   if pick is null or pick not in(1,2) then raise exception 'Equipo inválido.'; end if;
   if (select team from field_private.members where lobby_id=rid and user_id=uid) is distinct from pick then
    if (select count(*) from field_private.members where lobby_id=rid and team=pick)>=2 then raise exception 'Ese equipo ya está completo.'; end if;
    update field_private.members set team=pick where lobby_id=rid and user_id=uid;
   end if;
  else
   if l.host_id<>uid then raise exception 'Solo quien creó la sala puede empezar el partido.'; end if;
   if (select count(*) from field_private.members where lobby_id=rid)<>4 then raise exception 'Faltan jugadores: hacen falta cuatro.'; end if;
   if (select count(*) from field_private.members where lobby_id=rid and team=1)<>2 then raise exception 'Cada equipo necesita dos jugadores.'; end if;
   perform field_private.launch_room(rid,true);
  end if;
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
    select * into g from field_private.matches where id=(payload->>'matchId')::uuid and lobby_id=rid and uid in(p1,p2,p3,p4) for update;
    if g.id is null then raise exception 'No perteneces a este partido.'; end if;
    first_score:=(payload->>'playerScore')::integer; second_score:=(payload->>'opponentScore')::integer;
    if first_score is null or second_score is null or first_score<0 or second_score<0 or first_score>5 or second_score>5 or greatest(first_score,second_score)<>5 or first_score=second_score then raise exception 'Marcador inválido.'; end if;
    if g.state='playing' then
     -- Any member of a team reports for it: left team (p1,p3) and right team (p2,p4).
     if uid in(g.p1,g.p3) then update field_private.matches set report1=jsonb_build_array(first_score,second_score) where id=g.id and report1 is null;
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
     -- Leaving a match in progress forfeits it for the whole team.
     for g in select * from field_private.matches where lobby_id=rid and state='playing' and uid in(p1,p2,p3,p4) loop
      on_left:=uid in(g.p1,g.p3);
      perform field_private.finish_match(g.id,case when on_left then 0 else 5 end,case when on_left then 5 else 0 end);
     end loop;
    end if;
    update field_private.members set active=false where lobby_id=rid and user_id=uid;
    update field_private.invites set state='expired' where lobby_id=rid and state='pending';
   elsif command='poll' and l.rematch_lobby is not null and exists(select 1 from field_private.members where lobby_id=l.rematch_lobby and user_id=uid) then
    rid:=l.rematch_lobby;
   elsif l.state='playing' then
    -- The rival team forfeits after 90 s without news from all its players,
    -- or from the match host (without the host the match cannot go on).
    for g in select * from field_private.matches where lobby_id=rid and state='playing' and uid in(p1,p2,p3,p4) loop
     on_left:=uid in(g.p1,g.p3);
     if not exists(select 1 from field_private.members where lobby_id=rid and user_id in(case when on_left then g.p2 else g.p1 end,case when on_left then g.p4 else g.p3 end) and last_seen>=now()-interval '90 seconds')
      or (not on_left and exists(select 1 from field_private.members where lobby_id=rid and user_id=g.p1 and last_seen<now()-interval '90 seconds')) then
      perform field_private.finish_match(g.id,case when on_left then 5 else 0 end,case when on_left then 0 else 5 end);
     end if;
    end loop;
   end if;
  end if;
 elsif command='rematch' then
  -- Every player of a finished quick/ranked room asks for a rematch; the last
  -- vote creates a private room of the same kind, size and teams and starts
  -- it. Ranked rematches settle ELO like any other ranked match.
  rid:=nullif(payload->>'lobbyId','')::uuid;
  select * into l from field_private.lobbies where id=rid for update;
  if l.id is null or not exists(select 1 from field_private.members where lobby_id=rid and user_id=uid) then raise exception 'No perteneces a esta sala.'; end if;
  if l.rematch_lobby is not null then rid:=l.rematch_lobby;
  else
   if l.kind not in('quick','ranked') or l.state<>'finished' then raise exception 'La revancha solo está disponible al terminar un partido rápido o Ranked.'; end if;
   if exists(select 1 from field_private.members where lobby_id=rid and not active) then raise exception 'Un jugador ha salido de la sala.'; end if;
   if exists(select 1 from field_private.members m join field_private.lobbies q on q.id=m.lobby_id where m.user_id=uid and m.active and q.state in('waiting','playing')) then raise exception 'Ya estás en otra sala.'; end if;
   update field_private.members set rematch=true,last_seen=now() where lobby_id=rid and user_id=uid;
   if not exists(select 1 from field_private.members where lobby_id=rid and not rematch) then
    insert into field_private.lobbies(kind,is_public,host_id,size) values(l.kind,false,l.host_id,field_private.room_size(l)) returning id into existing;
    insert into field_private.members(lobby_id,user_id,slot,profile,team) select existing,m.user_id,m.slot,m.profile,m.team from field_private.members m where m.lobby_id=rid;
    update field_private.lobbies set rematch_lobby=existing where id=rid;
    perform field_private.launch_room(existing,true);
    rid:=existing;
   end if;
  end if;
 elsif command='leaderboard' then
  return coalesce((select jsonb_agg(to_jsonb(p)) from(select username,elo,ranked_played,ranked_wins from field_private.players order by elo desc,ranked_wins desc,username limit 50)p),'[]'::jsonb);
 elsif command not in('state','claim_username') then raise exception 'Acción desconocida.';
 end if;
 update field_private.invites set state='expired' where state='pending' and created_at<now()-interval '5 minutes' and uid in(sender,recipient);
 if rid is null and command<>'leave' then select q.id into rid from field_private.lobbies q join field_private.members m on m.lobby_id=q.id where m.user_id=uid and m.active and q.state in('waiting','playing') order by q.created_at desc limit 1; end if;
 return jsonb_build_object('version',2,'identity',(select jsonb_build_object('id',user_id,'username',username,'elo',elo,'played',ranked_played,'wins',ranked_wins) from field_private.players where user_id=uid),
 'friends',coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'username',p.username,'elo',p.elo,'accepted',f.accepted,'incoming',f.requested_by<>uid)) from field_private.friends f join field_private.players p on p.user_id=case when f.a=uid then f.b else f.a end where uid in(f.a,f.b)),'[]'::jsonb),
 'invites',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'sender',i.sender,'recipient',i.recipient,'username',p.username,'state',i.state,'lobbyId',i.lobby_id,'incoming',i.recipient=uid)) from field_private.invites i join field_private.players p on p.user_id=case when i.sender=uid then i.recipient else i.sender end where uid in(i.sender,i.recipient) and i.created_at>now()-interval '5 minutes'),'[]'::jsonb),
 'lobby',case when command='leave' then null else field_private.room_data(rid) end);
end; $$;

revoke all on all functions in schema field_private from public,anon,authenticated;
grant execute on function field_private.action(text,jsonb) to authenticated;
grant execute on function field_private.channel_access(text) to authenticated;
notify pgrst,'reload schema';
