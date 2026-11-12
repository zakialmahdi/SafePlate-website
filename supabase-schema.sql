-- SafePlate Postgres schema for storing user profiles & allergy preferences.
-- Run this in Supabase Dashboard -> SQL Editor if you want a dedicated
-- `public.profiles` table in addition to `auth.users` metadata.

create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  strict_mode boolean not null default true,
  trace_alerts boolean not null default true,
  allergens jsonb not null default '[
    {"name":"Peanuts","note":"Avoid all traces","severity":"High","tone":"red"},
    {"name":"Dairy","note":"Includes derivatives","severity":"High","tone":"violet"}
  ]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_allergens_is_array check (jsonb_typeof(allergens) = 'array')
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, full_name, strict_mode, trace_alerts, allergens)
  values (
    new.id,
    coalesce(nullif(trim(meta->>'full_name'), ''), ''),
    coalesce((meta->>'strict_mode')::boolean, true),
    coalesce((meta->>'trace_alerts')::boolean, true),
    case
      when jsonb_typeof(meta->'allergens') = 'array' then meta->'allergens'
      else '[
        {"name":"Peanuts","note":"Avoid all traces","severity":"High","tone":"red"},
        {"name":"Dairy","note":"Includes derivatives","severity":"High","tone":"violet"}
      ]'::jsonb
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function private.handle_new_user();
