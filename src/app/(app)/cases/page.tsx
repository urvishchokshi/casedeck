import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { createClient } from "@/lib/supabase/server";
import type { DifficultyLevel } from "@/lib/types";
import {
  parseCaseFilters,
  sanitizeSearchQuery,
  countActiveFilters,
  type FilterOption,
} from "@/lib/case-filters";
import {
  CaseFilterGroups,
  CaseSearchControls,
  type ChipGroup,
} from "./CaseFilters";

interface CaseListRow {
  id: string;
  title: string;
  case_types: string[];
  industry: string | null;
  company: string | null;
  difficulty: DifficultyLevel | null;
  avg_rating: number | null;
  rating_count: number;
  source_start_page: number;
  casebook: { name: string } | null;
}

interface FacetRow {
  case_types: string[];
  industry: string | null;
  difficulty: DifficultyLevel | null;
  company: string | null;
}

const thClasses =
  "border-b border-[var(--line)] px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] first:pl-4 last:pr-4";
const tdClasses =
  "border-b border-[var(--line-soft)] px-3 py-2.5 text-[13px] first:pl-4 last:pr-4";

function Rating({ c }: { c: CaseListRow }) {
  return c.rating_count > 0 && c.avg_rating !== null ? (
    <span className="font-semibold text-[var(--amber)]">
      ★ {c.avg_rating.toFixed(1)}
    </span>
  ) : (
    <span className="text-[var(--muted)]">New</span>
  );
}

const DIFFICULTY_ORDER: readonly string[] = ["Easy", "Medium", "Hard"];

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
  if (filters.rating !== null) query = query.gte("avg_rating", filters.rating);
  const safeQ = sanitizeSearchQuery(filters.q);
  if (safeQ)
    query = query.or(`title.ilike.%${safeQ}%,company.ilike.%${safeQ}%`);

  const [casesRes, facetsRes, casebooksRes] = await Promise.all([
    query,
    // Unfiltered facet source: chip options always reflect the whole library.
    // Subject to the PostgREST default row cap (1000) — fine at current scale;
    // revisit alongside pagination.
    supabase.from("cases").select("case_types, industry, difficulty, company"),
    supabase.from("casebooks").select("slug, name").order("name"),
  ]);
  const firstError = casesRes.error ?? facetsRes.error ?? casebooksRes.error;
  if (firstError) {
    throw new Error(`Failed to load cases: ${firstError.message}`);
  }

  const cases = ((casesRes.data ?? []) as unknown as CaseListRow[]).sort(
    (a, b) =>
      (a.casebook?.name ?? "").localeCompare(b.casebook?.name ?? "") ||
      a.source_start_page - b.source_start_page
  );
  const facets = (facetsRes.data ?? []) as unknown as FacetRow[];
  const casebooks = casebooksRes.data ?? [];
  const totalCases = facets.length;
  const activeCount = countActiveFilters(filters);

  const nonNull = (values: (string | null)[]) =>
    values.filter((v): v is string => v !== null);
  const chipGroups: ChipGroup[] = [
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
      label: "Industry",
      param: "industry" as const,
      options: toOptions(nonNull(facets.map((f) => f.industry)), filters.industries),
      selected: filters.industries,
    },
    {
      label: "Type",
      param: "type" as const,
      options: toOptions(facets.flatMap((f) => f.case_types), filters.types),
      selected: filters.types,
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
        ...casebooks.map((cb) => ({ value: cb.slug, label: cb.name })),
        ...filters.casebooks
          .filter((slug) => !casebooks.some((cb) => cb.slug === slug))
          .map((slug) => ({ value: slug, label: slug })),
      ],
      selected: filters.casebooks,
    },
  ].filter((group) => group.options.length > 0);

  return (
    <div>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[40px] text-[var(--ink)]">Case library</h1>
          <p className="mt-1 text-[14px] text-[var(--muted)]">
            {`${cases.length} ${cases.length === 1 ? "case" : "cases"}`}
            {activeCount > 0 &&
              ` · ${activeCount} ${activeCount === 1 ? "filter" : "filters"} active`}
          </p>
        </div>
        <CaseSearchControls filters={filters} />
      </div>

      <div className="mb-[18px] flex flex-col gap-[11px] rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-[18px] py-4 [box-shadow:var(--sh)]">
        <CaseFilterGroups groups={chipGroups} filters={filters} />
      </div>

      {totalCases === 0 ? (
        <div className="grid place-items-center rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-6 py-16 text-center [box-shadow:var(--sh)]">
          <div>
            <p className="text-[17px] font-semibold text-[var(--ink)]">
              No cases yet
            </p>
            <p className="mt-1 text-[14px] text-[var(--muted)]">
              Import a casebook with the content pipeline and cases will show up
              here.
            </p>
          </div>
        </div>
      ) : cases.length === 0 ? (
        <div className="grid place-items-center rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-6 py-16 text-center [box-shadow:var(--sh)]">
          <div>
            <p className="text-[17px] font-semibold text-[var(--ink)]">
              No cases match your filters
            </p>
            <p className="mt-1 text-[14px] text-[var(--muted)]">
              Try removing some filters or changing your search.
            </p>
            <Link
              href="/cases"
              className="mt-4 inline-flex h-[38px] items-center rounded-full border border-[var(--line)] bg-[var(--card)] px-[15px] text-[13.5px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--thead)]"
            >
              Clear filters
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] [box-shadow:var(--sh)] md:block">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[var(--thead)]">
                  <th className={`${thClasses} w-[34%]`}>Case</th>
                  <th className={thClasses}>Casebook</th>
                  <th className={thClasses}>Company</th>
                  <th className={thClasses}>Industry</th>
                  <th className={thClasses}>Type</th>
                  <th className={thClasses}>Difficulty</th>
                  <th className={thClasses}>Rating</th>
                  <th className={thClasses}>Status</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr
                    key={c.id}
                    className="relative transition-colors hover:bg-[var(--thead)]"
                  >
                    <td className={tdClasses}>
                      <Link
                        href={`/cases/${c.id}`}
                        className="after:absolute after:inset-0"
                      >
                        <span className="block text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[var(--ink)]">
                          {c.title}
                        </span>
                        <span className="block font-[family-name:var(--font-mono)] text-[12px] text-[var(--muted)]">
                          p. {c.source_start_page}
                        </span>
                      </Link>
                    </td>
                    <td className={`${tdClasses} text-[var(--muted)]`}>
                      {c.casebook?.name ?? "—"}
                    </td>
                    <td className={tdClasses}>
                      {c.company ? (
                        <Pill>{c.company}</Pill>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className={tdClasses}>
                      {c.industry ? (
                        <Pill>{c.industry}</Pill>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className={tdClasses}>
                      <span className="flex flex-wrap gap-1.5">
                        {c.case_types.map((t, i) => (
                          <Pill key={`type-${t}-${i}`} tone="accent">
                            {t}
                          </Pill>
                        ))}
                      </span>
                    </td>
                    <td className={tdClasses}>
                      {c.difficulty ? (
                        <Pill>{c.difficulty}</Pill>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className={tdClasses}>
                      <Rating c={c} />
                    </td>
                    <td className={`${tdClasses} text-[var(--muted)]`}>—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {cases.map((c) => (
              <Link
                key={c.id}
                href={`/cases/${c.id}`}
                className="block rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] p-4 [box-shadow:var(--sh)]"
              >
                <div className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[var(--ink)]">
                  {c.title}
                </div>
                <div className="mt-0.5 font-[family-name:var(--font-mono)] text-[12px] text-[var(--muted)]">
                  {c.casebook?.name ?? "—"} · p. {c.source_start_page}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {c.case_types.map((t, i) => (
                    <Pill key={`type-${t}-${i}`} tone="accent">
                      {t}
                    </Pill>
                  ))}
                  {c.company && <Pill>{c.company}</Pill>}
                  {c.difficulty && <Pill>{c.difficulty}</Pill>}
                  {c.rating_count > 0 && c.avg_rating !== null ? (
                    <Pill tone="amber">★ {c.avg_rating.toFixed(1)}</Pill>
                  ) : (
                    <Pill tone="amber">New</Pill>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
