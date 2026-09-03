/**
 * Upload a casebook's source PDF to the private library-files bucket and point
 * casebooks.pdf_url at it so the /casebooks page can offer a download.
 *
 * Usage: npm run upload-book -- --book <slug>
 *
 * Inputs:
 *   .env.local                 — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   pipeline/books.json        — registry of casebooks (slug must exist)
 *   pipeline/source/<slug>.pdf — the casebook PDF to upload
 *
 * Outputs:
 *   library-files/<slug>.pdf (upsert — re-runs overwrite) and
 *   casebooks.pdf_url set to that STORAGE PATH (not a URL — pages mint signed
 *   URLs at read time). The casebook row must already exist (npm run import
 *   creates it); this script never creates casebook rows.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
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
      fail(`Unknown argument "${arg}". Usage: npm run upload-book -- --book <slug>`);
    }
  }
  if (!book) {
    fail("Missing --book <slug>. Usage: npm run upload-book -- --book <slug>");
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

  const sourcePath = path.join(PIPELINE, "source", `${slug}.pdf`);
  if (!fs.existsSync(sourcePath)) {
    fail(`Missing source PDF: ${sourcePath}\nPlace the casebook PDF for "${book.name}" at that exact path.`);
  }

  const { data: casebook, error: casebookError } = await supabase
    .from("casebooks")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (casebookError) {
    fail(`Failed to look up casebook "${slug}": ${casebookError.message}`);
  }
  if (!casebook) {
    fail(
      `No casebooks row for "${slug}" — run npm run import -- --book ${slug} first; upload-book never creates casebook rows.`
    );
  }

  const sizeMb = (fs.statSync(sourcePath).size / (1024 * 1024)).toFixed(1);
  const storagePath = `${slug}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("library-files")
    .upload(storagePath, fs.readFileSync(sourcePath), {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadError) {
    fail(`Failed to upload ${storagePath} to library-files: ${uploadError.message}`);
  }

  // pdf_url stores the STORAGE PATH; the /casebooks page signs it at read time.
  const { error: updateError } = await supabase
    .from("casebooks")
    .update({ pdf_url: storagePath })
    .eq("id", casebook.id);
  if (updateError) {
    fail(`Failed to set casebooks.pdf_url for "${slug}": ${updateError.message}`);
  }

  console.log(`Uploaded pipeline/source/${slug}.pdf (${sizeMb} MB) → library-files/${storagePath}`);
  console.log(`casebooks.pdf_url set for "${book.name}". Re-runs overwrite — safe to repeat.`);
}

main().catch((err) => fail(err instanceof Error ? (err.stack ?? err.message) : String(err)));
