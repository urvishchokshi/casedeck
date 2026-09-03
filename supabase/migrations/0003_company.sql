-- 0003_company.sql — consulting-firm attribution for cases.
--
-- Extraction now captures the consulting firm a case is attributed to (e.g.
-- "McKinsey", "Bain") when the casebook states one — verbatim, never inferred.
-- Nullable: most cases carry no attribution. Indexed for equality filters in
-- the case library.
--
-- Safe to re-run.

alter table public.cases
  add column if not exists company text;

create index if not exists cases_company_idx
  on public.cases (company);

comment on column public.cases.company is
  'Consulting firm the case is attributed to, verbatim from the casebook; null when unstated (never inferred)';
