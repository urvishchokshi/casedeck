-- 0005_outcome.sql — replace user_case_progress.completed with a 3-way
-- outcome enum. Progress rows are test data: truncated, no backfill.
-- completed_at is retained and now means "outcome last set at".

do $$ begin
  create type public.case_outcome as enum ('done', 'retry', 'revisit');
exception when duplicate_object then null; end $$;

truncate table public.user_case_progress;

alter table public.user_case_progress
  drop column if exists completed;

alter table public.user_case_progress
  add column if not exists outcome public.case_outcome;

-- Aggregates were derived from the truncated rows — reset them.
update public.cases
set avg_rating = null, rating_count = 0
where avg_rating is not null or rating_count <> 0;

-- Only rows with a logged outcome count toward a case's rating.
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
      where p.case_id = cid
        and p.quality_rating is not null
        and p.outcome is not null
    ) sub
    where c.id = cid;
  end loop;

  return coalesce(new, old);
end;
$$;

drop trigger if exists recompute_case_rating on public.user_case_progress;
create trigger recompute_case_rating
  after insert or delete or update of quality_rating, outcome, case_id
  on public.user_case_progress
  for each row execute function public.recompute_case_rating();
