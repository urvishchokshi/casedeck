/**
 * Tag cleanup tooling: export the distinct filter-tag values on cases, and
 * apply a claude.ai-produced merge mapping back to the database. Manual,
 * user-triggered — import stays verbatim; nothing here runs automatically.
 *
 * Usage: npm run tags-export
 *        npm run tags-apply [-- --dry]
 *
 * Inputs:
 *   .env.local                 — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   pipeline/tags/mapping.json — (apply only) cumulative merge mapping from the
 *                                claude.ai chat (see pipeline/prompts/tag-cleanup.md)
 *
 * Outputs:
 *   export — pipeline/tags/current.json (gitignored snapshot) + a paste-ready
 *            console block; also echoes mapping.json when it exists.
 *   apply  — UPDATEs cases.industry / cases.company / cases.case_types per the
 *            mapping (null target clears the field / removes the array element;
 *            arrays are deduped). --dry previews with row counts and writes
 *            nothing. Idempotent — re-running a fully applied mapping reports
 *            zeros. Mapping keys that match nothing warn, never fail.
 *            Don't run apply alongside npm run import — both rewrite
 *            cases.case_types wholesale, last writer wins per row.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PIPELINE = path.join(ROOT, "pipeline");
const TAGS_DIR = path.join(PIPELINE, "tags");
const CURRENT_PATH = path.join(TAGS_DIR, "current.json");
const MAPPING_PATH = path.join(TAGS_DIR, "mapping.json");

const PAGE_SIZE = 1000;

// Targets are non-empty (use null to clear, never "") and unknown dimension
// keys are rejected — the mapping is LLM-produced, so a misnamed dimension
// ("companies", "Industry") must fail loudly instead of silently dropping.
const DimensionMapSchema = z.record(z.string(), z.string().min(1).nullable());
const MappingSchema = z.strictObject({
  industry: DimensionMapSchema.optional(),
  case_types: DimensionMapSchema.optional(),
  company: DimensionMapSchema.optional(),
});
type DimensionMap = z.infer<typeof DimensionMapSchema>;

type CaseRow = {
  id: string;
  industry: string | null;
  case_types: string[];
  company: string | null;
};

type TagCount = { value: string; count: number };

type ReportRow = { dimension: string; from: string; to: string; rows: number };

function fail(message: string): never {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): { command: "export" | "apply"; dry: boolean } {
  const [command, ...rest] = argv;
  if (command !== "export" && command !== "apply") {
    fail(
      `Expected subcommand "export" or "apply". Usage: npm run tags-export | npm run tags-apply [-- --dry]`
    );
  }
  let dry = false;
  for (const arg of rest) {
    if (arg === "--dry" && command === "apply") {
      dry = true;
    } else {
      fail(`Unknown argument "${arg}". Usage: npm run tags-export | npm run tags-apply [-- --dry]`);
    }
  }
  return { command, dry };
}

function readJsonFile<T>(filePath: string, schema: z.ZodType<T>, whatToCreate: string): T {
  if (!fs.existsSync(filePath)) {
    fail(`Missing file: ${filePath}\n${whatToCreate}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    fail(`${filePath} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    fail(`${filePath} does not match the expected schema:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

// Minimal .env.local loader (dotenv is not a dependency). Never logs values.
function loadEnvLocal(): void {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) {
    fail(`Missing ${envPath} — it must define NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.`);
  }
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) fail(`Environment variable ${name} is not set (expected in .env.local).`);
  return value;
}

// The app's facet queries live under PostgREST's 1000-row cap; this script must
// see every case, so it pages until an empty page — advancing by rows actually
// returned, so a server max-rows cap below PAGE_SIZE can't truncate the scan.
// Ordered by id so pages are stable.
async function fetchAllCaseRows(supabase: SupabaseClient): Promise<CaseRow[]> {
  const all: CaseRow[] = [];
  for (let from = 0; ; ) {
    const { data, error } = await supabase
      .from("cases")
      .select("id, industry, case_types, company")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) fail(`Failed to fetch cases: ${error.message}`);
    const page = (data ?? []) as CaseRow[];
    all.push(...page);
    if (page.length === 0) break;
    from += page.length;
  }
  return all;
}

function sortedCounts(counts: Map<string, number>): TagCount[] {
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
}

async function runExport(supabase: SupabaseClient): Promise<void> {
  const rows = await fetchAllCaseRows(supabase);

  const industry = new Map<string, number>();
  const caseTypes = new Map<string, number>();
  const company = new Map<string, number>();
  for (const row of rows) {
    if (row.industry) industry.set(row.industry, (industry.get(row.industry) ?? 0) + 1);
    if (row.company) company.set(row.company, (company.get(row.company) ?? 0) + 1);
    for (const type of row.case_types) {
      if (type) caseTypes.set(type, (caseTypes.get(type) ?? 0) + 1);
    }
  }

  const current = {
    industry: sortedCounts(industry),
    case_types: sortedCounts(caseTypes),
    company: sortedCounts(company),
  };

  fs.mkdirSync(TAGS_DIR, { recursive: true });
  fs.writeFileSync(CURRENT_PATH, JSON.stringify(current, null, 2) + "\n");

  console.log(
    `Exported tags from ${rows.length} case(s): ${current.industry.length} industry, ` +
      `${current.case_types.length} case_types, ${current.company.length} company value(s).`
  );
  console.log(`Snapshot written to pipeline/tags/current.json.`);
  console.log("");
  console.log("===== CURRENT TAGS — paste this block into the chat =====");
  console.log(JSON.stringify(current, null, 2));
  console.log("===== end of current tags =====");

  if (fs.existsSync(MAPPING_PATH)) {
    console.log("");
    console.log("===== EXISTING MAPPING — include this in the chat =====");
    console.log(fs.readFileSync(MAPPING_PATH, "utf8").trimEnd());
    console.log("===== end of existing mapping =====");
  }

  console.log("");
  console.log(
    "Next: paste pipeline/prompts/tag-cleanup.md plus the block(s) above into a claude.ai chat,"
  );
  console.log(
    "save the returned JSON to pipeline/tags/mapping.json, then npm run tags-apply -- --dry."
  );
}

// Drops from === to no-ops (warning) and rejects chained mappings (a target that
// is also a key in the same dimension would double-apply on sequential UPDATEs).
function normalizeDimension(
  dimension: string,
  map: DimensionMap | undefined,
  warnings: string[]
): DimensionMap {
  if (!map) return {};
  const cleaned: DimensionMap = {};
  for (const [from, to] of Object.entries(map)) {
    if (from === to) {
      warnings.push(`${dimension}: "${from}" maps to itself — ignored.`);
    } else {
      cleaned[from] = to;
    }
  }
  const keys = new Set(Object.keys(cleaned));
  const chained = Object.values(cleaned).filter((to): to is string => to !== null && keys.has(to));
  if (chained.length > 0) {
    fail(
      `${dimension} mapping is chained — these targets are also mapped keys: ` +
        `${chained.map((t) => `"${t}"`).join(", ")}. Flatten the mapping so every entry points ` +
        `directly at its final canonical value, then re-run.`
    );
  }
  return cleaned;
}

async function applyScalarDimension(
  supabase: SupabaseClient,
  dimension: "industry" | "company",
  map: DimensionMap,
  dry: boolean,
  report: ReportRow[]
): Promise<number> {
  let touched = 0;
  for (const [from, to] of Object.entries(map)) {
    let rows: number;
    if (dry) {
      const { count, error } = await supabase
        .from("cases")
        .select("*", { count: "exact", head: true })
        .eq(dimension, from);
      if (error) fail(`Failed to count cases with ${dimension} = "${from}": ${error.message}`);
      rows = count ?? 0;
    } else {
      // .select("id") so the actually-updated rows come back and can be counted.
      // The returned representation is subject to PostgREST's max-rows cap
      // (default 1000), so this count could undershoot the dry-run's exact
      // count if one tag value ever exceeds the cap — the UPDATE itself still
      // hits every matching row.
      const { data, error } = await supabase
        .from("cases")
        .update({ [dimension]: to })
        .eq(dimension, from)
        .select("id");
      if (error) fail(`Failed to update ${dimension} "${from}" → ${to === null ? "null" : `"${to}"`}: ${error.message}`);
      rows = (data ?? []).length;
    }
    touched += rows;
    report.push({ dimension, from, to: to ?? "(clear)", rows });
  }
  return touched;
}

async function applyCaseTypes(
  supabase: SupabaseClient,
  map: DimensionMap,
  dry: boolean,
  report: ReportRow[]
): Promise<number> {
  const fromValues = Object.keys(map);
  if (fromValues.length === 0) return 0;

  // Full-table scan rather than an .overlaps() filter: postgrest-js does not
  // quote array-literal elements, so verbatim tags containing , { } " would
  // silently drop out of the filter. The table is small; scan and filter here.
  const rows = await fetchAllCaseRows(supabase);

  // Per-entry counts = rows whose current array contains the from-value.
  const perFrom = new Map<string, number>(fromValues.map((from) => [from, 0]));
  const changed: { id: string; case_types: string[] }[] = [];
  for (const row of rows) {
    for (const type of new Set(row.case_types)) {
      if (perFrom.has(type)) perFrom.set(type, (perFrom.get(type) ?? 0) + 1);
    }
    // Map each element through the mapping (null target drops it), then dedup
    // keeping first-occurrence order — a case tagged both "Growth" and
    // "Growth Strategy" must end up with one "Growth", not two.
    const next: string[] = [];
    for (const type of row.case_types) {
      const mapped = type in map ? map[type] : type;
      if (mapped !== null && !next.includes(mapped)) next.push(mapped);
    }
    const unchanged =
      next.length === row.case_types.length && next.every((t, i) => t === row.case_types[i]);
    if (!unchanged) changed.push({ id: row.id, case_types: next });
  }

  if (!dry) {
    for (const row of changed) {
      const { error } = await supabase
        .from("cases")
        .update({ case_types: row.case_types })
        .eq("id", row.id);
      if (error) fail(`Failed to update case_types on case ${row.id}: ${error.message}`);
    }
  }

  for (const [from, to] of Object.entries(map)) {
    report.push({ dimension: "case_types", from, to: to ?? "(remove)", rows: perFrom.get(from) ?? 0 });
  }
  return changed.length;
}

async function main(): Promise<void> {
  const { command, dry } = parseArgs(process.argv.slice(2));

  loadEnvLocal();
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (command === "export") {
    await runExport(supabase);
    return;
  }

  const mapping = readJsonFile(
    MAPPING_PATH,
    MappingSchema,
    `Run npm run tags-export, paste pipeline/prompts/tag-cleanup.md plus the exported block into a claude.ai chat, and save the JSON it returns to that path.`
  );

  const warnings: string[] = [];
  const industryMap = normalizeDimension("industry", mapping.industry, warnings);
  const caseTypesMap = normalizeDimension("case_types", mapping.case_types, warnings);
  const companyMap = normalizeDimension("company", mapping.company, warnings);
  const entryCount =
    Object.keys(industryMap).length + Object.keys(caseTypesMap).length + Object.keys(companyMap).length;
  if (entryCount === 0) {
    fail(`${MAPPING_PATH} contains no mapping entries — nothing to apply.`);
  }

  console.log(
    `${dry ? "Dry run" : "Applying"}: ${entryCount} mapping entr${entryCount === 1 ? "y" : "ies"} ` +
      `(${Object.keys(industryMap).length} industry, ${Object.keys(caseTypesMap).length} case_types, ` +
      `${Object.keys(companyMap).length} company).`
  );

  const report: ReportRow[] = [];
  const industryTouched = await applyScalarDimension(supabase, "industry", industryMap, dry, report);
  const caseTypesTouched = await applyCaseTypes(supabase, caseTypesMap, dry, report);
  const companyTouched = await applyScalarDimension(supabase, "company", companyMap, dry, report);

  console.log("");
  console.table(report);

  const zeroMatch = report.filter((r) => r.rows === 0);
  if (zeroMatch.length > 0) {
    warnings.push(
      ...zeroMatch.map(
        (r) => `${r.dimension}: "${r.from}" matched nothing (already cleaned, or a typo in the mapping).`
      )
    );
  }

  const totalTouched = industryTouched + caseTypesTouched + companyTouched;
  if (dry) {
    console.log(
      `Dry run — nothing written. Would touch ${totalTouched} row-update(s) ` +
        `(${industryTouched} industry, ${caseTypesTouched} case_types, ${companyTouched} company).`
    );
  } else {
    console.log(
      `Applied ${totalTouched} row-update(s) ` +
        `(${industryTouched} industry, ${caseTypesTouched} case_types, ${companyTouched} company). ` +
        `Re-runs are idempotent — a fully applied mapping reports zeros.`
    );
  }

  if (warnings.length > 0) {
    console.warn("\nWarnings:\n  - " + warnings.join("\n  - "));
  }
}

main().catch((err) => fail(err instanceof Error ? (err.stack ?? err.message) : String(err)));
