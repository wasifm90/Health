-- Health app schema. Run once in Supabase → SQL Editor → New query → Run.

create extension if not exists pgcrypto;

-- One row per user: body info used to set daily targets, plus the iPhone sync token.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  sex text check (sex in ('male', 'female')),
  birth_year int,
  height_cm numeric,
  weight_kg numeric,
  activity_level text not null default 'light'
    check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal text not null default 'maintain' check (goal in ('lose', 'maintain', 'gain')),
  sync_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  eaten_at timestamptz not null default now(),
  local_date date not null,
  meal_type text,
  photo_path text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists meals_user_date on public.meals (user_id, local_date);

create table if not exists public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  quantity numeric not null,
  unit text not null,
  grams numeric not null,
  nutrients jsonb not null default '{}'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists meal_items_meal on public.meal_items (meal_id);

-- Daily values from Apple Health (via Health Auto Export).
create table if not exists public.health_metrics (
  user_id uuid not null references auth.users (id) on delete cascade,
  metric text not null,
  metric_date date not null,
  value numeric not null,
  unit text,
  updated_at timestamptz not null default now(),
  primary key (user_id, metric, metric_date)
);

create table if not exists public.inbody_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_date date not null,
  photo_path text,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists inbody_user_date on public.inbody_scans (user_id, scan_date desc);

create table if not exists public.daily_reports (
  user_id uuid not null references auth.users (id) on delete cascade,
  report_date date not null,
  report jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, report_date)
);

-- Shared cache of USDA lookups (no personal data). Only the server writes it.
create table if not exists public.food_cache (
  query text primary key,
  fdc_id bigint,
  description text,
  per100g jsonb,
  created_at timestamptz not null default now()
);

-- Row-level security: each user sees only their own rows.
alter table public.profiles enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.health_metrics enable row level security;
alter table public.inbody_scans enable row level security;
alter table public.daily_reports enable row level security;
alter table public.food_cache enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles','meals','meal_items','health_metrics','inbody_scans','daily_reports'] loop
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format(
      'create policy own_rows on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t);
  end loop;
end $$;

-- Create a profile automatically for each new account.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (user_id)
select id from auth.users on conflict do nothing;

-- Private photo storage: files live under photos/<user id>/...
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists photos_own on storage.objects;
create policy photos_own on storage.objects for all to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
