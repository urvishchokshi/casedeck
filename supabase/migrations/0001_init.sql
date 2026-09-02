-- 0001_init.sql — CasePrep initial schema.
-- Safe to re-run: enums, tables, triggers, policies and the storage bucket
-- are all created idempotently.

-- ============================================================
-- Enums
-- ============================================================

do $$ begin
  create type public.difficulty_level as enum ('Easy', 'Medium', 'Hard');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.partner_status as enum ('available', 'busy');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.mode_pref as enum ('online', 'offline', 'both');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.campus_type as enum ('Hyderabad', 'Mohali');
exception when duplicate_object then null; end $$;

-- ============================================================
-- Shared trigger: keep updated_at current
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================
-- profiles
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  campus public.campus_type,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any users created before this trigger existed.
insert into public.profiles (id, email, full_name)
select u.id, coalesce(u.email, ''), nullif(u.raw_user_meta_data ->> 'full_name', '')
from auth.users u
on conflict (id) do nothing;

-- ============================================================
-- casebooks
-- ============================================================

create table if not exists public.casebooks (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  college text,
  pdf_url text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- cases
-- ============================================================

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  casebook_id uuid not null references public.casebooks (id) on delete cascade,
  source_file text not null,
  title text not null,
  industry text not null,
  case_type text not null,
  difficulty public.difficulty_level not null,
  transcript jsonb not null default '[]',
  solution_image_urls jsonb not null default '[]',
  exhibit_image_urls jsonb not null default '[]',
  avg_rating numeric(3, 2),
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Idempotency key for the import pipeline: re-importing the same
  -- source file into the same casebook overwrites in place.
  unique (casebook_id, source_file)
);

create index if not exists cases_casebook_id_idx on public.cases (casebook_id);
create index if not exists cases_industry_idx on public.cases (industry);
create index if not exists cases_case_type_idx on public.cases (case_type);
create index if not exists cases_difficulty_idx on public.cases (difficulty);

drop trigger if exists set_cases_updated_at on public.cases;
create trigger set_cases_updated_at
  before update on public.cases
  for each row execute function public.set_updated_at();

-- ============================================================
-- user_case_progress
-- ============================================================

create table if not exists public.user_case_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  completed boolean not null default false,
  marked_for_later boolean not null default false,
  self_score smallint check (self_score between 1 and 10),
  quality_rating smallint check (quality_rating between 1 and 5),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, case_id)
);

create index if not exists user_case_progress_user_id_idx on public.user_case_progress (user_id);
create index if not exists user_case_progress_case_id_idx on public.user_case_progress (case_id);

drop trigger if exists set_user_case_progress_updated_at on public.user_case_progress;
create trigger set_user_case_progress_updated_at
  before update on public.user_case_progress
  for each row execute function public.set_updated_at();

-- ============================================================
-- match_profiles
-- ============================================================

create table if not exists public.match_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  whatsapp_number text not null,
  workex_function text not null,
  workex_industry text not null,
  campus public.campus_type not null,
  mode_preference public.mode_pref not null default 'both',
  status public.partner_status not null default 'available',
  updated_at timestamptz not null default now()
);

drop trigger if exists set_match_profiles_updated_at on public.match_profiles;
create trigger set_match_profiles_updated_at
  before update on public.match_profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- Rating aggregates on cases
-- ============================================================

-- Security definer so a user's own progress write may update the cases
-- aggregate columns despite cases having no update policy.
create or replace function public.recompute_case_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected uuid[];
  cid uuid;
begin
  if tg_op = 'INSERT' then
    affected := array[new.case_id];
  elsif tg_op = 'DELETE' then
    affected := array[old.case_id];
  elsif new.case_id is distinct from old.case_id then
    affected := array[old.case_id, new.case_id];
  else
    affected := array[new.case_id];
  end if;

  foreach cid in array affected loop
    update public.cases c
    set
      avg_rating = sub.avg_rating,
      rating_count = sub.rating_count
    from (
      select
        round(avg(p.quality_rating)::numeric, 2) as avg_rating,
        count(p.quality_rating)::integer as rating_count
      from public.user_case_progress p
      where p.case_id = cid and p.quality_rating is not null
    ) sub
    where c.id = cid;
  end loop;

  return coalesce(new, old);
end;
$$;

drop trigger if exists recompute_case_rating on public.user_case_progress;
create trigger recompute_case_rating
  after insert or delete or update of quality_rating, case_id
  on public.user_case_progress
  for each row execute function public.recompute_case_rating();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.casebooks enable row level security;
alter table public.cases enable row level security;
alter table public.user_case_progress enable row level security;
alter table public.match_profiles enable row level security;

-- profiles: everyone signed in can read; users update only their own row.
-- is_admin is protected via column-level privileges below, since RLS
-- cannot compare old and new values.
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Users may only change full_name and campus — never is_admin, email or id.
revoke update on public.profiles from authenticated;
grant update (full_name, campus) on public.profiles to authenticated;

-- casebooks / cases: read-only for signed-in users. Writes go through the
-- service role key (import pipeline), which bypasses RLS.
drop policy if exists "casebooks_select_authenticated" on public.casebooks;
create policy "casebooks_select_authenticated"
  on public.casebooks for select
  to authenticated
  using (true);

drop policy if exists "cases_select_authenticated" on public.cases;
create policy "cases_select_authenticated"
  on public.cases for select
  to authenticated
  using (true);

-- user_case_progress: users manage only their own rows.
drop policy if exists "user_case_progress_select_own" on public.user_case_progress;
create policy "user_case_progress_select_own"
  on public.user_case_progress for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_case_progress_insert_own" on public.user_case_progress;
create policy "user_case_progress_insert_own"
  on public.user_case_progress for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_case_progress_update_own" on public.user_case_progress;
create policy "user_case_progress_update_own"
  on public.user_case_progress for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- match_profiles: everyone signed in can browse; users manage their own row.
drop policy if exists "match_profiles_select_authenticated" on public.match_profiles;
create policy "match_profiles_select_authenticated"
  on public.match_profiles for select
  to authenticated
  using (true);

drop policy if exists "match_profiles_insert_own" on public.match_profiles;
create policy "match_profiles_insert_own"
  on public.match_profiles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "match_profiles_update_own" on public.match_profiles;
create policy "match_profiles_update_own"
  on public.match_profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "match_profiles_delete_own" on public.match_profiles;
create policy "match_profiles_delete_own"
  on public.match_profiles for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ============================================================
-- Storage: private bucket for case solution/exhibit images
-- ============================================================

insert into storage.buckets (id, name, public)
values ('case-images', 'case-images', false)
on conflict (id) do nothing;

-- Signed-in users can read; uploads happen with the service role key only.
-- Note: on some newer Supabase projects the SQL editor role cannot create
-- policies on storage.objects ("must be owner of table objects"). If this
-- statement fails, create the same select-for-authenticated policy via
-- Dashboard → Storage → case-images → Policies instead.
drop policy if exists "case_images_select_authenticated" on storage.objects;
create policy "case_images_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'case-images');
