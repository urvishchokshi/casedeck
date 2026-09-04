import type { CaseOutcome, DifficultyLevel } from "@/lib/types";

/**
 * Pure aggregation logic for the /dashboard page. Everything operates on the
 * signed-in user's progress rows (with their case embed) plus a lightweight
 * facet list of all cases — no queries, no React.
 *
 * "Attempted" = any non-null outcome (done, retry and revisit all count).
 * Scoring rule used throughout: a row contributes to an average only when
 * `outcome !== null && self_score !== null`. The logCase contract guarantees
 * self_score exists iff outcome is set, but we filter defensively rather
 * than assume.
 */

/** Label for null industry/difficulty groupings; always sorted last. */
export const UNTAGGED = "Untagged";
/** Max rows shown in the "Marked for later" card. */
export const MARKED_LIMIT = 8;
/** Minimum scored attempted cases for a grouping to qualify as "weakest ground". */
export const WEAKEST_MIN_CASES = 2;
/** Industry bars turn amber below this average self-score. */
export const WEAK_SCORE_THRESHOLD = 6;

export interface ProgressCaseInfo {
  id: string;
  title: string;
  case_types: string[];
  industry: string | null;
  difficulty: DifficultyLevel | null;
}

export interface ProgressWithCase {
  case_id: string;
  outcome: CaseOutcome | null;
  marked_for_later: boolean;
  self_score: number | null;
  quality_rating: number | null;
  completed_at: string | null;
  updated_at: string;
  case: ProgressCaseInfo | null;
}

export interface CaseFacet {
  case_types: string[];
  industry: string | null;
  difficulty: DifficultyLevel | null;
}

export interface DashboardStats {
  attempted: number;
  retry: number;
  revisit: number;
  total: number;
  avgSelfScore: number | null;
  marked: number;
  rated: number;
  lastCompletedAt: string | null;
}

export function computeStats(
  progress: ProgressWithCase[],
  totalCases: number
): DashboardStats {
  const attemptedRows = progress.filter((p) => p.outcome !== null);
  const scores = attemptedRows
    .map((p) => p.self_score)
    .filter((s): s is number => s !== null);
  let lastCompletedAt: string | null = null;
  for (const p of attemptedRows) {
    // ISO-8601 UTC strings compare correctly lexicographically.
    if (p.completed_at !== null && (lastCompletedAt === null || p.completed_at > lastCompletedAt)) {
      lastCompletedAt = p.completed_at;
    }
  }
  return {
    attempted: attemptedRows.length,
    retry: attemptedRows.filter((p) => p.outcome === "retry").length,
    revisit: attemptedRows.filter((p) => p.outcome === "revisit").length,
    total: totalCases,
    avgSelfScore: scores.length
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null,
    marked: progress.filter((p) => p.marked_for_later).length,
    rated: progress.filter((p) => p.quality_rating !== null).length,
    lastCompletedAt,
  };
}

export interface TypeBreakdown {
  label: string;
  attempted: number;
  total: number;
}

/** Types with ≥1 attempted case; a multi-type case counts once toward each type. */
export function aggregateByType(
  progress: ProgressWithCase[],
  facets: CaseFacet[]
): TypeBreakdown[] {
  const attemptedCounts = new Map<string, number>();
  for (const p of progress) {
    if (p.outcome === null || !p.case) continue;
    // Set-dedupe: a duplicated tag within one case must not count twice.
    for (const t of new Set(p.case.case_types)) {
      attemptedCounts.set(t, (attemptedCounts.get(t) ?? 0) + 1);
    }
  }
  const totals = new Map<string, number>();
  for (const f of facets) {
    for (const t of new Set(f.case_types)) {
      totals.set(t, (totals.get(t) ?? 0) + 1);
    }
  }
  return [...attemptedCounts.entries()]
    .map(([label, attempted]) => ({
      label,
      attempted,
      // Facets sit under the PostgREST row cap; never show attempted > total.
      total: Math.max(totals.get(label) ?? 0, attempted),
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

export interface IndustryBreakdown {
  label: string;
  avg: number;
  attempted: number;
}

/**
 * Industries (null → Untagged) with ≥1 scored attempted case, weakest first;
 * Untagged always last.
 */
export function aggregateByIndustry(
  progress: ProgressWithCase[]
): IndustryBreakdown[] {
  const groups = new Map<string, { scores: number[]; attempted: number }>();
  for (const p of progress) {
    if (p.outcome === null || !p.case) continue;
    const label = p.case.industry ?? UNTAGGED;
    const g = groups.get(label) ?? { scores: [], attempted: 0 };
    g.attempted += 1;
    if (p.self_score !== null) g.scores.push(p.self_score);
    groups.set(label, g);
  }
  return [...groups.entries()]
    .filter(([, g]) => g.scores.length > 0)
    .map(([label, g]) => ({
      label,
      avg: g.scores.reduce((a, b) => a + b, 0) / g.scores.length,
      attempted: g.attempted,
    }))
    .sort((a, b) => {
      if (a.label === UNTAGGED) return 1;
      if (b.label === UNTAGGED) return -1;
      return a.avg - b.avg || a.label.localeCompare(b.label);
    });
}

export interface WeakGrouping {
  label: string;
  dimension: "type" | "industry";
  avg: number;
  attempted: number;
  href: string;
}

/**
 * The ≤3 lowest-avg-self-score groupings across the type and industry
 * dimensions, each with ≥ WEAKEST_MIN_CASES scored attempted cases. Untagged
 * is excluded: it isn't a filterable value, so an honest "Practice →" link is
 * impossible (it still surfaces in the industry breakdown).
 */
export function weakestGround(progress: ProgressWithCase[]): WeakGrouping[] {
  const groups = new Map<
    string,
    { label: string; dimension: "type" | "industry"; scores: number[] }
  >();
  const add = (
    dimension: "type" | "industry",
    label: string,
    score: number
  ) => {
    const key = `${dimension}:${label}`;
    const g = groups.get(key) ?? { label, dimension, scores: [] };
    g.scores.push(score);
    groups.set(key, g);
  };
  for (const p of progress) {
    if (p.outcome === null || p.self_score === null || !p.case) continue;
    for (const t of new Set(p.case.case_types)) add("type", t, p.self_score);
    if (p.case.industry !== null) add("industry", p.case.industry, p.self_score);
  }
  return [...groups.values()]
    .filter((g) => g.scores.length >= WEAKEST_MIN_CASES)
    .map((g) => ({
      label: g.label,
      dimension: g.dimension,
      avg: g.scores.reduce((a, b) => a + b, 0) / g.scores.length,
      attempted: g.scores.length,
      // The dimension name doubles as the /cases filter param (type/industry).
      href: `/cases?${g.dimension}=${encodeURIComponent(g.label)}&status=not_done`,
    }))
    .sort(
      (a, b) =>
        a.avg - b.avg ||
        a.dimension.localeCompare(b.dimension) ||
        a.label.localeCompare(b.label)
    )
    .slice(0, 3);
}

export interface MarkedCase {
  id: string;
  title: string;
  case_types: string[];
  difficulty: DifficultyLevel | null;
}

/** Most recently touched marked cases (updated_at is the only signal). */
export function markedCases(progress: ProgressWithCase[]): {
  cases: MarkedCase[];
  total: number;
} {
  const marked = progress
    .filter(
      (p): p is ProgressWithCase & { case: ProgressCaseInfo } =>
        p.marked_for_later && p.case !== null
    )
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return {
    total: marked.length,
    cases: marked.slice(0, MARKED_LIMIT).map((p) => ({
      id: p.case.id,
      title: p.case.title,
      case_types: p.case.case_types,
      difficulty: p.case.difficulty,
    })),
  };
}

export interface DifficultySegment {
  label: string;
  attempted: number;
  total: number;
  avg: number | null;
}

const DIFFICULTIES: readonly DifficultyLevel[] = ["Easy", "Medium", "Hard"];

/** Easy/Medium/Hard segments; Untagged appended only when null-difficulty cases exist. */
export function byDifficulty(
  progress: ProgressWithCase[],
  facets: CaseFacet[]
): DifficultySegment[] {
  const labels: string[] = [...DIFFICULTIES];
  if (facets.some((f) => f.difficulty === null)) labels.push(UNTAGGED);
  return labels.map((label) => {
    const matches = (d: DifficultyLevel | null) =>
      label === UNTAGGED ? d === null : d === label;
    const attemptedRows = progress.filter(
      (p) => p.outcome !== null && p.case !== null && matches(p.case.difficulty)
    );
    const scores = attemptedRows
      .map((p) => p.self_score)
      .filter((s): s is number => s !== null);
    return {
      label,
      attempted: attemptedRows.length,
      total: facets.filter((f) => matches(f.difficulty)).length,
      avg: scores.length
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null,
    };
  });
}
