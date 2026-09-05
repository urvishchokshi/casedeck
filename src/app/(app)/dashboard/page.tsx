import Link from "next/link";
import type { ReactNode } from "react";
import { PageTitle } from "@/components/PageTitle";
import { createClient } from "@/lib/supabase/server";
import { relativeDate } from "@/lib/date";
import {
  aggregateByIndustry,
  aggregateByType,
  byDifficulty,
  computeStats,
  weakestGround,
  type CaseFacet,
  type ProgressWithCase,
} from "@/lib/dashboard";

export const metadata = { title: "Dashboard" };

const cardClasses =
  "rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-[22px] py-5 [box-shadow:var(--sh)]";

function StatCard({
  label,
  value,
  sub,
  caption,
  accentValue = false,
}: {
  label: string;
  value: string;
  sub?: string;
  caption?: ReactNode;
  accentValue?: boolean;
}) {
  return (
    <div className={cardClasses}>
      <p className="text-[12.5px] font-semibold text-[var(--muted-2)]">
        {label}
      </p>
      <p
        className={`mt-2 text-[42px] font-bold leading-[1.1] tracking-[-0.03em] ${
          accentValue ? "text-[var(--accent)]" : "text-[var(--heading)]"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-[12.5px] text-[var(--faint)]">{sub}</p>}
      {caption && (
        <p className="mt-1 text-[12.5px] text-[var(--faint)]">{caption}</p>
      )}
    </div>
  );
}

function Bar({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <div
      className={`h-2 flex-1 overflow-hidden rounded-[5px] bg-[var(--bar-track)] ${className}`}
    >
      <div
        className="cd-grow h-2 rounded-[5px] bg-[var(--accent)]"
        // Dynamic widths can't be Tailwind classes.
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

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

  return (
    // Matches the shell <main>'s flex column so the fade-up wrapper is
    // layout-neutral.
    <div className="cd-fade-up flex flex-col gap-4">
      <PageTitle plain="Your " accent="numbers" />

      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[22px] font-bold tracking-[-0.02em] text-[var(--heading)]">
          {stats.attempted} of {stats.total}{" "}
          <span className="text-[var(--accent)]">attempted</span>
        </span>
        <span className="text-[12.5px] text-[var(--muted-2)]">
          {hasAttempted && stats.lastCompletedAt !== null
            ? `Last case ${relativeDate(stats.lastCompletedAt)}`
            : "Nothing logged yet — your numbers start with your first case."}
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5">
        <StatCard
          label="Cases attempted"
          value={String(stats.attempted)}
          sub={`of ${stats.total}`}
          caption={
            stats.revisit > 0 ? (
              <Link
                href="/cases?status=revisit"
                className="transition-colors hover:text-[var(--accent)]"
              >
                {stats.revisit} revisit
              </Link>
            ) : undefined
          }
        />
        <StatCard
          label="Avg self-score"
          value={stats.avgSelfScore !== null ? stats.avgSelfScore.toFixed(1) : "—"}
          sub="out of 10"
          accentValue={stats.avgSelfScore !== null}
        />
        <StatCard
          label="Cases rated"
          value={String(stats.rated)}
          sub="self-scored"
        />
      </div>

      {!hasAttempted ? (
        <div className={`${cardClasses} grid place-items-center px-6 py-16 text-center`}>
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
              className="mt-4 inline-flex h-[38px] items-center justify-center rounded-[var(--rs)] bg-[var(--accent)] px-4 text-[12.5px] font-semibold text-[var(--on-accent)] transition-[color,background-color,transform] active:scale-[0.97] hover:bg-[var(--accent-hover)]"
            >
              Browse cases
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-3.5 max-desk:grid-cols-1">
            <div className={cardClasses}>
              <h2 className="mb-4 text-[15px] tracking-[-0.01em]">
                Cases by type
              </h2>
              {typeRows.length === 0 ? (
                <p className="text-[13px] text-[var(--muted)]">
                  No typed cases attempted yet.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {typeRows.map((r) => (
                    <div
                      key={r.label}
                      className="flex items-center gap-3.5 max-desk:grid max-desk:grid-cols-[minmax(0,1fr)_auto] max-desk:gap-x-3 max-desk:gap-y-1.5"
                    >
                      <span
                        className="min-w-0 truncate text-[13px] text-[var(--slate)] desk:w-24 desk:flex-none"
                        title={r.label}
                      >
                        {r.label}
                      </span>
                      <Bar
                        pct={r.total > 0 ? (r.attempted / r.total) * 100 : 0}
                        className="max-desk:order-last max-desk:col-span-2"
                      />
                      <span className="flex-none text-[12.5px] font-semibold text-[var(--muted)]">
                        {r.attempted}/{r.total}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={cardClasses}>
              <h2 className="mb-4 text-[15px] tracking-[-0.01em]">
                Performance by industry
              </h2>
              {industryRows.length === 0 ? (
                <p className="text-[13px] text-[var(--muted)]">
                  No scored cases yet.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {industryRows.map((r) => (
                    <div
                      key={r.label}
                      className="flex items-center gap-3.5 max-desk:grid max-desk:grid-cols-[minmax(0,1fr)_auto] max-desk:gap-x-3 max-desk:gap-y-1.5"
                    >
                      <span
                        className="min-w-0 truncate text-[13px] text-[var(--slate)] desk:w-[118px] desk:flex-none"
                        title={r.label}
                      >
                        {r.label}
                      </span>
                      <Bar
                        pct={r.avg * 10}
                        className="max-desk:order-last max-desk:col-span-2"
                      />
                      <span className="flex-none text-[12.5px] text-[var(--muted-2)]">
                        <span className="font-bold text-[var(--heading)]">
                          {r.avg.toFixed(1)}
                        </span>{" "}
                        · {r.attempted} attempted
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {weakest.length > 0 && (
            <div className={cardClasses}>
              <h2 className="mb-3.5 text-[15px] tracking-[-0.01em]">
                Weakest ground
              </h2>
              <div className="flex flex-col gap-2.5">
                {weakest.map((w) => (
                  <div
                    key={`${w.dimension}-${w.label}`}
                    className="flex flex-wrap items-center gap-3.5 rounded-[14px] border border-[var(--bar-track)] bg-[var(--tile)] px-4 py-3.5 max-desk:grid max-desk:grid-cols-[minmax(0,1fr)_auto] max-desk:gap-x-3 max-desk:gap-y-2.5"
                  >
                    <span
                      className="min-w-0 truncate text-[15px] font-bold text-[var(--heading)] max-desk:order-1"
                      title={w.label}
                    >
                      {w.label}
                    </span>
                    <span className="rounded-[7px] bg-[var(--chip-dim)] px-[9px] py-1 text-[11.5px] font-semibold text-[var(--muted)] max-desk:order-3 max-desk:justify-self-start">
                      {w.dimension}
                    </span>
                    <span className="ml-auto text-[22px] font-bold tracking-[-0.02em] text-[var(--weak)] max-desk:order-2">
                      {w.avg.toFixed(1)}
                    </span>
                    <Link
                      href={w.href}
                      className="inline-flex h-9 items-center whitespace-nowrap rounded-[var(--rs)] border border-[var(--line-ctl)] bg-[var(--card)] px-4 text-[12.5px] font-semibold text-[var(--accent)] transition-[color,background-color,border-color,transform] active:scale-[0.97] hover:border-[var(--accent)] max-desk:order-4 max-desk:col-span-2 max-desk:h-10 max-desk:justify-center"
                    >
                      Practice →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={cardClasses}>
            <h2 className="mb-4 text-[15px] tracking-[-0.01em]">
              By difficulty
            </h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-[18px]">
              {difficultySegments.map((s) => (
                <div
                  key={s.label}
                  className={`border-l-[3px] pl-3.5 ${
                    s.attempted > 0
                      ? "border-[var(--accent)]"
                      : "border-[var(--bar-idle)]"
                  }`}
                >
                  <p className="text-[12.5px] font-semibold text-[var(--muted-2)]">
                    {s.label}
                  </p>
                  <p className="mt-1.5 flex items-baseline gap-0.5">
                    <span className="text-[34px] font-bold leading-none tracking-[-0.03em] text-[var(--heading)]">
                      {s.attempted}
                    </span>
                    <span className="text-[15px] text-[var(--faint)]">
                      /{s.total}
                    </span>
                  </p>
                  <p className="mt-[5px] text-[12.5px] text-[var(--muted-2)]">
                    avg {s.avg !== null ? s.avg.toFixed(1) : "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
