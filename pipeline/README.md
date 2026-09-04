# Content pipeline

Turns IIM casebook PDFs into structured case JSON (and, later, solution-page screenshots) for import into Supabase. Extraction quality work happens in claude.ai chats; the scripts here handle deterministic splitting and rendering.

## Folder layout

```
pipeline/
  books.json     # registry: [{ slug, name, college }]           (versioned)
  plans/         # <slug>.json per-case page plans               (versioned)
  prompts/       # ready-to-paste claude.ai prompts              (versioned)
  source/        # <slug>.pdf original casebooks                 (gitignored)
  chunks/        # <slug>/chunk-NN_*.pdf + manifest.json         (gitignored, generated)
  inbox/         # <slug>/*.json extraction results from chats   (gitignored)
  tags/          # mapping.json cumulative tag-merge mapping      (versioned)
                 # current.json exported tag snapshot             (gitignored, generated)
```

## Page-number convention

The book prints a page number in every slide's footer; all extraction output uses those **printed** numbers. Each plan carries a calibration offset satisfying:

```
pdf_page = printed_page + printed_page_offset
```

The later import script uses this to render solution/exhibit screenshots from the **source** PDF given printed page numbers.

## Workflow (per casebook)

1. **Register the book** — add `{ slug, name, college }` to `books.json`; drop the PDF at `source/<slug>.pdf`.
2. **Build the plan** — open a claude.ai chat, paste `prompts/split-plan.md` (below the divider) plus the book's contents/index pages. Answer its calibration question (the PDF page where the first case starts). Save the returned JSON to `plans/<slug>.json`.
3. **Split into chunks** — run:

   ```
   npm run split -- --book <slug> [--chunk-size 8]
   ```

   This validates the plan (overlaps abort; gaps only warn — divider pages exist), writes `chunks/<slug>/chunk-NN_pAAA-pBBB.pdf` (~8 cases each), a `manifest.json` mapping chunks → cases/pages, and `_smoke-test.png` (first page of chunk-01 at 2x) to prove the rendering path works. Re-running rebuilds the chunk directory from scratch.

4. **Extract** — create a claude.ai Project with `prompts/extraction.md` (below the divider) as its Project instructions. For each chunk: new chat, attach the chunk PDF, save the returned JSON array to `inbox/<slug>/<chunk-file-name>.json`. If a response cuts off, reply "continue".
5. **Import** — the import script (next phase) reads the inbox + manifest, renders solution/exhibit screenshots from the source PDF via the printed-page offset, and upserts into Supabase.

## Tag cleanup (as needed, across all books)

Tags are extracted **verbatim**, so the filter lists fragment over time ("E-Commerce" / "E-commerce", "McKinsey" / "McKinsey Buddy Case"). Cleanup is manual and user-triggered — never automatic during import:

1. `npm run tags-export` — writes `tags/current.json` and prints a paste-ready block of distinct `industry` / `case_types` / `company` values with counts (plus the existing mapping, when one exists).
2. Paste `prompts/tag-cleanup.md` (below its divider) + the exported block(s) into a claude.ai chat; save the returned JSON to `tags/mapping.json`.
3. `npm run tags-apply -- --dry` — previews per-entry affected-row counts without writing.
4. `npm run tags-apply` — applies the mapping (scalar UPDATEs for industry/company; in-array replace + dedup for case_types; a `null` target clears the field / removes the element). Idempotent — re-runs report zeros; keys that match nothing warn, never fail.

`mapping.json` is **cumulative**: each cleanup round feeds it back into the chat and saves the full old+new mapping, so canonical choices stay stable across rounds. It is versioned in git; `current.json` is a regenerable snapshot and is not.

## Plan schema (`plans/<slug>.json`)

```json
{
  "printed_page_offset": 0,
  "cases": [
    { "index": 1, "title": "Case title", "start": 10, "end": 14 }
  ]
}
```

`start`/`end` are 1-based PDF page numbers in the source file (inclusive).

## Manifest schema (`chunks/<slug>/manifest.json`)

```json
{
  "slug": "iim-a",
  "printed_page_offset": 0,
  "chunks": [
    {
      "file": "chunk-01_p010-p065.pdf",
      "start_page": 10,
      "end_page": 65,
      "case_indices": [1, 2, 3, 4, 5, 6, 7, 8],
      "case_titles": ["..."]
    }
  ]
}
```
