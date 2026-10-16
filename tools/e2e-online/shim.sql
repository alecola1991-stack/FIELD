-- Minimal Supabase stand-in for the local test database (roles, auth.uid(), realtime schema).
create role anon nologin; create role authenticated nologin;
grant usage on schema public to authenticated, anon;
create schema auth; grant usage on schema auth to authenticated, anon;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant execute on function auth.uid() to authenticated, anon;
create schema realtime; grant usage on schema realtime to authenticated;
create table realtime.messages(id serial, topic text);
alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic',true) $$;
