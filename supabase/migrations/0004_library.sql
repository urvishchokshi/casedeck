-- 0004_library.sql — casebook PDFs, frameworks, and study materials.
--
-- Phase 5 adds the download/study surface: a private library-files bucket for
-- casebook PDFs and study-material files, a frameworks table whose entries are
-- rendered pages from casebook PDFs (images live in the existing case-images
-- bucket, reusing objects the case importer already rendered), and a materials
-- table for standalone downloadable files (populated manually via Studio).
-- casebooks.pdf_url is repurposed as a storage path in library-files.
--
-- Safe to re-run.

-- ============================================================
-- frameworks
-- ============================================================

create table if not exists public.frameworks (
  id uuid primary key default gen_random_uuid(),
  -- Global (not per-casebook) uniqueness: the import script upserts on title.
  title text unique not null,
  description text,
  casebook_id uuid references public.casebooks (id) on delete set null,
  image_paths jsonb not null default '[]',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- materials
-- ============================================================

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  file_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.frameworks enable row level security;
alter table public.materials enable row level security;

-- frameworks / materials: read-only for signed-in users. Writes go through
-- the service role key (import script / Studio), which bypasses RLS — no
-- insert/update/delete policies on purpose.
drop policy if exists "frameworks_select_authenticated" on public.frameworks;
create policy "frameworks_select_authenticated"
  on public.frameworks for select
  to authenticated
  using (true);

drop policy if exists "materials_select_authenticated" on public.materials;
create policy "materials_select_authenticated"
  on public.materials for select
  to authenticated
  using (true);

-- ============================================================
-- Storage: private bucket for casebook PDFs + study-material files
-- ============================================================

insert into storage.buckets (id, name, public)
values ('library-files', 'library-files', false)
on conflict (id) do nothing;

-- Signed-in users can read; uploads happen with the service role key only.
-- Note: on some newer Supabase projects the SQL editor role cannot create
-- policies on storage.objects ("must be owner of table objects"). If this
-- statement fails, create the same select-for-authenticated policy via
-- Dashboard → Storage → library-files → Policies instead.
drop policy if exists "library_files_select_authenticated" on storage.objects;
create policy "library_files_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'library-files');

-- ============================================================
-- Column documentation
-- ============================================================

comment on column public.frameworks.image_paths is
  'Ordered storage paths in the private case-images bucket (e.g. "iim-a/p12.png") — sign at read time';

comment on column public.materials.file_path is
  'Storage path in the private library-files bucket — sign at read time';

comment on column public.casebooks.pdf_url is
  'Storage path of the casebook PDF in the private library-files bucket (a path, NOT a URL) — sign at read time; null = no PDF yet';
