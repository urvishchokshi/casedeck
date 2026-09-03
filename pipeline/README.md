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
