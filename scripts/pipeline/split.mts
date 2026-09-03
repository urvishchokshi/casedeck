/**
 * Split a casebook PDF into chunk PDFs of ~N cases each, per the plan file.
 *
 * Usage: npm run split -- --book <slug> [--chunk-size 8]
 *
 * Inputs:
 *   pipeline/books.json          — registry of casebooks (slug must exist)
 *   pipeline/source/<slug>.pdf   — the casebook PDF
 *   pipeline/plans/<slug>.json   — per-case page plan (from the split-plan claude.ai chat)
 *
 * Outputs (pipeline/chunks/<slug>/):
 *   chunk-NN_pAAA-pBBB.pdf       — one PDF per chunk of cases
 *   manifest.json                — chunk → cases/pages mapping
 *   _smoke-test.png              — first page of chunk-01 rendered at 2x (~200 DPI)
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as mupdf from "mupdf";
import { z } from "zod";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PIPELINE = path.join(ROOT, "pipeline");

const BookSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  college: z.string().min(1),
});
const BooksSchema = z.array(BookSchema);

const PlanSchema = z.object({
  printed_page_offset: z.number().int(),
  cases: z
    .array(
      z.object({
        index: z.number().int(),
        title: z.string().min(1),
        start: z.number().int().min(1),
        end: z.number().int().min(1),
      })
    )
    .min(1),
});
type Plan = z.infer<typeof PlanSchema>;
type PlanCase = Plan["cases"][number];

function fail(message: string): never {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): { book: string; chunkSize: number } {
  let book: string | undefined;
  let chunkSize = 8;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--book") {
      book = argv[++i];
    } else if (arg === "--chunk-size") {
      const raw = argv[++i];
      chunkSize = Number(raw);
      if (!Number.isInteger(chunkSize) || chunkSize < 1) {
        fail(`--chunk-size must be a positive integer (got "${raw}")`);
      }
    } else {
      fail(`Unknown argument "${arg}". Usage: npm run split -- --book <slug> [--chunk-size 8]`);
    }
  }
  if (!book) {
    fail("Missing --book <slug>. Usage: npm run split -- --book <slug> [--chunk-size 8]");
  }
  return { book, chunkSize };
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

function validatePlan(plan: Plan, pageCount: number): string[] {
  const warnings: string[] = [];
  const errors: string[] = [];

  const seenIndices = new Map<number, string>();
  for (const c of plan.cases) {
    if (c.index < 1) {
      errors.push(`Case "${c.title}": index must be >= 1 (got ${c.index})`);
    }
    const dup = seenIndices.get(c.index);
    if (dup !== undefined) {
      errors.push(`Duplicate case index ${c.index}: "${dup}" and "${c.title}" — indices must be unique (they identify cases at import time)`);
    }
    seenIndices.set(c.index, c.title);

    if (c.start > c.end) {
      errors.push(`Case ${c.index} "${c.title}": start (${c.start}) > end (${c.end})`);
    }
    if (c.start < 1 || c.end > pageCount) {
      errors.push(
        `Case ${c.index} "${c.title}": range ${c.start}-${c.end} is outside the document (1-${pageCount})`
      );
    }
    // Offset sanity: printed_page = pdf_page - offset must be a plausible page number
    const printedStart = c.start - plan.printed_page_offset;
    if (printedStart < 1) {
      errors.push(
        `Case ${c.index} "${c.title}": printed_page_offset ${plan.printed_page_offset} implies printed page ${printedStart} for PDF page ${c.start} — the offset is likely wrong (must satisfy pdf_page = printed_page + offset)`
      );
    }
  }

  if (errors.length > 0) {
    fail(`Plan validation failed:\n  - ${errors.join("\n  - ")}`);
  }

  // Full coverage sweep: catches every overlapping pair (not just adjacent ones)
  // and reports true gaps only (pages covered by no case).
  const coverage: PlanCase[][] = Array.from({ length: pageCount + 1 }, () => []);
  for (const c of plan.cases) {
    for (let p = c.start; p <= c.end; p++) coverage[p].push(c);
  }
  const overlapPairs = new Set<string>();
  for (let p = 1; p <= pageCount; p++) {
    const cs = coverage[p];
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        const [a, b] = [cs[i], cs[j]].sort((x, y) => x.index - y.index);
        overlapPairs.add(
          `Overlap: case ${a.index} "${a.title}" (${a.start}-${a.end}) and case ${b.index} "${b.title}" (${b.start}-${b.end})`
        );
      }
    }
  }
  if (overlapPairs.size > 0) {
    fail(`Plan validation failed:\n  - ${[...overlapPairs].join("\n  - ")}`);
  }

  const first = Math.min(...plan.cases.map((c) => c.start));
  const last = Math.max(...plan.cases.map((c) => c.end));
  for (let p = first; p <= last; p++) {
    if (coverage[p].length === 0) {
      let end = p;
      while (end + 1 <= last && coverage[end + 1].length === 0) end++;
      warnings.push(`Gap: pages ${p}-${end} not covered by any case (probably divider pages)`);
      p = end;
    }
  }
  return warnings;
}

function chunkCases(cases: PlanCase[], chunkSize: number): PlanCase[][] {
  const ordered = [...cases].sort((a, b) => a.start - b.start);
  const groups: PlanCase[][] = [];
  for (let i = 0; i < ordered.length; i += chunkSize) {
    groups.push(ordered.slice(i, i + chunkSize));
  }
  return groups;
}

function main() {
  const { book: slug, chunkSize } = parseArgs(process.argv.slice(2));

  const booksPath = path.join(PIPELINE, "books.json");
  const books = readJsonFile(
    booksPath,
    BooksSchema,
    `Create it as a JSON array of { "slug", "name", "college" } objects.`
  );
  const book = books.find((b) => b.slug === slug);
  if (!book) {
    fail(
      `No book with slug "${slug}" in ${booksPath}.\nKnown slugs: ${books.map((b) => b.slug).join(", ") || "(none)"}.\nAdd an entry { "slug": "${slug}", "name": "...", "college": "..." } to books.json.`
    );
  }

  const sourcePath = path.join(PIPELINE, "source", `${slug}.pdf`);
  if (!fs.existsSync(sourcePath)) {
    fail(`Missing source PDF: ${sourcePath}\nPlace the casebook PDF for "${book.name}" at that exact path.`);
  }

  const planPath = path.join(PIPELINE, "plans", `${slug}.json`);
  const plan = readJsonFile(
    planPath,
    PlanSchema,
    `Create it using the split-plan prompt (pipeline/prompts/split-plan.md) in a claude.ai chat with the casebook's contents pages, then save the JSON it returns to that path.`
  );

  const sourceDoc = new mupdf.PDFDocument(fs.readFileSync(sourcePath));
  const pageCount = sourceDoc.countPages();
  console.log(`Book: ${book.name} (${slug}) — ${pageCount} pages, ${plan.cases.length} cases planned`);

  const warnings = validatePlan(plan, pageCount);

  const inboxDir = path.join(PIPELINE, "inbox", slug);
  if (fs.existsSync(inboxDir) && fs.readdirSync(inboxDir).some((f) => f.endsWith(".json"))) {
    warnings.push(
      `inbox/${slug}/ already contains extraction JSON keyed by chunk filenames — re-splitting may change chunk names/boundaries and orphan those files`
    );
  }

  const outDir = path.join(PIPELINE, "chunks", slug);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const groups = chunkCases(plan.cases, chunkSize);
  const pageDigits = Math.max(3, String(pageCount).length);

  type ManifestChunk = {
    file: string;
    start_page: number;
    end_page: number;
    case_indices: number[];
    case_titles: string[];
  };
  const manifestChunks: ManifestChunk[] = [];

  groups.forEach((group, i) => {
    const startPage = group[0].start;
    const endPage = group[group.length - 1].end;
    const chunkNo = String(i + 1).padStart(2, "0");
    const pad = (n: number) => String(n).padStart(pageDigits, "0");
    const fileName = `chunk-${chunkNo}_p${pad(startPage)}-p${pad(endPage)}.pdf`;

    const chunkDoc = new mupdf.PDFDocument();
    // One graft map per chunk so shared resources (fonts, background XObjects)
    // are copied once, not once per page.
    const graftMap = chunkDoc.newGraftMap();
    let dst = 0;
    for (const c of group) {
      for (let p = c.start; p <= c.end; p++) {
        // graftPage uses 0-based page indices; the plan uses 1-based
        graftMap.graftPage(dst++, sourceDoc, p - 1);
      }
    }
    graftMap.destroy();
    const buffer = chunkDoc.saveToBuffer("compress");
    fs.writeFileSync(path.join(outDir, fileName), buffer.asUint8Array());
    chunkDoc.destroy();

    manifestChunks.push({
      file: fileName,
      start_page: startPage,
      end_page: endPage,
      case_indices: group.map((c) => c.index),
      case_titles: group.map((c) => c.title),
    });
  });

  const manifest = {
    slug,
    printed_page_offset: plan.printed_page_offset,
    chunks: manifestChunks,
  };
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  // Smoke-test render: first page of chunk-01 at 2x (~200 DPI on 16:9 slides).
  // This exercises the exact rendering path the import script will rely on.
  const firstChunkPath = path.join(outDir, manifestChunks[0].file);
  const renderDoc = new mupdf.PDFDocument(fs.readFileSync(firstChunkPath));
  const page = renderDoc.loadPage(0);
  const pixmap = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB, false, true);
  const smokePath = path.join(outDir, "_smoke-test.png");
  fs.writeFileSync(smokePath, pixmap.asPNG());
  pixmap.destroy();
  renderDoc.destroy();
  sourceDoc.destroy();

  console.log(`\nWrote ${manifestChunks.length} chunk(s) to ${outDir}`);
  console.table(
    manifestChunks.map((c) => ({
      chunk: c.file.slice(0, 8),
      cases: c.case_indices.length,
      pages: `${c.start_page}-${c.end_page}`,
      file: c.file,
    }))
  );
  console.log(`Manifest: ${path.join(outDir, "manifest.json")}`);
  console.log(`Smoke test render: ${smokePath}`);

  if (warnings.length > 0) {
    console.warn(`\nWarnings:\n  - ${warnings.join("\n  - ")}`);
  }
}

main();
