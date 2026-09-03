/**
 * Import framework/theory pages into Supabase: validate pipeline/frameworks/
 * JSON, render the referenced pages from the source PDF (reusing images the
 * case importer already rendered), upload PNGs to the private case-images
 * bucket, and upsert frameworks rows.
 *
 * Usage: npm run import-frameworks -- --book <slug>
 *
 * Inputs:
 *   .env.local                     — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   pipeline/books.json            — registry of casebooks (slug must exist)
 *   pipeline/plans/<slug>.json     — printed_page_offset (pdf_page = printed_page + offset)
 *   pipeline/source/<slug>.pdf     — the casebook PDF (pages are rendered from here)
 *   pipeline/frameworks/<slug>.json — framework entries (see pipeline/frameworks/README.md)
 *
 * Outputs:
 *   frameworks rows upserted by title (titles are GLOBALLY unique — a
 *   same-titled framework in another book would overwrite the row; disambiguate
 *   titles in the JSON if that ever matters); PNGs in the case-images bucket at
 *   <slug>/p<printed>.png (2x scale) — pages already rendered by npm run import
 *   are reused, not re-rendered. Idempotent: re-runs overwrite.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as mupdf from "mupdf";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PIPELINE = path.join(ROOT, "pipeline");

const BookSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  college: z.string().min(1),
});
const BooksSchema = z.array(BookSchema);

// Only the offset is needed here; the full plan shape is validated by split.mts.
const OffsetPlanSchema = z.object({ printed_page_offset: z.number().int() });

const FrameworkEntrySchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  printed_pages: z.array(z.number().int().min(1)).min(1),
  sort_order: z.number().int().optional().default(0),
});
type FrameworkEntry = z.infer<typeof FrameworkEntrySchema>;

type ValidEntry = {
  /** Where the entry came from, for the report: `[<i>] "<title>"`. */
  id: string;
  data: FrameworkEntry;
};

type ReportRow = {
  status: "imported" | "updated" | "skipped";
  framework: string;
  reason: string;
};

function fail(message: string): never {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): { book: string } {
  let book: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--book") {
      book = argv[++i];
    } else {
      fail(`Unknown argument "${arg}". Usage: npm run import-frameworks -- --book <slug>`);
    }
  }
  if (!book) {
    fail("Missing --book <slug>. Usage: npm run import-frameworks -- --book <slug>");
  }
  return { book };
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

function oneLine(text: string, max = 160): string {
  const flat = text.replace(/\s*\n\s*/g, "; ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

async function main(): Promise<void> {
  const { book: slug } = parseArgs(process.argv.slice(2));

  loadEnvLocal();
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const booksPath = path.join(PIPELINE, "books.json");
  const books = readJsonFile(
    booksPath,
    BooksSchema,
    `Create it as a JSON array of { "slug", "name", "college" } objects.`
  );
  const book = books.find((b) => b.slug === slug);
  if (!book) {
    fail(
      `No book with slug "${slug}" in ${booksPath}.\nKnown slugs: ${books.map((b) => b.slug).join(", ") || "(none)"}.`
    );
  }

  const planPath = path.join(PIPELINE, "plans", `${slug}.json`);
  const { printed_page_offset: offset } = readJsonFile(
    planPath,
    OffsetPlanSchema,
    `Create it using the split-plan prompt (pipeline/prompts/split-plan.md) in a claude.ai chat.`
  );

  const sourcePath = path.join(PIPELINE, "source", `${slug}.pdf`);
  if (!fs.existsSync(sourcePath)) {
    fail(`Missing source PDF: ${sourcePath}\nPlace the casebook PDF for "${book.name}" at that exact path.`);
  }

  const frameworksPath = path.join(PIPELINE, "frameworks", `${slug}.json`);
  if (!fs.existsSync(frameworksPath)) {
    fail(
      `Missing framework entries: ${frameworksPath}\nWrite it per pipeline/frameworks/README.md (hand-written or produced in a claude.ai chat).`
    );
  }
  let rawEntries: unknown;
  try {
    rawEntries = JSON.parse(fs.readFileSync(frameworksPath, "utf8"));
  } catch (err) {
    fail(`${frameworksPath} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!Array.isArray(rawEntries)) {
    fail(`${frameworksPath} must be a JSON array — see pipeline/frameworks/README.md.`);
  }

  const warnings: string[] = [];
  const skipped: ReportRow[] = [];

  // ── Validate every entry; dedup by title (last wins, matching the upsert key).
  const byTitle = new Map<string, ValidEntry>();
  rawEntries.forEach((element: unknown, i) => {
    const loose = typeof element === "object" && element !== null ? (element as Record<string, unknown>) : {};
    const title = typeof loose.title === "string" ? loose.title : "(untitled)";
    const entryId = `[${i}] "${title}"`;

    const result = FrameworkEntrySchema.safeParse(element);
    if (!result.success) {
      skipped.push({
        status: "skipped",
        framework: entryId,
        reason: `invalid: ${oneLine(z.prettifyError(result.error))}`,
      });
      return;
    }

    // Repeated pages within one entry are almost certainly an authoring slip;
    // keep the first occurrence so the display order stays as intended.
    const uniquePages = [...new Set(result.data.printed_pages)];
    if (uniquePages.length !== result.data.printed_pages.length) {
      warnings.push(`${entryId}: duplicate printed_pages collapsed`);
      result.data.printed_pages = uniquePages;
    }

    const previous = byTitle.get(result.data.title);
    if (previous) {
      skipped.push({
        status: "skipped",
        framework: previous.id,
        reason: `duplicate title — superseded by ${entryId}`,
      });
    }
    byTitle.set(result.data.title, { id: entryId, data: result.data });
  });

  // ── Page-range check against the source PDF.
  const sourceDoc = new mupdf.PDFDocument(fs.readFileSync(sourcePath));
  const pageCount = sourceDoc.countPages();
  console.log(
    `Book: ${book.name} (${slug}) — ${pageCount} PDF pages, offset ${offset}, ${byTitle.size} framework(s) after validation`
  );

  const entries: ValidEntry[] = [];
  for (const e of byTitle.values()) {
    const outOfRange = e.data.printed_pages.find((p) => p + offset < 1 || p + offset > pageCount);
    if (outOfRange !== undefined) {
      skipped.push({
        status: "skipped",
        framework: e.id,
        reason: `printed page ${outOfRange} → pdf page ${outOfRange + offset} outside 1-${pageCount} (check printed_page_offset)`,
      });
      continue;
    }
    entries.push(e);
  }

  // ── Casebook lookup only — frameworks without an imported book make no sense,
  // and creating the row here would fork ownership of name/college.
  const { data: casebook, error: casebookError } = await supabase
    .from("casebooks")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (casebookError) {
    fail(`Failed to look up casebook "${slug}": ${casebookError.message}`);
  }
  if (!casebook) {
    fail(`No casebooks row for "${slug}" — run npm run import -- --book ${slug} first.`);
  }

  // Only feeds the imported-vs-updated report labels; subject to the PostgREST
  // 1000-row default cap, which is far above any plausible framework count.
  const { data: existingRows, error: existingError } = await supabase
    .from("frameworks")
    .select("title");
  if (existingError) {
    fail(`Failed to read existing frameworks: ${existingError.message}`);
  }
  const existingTitles = new Set(
    z.array(z.object({ title: z.string() })).parse(existingRows ?? []).map((r) => r.title)
  );

  // ── Reuse pages the case importer already rendered: identical 2x/DeviceRGB
  // params make existing objects equivalent, so only missing pages are rendered.
  // (list() defaults to 100 rows; a book with >1000 objects would need paging.)
  const existingObjects = new Set<string>();
  const { data: objectList, error: listError } = await supabase.storage
    .from("case-images")
    .list(slug, { limit: 1000 });
  if (listError) {
    warnings.push(`could not list existing case-images/${slug} objects (${listError.message}) — rendering all pages`);
  } else {
    for (const obj of objectList ?? []) existingObjects.add(obj.name);
  }

  const neededPages = [...new Set(entries.flatMap((e) => e.data.printed_pages))].sort((a, b) => a - b);
  const failedPages = new Set<number>();
  let renderedCount = 0;
  let reusedCount = 0;
  let uploadedCount = 0;
  for (const printed of neededPages) {
    if (existingObjects.has(`p${printed}.png`)) {
      reusedCount++;
      continue;
    }
    const page = sourceDoc.loadPage(printed + offset - 1); // loadPage is 0-based
    const pixmap = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB, false, true);
    const png = pixmap.asPNG();
    pixmap.destroy();
    page.destroy();
    renderedCount++;

    const storagePath = `${slug}/p${printed}.png`;
    const { error } = await supabase.storage
      .from("case-images")
      .upload(storagePath, Buffer.from(png), { contentType: "image/png", upsert: true });
    if (error) {
      failedPages.add(printed);
      warnings.push(`upload failed for ${storagePath}: ${error.message}`);
    } else {
      uploadedCount++;
    }
  }
  sourceDoc.destroy();

  // ── Framework upserts.
  const results: ReportRow[] = [];
  for (const e of entries) {
    const failedPage = e.data.printed_pages.find((p) => failedPages.has(p));
    if (failedPage !== undefined) {
      skipped.push({
        status: "skipped",
        framework: e.id,
        reason: `image upload failed for p${failedPage}`,
      });
      continue;
    }
    const row = {
      title: e.data.title,
      description: e.data.description,
      casebook_id: casebook.id,
      image_paths: e.data.printed_pages.map((p) => `${slug}/p${p}.png`),
      sort_order: e.data.sort_order,
    };
    const { error } = await supabase.from("frameworks").upsert(row, { onConflict: "title" });
    if (error) {
      skipped.push({
        status: "skipped",
        framework: e.id,
        reason: `db upsert failed: ${oneLine(error.message)}`,
      });
      continue;
    }
    results.push({
      status: existingTitles.has(e.data.title) ? "updated" : "imported",
      framework: e.id,
      reason: "",
    });
  }

  // ── Report.
  const imported = results.filter((r) => r.status === "imported").length;
  const updated = results.filter((r) => r.status === "updated").length;
  console.log("");
  console.table([...results, ...skipped]);
  console.log(
    `Imported ${imported} new, updated ${updated}, skipped ${skipped.length} — rendered ${renderedCount} page(s), reused ${reusedCount} existing, uploaded ${uploadedCount}.`
  );

  if (warnings.length > 0) {
    console.warn(`\nWarnings:\n  - ${warnings.join("\n  - ")}`);
  }
}

main().catch((err) => fail(err instanceof Error ? (err.stack ?? err.message) : String(err)));
