-- 0006_remove_retry_marked.sql — drop the 'retry' outcome value and the
-- mark-for-later feature. Existing retry rows are un-logged (outcome, scores,
-- completed_at nulled — mirrors clearOutcome). Postgres cannot drop a value
-- from an enum, so case_outcome is rebuilt as ('done','revisit').

-- 1. Un-log retry rows. Nulling quality_rating/outcome fires
--    recompute_case_rating per row, so cases.avg_rating/rating_count self-heal.
update public.user_case_progress
set outcome = null,
    quality_rating = null,
    self_score = null,
    completed_at = null
where outcome = 'retry';

-- 2. Rebuild the enum without 'retry'.
create type public.case_outcome_new as enum ('done', 'revisit');
alter table public.user_case_progress
  alter column outcome type public.case_outcome_new
  using outcome::text::public.case_outcome_new;
drop type public.case_outcome;
alter type public.case_outcome_new rename to case_outcome;

-- 3. Drop mark-for-later.
alter table public.user_case_progress
  drop column if exists marked_for_later;

-- 4. Hygiene: rows now carrying nothing (incl. freshly un-logged retry rows)
--    are all-null noise — indistinguishable from "no row" to the app.
--    Migration-only delete; the app deliberately keeps no delete policy.
delete from public.user_case_progress
where outcome is null and self_score is null and quality_rating is null;
