import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { createClient } from "@/lib/supabase/server";
import { MIN_RATINGS_TO_SHOW, shownRating } from "@/lib/rating";
import type { CaseOutcome, DifficultyLevel } from "@/lib/types";
import {
  buildCasesSearchString,
  parseCaseFilters,
  sanitizeSearchQuery,
  type FilterOption,
} from "@/lib/case-filters";
import { CaseFilterBar, type FilterGroup } from "./CaseFilters";
import { CaseTable, type CaseTableRow } from "./CaseTable";

export const metadata = { title: "Case library" };

interface CaseListRow {
  id: string;
  title: string;
  case_types: string[];
  industry: string | null;
  company: string | null;
  difficulty: DifficultyLevel | null;
  avg_rating: number | null;
  rating_count: number;
  /** Not displayed here (it lives on the case page) — kept as the order tiebreaker. */
  source_start_page: number;
  casebook: { name: string } | null;
}

interface FacetRow {
  case_types: string[];
  industry: string | null;
  difficulty: DifficultyLevel | null;
  company: string | null;
}

const DIFFICULTY_ORDER: readonly string[] = ["Easy", "Medium", "Hard"];

/** "IIM Ahmedabad Casebook 2025–26" → "IIM-Ahmedabad 2025–26" (design rule). */
function shortBookName(name: string): string {
  return name.replace(" Casebook", "").replace(/^IIM /, "IIM-");
}

/**
 * Distinct sorted values unioned with any selected-but-unknown values, so a
 * stale shared URL still renders a removable accent chip instead of an
 * invisible active filter.
 */
function toOptions(values: Iterable<string>, selected: string[]): FilterOption[] {
  const distinct = [...new Set([...values, ...selected])].sort((a, b) =>
    a.localeCompare(b)
  );
  return distinct.map((value) => ({ value, label: value }));
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const filters = parseCaseFilters(await searchParams);
  const supabase = await createClient();
  // The (app) layout redirects unauthenticated visitors, so user is present;
  // the null guard just keeps this page from crashing if that ever changes.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // One filtered query; every case has a casebook (casebook_id NOT NULL), so
  // the !inner embed is lossless and lets ?casebook= filter on the slug.
  let query = supabase
    .from("cases")
    .select(
      "id, title, case_types, industry, company, difficulty, avg_rating, rating_count, source_start_page, casebook:casebooks!inner(name)"
    )
    // Deterministic server-side order so the row caps can never drop an
    // arbitrary subset; display order (by casebook name) is applied below.
    .order("casebook_id")
    .order("source_start_page")
    // Guard against unbounded growth; pagination is a future enhancement.
    .limit(500);
  if (filters.types.length) query = query.overlaps("case_types", filters.types);
  if (filters.difficulties.length)
    query = query.in("difficulty", filters.difficulties);
  if (filters.industries.length)
    query = query.in("industry", filters.industries);
  if (filters.companies.length) query = query.in("company", filters.companies);
  if (filters.casebooks.length)
    query = query.in("casebook.slug", filters.casebooks);
  // The rating threshold pairs with a count gate so the filter can't match
  // cases still displayed as "New" (avg hidden until MIN_RATINGS_TO_SHOW).
  if (filters.rating !== null)
    query = query
      .gte("avg_rating", filters.rating)
      .gte("rating_count", MIN_RATINGS_TO_SHOW);
  const safeQ = sanitizeSearchQuery(filters.q);
  if (safeQ)
    query = query.or(`title.ilike.%${safeQ}%,company.ilike.%${safeQ}%`);

  const [casesRes, facetsRes, casebooksRes, progressRes] = await Promise.all([
    query,
    // Unfiltered facet source: chip options always reflect the whole library.
    // Subject to the PostgREST default row cap (1000) — fine at current scale;
    // revisit alongside pagination.
    supabase.from("cases").select("case_types, industry, difficulty, company"),
    supabase.from("casebooks").select("slug, name").order("name"),
    user
      ? supabase
          .from("user_case_progress")
          .select("case_id, outcome")
          .eq("user_id", user.id)
      : null,
  ]);
  const firstError =
    casesRes.error ?? facetsRes.error ?? casebooksRes.error ?? progressRes?.error;
  if (firstError) {
    throw new Error(`Failed to load cases: ${firstError.message}`);
  }

  const outcomeByCase = new Map<string, CaseOutcome | null>(
    (progressRes?.data ?? []).map((p) => [p.case_id, p.outcome])
  );

  // The Status group filters in JS after the query: "not started" is the
  // absence of a progress row, which the SQL filter can't express; fine under
  // the 500-row cap.
  const statusClauses: ((o: CaseOutcome | null) => boolean)[] = [];
  if (filters.status === "done") statusClauses.push((o) => o === "done");
  if (filters.status === "revisit") statusClauses.push((o) => o === "revisit");
  if (filters.status === "not_done") statusClauses.push((o) => o === null);

  const cases = ((casesRes.data ?? []) as unknown as CaseListRow[])
    .filter(
      (c) =>
        statusClauses.length === 0 ||
        statusClauses.some((clause) =>
          clause(outcomeByCase.get(c.id) ?? null)
        )
    )
    .sort(
      (a, b) =>
        (a.casebook?.name ?? "").localeCompare(b.casebook?.name ?? "") ||
        a.source_start_page - b.source_start_page
    );
  const facets = (facetsRes.data ?? []) as unknown as FacetRow[];
  const casebooks = casebooksRes.data ?? [];
  const totalCases = facets.length;

  const rows: CaseTableRow[] = cases.map((c) => {
    const rating = shownRating(c.avg_rating, c.rating_count);
    return {
      id: c.id,
      title: c.title,
      book: shortBookName(c.casebook?.name ?? "—"),
      company: c.company,
      industry: c.industry,
      type: c.case_types.join(", "),
      difficulty: c.difficulty,
      rating: rating !== null ? rating.toFixed(1) : null,
      outcome: outcomeByCase.get(c.id) ?? null,
    };
  });

  const nonNull = (values: (string | null)[]) =>
    values.filter((v): v is string => v !== null);
  const filterGroups: FilterGroup[] = [
    {
      label: "Type",
      param: "type" as const,
      options: toOptions(facets.flatMap((f) => f.case_types), filters.types),
      selected: filters.types,
    },
    {
      label: "Industry",
      param: "industry" as const,
      options: toOptions(nonNull(facets.map((f) => f.industry)), filters.industries),
      selected: filters.industries,
    },
    {
      label: "Difficulty",
      param: "difficulty" as const,
      options: toOptions(
        nonNull(facets.map((f) => f.difficulty)),
        filters.difficulties
      ).sort(
        (a, b) =>
          DIFFICULTY_ORDER.indexOf(a.value) - DIFFICULTY_ORDER.indexOf(b.value)
      ),
      selected: filters.difficulties,
    },
    {
      label: "Company",
      param: "company" as const,
      options: toOptions(nonNull(facets.map((f) => f.company)), filters.companies),
      selected: filters.companies,
    },
    {
      label: "Casebook",
      param: "casebook" as const,
      options: [
        ...casebooks.map((cb) => ({
          value: cb.slug,
          label: shortBookName(cb.name),
        })),
        ...filters.casebooks
          .filter((slug) => !casebooks.some((cb) => cb.slug === slug))
          .map((slug) => ({ value: slug, label: slug })),
      ],
      selected: filters.casebooks,
    },
  ].filter((group) => group.options.length > 0);

  return (
    // Matches the shell <main>'s flex column so the fade-up wrapper is
    // layout-neutral.
    <div className="cd-fade-up flex flex-col gap-4">
      <PageTitle plain="Case " accent="Library" />

      <CaseFilterBar
        groups={filterGroups}
        filters={filters}
        resultCount={cases.length}
      >
        {totalCases === 0 ? (
          <div className="grid place-items-center px-6 pb-16 pt-8 text-center">
            <div>
              <p className="text-[17px] font-semibold text-[var(--ink)]">
                No cases yet
              </p>
              <p className="mt-1 text-[14px] text-[var(--muted)]">
                Import a casebook with the content pipeline and cases will show
                up here.
              </p>
            </div>
          </div>
        ) : cases.length === 0 ? (
          <div className="grid place-items-center px-6 pb-16 pt-8 text-center">
            <div>
              <p className="text-[17px] font-semibold text-[var(--ink)]">
                No cases match your filters
              </p>
              <p className="mt-1 text-[14px] text-[var(--muted)]">
                Try removing some filters or changing your search.
              </p>
              <Link
                href="/cases"
                className="mt-4 inline-flex h-[34px] items-center rounded-[var(--rs)] border border-[var(--line-ctl)] bg-[var(--card)] px-4 text-[12.5px] font-semibold text-[var(--slate)] transition-colors hover:border-[var(--line-hover)]"
              >
                Clear filters
              </Link>
            </div>
          </div>
        ) : (
          // Keyed on the filter state so the load-more window resets when the
          // result set changes.
          <CaseTable key={buildCasesSearchString(filters)} rows={rows} />
        )}
      </CaseFilterBar>
    </div>
  );
}
