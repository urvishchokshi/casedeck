import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { createClient } from "@/lib/supabase/server";
import { relativeDate } from "@/lib/date";
import {
  aggregateByIndustry,
  aggregateByType,
  byDifficulty,
  computeStats,
  weakestGround,
  WEAK_SCORE_THRESHOLD,
  type CaseFacet,
  type ProgressWithCase,
} from "@/lib/dashboard";

export const metadata = { title: "Dashboard" };

function StatCard({
  label,
  value,
  sub,
  caption,
}: {
  label: string;
  value: string;
  sub?: string;
  caption?: ReactNode;
}) {
  return (
    <Card className="px-[18px] py-4">
      <p className="text-[11.5px] font-semibold text-[var(--muted)]">{label}</p>
      <p className="mt-1.5 font-[family-name:var(--font-display)] text-[42px] leading-none text-[var(--ink)]">
        {value}
      </p>
      {sub && <p className="mt-1 text-[11.5px] text-[var(--muted)]">{sub}</p>}
      {caption && (
        <p className="mt-1 text-[11.5px] text-[var(--muted)]">{caption}</p>
      )}
    </Card>
  );
}

function Bar({ pct, tone = "accent" }: { pct: number; tone?: "accent" | "amber" }) {
  return (
    <div
      className={`h-[9px] overflow-hidden rounded-full ${
        tone === "amber" ? "bg-[var(--amber-50)]" : "bg-[var(--accent-200)]"
      }`}
    >
      <div
        className={`h-full rounded-full ${
          tone === "amber" ? "bg-[var(--amber)]" : "bg-[var(--accent)]"
        }`}
        // Dynamic widths can't be Tailwind classes.
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

const barRowClasses =
  "grid grid-cols-[112px_1fr_auto] items-center gap-2.5 text-[13px]";

export default async function DashboardPage() {
  const supabase = await createClient();
  // The (app) layout redirects unauthenticated visitors, so user is present;
  // the null guard just keeps this page from crashing if that ever changes.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [progressRes, facetsRes] = await Promise.all([
    user
      ? supabase
          .from("user_case_progress")
          .select(
            "case_id, outcome, self_score, quality_rating, completed_at, case:cases(id, title, case_types, industry, difficulty)"
          )
          .eq("user_id", user.id)
      : null,
    // Subject to the PostgREST default row cap (1000) — fine at current
    // scale; revisit alongside /cases pagination.
    supabase.from("cases").select("case_types, industry, difficulty"),
  ]);
  const firstError = progressRes?.error ?? facetsRes.error;
  if (firstError) {
    throw new Error(`Failed to load dashboard: ${firstError.message}`);
  }

  const progress = (progressRes?.data ?? []) as unknown as ProgressWithCase[];
  const facets = (facetsRes.data ?? []) as unknown as CaseFacet[];

  const stats = computeStats(progress, facets.length);
  const hasAttempted = stats.attempted > 0;
  const typeRows = aggregateByType(progress, facets);
  const industryRows = aggregateByIndustry(progress);
  const weakest = weakestGround(progress);
  const difficultySegments = byDifficulty(progress, facets);

  const subtitle = hasAttempted
    ? `${stats.attempted} of ${stats.total} cases attempted` +
      (stats.lastCompletedAt !== null
        ? ` · last case ${relativeDate(stats.lastCompletedAt)}`
        : "")
    : "Nothing logged yet — your numbers start with your first case.";

  return (
    <div>
      <PageHeader title="Your numbers" subtitle={subtitle} />

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-3">
        <StatCard
          label="Cases attempted"
          value={String(stats.attempted)}
          sub={`of ${stats.total}`}
          caption={
            stats.revisit > 0 ? (
              <Link
                href="/cases?status=revisit"
                className="transition-colors hover:text-[var(--ink)]"
              >
                {stats.revisit} revisit
              </Link>
            ) : undefined
          }
        />
        <StatCard
          label="Avg self-score"
          value={stats.avgSelfScore !== null ? stats.avgSelfScore.toFixed(1) : "—"}
        />
        <StatCard label="Cases rated" value={String(stats.rated)} />
      </div>

      {!hasAttempted ? (
        <Card className="mt-[18px] grid place-items-center px-6 py-16 text-center">
          <div>
            <p className="text-[17px] font-semibold text-[var(--ink)]">
              Do your first case and your numbers start here
            </p>
            <p className="mt-1 text-[14px] text-[var(--muted)]">
              Pick a case from the library, run it with a partner, and log how
              it went.
            </p>
            <Link
              href="/cases"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-[var(--rs)] bg-[var(--accent)] px-[15px] text-[13.5px] font-semibold text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-hover)]"
            >
              Browse cases
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <div className="mt-[18px] grid grid-cols-1 gap-[18px] xl:grid-cols-2">
            <Card className="px-5 py-[18px]">
              <h2 className="text-[22px] text-[var(--ink)]">Cases by type</h2>
              {typeRows.length === 0 ? (
                <p className="mt-3.5 text-[13px] text-[var(--muted)]">
                  No typed cases attempted yet.
                </p>
              ) : (
                <div className="mt-3.5 flex flex-col gap-2.5">
                  {typeRows.map((r) => (
                    <div key={r.label} className={barRowClasses}>
                      <span
                        className="truncate font-semibold text-[var(--ink)]"
                        title={r.label}
                      >
                        {r.label}
                      </span>
                      <Bar
                        pct={r.total > 0 ? (r.attempted / r.total) * 100 : 0}
                      />
                      <span className="text-[var(--muted)]">
                        {r.attempted}/{r.total}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="px-5 py-[18px]">
              <h2 className="text-[22px] text-[var(--ink)]">
                Performance by industry
              </h2>
              {industryRows.length === 0 ? (
                <p className="mt-3.5 text-[13px] text-[var(--muted)]">
                  No scored cases yet.
                </p>
              ) : (
                <div className="mt-3.5 flex flex-col gap-2.5">
                  {industryRows.map((r) => (
                    <div key={r.label} className={barRowClasses}>
                      <span
                        className="truncate font-semibold text-[var(--ink)]"
                        title={r.label}
                      >
                        {r.label}
                      </span>
                      <Bar
                        pct={r.avg * 10}
                        tone={r.avg < WEAK_SCORE_THRESHOLD ? "amber" : "accent"}
                      />
                      <span>
                        <span className="font-semibold text-[var(--ink)]">
                          {r.avg.toFixed(1)}
                        </span>
                        <span className="text-[var(--muted)]">
                          {" "}
                          · {r.attempted} attempted
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {weakest.length > 0 && (
              <Card className="px-5 py-[18px]">
                <h2 className="text-[22px] text-[var(--ink)]">Weakest ground</h2>
                <div className="mt-3.5 flex flex-col gap-2">
                  {weakest.map((w) => (
                    <div
                      key={`${w.dimension}-${w.label}`}
                      className="flex items-center justify-between gap-3 rounded-[var(--rs)] border border-[var(--line)] px-[13px] py-[11px]"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="truncate text-[14.5px] font-semibold text-[var(--ink)]"
                          title={w.label}
                        >
                          {w.label}
                        </span>
                        <Pill>{w.dimension}</Pill>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-[family-name:var(--font-display)] text-[26px] leading-none text-[var(--amber)]">
                          {w.avg.toFixed(1)}
                        </span>
                        <Link
                          href={w.href}
                          className="inline-flex h-8 items-center rounded-full border border-[var(--line)] px-3 text-[12.5px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--thead)]"
                        >
                          Practice →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          <Card className="mt-[18px] px-5 py-[18px]">
            <h2 className="text-[22px] text-[var(--ink)]">By difficulty</h2>
            <div
              className={`mt-3.5 grid grid-cols-1 divide-y divide-[var(--line-soft)] sm:divide-x sm:divide-y-0 ${
                difficultySegments.length === 4
                  ? "sm:grid-cols-4"
                  : "sm:grid-cols-3"
              }`}
            >
              {difficultySegments.map((s) => (
                <div
                  key={s.label}
                  className="py-3 first:pt-0 last:pb-0 sm:px-4 sm:py-0 sm:first:pl-0 sm:last:pr-0"
                >
                  <p className="text-[11.5px] font-semibold text-[var(--muted)]">
                    {s.label}
                  </p>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-[26px] leading-none text-[var(--ink)]">
                    {s.attempted}
                    <span className="text-[15px] text-[var(--muted)]">
                      /{s.total}
                    </span>
                  </p>
                  <p className="mt-1 text-[13px] text-[var(--muted)]">
                    avg {s.avg !== null ? s.avg.toFixed(1) : "—"}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
