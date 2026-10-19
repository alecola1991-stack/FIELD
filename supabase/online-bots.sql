-- Online bots. Run once in the SQL Editor AFTER online-profiles.sql.
-- When a public room (quick, ranked or tournament, 1v1 or 2v2) is still waiting after 16 s of
-- search, the client asks for bots ('bots' command) and they take the empty seats. Bots are
-- ordinary rows of field_private.players (is_bot = true) with a username, ELO, ranked record and
-- online profile like any player, so nothing in the game tells them apart.
--  * Their ELO is a little below the humans in the room (10 to 80 points); a bot already in that
--    range and not playing is reused, otherwise a new one is created.
--  * Usernames mix Spanish first names and footballers with capitals and numbers (juan_3542,
--    xx_messi11, PabloPedri7…). Teams: mostly LaLiga.
--  * The match host is always a human: 1v1 rooms put the human first; 2v2 rooms make sure the
--    left team has a human; tournament matches against a bot put the human as p1. Bot against bot
--    tournament matches are settled at once (the better ELO is more likely to win).
--  * A side with no humans never reports: the other side's report settles the match (ranked ELO
--    moves as against anyone). A team with a bot is never forfeited for not polling.
--  * Bots always accept rematches. They are left out of the leaderboard.
--  * players.user_id no longer references auth.users (bots have no account): a trigger keeps
--    requiring an auth user for humans, and deleting an auth user still deletes its player.
--  * Usernames are now unique ignoring case (bots may use capitals; people still claim lowercase).
--  * The RPC reports version 5 (the client asks for bots from 5).
alter table field_private.players add column if not exists is_bot boolean not null default false;
alter table field_private.players add column if not exists bot_profile jsonb;
alter table field_private.players drop constraint if exists players_user_id_fkey;
alter table field_private.players drop constraint if exists players_username_check;
alter table field_private.players add constraint players_username_check check(username ~ '^[a-z0-9_]{3,20}$' or (is_bot and username ~ '^[A-Za-z0-9_]{3,20}$'));
create unique index if not exists players_username_lower_idx on field_private.players(lower(username));

-- Humans must still be Supabase users.
create or replace function field_private.players_auth_check() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not new.is_bot and not exists(select 1 from auth.users where id=new.user_id) then raise exception 'Usuario desconocido.'; end if;
 return new;
end; $$;
drop trigger if exists players_auth_check on field_private.players;
create trigger players_auth_check before insert or update of user_id,is_bot on field_private.players for each row execute function field_private.players_auth_check();

-- Deleting an account still deletes its player (what the old foreign key did).
create or replace function field_private.auth_user_deleted() returns trigger language plpgsql security definer set search_path='' as $$
begin delete from field_private.players where user_id=old.id and not is_bot; return old; end; $$;
do $$ begin
 drop trigger if exists field_player_cleanup on auth.users;
 create trigger field_player_cleanup after delete on auth.users for each row execute function field_private.auth_user_deleted();
exception when insufficient_privilege then raise notice 'Sin permiso para crear el trigger en auth.users: borrar una cuenta dejará su jugador.';
end $$;

create or replace function field_private.pick_text(items text[]) returns text language sql volatile set search_path='' as $$
 select items[1+floor(random()*array_length(items,1))::integer];
$$;

-- A free username (Spanish first names and footballers, with capitals and numbers) and the
-- short name shown on the pitch: {username, name}.
drop function if exists field_private.bot_name();
create or replace function field_private.bot_name() returns text[] language plpgsql volatile set search_path='' as $$
declare names text[]:=array['juan','javi','sergio','alex','pablo','dani','adri','carlos','mario','diego','hugo','lucas','ivan','raul','alvaro','marcos','david','jorge','ruben','victor','manu','miguel','pepe','toni','nacho','fran','luis','angel','oscar','samu','edu','gonzalo','jaime','alberto','antonio','jose','paco','rafa','iker','unai','aitor','mikel','pau','marc','jordi','pol','borja','kike','txema','hector','nico','leo','izan','eric','gabri','santi','moha','cristian','joel','andres'];
 players text[]:=array['messi','cr7','neymar','mbappe','haaland','pedri','gavi','lamine','yamal','vini','bellingham','modric','kroos','ramos','iniesta','xavi','puyol','villa','torres','casillas','busquets','griezmann','benzema','lewan','valverde','rodri','nico','olmo','morata','raul','guti','isco','koke','oblak','carvajal','araujo','fermin','cucurella','oyarzabal','williams','joaquin','aspas','kubo','raphinha','dembele','salah','kane','zidane','ronaldinho','ronaldo','ibra','pique','alba','marcelo','courtois','bale','suarez','dybala','nunez','camavinga'];
 clubs text[]:=array['madrid','barca','atleti','betis','sevilla','valencia','athletic','real','cule','merengue','colchonero','bilbao','celta','depor','rayo','villarreal','osasuna','malaga'];
 a text; b text; result text; shown text; tries integer:=0; pattern integer;
begin
 loop
  tries:=tries+1;
  a:=field_private.pick_text(names); b:=field_private.pick_text(players); pattern:=floor(random()*12)::integer;
  shown:=upper(case when pattern in(1,3,6,8,9) then b else a end);
  result:=case pattern
   when 0 then a||'_'||(1000+floor(random()*9000))::integer
   when 1 then 'xx_'||b||(1+floor(random()*30))::integer
   when 2 then initcap(a)||initcap(b)||(1+floor(random()*99))::integer
   when 3 then b||'_'||a
   when 4 then upper(a)||(1990+floor(random()*20))::integer
   when 5 then 'el_'||a||(1+floor(random()*99))::integer
   when 6 then initcap(b)||(2000+floor(random()*12))::integer
   when 7 then a||'_'||field_private.pick_text(clubs)
   when 8 then 'xX'||initcap(b)||'Xx'
   when 9 then upper(b)||'_'||(1+floor(random()*99))::integer
   when 10 then initcap(a)||'_'||initcap(field_private.pick_text(clubs))
   else a||b||(1+floor(random()*999))::integer end;
  result:=left(regexp_replace(result,'[^A-Za-z0-9_]','','g'),20);
  if length(result)>=3 and not exists(select 1 from field_private.players where lower(username)=lower(result)) then return array[result,shown]; end if;
  if tries>40 then return array[left(a||'_'||replace(gen_random_uuid()::text,'-',''),20),upper(a)]; end if;
 end loop;
end; $$;

-- Online profile of a new bot: name, shirt number and team (mostly LaLiga).
drop function if exists field_private.bot_profile(text);
create or replace function field_private.bot_profile(shown text) returns jsonb language plpgsql volatile set search_path='' as $$
declare laliga text[]:=array['laliga-real-madrid','laliga-real-madrid','laliga-real-madrid','laliga-barcelona','laliga-barcelona','laliga-barcelona','laliga-atletico','laliga-atletico','laliga-betis','laliga-betis','laliga-sevilla','laliga-athletic','laliga-athletic','laliga-sociedad','laliga-valencia','laliga-villarreal','laliga-celta','laliga-osasuna','laliga-rayo','laliga-getafe','laliga-espanyol','laliga-alaves','laliga-elche','laliga-levante','laliga-malaga','laliga-racing','laliga-deportivo'];
 others text[]:=array['laliga2-almeria','laliga2-cadiz','laliga2-granada','laliga2-girona','laliga2-las-palmas','laliga2-mallorca','laliga2-oviedo','laliga2-sporting','laliga2-valladolid','laliga2-tenerife','premier-man-city','premier-liverpool','premier-arsenal','premier-man-united','premier-chelsea','serie-a-milan','serie-a-inter','serie-a-juventus','serie-a-napoli','bundesliga-bayern','bundesliga-dortmund','ligue-1-psg','ligue-1-marseille'];
 r numeric:=random();
begin
 return jsonb_build_object('name',left(upper(regexp_replace(coalesce(shown,''),'[^A-Za-z0-9]','','g')),12),
  'number',case when random()<.55 then (array[7,9,10,11,10,7,9,8])[1+floor(random()*8)::integer] else 1+floor(random()*99)::integer end,
  'teamId',case when r<.78 then field_private.pick_text(laliga) else field_private.pick_text(others) end,'level',1);
end; $$;

-- A bot near the target ELO that is not playing (reused), or a new one.
create or replace function field_private.pick_bot(target integer) returns uuid language plpgsql set search_path='' as $$
declare bot uuid; name text[]; played integer; wins integer; rating integer:=greatest(0,target);
begin
 select p.user_id into bot from field_private.players p where p.is_bot and p.elo between rating-35 and rating+35
  and not exists(select 1 from field_private.members m join field_private.lobbies q on q.id=m.lobby_id where m.user_id=p.user_id and q.state in('waiting','playing'))
  order by random() limit 1 for update skip locked;
 if bot is not null then return bot; end if;
 name:=field_private.bot_name();
 -- A believable ranked record for that ELO (everyone starts at 500).
 played:=greatest(3,round(abs(rating-500)/9.0)::integer+floor(random()*45)::integer);
 wins:=least(played,greatest(0,round(played*.5+(rating-500)/18.0)::integer));
 insert into field_private.players(user_id,username,elo,ranked_played,ranked_wins,is_bot,bot_profile)
  values(gen_random_uuid(),name[1],rating,played,wins,true,field_private.bot_profile(name[2])) returning user_id into bot;
 return bot;
end; $$;

-- Bots take every empty seat of a waiting room.
create or replace function field_private.fill_with_bots(room_id uuid) returns void language plpgsql set search_path='' as $$
declare l field_private.lobbies; capacity integer; s integer; target integer; lvl integer; bot uuid; prof jsonb;
begin
 select * into l from field_private.lobbies where id=room_id;
 capacity:=field_private.room_size(l);
 select coalesce(round(avg(p.elo)),500)::integer,coalesce(round(avg(least(100,greatest(1,coalesce((m.profile->>'level')::integer,1))))),1)::integer into target,lvl
  from field_private.members m join field_private.players p on p.user_id=m.user_id where m.lobby_id=room_id and not p.is_bot;
 for s in 1..capacity loop
  continue when exists(select 1 from field_private.members where lobby_id=room_id and slot=s);
  bot:=field_private.pick_bot(target-10-floor(random()*70)::integer);
  select coalesce(bot_profile,'{}'::jsonb) into prof from field_private.players where user_id=bot;
  prof:=prof||jsonb_build_object('level',least(100,greatest(1,lvl+floor(random()*11)::integer-5)));
  insert into field_private.members(lobby_id,user_id,slot,profile) values(room_id,bot,s,prof);
 end loop;
end; $$;

-- Room data: players carry a bot flag (the match host moves the bots).
create or replace function field_private.room_data(room_id uuid) returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('id',l.id,'code',l.code,'kind',l.kind,'public',l.is_public,'state',l.state,'champion',l.champion,
 'size',field_private.room_size(l),'host',l.host_id,
 'rematch',jsonb_build_object('next',l.rematch_lobby,'votes',coalesce((select jsonb_agg(m.user_id) from field_private.members m where m.lobby_id=l.id and m.rematch),'[]'::jsonb)),
 'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'username',p.username,'elo',p.elo,'slot',m.slot,'team',m.team,'active',m.active,'profile',m.profile,'bot',p.is_bot) order by m.slot) from field_private.members m join field_private.players p on p.user_id=m.user_id where m.lobby_id=l.id),'[]'::jsonb),
 'matches',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'round',g.round,'position',g.position,'p1',g.p1,'p2',g.p2,'p3',g.p3,'p4',g.p4,'state',g.state,'winner',g.winner,'score1',g.score1,'score2',g.score2,'eloDelta',g.elo_delta,'reported1',g.report1 is not null,'reported2',g.report2 is not null) order by g.round,g.position) from field_private.matches g where g.lobby_id=l.id),'[]'::jsonb))
 from field_private.lobbies l where l.id=room_id;
$$;

-- Tournament bracket (online-teams.sql version) plus bots: a human always hosts against a bot
-- (p1), and bot against bot matches are settled at once.
create or replace function field_private.advance_bracket(room_id uuid) returns void language plpgsql set search_path='' as $$
declare l field_private.lobbies; g field_private.matches; cur uuid[]; nxt uuid[]; empty boolean[]; nxt_empty boolean[];
 n integer; r integer:=0; k integer; a uuid; b uuid; a_active boolean; b_active boolean; a_bot boolean; b_bot boolean; ea integer; eb integer; loser integer;
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
     select is_bot,elo into a_bot,ea from field_private.players where user_id=a;
     select is_bot,elo into b_bot,eb from field_private.players where user_id=b;
     if a_bot and not b_bot then insert into field_private.matches(lobby_id,round,position,p1,p2) values(l.id,r,k,b,a) returning * into g;
     else insert into field_private.matches(lobby_id,round,position,p1,p2) values(l.id,r,k,a,b) returning * into g; end if;
     select active into a_active from field_private.members where lobby_id=l.id and user_id=g.p1;
     select active into b_active from field_private.members where lobby_id=l.id and user_id=g.p2;
     if not a_active then perform field_private.finish_match(g.id,0,5);
     elsif not b_active then perform field_private.finish_match(g.id,5,0);
     elsif a_bot and b_bot then
      loser:=floor(random()*5)::integer;
      if random()<1/(1+power(10::numeric,(eb-ea)/400::numeric)) then perform field_private.finish_match(g.id,5,loser);
      else perform field_private.finish_match(g.id,loser,5); end if;
     end if;
     select * into g from field_private.matches where id=g.id;
    end if;
    nxt:=array_append(nxt,case when g.state='finished' then g.winner end);
   end if;
  end loop;
  cur:=nxt; empty:=nxt_empty; n:=n/2;
 end loop;
 if cur[1] is not null then update field_private.lobbies set state='finished',champion=cur[1] where id=l.id and state='playing'; end if;
end; $$;

-- Room start (online-teams.sql version) plus bots: the human hosts. 1v1: humans first. 2v2: the
-- left team has a human and leads with them. Tournaments with bots get a random bracket.
create or replace function field_private.launch_room(room_id uuid, manual boolean default false) returns void language plpgsql set search_path='' as $$
declare l field_private.lobbies; players uuid[]; capacity integer; lefts uuid[]; rights uuid[]; picks integer[]; leaves uuid[]; byes uuid[]; rest uuid[]; bots boolean;
begin
 select * into l from field_private.lobbies where id=room_id for update;
 capacity:=field_private.room_size(l);
 bots:=exists(select 1 from field_private.members m join field_private.players p on p.user_id=m.user_id where m.lobby_id=l.id and p.is_bot);
 select array_agg(m.user_id order by case when bots and l.kind='tournament' then random() else 0 end,p.is_bot,m.slot) into players
  from field_private.members m join field_private.players p on p.user_id=m.user_id where m.lobby_id=l.id;
 if l.state<>'waiting' or coalesce(array_length(players,1),0)<>capacity then return; end if;
 if l.kind in('quick','ranked') and capacity=4 then
  if l.is_public then
   update field_private.members m set team=t.team from (select user_id,case when row_number() over(order by random())<=2 then 1 else 2 end team from field_private.members where lobby_id=l.id) t where m.lobby_id=l.id and m.user_id=t.user_id;
  elsif not manual then return;
  end if;
  -- The left team (whose first player hosts) must have a human.
  if not exists(select 1 from field_private.members m join field_private.players p on p.user_id=m.user_id where m.lobby_id=l.id and m.team=1 and not p.is_bot) then
   update field_private.members set team=3-team where lobby_id=l.id and team in(1,2);
  end if;
  select array_agg(m.user_id order by p.is_bot,m.slot) into lefts from field_private.members m join field_private.players p on p.user_id=m.user_id where m.lobby_id=l.id and m.team=1;
  select array_agg(m.user_id order by p.is_bot,m.slot) into rights from field_private.members m join field_private.players p on p.user_id=m.user_id where m.lobby_id=l.id and m.team=2;
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
 if not exists(select 1 from field_private.players where user_id=uid) then return jsonb_build_object('identity',null,'friends','[]'::jsonb,'invites','[]'::jsonb,'lobby',null,'version',5); end if;
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
    if first_score is null or second_score is null or first_score<0 or second_score<0 or first_score>5 or second_score>5 or greatest(first_score,second_score)<>5 or first_score=second_score then raise exception 'Marcador inválido.'; end if;
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
   -- Bots always accept a rematch.
   update field_private.members m set rematch=true from field_private.players p where m.lobby_id=rid and p.user_id=m.user_id and p.is_bot;
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
  return (select jsonb_build_object('id',p.user_id,'username',p.username,'elo',p.elo,'played',p.ranked_played,'wins',p.ranked_wins,'me',p.user_id=uid,
   'friend',(select case when f.accepted then 'friend' when f.requested_by=uid then 'sent' else 'received' end from field_private.friends f where f.a=least(uid,p.user_id) and f.b=greatest(uid,p.user_id)),
   'friends',(select count(*) from field_private.friends f where f.accepted and p.user_id in(f.a,f.b)),
   'profile',(select m.profile from field_private.members m join field_private.lobbies lb on lb.id=m.lobby_id where m.user_id=p.user_id order by lb.created_at desc limit 1),
   'online',(select jsonb_build_object('played',count(*),'wins',count(*) filter (where (mt.winner=mt.p1)=(p.user_id in(mt.p1,mt.p3)))) from field_private.matches mt where mt.state='finished' and p.user_id in(mt.p1,mt.p2,mt.p3,mt.p4)),
   'recent',coalesce((select jsonb_agg(s.r order by s.at desc) from (
     select mt.created_at at, jsonb_build_object('kind',lb.kind,'size',field_private.room_size(lb),'won',(mt.winner=mt.p1)=(p.user_id in(mt.p1,mt.p3)),
      'for',case when p.user_id in(mt.p1,mt.p3) then mt.score1 else mt.score2 end,'against',case when p.user_id in(mt.p1,mt.p3) then mt.score2 else mt.score1 end,
      'elo',case when lb.kind='ranked' then case when p.user_id in(mt.p1,mt.p3) then mt.elo_delta else -mt.elo_delta end end,'at',mt.created_at) r
     from field_private.matches mt join field_private.lobbies lb on lb.id=mt.lobby_id
     where mt.state='finished' and p.user_id in(mt.p1,mt.p2,mt.p3,mt.p4) order by mt.created_at desc limit 10) s),'[]'::jsonb))
   from field_private.players p where p.user_id=target);
 elsif command='leaderboard' then
  return coalesce((select jsonb_agg(to_jsonb(p)) from(select username,elo,ranked_played,ranked_wins from field_private.players where not is_bot order by elo desc,ranked_wins desc,username limit 50)p),'[]'::jsonb);
 elsif command not in('state','claim_username') then raise exception 'Acción desconocida.';
 end if;
 update field_private.invites set state='expired' where state='pending' and created_at<now()-interval '5 minutes' and uid in(sender,recipient);
 if rid is null and command<>'leave' then select q.id into rid from field_private.lobbies q join field_private.members m on m.lobby_id=q.id where m.user_id=uid and m.active and q.state in('waiting','playing') order by q.created_at desc limit 1; end if;
 return jsonb_build_object('version',5,'identity',(select jsonb_build_object('id',user_id,'username',username,'elo',elo,'played',ranked_played,'wins',ranked_wins) from field_private.players where user_id=uid),
 'friends',coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'username',p.username,'elo',p.elo,'accepted',f.accepted,'incoming',f.requested_by<>uid)) from field_private.friends f join field_private.players p on p.user_id=case when f.a=uid then f.b else f.a end where uid in(f.a,f.b)),'[]'::jsonb),
 'invites',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'sender',i.sender,'recipient',i.recipient,'username',p.username,'state',i.state,'lobbyId',i.lobby_id,'incoming',i.recipient=uid)) from field_private.invites i join field_private.players p on p.user_id=case when i.sender=uid then i.recipient else i.sender end where uid in(i.sender,i.recipient) and i.created_at>now()-interval '5 minutes'),'[]'::jsonb),
 'lobby',case when command='leave' then null else field_private.room_data(rid) end);
end; $$;

revoke all on all functions in schema field_private from public,anon,authenticated;
grant execute on function field_private.action(text,jsonb) to authenticated;
grant execute on function field_private.channel_access(text) to authenticated;
notify pgrst,'reload schema';
