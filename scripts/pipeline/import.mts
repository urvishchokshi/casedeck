/**
 * Import extracted cases from the inbox into Supabase: validate the extraction
 * JSON, render solution/exhibit pages from the source PDF, upload PNGs to the
 * private case-images bucket, and upsert casebook + case rows.
 *
 * Usage: npm run import -- --book <slug>
 *
 * Inputs:
 *   .env.local                   — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   pipeline/books.json          — registry of casebooks (slug must exist)
 *   pipeline/plans/<slug>.json   — printed_page_offset (pdf_page = printed_page + offset)
 *   pipeline/source/<slug>.pdf   — the casebook PDF (pages are rendered from here)
 *   pipeline/inbox/<slug>/*.json — extraction JSON arrays from claude.ai chats
 *
 * Outputs:
 *   casebooks row upserted by slug; cases rows upserted on
 *   (casebook_id, source_start_page); PNGs in the case-images bucket at
 *   <slug>/p<printed>.png (2x scale, ~200 DPI). Idempotent: re-runs overwrite.
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

const pageNumber = z.number().int().min(1);
const ExtractedCaseSchema = z.object({
  title: z.string().min(1),
  printed_pages: z.array(pageNumber).min(1),
  case_types: z.array(z.string()),
  industry: z.string().nullable(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).nullable(),
  // Optional so pre-0003 inbox JSONs (no company field) still import cleanly.
  company: z.string().nullable().default(null),
  extra_tags: z.array(z.string()),
  tags_inferred: z.boolean(),
  prompt: z.string().nullable(),
  transcript: z.array(
    z.object({
      speaker: z.enum(["interviewer", "candidate"]),
      text: z.string(),
    })
  ),
  solution_pages: z.array(pageNumber).min(1),
  exhibit_pages: z.array(pageNumber),
});
type ExtractedCase = z.infer<typeof ExtractedCaseSchema>;

type ValidCase = {
  /** Where the case came from, for the report: `<file>[<i>] "<title>"`. */
  id: string;
  sourceStartPage: number;
  data: ExtractedCase;
};

type ReportRow = {
  status: "imported" | "updated" | "skipped";
  case: string;
  start_page: number | "";
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
      fail(`Unknown argument "${arg}". Usage: npm run import -- --book <slug>`);
    }
  }
  if (!book) {
    fail("Missing --book <slug>. Usage: npm run import -- --book <slug>");
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

// Extraction JSON saved from a chat may be wrapped in a markdown code fence.
function stripCodeFence(raw: string): string {
  const match = raw.trim().match(/^```[\w-]*\s*([\s\S]*?)\s*```$/);
  return match ? match[1] : raw;
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

  const inboxDir = path.join(PIPELINE, "inbox", slug);
  const inboxFiles = fs.existsSync(inboxDir)
    ? fs.readdirSync(inboxDir).filter((f) => f.endsWith(".json")).sort()
    : [];
  if (inboxFiles.length === 0) {
    fail(
      `No extraction JSON in ${inboxDir}.\nRun the extraction chats (pipeline/prompts/extraction.md) per chunk and save their JSON arrays there.`
    );
  }

  const warnings: string[] = [];
  const skipped: ReportRow[] = [];

  // ── Parse + validate every inbox file; dedup by first printed page (last wins).
  const bySourceStartPage = new Map<number, ValidCase>();
  for (const fileName of inboxFiles) {
    const rawText = fs.readFileSync(path.join(inboxDir, fileName), "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFence(rawText));
    } catch (err) {
      skipped.push({
        status: "skipped",
        case: fileName,
        start_page: "",
        reason: `not valid JSON: ${oneLine(err instanceof Error ? err.message : String(err))}`,
      });
      continue;
    }
    if (!Array.isArray(parsed)) {
      skipped.push({ status: "skipped", case: fileName, start_page: "", reason: "not a JSON array" });
      continue;
    }

    parsed.forEach((element: unknown, i) => {
      const loose = typeof element === "object" && element !== null ? (element as Record<string, unknown>) : {};
      const title = typeof loose.title === "string" ? loose.title : "(untitled)";
      const caseId = `${fileName}[${i}] "${title}"`;

      if ("error" in loose) {
        skipped.push({
          status: "skipped",
          case: caseId,
          start_page: "",
          reason: `extraction error: ${oneLine(String(loose.error))}`,
        });
        return;
      }
      const result = ExtractedCaseSchema.safeParse(element);
      if (!result.success) {
        skipped.push({
          status: "skipped",
          case: caseId,
          start_page: "",
          reason: `invalid: ${oneLine(z.prettifyError(result.error))}`,
        });
        return;
      }

      const sourceStartPage = Math.min(...result.data.printed_pages);
      const previous = bySourceStartPage.get(sourceStartPage);
      if (previous) {
        skipped.push({
          status: "skipped",
          case: previous.id,
          start_page: sourceStartPage,
          reason: `duplicate start page — superseded by ${caseId}`,
        });
      }
      bySourceStartPage.set(sourceStartPage, { id: caseId, sourceStartPage, data: result.data });
    });
  }

  // ── Page-range check against the source PDF.
  const sourceDoc = new mupdf.PDFDocument(fs.readFileSync(sourcePath));
  const pageCount = sourceDoc.countPages();
  console.log(`Book: ${book.name} (${slug}) — ${pageCount} PDF pages, offset ${offset}, ${bySourceStartPage.size} case(s) after validation`);

  const cases: ValidCase[] = [];
  for (const c of [...bySourceStartPage.values()].sort((a, b) => a.sourceStartPage - b.sourceStartPage)) {
    const pages = [...c.data.solution_pages, ...c.data.exhibit_pages, ...c.data.printed_pages];
    const outOfRange = pages.find((p) => p + offset < 1 || p + offset > pageCount);
    if (outOfRange !== undefined) {
      skipped.push({
        status: "skipped",
        case: c.id,
        start_page: c.sourceStartPage,
        reason: `printed page ${outOfRange} → pdf page ${outOfRange + offset} outside 1-${pageCount} (check printed_page_offset)`,
      });
      continue;
    }
    if (c.data.transcript.length === 0) {
      warnings.push(`${c.id}: empty transcript`);
    }
    cases.push(c);
  }

  // ── Casebook upsert (payload omits pdf_url so an existing value is preserved).
  const { data: casebook, error: casebookError } = await supabase
    .from("casebooks")
    .upsert({ slug, name: book.name, college: book.college }, { onConflict: "slug" })
    .select("id")
    .single();
  if (casebookError || !casebook) {
    fail(`Failed to upsert casebook "${slug}": ${casebookError?.message ?? "no row returned"}`);
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("cases")
    .select("source_start_page")
    .eq("casebook_id", casebook.id);
  if (existingError) {
    fail(`Failed to read existing cases for "${slug}": ${existingError.message}`);
  }
  const existingStartPages = new Set(
    z.array(z.object({ source_start_page: z.number() })).parse(existingRows ?? []).map((r) => r.source_start_page)
  );

  // ── Render + upload each unique needed page once, before any case row is written.
  const neededPages = [...new Set(cases.flatMap((c) => [...c.data.solution_pages, ...c.data.exhibit_pages]))].sort(
    (a, b) => a - b
  );
  const pageToStoragePath = new Map<number, string>();
  const failedPages = new Set<number>();
  let renderedCount = 0;
  let uploadedCount = 0;
  for (const printed of neededPages) {
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
      pageToStoragePath.set(printed, storagePath);
      uploadedCount++;
    }
  }
  sourceDoc.destroy();

  // ── Case upserts.
  const results: ReportRow[] = [];
  for (const c of cases) {
    const failedPage = [...c.data.solution_pages, ...c.data.exhibit_pages].find((p) => failedPages.has(p));
    if (failedPage !== undefined) {
      skipped.push({
        status: "skipped",
        case: c.id,
        start_page: c.sourceStartPage,
        reason: `image upload failed for p${failedPage}`,
      });
      continue;
    }
    const row = {
      casebook_id: casebook.id,
      source_start_page: c.sourceStartPage,
      title: c.data.title,
      case_types: c.data.case_types,
      industry: c.data.industry,
      difficulty: c.data.difficulty,
      company: c.data.company,
      extra_tags: c.data.extra_tags,
      tags_inferred: c.data.tags_inferred,
      prompt: c.data.prompt,
      transcript: c.data.transcript,
      printed_pages: c.data.printed_pages,
      solution_image_urls: c.data.solution_pages.map((p) => pageToStoragePath.get(p)!),
      exhibit_image_urls: c.data.exhibit_pages.map((p) => pageToStoragePath.get(p)!),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("cases")
      .upsert(row, { onConflict: "casebook_id,source_start_page" });
    if (error) {
      skipped.push({
        status: "skipped",
        case: c.id,
        start_page: c.sourceStartPage,
        reason: `db upsert failed: ${oneLine(error.message)}`,
      });
      continue;
    }
    results.push({
      status: existingStartPages.has(c.sourceStartPage) ? "updated" : "imported",
      case: c.id,
      start_page: c.sourceStartPage,
      reason: "",
    });
  }

  // ── Report.
  const imported = results.filter((r) => r.status === "imported").length;
  const updated = results.filter((r) => r.status === "updated").length;
  console.log("");
  console.table([...results, ...skipped]);
  console.log(
    `Imported ${imported} new, updated ${updated}, skipped ${skipped.length} — rendered ${renderedCount} page(s), uploaded ${uploadedCount}.`
  );
  console.log("Inbox files may be deleted or kept — re-running the import is idempotent.");

  if (warnings.length > 0) {
    console.warn(`\nWarnings:\n  - ${warnings.join("\n  - ")}`);
  }
}

main().catch((err) => fail(err instanceof Error ? (err.stack ?? err.message) : String(err)));
