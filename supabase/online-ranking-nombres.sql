-- New names for the bots that already exist. Run once in the SQL Editor AFTER online-ranking.sql
-- (only needed if online-ranking.sql was run before the new bot_name; running it again is harmless:
-- every bot simply gets another name).
--  * Redefines bot_name() as in the current online-ranking.sql (34 formats, no two bots alike).
--  * Renames every bot: first to a temporary name, so the old names do not block the new ones,
--    then one by one with bot_name(). The short name on the pitch (bot_profile.name) follows.
--    Profiles, ELO, records and match history stay (they go by id).
-- Bot usernames, varied like real gamer tags: 34 formats (name + surname, nicknames, diminutives,
-- leetspeak, club fans, places, English gamer words, streamer tags…) with mixed casing and numbers.
-- Every new name must look different from the rest: its letters (digits and _ removed) cannot
-- repeat another player's, and no root word (name, surname, footballer, word) may already appear in
-- 3 or more usernames. Returns {username, short name for the pitch}.
create or replace function field_private.bot_name() returns text[] language plpgsql volatile set search_path='' as $$
declare
 names text[]:=array['juan','javi','sergio','alex','pablo','dani','adri','carlos','mario','diego','hugo','lucas','ivan','raul','alvaro','marcos','david','jorge','ruben','victor','manu','miguel','pepe','toni','nacho','fran','luis','angel','oscar','samu','edu','gonzalo','jaime','alberto','antonio','jose','paco','rafa','iker','unai','aitor','mikel','pau','marc','jordi','pol','borja','kike','txema','hector','nico','leo','izan','eric','gabri','santi','moha','cristian','joel','andres','lucia','marta','paula','laura','sara','carla','nerea','ane','irene','alba','noelia','ainhoa','julia','claudia','ximo','quique','chema','fermin','ismael','aaron','yeray','kevin','jonathan','brayan','pedro','felipe','tomas','benja','ernesto','ramon','sebas','julen','asier','oier','xabi','lander','gorka','biel','arnau','roger','oriol','sergi','xavi','cesc','adrian','alonso','ivanchu','teo','enzo','bruno','dario','omar','yassin','ilias','rayan','hamza','thiago','mateo','gael','liam','axel','eloy','fidel','guille','manolo','curro','juanma','josemi'];
 surnames text[]:=array['garcia','lopez','ruiz','martin','sanchez','perez','gomez','diaz','moreno','alonso','romero','navarro','torres','dominguez','vazquez','ramos','gil','serrano','blanco','molina','castro','ortiz','rubio','marin','sanz','iglesias','nunez','medina','garrido','cortes','castillo','santos','lozano','guerrero','cano','prieto','mendez','cruz','calvo','gallego','vidal','leon','herrera','marquez','pena','flores','cabrera','campos','vega','fuentes','carrasco','diez','caballero','reyes','aguilar','pascual','herrero','montero','hidalgo','gimenez','ibanez','ferrer','duran','santiago','benitez','mora','vicente','arias','vargas','carmona','crespo','roman','pastor','soto','saez','velasco','moya','soler','parra','esteban','bravo','gallardo','rojas','pardo','merino','franco','espinosa','izquierdo','lorenzo','montes','mateo','rivas','bermudez','etxeberria','arrieta','puig','pujol','casals','vila','oliver'];
 players text[]:=array['messi','cr7','neymar','mbappe','haaland','pedri','gavi','lamine','vini','bellingham','modric','kroos','ramos','iniesta','xavi','puyol','villa','torres','casillas','busquets','griezmann','benzema','lewan','valverde','rodri','olmo','morata','guti','isco','koke','oblak','carvajal','araujo','cucurella','oyarzabal','williams','joaquin','aspas','kubo','raphinha','dembele','salah','kane','zidane','ronaldinho','ronaldo','ibra','pique','marcelo','courtois','bale','suarez','dybala','camavinga','pirlo','totti','maldini','kaka','henry','drogba','rooney','buffon','cantona','eto','alves','etoo','forlan','falcao','aguero','riquelme','zanetti','cafu','beckham','figo','laudrup','hierro','butragueno','raul','zubizarreta','valeron','fernando','mendieta','nayim','tamudo','reina','silva','cazorla','mata','marchena','senna','capdevila','xabialonso'];
 words text[]:=array['crack','pichichi','golazo','chilena','rabona','vaselina','panenka','regate','bestia','maquina','tanque','rayo','toro','lobo','tigre','halcon','leon','pantera','cobra','dragon','ninja','rey','fenomeno','bala','cohete','misil','muro','pulpo','tiburon','zorro','buho','lince','gato','perro','pollo','croqueta','tortilla','churro','patata','bocata','chorizo','fideo','turron','galleta','pistacho','mango','pepino','tomate','limon','canelo','nene','chaval','mostro','figura','maestro','jefe','capi','socio','chino','rubio','moreno','flaco','gordo','bigote','calvo','pelos','tito','chispa','trueno','tornado','huracan','volcan','cometa','meteoro','eclipse','sombra','fantasma','vampiro','pirata','vikingo','samurai','gladiador','espartano','faraon','sultan','duque','conde','baron','capitan','sargento','cabo','profe','doctor','mister'];
 eng text[]:=array['dark','shadow','sniper','ghost','toxic','silent','crazy','lucky','mad','wild','pro','epic','ultra','mega','super','hyper','neo','alpha','omega','storm','blaze','frost','venom','phantom','reaper','hunter','killer','legend','king','boss','master','rookie','noob','beast','savage','flash','nova','pixel','glitch','turbo','nitro','rocket','vortex','zero','ace','chief','titan','striker','keeper','goat'];
 places text[]:=array['madrid','sevilla','cadiz','bilbao','vigo','malaga','zaragoza','valencia','murcia','granada','oviedo','gijon','huelva','almeria','cordoba','jaen','leon','burgos','soria','teruel','lugo','ourense','girona','lleida','tarragona','alicante','elche','cartagena','badajoz','caceres','toledo','cuenca','segovia','avila','salamanca','zamora','palencia','logrono','pamplona','santander','huesca','mallorca','ibiza','tenerife','canarias','ceuta','melilla','getafe','leganes','mostoles','alcorcon','fuenla','vallekas','triana','carabanchel'];
 shortplaces text[]:=array['bcn','mad','svq','vlc','bio','zgz','agp','alc','mur','ovi','gij','lpa','tfn','pmi','vgo','scq','grx','cdz'];
 clubs text[]:=array['madrid','barca','atleti','betis','sevilla','valencia','athletic','real','cule','merengue','colchonero','celta','depor','rayo','villarreal','osasuna','malaga','getafe','espanyol','alaves','levante','elche','granada','cadiz','sporting','oviedo','racing','zaragoza','mallorca','almeria','txuri','periquito','sevillista','madridista','culer','atletico','che','leones','groguet'];
 fan text[]:=array['4life','campeon','hastalamuerte','siempre','pasion','forever','fan','fiel','oficial','_ultra','1902','1899','1903','1907','10'];
 a text; s text; p text; w text; e text; e2 text; pl text; c text; result text; shown text; skeleton text;
 tries integer:=0; pattern integer; nn text; yy text; roots text[]; root text; limit_roots integer;
 leet text; sig text;
begin
 loop
  tries:=tries+1;
  if tries>400 then a:=field_private.pick_text(names); return array[left(a||'_'||replace(gen_random_uuid()::text,'-',''),14),upper(a)]; end if;
  a:=field_private.pick_text(names); s:=field_private.pick_text(surnames); p:=field_private.pick_text(players);
  w:=field_private.pick_text(words); e:=field_private.pick_text(eng); e2:=field_private.pick_text(eng);
  pl:=field_private.pick_text(places); c:=translate(field_private.pick_text(clubs),'é','e');
  nn:=(1+floor(random()*99))::integer::text; yy:=lpad(((85+floor(random()*25))::integer%100)::text,2,'0');
  leet:=translate(a,'ae','43');
  pattern:=floor(random()*34)::integer;
  shown:=a; roots:=array[a];
  result:=case pattern
   when 0 then a||s
   when 1 then initcap(a)||initcap(s)
   when 2 then left(a,1)||s||nn
   when 3 then a||'_'||s||yy
   when 4 then initcap(w)||initcap(a)
   when 5 then 'El'||initcap(w)||'De'||initcap(pl)
   when 6 then w||'_'||pl
   when 7 then (array[p||'_fan','fan_de_'||p,'soy'||p,p||'lover','team'||initcap(p)])[1+floor(random()*5)::integer]
   when 8 then 'soydel'||c
   when 9 then c||field_private.pick_text(fan)
   when 10 then (array[a||'ito',a||'ete',a||'in',a||'iyo',a||'illo'])[1+floor(random()*5)::integer]||case when random()<.6 then nn else '' end
   when 11 then case when random()<.5 then upper(leet) else leet end||case when random()<.4 then nn else '' end
   when 12 then upper(a)||'_'||upper(left(s,1))
   when 13 then initcap(e)||initcap(a)
   when 14 then initcap(e)||initcap(e2)
   when 15 then e||(100+floor(random()*900))::integer
   when 16 then a||repeat(right(a,1),2+floor(random()*3)::integer)
   when 17 then (array['_'||a||'_','__'||a||'__','x'||a||'x','xX'||initcap(a)||'Xx'])[1+floor(random()*4)::integer]
   when 18 then initcap(p)||(1998+floor(random()*12))::integer
   when 19 then a||'_'||w
   when 20 then w||nn
   when 21 then initcap(a)||'_'||upper(field_private.pick_text(shortplaces))
   when 22 then left(a,3)||left(s,3)||nn
   when 23 then s||'_'||nn
   when 24 then (array['Mr'||initcap(w),'Don'||initcap(s),'Sr'||initcap(s),'Profe'||initcap(a),'Tio'||initcap(a)])[1+floor(random()*5)::integer]
   when 25 then a||(array['yt','TV','_ttv','_live','gaming','plays'])[1+floor(random()*6)::integer]
   when 26 then initcap(w)||initcap(field_private.pick_text(words))
   when 27 then upper(left(a,1))||upper(left(s,1))||(1+floor(random()*99))::integer||(array['','x','z','_'])[1+floor(random()*4)::integer]
   when 28 then initcap(a)||initcap(s)||'_'
   when 29 then 'TheReal'||initcap(a)
   when 30 then p||'_de_'||pl
   when 31 then a||'_'||left(s,1)||yy
   when 32 then (array['el','el','lo'])[1+floor(random()*3)::integer]||w||'_'||nn
   else e||'_'||a end;
  -- Root words of the chosen format (what makes two names look alike).
  roots:=case
   when pattern in(0,1,2,3,22,28,31) then array[a,s]
   when pattern in(4,19) then array[w,a]
   when pattern in(5,6) then array[w,pl]
   when pattern in(7,18,30) then array[p]
   when pattern in(8,9) then array[c]
   when pattern in(13,33) then array[e,a]
   when pattern in(14) then array[e,e2]
   when pattern in(15) then array[e]
   when pattern in(20,26,32) then array[w]
   when pattern in(23) then array[s]
   when pattern=24 then array[w,s,a]
   when pattern=27 then array[left(a,1)||left(s,1)]
   else array[a] end;
  shown:=case
   when pattern in(7,18,30) then p
   when pattern in(5,6,20,26,32) then w
   when pattern in(14,15) then e
   when pattern in(8,9) then c
   when pattern=23 then s
   else a end;
  result:=regexp_replace(result,'[^A-Za-z0-9_]','','g');
  continue when length(result)>20;
  -- Occasionally all capitals or all lower case, like people type them.
  if random()<.08 then result:=upper(result); elsif random()<.1 then result:=lower(result); end if;
  skeleton:=regexp_replace(lower(result),'[^a-z]','','g');
  -- Recognisable formats (soydel…, team…, …2004, TheReal…) are capped so none dominates.
  sig:=case pattern
   when 5 then '^el[a-z]+de[a-z]' when 7 then '(_fan$|^fan_de_|^soy[a-z]|lover$|^team)' when 8 then '^soydel'
   when 9 then '(4life|campeon|hastalamuerte|siempre|pasion|forever|fiel|oficial|_ultra|19[0-9][0-9])$'
   when 10 then '(ito|ete|in|iyo|illo)[0-9]*$' when 12 then '^[a-z]+_[a-z]$' when 15 then '^[a-z]+[0-9]{3}$'
   when 16 then '(.)\1\1$' when 17 then '^(_|x)' when 18 then '[a-z](199[0-9]|20[01][0-9])$'
   when 21 then '_(bcn|mad|svq|vlc|bio|zgz|agp|alc|mur|ovi|gij|lpa|tfn|pmi|vgo|scq|grx|cdz)$'
   when 24 then '^(mr|don|sr|profe|tio)[a-z]' when 25 then '(yt|tv|_live|gaming|plays)$' when 27 then '^[a-z]{2}[0-9]+[xz_]?$'
   when 29 then '^thereal' when 30 then '_de_' when 32 then '^(el|la|lo)[a-z]+_[0-9]+$' end;
  continue when sig is not null and tries<=150 and (select count(*) from field_private.players where lower(username) ~ sig)>=7;
  limit_roots:=case when tries>150 then 6 else 3 end;
  continue when length(result)<3 or length(skeleton)<2;
  continue when exists(select 1 from field_private.players where lower(username)=lower(result) or regexp_replace(lower(username),'[^a-z]','','g')=skeleton);
  -- No root may already be in limit_roots usernames (two-letter roots are free).
  continue when exists(select 1 from unnest(roots) r where length(r)>2
   and (select count(*) from field_private.players where lower(username) like '%'||r||'%')>=limit_roots);
  return array[result,upper(left(shown,12))];
 end loop;
end; $$;


do $$
declare b record; name text[];
begin
 update field_private.players set username='b_'||lpad((row_number)::text,6,'0')
  from (select user_id id,row_number() over (order by user_id) from field_private.players where is_bot) t where t.id=user_id;
 for b in select user_id from field_private.players where is_bot order by elo desc loop
  name:=field_private.bot_name();
  update field_private.players set username=name[1],bot_profile=coalesce(bot_profile,'{}'::jsonb)||jsonb_build_object('name',left(name[2],12)) where user_id=b.user_id;
 end loop;
end $$;
