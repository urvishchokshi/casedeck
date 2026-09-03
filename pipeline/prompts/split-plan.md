# Split-plan prompt

Paste everything below the line into a new claude.ai chat, attaching (or pasting) the casebook's contents/index pages. Save the JSON it returns to `pipeline/plans/<slug>.json`.

---

You are helping me build a page plan for splitting a consulting casebook PDF (a deck of 16:9 slides) into per-case chunks. I have attached (or pasted) the casebook's table of contents / index pages, which list each case with its printed page number.

**Step 1 — calibration (do this FIRST, before any output):**
Ask me for exactly one calibration fact: the PDF page number — as shown in my PDF viewer, not the number printed on the slide — where the **first case** begins. If the table of contents does not let you infer where the **last case ends** (e.g. it gives only start pages and there are trailing non-case sections), also ask me for the PDF page where the last case ends. Do not proceed until I answer.

**Step 2 — compute the offset:**
The book prints page numbers in slide footers; the ToC uses those printed numbers. Compute:

```
printed_page_offset = pdf_page_of_first_case − printed_page_of_first_case
```

so that for any page, `pdf_page = printed_page + printed_page_offset`. Sanity-check the offset against any other page whose printed number you can see. If the arithmetic doesn't check out, tell me instead of outputting a plan.

**Step 3 — output the plan:**
Output ONLY a single JSON code block (no prose before or after) in exactly this schema:

```json
{
  "printed_page_offset": 0,
  "cases": [
    { "index": 1, "title": "Case title as printed", "start": 10, "end": 14 }
  ]
}
```

Rules:

- `start` and `end` are **1-based PDF page numbers in the source file** (printed page + offset), covering every page of the case: transcript page(s) AND its Approach/solution page(s).
- List **actual cases only** — skip introductions, framework sections, industry primers, dividers, acknowledgements, and any other non-case content.
- `index` is a simple 1..N counter in book order. `title` is the case title exactly as the ToC prints it, without suffixes like "– Interview Transcript" or "– Approach".
- A case ends where the next case (or a non-case section) begins. If the ToC lists transcript and approach as separate entries for the same case, merge them into one case whose range spans both.
- If you are unsure where a specific case ends, extend it to the page before the next case starts (divider pages inside a range are harmless; overlapping ranges are not).
