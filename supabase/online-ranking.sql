-- Ranked ladder with bots. Run once in the SQL Editor AFTER online-tiempo.sql.
-- The Ranked table now lists everyone with an ELO, people and bots alike, so it looks like a busy
-- community from day one:
--  * 300 seeded bots (players.ladder_target not null) with a realistic pyramid of ELO from 1200 down
--    to about 280: a handful above 1000, most between 400 and 700. Usernames, teams and ranked
--    records like the bots that fill rooms (bot_name, bot_profile).
--  * Daily drift: the first leaderboard or profile request of the day plays the missed days (up to
--    7): about a third of the seeded bots play 1-5 games each, winning more when they are below
--    their anchor ELO, so the table moves without losing its shape. No cron needed.
--  * Seeded bots are also rivals: pick_bot already reuses any free bot within 35 ELO.
--  * A bot profile shows a generated history (stable per day, mixed with its real games against
--    people), casual games, friends and its team.
--  * 'leaderboard' returns {rows: top 100, total, me: {position, ...}}; version 8.
alter table field_private.players add column if not exists ladder_target integer;
create table if not exists field_private.ladder_state(id integer primary key default 1 check(id=1), day date not null);
insert into field_private.ladder_state(id,day) values(1,current_date) on conflict(id) do nothing;
revoke all on field_private.ladder_state from public, anon, authenticated;

-- Stable pseudo-random number in [0,1) for a key.
create or replace function field_private.hrand(key text) returns double precision language sql immutable set search_path='' as $$
 select ('x'||substr(md5(key),1,8))::bit(32)::bigint/4294967296.0;
$$;

-- A believable ranked record for an ELO (everyone starts at 500).
create or replace function field_private.bot_record(rating integer) returns integer[] language plpgsql volatile set search_path='' as $$
declare played integer; wins integer;
begin
 played:=greatest(8,round(abs(rating-500)/6.0)::integer+20+floor(random()*120)::integer);
 -- Each ranked game moves about 16 ELO: wins - losses = (ELO - 500) / 16.
 wins:=least(played-1,greatest(1,round((played+(rating-500)/16.0)/2)::integer));
 return array[played,wins];
end; $$;

-- Seeds the ladder up to the given number of anchored bots (pyramid from 1200 to ~280).
create or replace function field_private.seed_ladder(total integer default 300) returns integer language plpgsql set search_path='' as $$
declare buckets integer[][]:=array[[1,1188,1200],[7,1000,1180],[20,850,999],[50,700,849],[90,550,699],[85,400,549],[47,282,399]];
 have integer; i integer; k integer; rating integer; name text[]; rec integer[]; made integer:=0;
begin
 select count(*) into have from field_private.players where is_bot and ladder_target is not null;
 if have>=total then return 0; end if;
 for i in 1..array_length(buckets,1) loop
  for k in 1..ceil(buckets[i][1]*(total-have)/300.0)::integer loop
   rating:=buckets[i][2]+floor(random()*(buckets[i][3]-buckets[i][2]+1))::integer;
   name:=field_private.bot_name(); rec:=field_private.bot_record(rating);
   insert into field_private.players(user_id,username,elo,ranked_played,ranked_wins,is_bot,bot_profile,ladder_target)
    values(gen_random_uuid(),name[1],rating,rec[1],rec[2],true,field_private.bot_profile(name[2]),rating);
   made:=made+1;
  end loop;
 end loop;
 return made;
end; $$;

-- Plays the days missed since the last call (at most 7).
create or replace function field_private.ladder_tick() returns void language plpgsql set search_path='' as $$
declare last date; d integer; b record; n integer; g integer; won integer; rating integer; target integer; chance double precision;
begin
 select day into last from field_private.ladder_state where id=1 for update;
 if last is null or last>=current_date then return; end if;
 update field_private.ladder_state set day=current_date where id=1;
 for d in 1..least(7,current_date-last) loop
  for b in select user_id,elo,ladder_target from field_private.players where is_bot and ladder_target is not null and random()<.35 loop
   n:=1+floor(random()*5)::integer; won:=0; rating:=b.elo;
   target:=least(1200,greatest(270,b.ladder_target+round((random()-.5)*16)::integer));
   for g in 1..n loop
    chance:=least(.75,greatest(.25,.5+(target-rating)/600.0));
    if random()<chance then won:=won+1; rating:=rating+12+floor(random()*9)::integer;
    else rating:=rating-12-floor(random()*9)::integer; end if;
   end loop;
   update field_private.players set elo=least(1250,greatest(250,rating)),ranked_played=ranked_played+n,ranked_wins=ranked_wins+won,ladder_target=target where user_id=b.user_id;
  end loop;
 end loop;
end; $$;

-- Generated recent games of a bot: about one game on most days, stable for each day.
create or replace function field_private.bot_history(bot uuid) returns table(at timestamptz, r jsonb) language plpgsql stable set search_path='' as $$
declare p field_private.players; d integer; dd date; k text; h double precision; rate double precision; won boolean; hi integer; lo integer; kind text; size integer; t timestamptz; made integer:=0;
begin
 select * into p from field_private.players where user_id=bot;
 if p.user_id is null then return; end if;
 rate:=case when p.ranked_played>0 then p.ranked_wins::double precision/p.ranked_played else .5 end;
 for d in 0..40 loop
  exit when made>=10;
  dd:=current_date-d; k:=bot::text||dd::text;
  continue when field_private.hrand(k||'play')>.62;
  t:=dd::timestamptz+make_interval(mins=>(9*60+floor(field_private.hrand(k||'time')*14*60))::integer);
  continue when t>now();
  won:=field_private.hrand(k||'won')<rate;
  hi:=1+floor(field_private.hrand(k||'hi')*5)::integer; lo:=floor(field_private.hrand(k||'lo')*hi)::integer;
  h:=field_private.hrand(k||'kind'); kind:=case when h<.7 then 'ranked' when h<.95 then 'quick' else 'tournament' end;
  size:=case when field_private.hrand(k||'size')<.2 then 4 else 2 end;
  at:=t; r:=jsonb_build_object('kind',kind,'size',size,'won',won,'for',case when won then hi else lo end,'against',case when won then lo else hi end,
   'elo',case when kind='ranked' then (case when won then 1 else -1 end)*(10+floor(field_private.hrand(k||'elo')*12)::integer) end,'at',t);
  made:=made+1; return next;
 end loop;
end; $$;

-- 300 bots on the ladder (does nothing if they already exist).
select field_private.seed_ladder(300);

create or replace function field_private.action(command text, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); target uuid; name text; rid uuid; existing uuid; l field_private.lobbies; g field_private.matches; inv field_private.invites;
 capacity integer; num integer; lobby_kind text; first_score integer; second_score integer; first_profile jsonb; on_left boolean; pick integer; my_team integer;
 left_human boolean; right_human boolean; final jsonb;
begin
 if uid is null then raise exception 'Inicia sesión para usar el online.'; end if;
 if command='claim_username' then
  name:=lower(trim(payload->>'username'));
  if name is null or name !~ '^[a-z0-9_]{3,20}$' then raise exception 'Usa entre 3 y 20 letras, números o guiones bajos.'; end if;
  if exists(select 1 from field_private.players where user_id=uid) then raise exception 'Ya tienes un nombre de usuario.'; end if;
  begin insert into field_private.players(user_id,username) values(uid,name); exception when unique_violation then raise exception 'Ese nombre de usuario ya está ocupado.'; end;
 elsif command='username_available' then
  name:=lower(trim(payload->>'username'));
  return jsonb_build_object('available',name ~ '^[a-z0-9_]{3,20}$' and not exists(select 1 from field_private.players where lower(username)=name));
 end if;
 if not exists(select 1 from field_private.players where user_id=uid) then return jsonb_build_object('identity',null,'friends','[]'::jsonb,'invites','[]'::jsonb,'lobby',null,'version',8); end if;
 -- Serialize each user's mutations and each queue/room admission.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
 if command='friend_request' then
  select user_id into target from field_private.players where lower(username)=lower(trim(payload->>'username'));
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
   target:=nullif(payload->>'swapWith','')::uuid;
   select team into my_team from field_private.members where lobby_id=rid and user_id=uid;
   if target is not null then
    -- Full room: swap sides with a player of the other team.
    select team into pick from field_private.members where lobby_id=rid and user_id=target;
    if target=uid or pick is null then raise exception 'Ese jugador no está en la sala.'; end if;
    if pick is not distinct from my_team then raise exception 'Ya estáis en el mismo equipo.'; end if;
    update field_private.members set team=case when user_id=uid then pick else my_team end where lobby_id=rid and user_id in(uid,target);
   else
    pick:=(payload->>'team')::integer;
    if pick is null or pick not in(1,2) then raise exception 'Equipo inválido.'; end if;
    if my_team is distinct from pick then
     if (select count(*) from field_private.members where lobby_id=rid and team=pick)>=2 then raise exception 'Ese equipo ya está completo. Pulsa «Cambiar» junto a un jugador para intercambiaros.'; end if;
     update field_private.members set team=pick where lobby_id=rid and user_id=uid;
    end if;
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
    if first_score is null or second_score is null or first_score<0 or second_score<0 or first_score>30 or second_score>30 or first_score=second_score then raise exception 'Marcador inválido.'; end if;
    if g.state='playing' then
     -- Any member of a team reports for it: left team (p1,p3) and right team (p2,p4).
     if uid in(g.p1,g.p3) then update field_private.matches set report1=jsonb_build_array(first_score,second_score) where id=g.id and report1 is null;
     else update field_private.matches set report2=jsonb_build_array(second_score,first_score) where id=g.id and report2 is null; end if;
     select * into g from field_private.matches where id=g.id;
     -- A side made only of bots never reports: the other side's report settles the match.
     left_human:=exists(select 1 from field_private.players where user_id in(g.p1,g.p3) and not is_bot);
     right_human:=exists(select 1 from field_private.players where user_id in(g.p2,g.p4) and not is_bot);
     if (g.report1 is not null or not left_human) and (g.report2 is not null or not right_human) then
      if g.report1 is null or g.report2 is null or g.report1=g.report2 then
       final:=coalesce(g.report1,g.report2); perform field_private.finish_match(g.id,(final->>0)::integer,(final->>1)::integer);
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
     -- (a team with a bot keeps playing: the host moves the bot).
     if (not exists(select 1 from field_private.members where lobby_id=rid and user_id in(case when on_left then g.p2 else g.p1 end,case when on_left then g.p4 else g.p3 end) and last_seen>=now()-interval '90 seconds')
       and not exists(select 1 from field_private.players where is_bot and user_id in(case when on_left then g.p2 else g.p1 end,case when on_left then g.p4 else g.p3 end)))
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
   -- The bots answer once for the room: one time in three they accept; otherwise they leave it.
   if exists(select 1 from field_private.members m join field_private.players p on p.user_id=m.user_id where m.lobby_id=rid and p.is_bot and not m.rematch) then
    if random()<1/3.0 then update field_private.members m set rematch=true from field_private.players p where m.lobby_id=rid and p.user_id=m.user_id and p.is_bot;
    else update field_private.members m set active=false from field_private.players p where m.lobby_id=rid and p.user_id=m.user_id and p.is_bot; end if;
   end if;
   if not exists(select 1 from field_private.members where lobby_id=rid and not rematch) then
    insert into field_private.lobbies(kind,is_public,host_id,size) values(l.kind,false,l.host_id,field_private.room_size(l)) returning id into existing;
    insert into field_private.members(lobby_id,user_id,slot,profile,team) select existing,m.user_id,m.slot,m.profile,m.team from field_private.members m where m.lobby_id=rid;
    update field_private.lobbies set rematch_lobby=existing where id=rid;
    perform field_private.launch_room(existing,true);
    rid:=existing;
   end if;
  end if;
 elsif command='bots' then
  -- Public room still waiting after 16 s of search: bots take the empty seats and the room starts.
  rid:=nullif(payload->>'lobbyId','')::uuid;
  select * into l from field_private.lobbies where id=rid;
  if l.id is null or not exists(select 1 from field_private.members where lobby_id=rid and user_id=uid) then raise exception 'No perteneces a esta sala.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('field-queue-'||l.kind||'-'||field_private.room_size(l),2));
  select * into l from field_private.lobbies where id=rid for update;
  update field_private.members set last_seen=now() where lobby_id=rid and user_id=uid;
  if l.state='waiting' and l.is_public then
   if l.created_at>now()-interval '15 seconds' then raise exception 'Seguimos buscando jugadores.'; end if;
   perform field_private.fill_with_bots(rid);
   perform field_private.launch_room(rid);
  end if;
 elsif command='bot_leave' then
  -- The match host reports that the rival bots quit the match (decided in the game after a goal):
  -- their team forfeits and they leave the room. Only for a rival side made only of bots.
  rid:=nullif(payload->>'lobbyId','')::uuid;
  select * into l from field_private.lobbies where id=rid for update;
  if l.id is null or not exists(select 1 from field_private.members where lobby_id=rid and user_id=uid) then raise exception 'No perteneces a esta sala.'; end if;
  update field_private.members set last_seen=now() where lobby_id=rid and user_id=uid;
  select * into g from field_private.matches where id=(payload->>'matchId')::uuid and lobby_id=rid and state='playing' and uid in(p1,p3) for update;
  if g.id is not null and not exists(select 1 from field_private.players where user_id in(g.p2,g.p4) and not is_bot) then
   update field_private.members set active=false where lobby_id=rid and user_id in(g.p2,g.p4);
   perform field_private.finish_match(g.id,5,0);
  end if;
 elsif command='search' then
  -- Players whose username starts with the query (letters, digits, underscore), best matches first.
  name:=regexp_replace(lower(trim(coalesce(payload->>'query',''))),'[^a-z0-9_]','','g');
  if length(name)<2 then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) - 'exact' order by x.exact desc, x.elo desc, x.username) from (
   select p.user_id id, p.username, p.elo, p.ranked_played played, p.ranked_wins wins, lower(p.username)=name exact,
    (select case when f.accepted then 'friend' when f.requested_by=uid then 'sent' else 'received' end from field_private.friends f where f.a=least(uid,p.user_id) and f.b=greatest(uid,p.user_id)) friend
   from field_private.players p where left(lower(p.username),length(name))=name and p.user_id<>uid order by lower(p.username)=name desc, p.elo desc, p.username limit 12) x),'[]'::jsonb);
 elsif command='profile' then
  -- Public profile: ELO, ranked record, friendship, last team used online and the last ten results.
  target:=coalesce(nullif(payload->>'userId','')::uuid,(select user_id from field_private.players where lower(username)=lower(trim(coalesce(payload->>'username','')))));
  if target is null or not exists(select 1 from field_private.players where user_id=target) then raise exception 'No existe ese jugador.'; end if;
  perform field_private.ladder_tick();
  return (select jsonb_build_object('id',p.user_id,'username',p.username,'elo',p.elo,'played',p.ranked_played,'wins',p.ranked_wins,'me',p.user_id=uid,
   'friend',(select case when f.accepted then 'friend' when f.requested_by=uid then 'sent' else 'received' end from field_private.friends f where f.a=least(uid,p.user_id) and f.b=greatest(uid,p.user_id)),
   'friends',(select count(*) from field_private.friends f where f.accepted and p.user_id in(f.a,f.b))+case when p.is_bot then floor(field_private.hrand(p.user_id::text||'friends')*14)::integer else 0 end,
   'profile',coalesce((select m.profile from field_private.members m join field_private.lobbies lb on lb.id=m.lobby_id where m.user_id=p.user_id order by lb.created_at desc limit 1),p.bot_profile)
    -- A bot's level grows with its games, like a person's would.
    ||case when p.is_bot then jsonb_build_object('level',least(100,4+p.ranked_played/5+floor(field_private.hrand(p.user_id::text||'level')*12)::integer)) else '{}'::jsonb end,
   'online',case when p.is_bot then jsonb_build_object('played',p.ranked_played+floor(field_private.hrand(p.user_id::text||'casual')*40)::integer,'wins',p.ranked_wins+floor(field_private.hrand(p.user_id::text||'casual')*40*field_private.hrand(p.user_id::text||'casualwins'))::integer)
    else (select jsonb_build_object('played',count(*),'wins',count(*) filter (where (mt.winner=mt.p1)=(p.user_id in(mt.p1,mt.p3)))) from field_private.matches mt where mt.state='finished' and p.user_id in(mt.p1,mt.p2,mt.p3,mt.p4)) end,
   'recent',coalesce((select jsonb_agg(s.r order by s.at desc) from (
     select mt.created_at at, jsonb_build_object('kind',lb.kind,'size',field_private.room_size(lb),'won',(mt.winner=mt.p1)=(p.user_id in(mt.p1,mt.p3)),
      'for',case when p.user_id in(mt.p1,mt.p3) then mt.score1 else mt.score2 end,'against',case when p.user_id in(mt.p1,mt.p3) then mt.score2 else mt.score1 end,
      'elo',case when lb.kind='ranked' then case when p.user_id in(mt.p1,mt.p3) then mt.elo_delta else -mt.elo_delta end end,'at',mt.created_at) r
     from field_private.matches mt join field_private.lobbies lb on lb.id=mt.lobby_id
     where mt.state='finished' and p.user_id in(mt.p1,mt.p2,mt.p3,mt.p4)
     union all select h.at, h.r from field_private.bot_history(p.user_id) h where p.is_bot
     order by 1 desc limit 10) s),'[]'::jsonb))
   from field_private.players p where p.user_id=target);
 elsif command='leaderboard' then
  -- Top 100 of the whole ladder (people and bots alike) plus the caller's place.
  perform field_private.ladder_tick();
  return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.elo desc,p.ranked_wins desc,p.username) from(select user_id id,username,elo,ranked_played,ranked_wins from field_private.players order by elo desc,ranked_wins desc,username limit 100)p),'[]'::jsonb),
   'total',(select count(*) from field_private.players),
   'me',(select jsonb_build_object('id',me.user_id,'username',me.username,'elo',me.elo,'ranked_played',me.ranked_played,'ranked_wins',me.ranked_wins,
     'position',1+(select count(*) from field_private.players o where (o.elo>me.elo or (o.elo=me.elo and (o.ranked_wins>me.ranked_wins or (o.ranked_wins=me.ranked_wins and o.username<me.username))))))
    from field_private.players me where me.user_id=uid));
 elsif command not in('state','claim_username') then raise exception 'Acción desconocida.';
 end if;
 update field_private.invites set state='expired' where state='pending' and created_at<now()-interval '5 minutes' and uid in(sender,recipient);
 if rid is null and command<>'leave' then select q.id into rid from field_private.lobbies q join field_private.members m on m.lobby_id=q.id where m.user_id=uid and m.active and q.state in('waiting','playing') order by q.created_at desc limit 1; end if;
 return jsonb_build_object('version',8,'identity',(select jsonb_build_object('id',user_id,'username',username,'elo',elo,'played',ranked_played,'wins',ranked_wins) from field_private.players where user_id=uid),
 'friends',coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'username',p.username,'elo',p.elo,'accepted',f.accepted,'incoming',f.requested_by<>uid)) from field_private.friends f join field_private.players p on p.user_id=case when f.a=uid then f.b else f.a end where uid in(f.a,f.b)),'[]'::jsonb),
 'invites',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'sender',i.sender,'recipient',i.recipient,'username',p.username,'state',i.state,'lobbyId',i.lobby_id,'incoming',i.recipient=uid)) from field_private.invites i join field_private.players p on p.user_id=case when i.sender=uid then i.recipient else i.sender end where uid in(i.sender,i.recipient) and i.created_at>now()-interval '5 minutes'),'[]'::jsonb),
 'lobby',case when command='leave' then null else field_private.room_data(rid) end);
end; $$;

revoke all on all functions in schema field_private from public,anon,authenticated;
grant execute on function field_private.action(text,jsonb) to authenticated;
grant execute on function field_private.channel_access(text) to authenticated;
notify pgrst,'reload schema';
