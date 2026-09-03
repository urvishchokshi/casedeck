-- 0002_pipeline_tags.sql — reconcile public.cases with the extraction pipeline.
--
-- Dynamic text[] tag columns (multi-type cases, verbatim labels), nullable
-- industry/difficulty (extraction permits nulls), a case prompt column, and a
-- printed-page-based idempotency key replacing source_file.
--
-- Safe to re-run. cases was empty when this migration was written, so no
-- backfill is needed (and source_start_page's default 0 cannot collide).

-- 1. Old idempotency key + source_file go away.
--    The constraint was created inline/unnamed in 0001, so it carries the
--    auto-generated name below; even if the name ever differed, dropping the
--    column removes the dependent constraint anyway.
alter table public.cases
  drop constraint if exists cases_casebook_id_source_file_key;
alter table public.cases
  drop column if exists source_file;

-- 2. Single-value case_type replaced by case_types text[].
--    Dropping the column drops its index implicitly; explicit for clarity.
drop index if exists public.cases_case_type_idx;
alter table public.cases
  drop column if exists case_type;

-- 3. New tag/content columns.
alter table public.cases
  add column if not exists case_types text[] not null default '{}',
  add column if not exists extra_tags text[] not null default '{}',
  add column if not exists tags_inferred boolean not null default false,
  add column if not exists prompt text,
  add column if not exists source_start_page integer not null default 0,
  add column if not exists printed_pages integer[] not null default '{}';

-- 4. Extraction legitimately emits nulls for these when undeterminable.
alter table public.cases alter column industry drop not null;
alter table public.cases alter column difficulty drop not null;

-- 5. New idempotency key for re-imports: first printed page of the case.
--    (add constraint has no IF NOT EXISTS, hence the DO block.)
do $$ begin
  alter table public.cases
    add constraint cases_casebook_id_source_start_page_key
    unique (casebook_id, source_start_page);
-- duplicate_table (42P07): a re-added unique constraint fails on its backing
-- index relation, not with duplicate_object.
exception when duplicate_object or duplicate_table then null; end $$;

-- 6. GIN indexes for array-containment tag filters in the case library.
create index if not exists cases_case_types_gin_idx
  on public.cases using gin (case_types);
create index if not exists cases_extra_tags_gin_idx
  on public.cases using gin (extra_tags);

-- 7. Documentation-only comments (no type changes).
comment on column public.cases.transcript is
  'jsonb array of {speaker: "interviewer" | "candidate", text: string} turns';
comment on column public.cases.source_start_page is
  'First printed page of the case; with casebook_id, the import idempotency key';
comment on column public.cases.printed_pages is
  'All printed page numbers (slide-footer numbers) the case spans';
comment on column public.cases.solution_image_urls is
  'Ordered storage paths in the private case-images bucket (<slug>/p<printed>.png), signed at read time — not URLs';
comment on column public.cases.exhibit_image_urls is
  'Ordered storage paths in the private case-images bucket (<slug>/p<printed>.png), signed at read time — not URLs';
