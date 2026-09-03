import type { DifficultyLevel } from "@/lib/types";

/**
 * URL search params are the single source of truth for the /cases filters:
 * ?type=A&type=B&difficulty=Easy&industry=…&company=…&casebook=<slug>&rating=4
 * &status=done&marked=1&q=…
 * Multi-select within a group = OR; across groups = AND. Rating is single-select.
 * status + marked form one Status group: selected chips OR together
 * (e.g. status=done&marked=1 → completed OR marked for later).
 */
export type StatusFilter = "done" | "not_done";

export interface CaseFilterState {
  types: string[];
  difficulties: DifficultyLevel[];
  industries: string[];
  companies: string[];
  /** Casebook slugs. */
  casebooks: string[];
  rating: 3 | 4 | null;
  status: StatusFilter | null;
  marked: boolean;
  /** Trimmed raw query; sanitize with sanitizeSearchQuery before use in SQL. */
  q: string;
}

export interface FilterOption {
  value: string;
  label: string;
}

const DIFFICULTIES: readonly DifficultyLevel[] = ["Easy", "Medium", "Hard"];

function toArray(value: string | string[] | undefined): string[] {
  const values = value === undefined ? [] : Array.isArray(value) ? value : [value];
  // postgrest-js quotes .in()/.overlaps() values but doesn't escape embedded
  // quotes/backslashes — strip them so a crafted URL can't 400 the query.
  // No real tag/company/slug value contains them.
  return [...new Set(values.map((v) => v.replace(/["\\]/g, "")).filter((v) => v !== ""))];
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseCaseFilters(sp: {
  [key: string]: string | string[] | undefined;
}): CaseFilterState {
  // difficulty is a Postgres enum column — an unknown value in .in() would be
  // a query error, so invalid values are dropped here. The text-column params
  // pass through: unknown values just match nothing.
  const difficulties = toArray(sp.difficulty).filter((v): v is DifficultyLevel =>
    (DIFFICULTIES as readonly string[]).includes(v)
  );
  const ratingRaw = first(sp.rating);
  const rating = ratingRaw === "4" ? 4 : ratingRaw === "3" ? 3 : null;
  const statusRaw = first(sp.status);
  const status =
    statusRaw === "done" || statusRaw === "not_done" ? statusRaw : null;
  return {
    types: toArray(sp.type),
    difficulties,
    industries: toArray(sp.industry),
    companies: toArray(sp.company),
    casebooks: toArray(sp.casebook),
    rating,
    status,
    marked: first(sp.marked) === "1",
    q: (first(sp.q) ?? "").trim().slice(0, 100),
  };
}

export function buildCasesSearchString(state: CaseFilterState): string {
  const params = new URLSearchParams();
  for (const v of state.types) params.append("type", v);
  for (const v of state.difficulties) params.append("difficulty", v);
  for (const v of state.industries) params.append("industry", v);
  for (const v of state.companies) params.append("company", v);
  for (const v of state.casebooks) params.append("casebook", v);
  if (state.rating !== null) params.set("rating", String(state.rating));
  if (state.status !== null) params.set("status", state.status);
  if (state.marked) params.set("marked", "1");
  const q = state.q.trim();
  if (q) params.set("q", q.slice(0, 100));
  const s = params.toString();
  return s ? `?${s}` : "";
}

/**
 * Strip (not escape) characters that are logic-tree delimiters in PostgREST
 * .or() syntax or LIKE metacharacters (PostgREST also maps * to %). None
 * carry search value for case titles/companies; an empty result means
 * "skip the search filter".
 */
export function sanitizeSearchQuery(raw: string): string {
  return raw
    .replace(/[,()"\\%_*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

/** Each selected chip counts as one filter; rating and a non-empty q add one each. */
export function countActiveFilters(state: CaseFilterState): number {
  return (
    state.types.length +
    state.difficulties.length +
    state.industries.length +
    state.companies.length +
    state.casebooks.length +
    (state.rating !== null ? 1 : 0) +
    (state.status !== null ? 1 : 0) +
    (state.marked ? 1 : 0) +
    (sanitizeSearchQuery(state.q) ? 1 : 0)
  );
}
