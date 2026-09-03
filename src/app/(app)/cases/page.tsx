import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { createClient } from "@/lib/supabase/server";
import type { DifficultyLevel } from "@/lib/types";

interface FilterGroup {
  label: string;
  options: string[];
}

const filterGroups: FilterGroup[] = [
  { label: "Difficulty", options: ["Easy", "Medium", "Hard"] },
  { label: "Industry", options: ["Aviation", "FMCG", "Pharma", "Auto", "E-commerce", "BFSI"] },
  { label: "Type", options: ["Profitability", "Market Entry", "Pricing", "Growth", "Operations"] },
  { label: "Rating", options: ["4★ & up", "3★ & up", "Any"] },
  { label: "Casebook", options: ["ISB 2025", "IIM A", "IIM B", "IIM C"] },
  { label: "Status", options: ["Not started", "Done", "Marked for later"] },
];

interface CaseListRow {
  id: string;
  title: string;
  case_types: string[];
  extra_tags: string[];
  difficulty: DifficultyLevel | null;
  avg_rating: number | null;
  rating_count: number;
  source_start_page: number;
  casebook: { name: string } | null;
}

const thClasses =
  "border-b border-[var(--line)] px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] first:pl-4 last:pr-4";
const tdClasses =
  "border-b border-[var(--line-soft)] px-3 py-2.5 text-[13px] first:pl-4 last:pr-4";

/** Extra tags are shown only when the tag row stays short; otherwise omitted. */
function visibleExtraTags(c: CaseListRow): string[] {
  return c.case_types.length + c.extra_tags.length <= 3 ? c.extra_tags : [];
}

function Rating({ c }: { c: CaseListRow }) {
  return c.rating_count > 0 && c.avg_rating !== null ? (
    <span className="font-semibold text-[var(--amber)]">
      ★ {c.avg_rating.toFixed(1)}
    </span>
  ) : (
    <span className="text-[var(--muted)]">New</span>
  );
}

export default async function CasesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cases")
    .select(
      "id, title, case_types, extra_tags, difficulty, avg_rating, rating_count, source_start_page, casebook:casebooks(name)"
    )
    // Deterministic server-side order so the PostgREST row cap can never drop
    // an arbitrary subset; display order (by casebook name) is applied below.
    .order("casebook_id")
    .order("source_start_page");

  if (error) {
    throw new Error(`Failed to load cases: ${error.message}`);
  }

  const cases = ((data ?? []) as unknown as CaseListRow[]).sort(
    (a, b) =>
      (a.casebook?.name ?? "").localeCompare(b.casebook?.name ?? "") ||
      a.source_start_page - b.source_start_page
  );

  return (
    <div>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[40px] text-[var(--ink)]">Case library</h1>
          <p className="mt-1 text-[14px] text-[var(--muted)]">
            {cases.length} {cases.length === 1 ? "case" : "cases"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            disabled
            aria-label="Search cases"
            placeholder="Search case, company, casebook…"
            className="h-[38px] w-[290px] max-w-full rounded-full border border-[var(--line)] bg-[var(--card)] px-[13px] text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="button"
            disabled
            className="h-[38px] whitespace-nowrap rounded-full border border-[var(--line)] bg-[var(--card)] px-[15px] text-[13.5px] font-semibold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mb-[18px] flex flex-col gap-[11px] rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-[18px] py-4 [box-shadow:var(--sh)]">
        {filterGroups.map((group) => (
          <div
            key={group.label}
            className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[96px_1fr] sm:gap-3.5"
          >
            <div className="text-[11.5px] font-semibold text-[var(--muted)]">
              {group.label}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {group.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled
                  className="rounded-full border border-[var(--line)] bg-[var(--card)] px-[11px] py-1 text-[12px] font-semibold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {cases.length === 0 ? (
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
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] [box-shadow:var(--sh)] md:block">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[var(--thead)]">
                  <th className={`${thClasses} w-[34%]`}>Case</th>
                  <th className={thClasses}>Casebook</th>
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
                          {c.casebook?.name ?? "—"} · p. {c.source_start_page}
                        </span>
                      </Link>
                    </td>
                    <td className={`${tdClasses} text-[var(--muted)]`}>
                      {c.casebook?.name ?? "—"}
                    </td>
                    <td className={tdClasses}>
                      <span className="flex flex-wrap gap-1.5">
                        {c.case_types.map((t, i) => (
                          <Pill key={`type-${t}-${i}`} tone="accent">
                            {t}
                          </Pill>
                        ))}
                        {visibleExtraTags(c).map((t, i) => (
                          <Pill key={`extra-${t}-${i}`}>{t}</Pill>
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
