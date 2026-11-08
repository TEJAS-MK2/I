create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create or replace function auth.uid()
returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
insert into auth.users(id) values
('123e4567-e89b-42d3-a456-426614174001'),
('123e4567-e89b-42d3-a456-426614174002');
