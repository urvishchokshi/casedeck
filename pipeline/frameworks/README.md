# Framework entries

One `<slug>.json` per casebook, describing the book's framework/theory pages
(the study-material section most casebooks open with). Imported with:

```
npm run import-frameworks -- --book <slug>
```

The script renders each referenced page from `pipeline/source/<slug>.pdf` at 2x
via mupdf and uploads it to the private `case-images` bucket at
`<slug>/p<printed>.png` — pages the case importer already rendered are reused,
not re-rendered. Rows land in the `frameworks` table, upserted by title.

## Format

A JSON array of entries:

```json
[
  {
    "title": "Profitability Framework",
    "description": "Break a profit decline into revenue and cost drivers before going deep.",
    "printed_pages": [12, 13, 14],
    "sort_order": 1
  },
  {
    "title": "Market Entry",
    "description": null,
    "printed_pages": [18],
    "sort_order": 2
  }
]
```

Rules:

- **Page numbers are the ones printed in slide footers**, same convention as
  case extraction. The plan's `printed_page_offset` (`pipeline/plans/<slug>.json`)
  converts them to PDF pages: `pdf_page = printed_page + offset`.
- `printed_pages` order = display order of the images on /frameworks.
- `description` may be `null` (or omitted).
- `sort_order` (optional, default 0) orders entries on /frameworks; ties break
  by title.
- **Titles are globally unique across all books** — the import upserts on
  title, so a same-titled framework in a second book would overwrite the first.
  Disambiguate in the JSON (e.g. "Profitability (IIM A)") if that ever matters.

## Producing the file

Hand-write it, or paste the casebook's frameworks-section slides (or its table
of contents) into a claude.ai chat and ask for a JSON array in exactly the
shape above, reading page numbers from the slide footers.

Invalid entries are skipped with a report — a partial file imports fine, and
re-runs are idempotent.

Note: already-rendered pages are reused by *existence*, so if a source PDF is
ever replaced with a revised edition, delete the book's `case-images/<slug>/`
storage folder first to force fresh renders.

## Prerequisites

- Book registered in `pipeline/books.json`
- Plan exists at `pipeline/plans/<slug>.json`
- Source PDF at `pipeline/source/<slug>.pdf`
- `npm run import -- --book <slug>` has run at least once (the casebook row
  must exist — import-frameworks never creates it)
