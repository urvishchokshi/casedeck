# Tag cleanup prompt

Run `npm run tags-export`, then paste everything below the line into a new claude.ai chat, followed by the `CURRENT TAGS` block the export printed — and, when the export printed one, the `EXISTING MAPPING` block too. Save the JSON it returns to `pipeline/tags/mapping.json`, then preview with `npm run tags-apply -- --dry` and apply with `npm run tags-apply`.

---

You are cleaning up the filter tags of a case-interview prep platform. Its cases carry three tag dimensions extracted **verbatim** from casebook slides, so the lists have fragmented into near-duplicates. I will paste the current values with usage counts for three dimensions: `industry` (one value per case), `case_types` (multiple per case), and `company` (the consulting firm a case is attributed to). I may also paste an existing mapping from a previous cleanup round.

**Your task:** produce a merge mapping that REDUCES each list by consolidating values that mean the same thing. Merge:

- Case, punctuation, and spacing variants — "E-commerce" / "E-Commerce", "Oil & Gas" / "Oil and Gas" / "Oil & Gas/ Services".
- Abbreviations and long forms — "F&B" → "Food & Beverage"; "M&A" and "Mergers & Acquisitions" → one canonical.
- Parenthetical or hyphenated sub-segments into their parent — "Food & Beverage (Fine Dining)" → "Food & Beverage", "Automotive (Two-wheelers)" → "Automotive".
- Near-synonyms — "Growth" / "Growth Strategy".
- Company suffixes and regional variants — "McKinsey Buddy Case" → "McKinsey", "LEK" / "LEK Consulting" → one, "Strategy&" / "Strategy& India" / "Strategy& ME" / "Strategy& Middle East" → "Strategy&".

Rules:

- **Canonical choice:** prefer the most standard, recognizable label for the concept; the usage counts indicate which spelling is most common. **Merge only when the values are clearly the same concept — when genuinely in doubt, keep them separate.** Target a compact, filter-friendly list (industries roughly 20–30 values), but never force-merge distinct domains just to hit a number.
- A value that is not a valid entry for its dimension at all (e.g. "Abstract" as an industry) maps to `null` — the field is cleared / the array element removed.
- **If an existing mapping was provided, treat it as settled:** extend it with entries for the new values and output the FULL cumulative mapping (old entries + new), keeping the prior canonical choices unless one was clearly wrong.
- **No chains:** every entry must point directly at its final canonical value — a target must never itself appear as a mapped key in the same dimension.
- Include entries ONLY for values that change; values already canonical are simply omitted and stay untouched.

Output ONLY a single JSON code block (**no prose before or after it**) in exactly this schema — each dimension an object of `"<from>": "<to>"` pairs (or `null` to clear):

```json
{
  "industry": { "<from>": "<to or null>" },
  "case_types": { "<from>": "<to or null>" },
  "company": { "<from>": "<to or null>" }
}
```

## Example output

```json
{
  "industry": {
    "E-commerce": "E-Commerce",
    "Food & Beverage (Fine Dining)": "Food & Beverage",
    "F&B": "Food & Beverage",
    "Abstract": null
  },
  "case_types": {
    "Growth": "Growth Strategy",
    "Mergers & Acquisitions": "M&A"
  },
  "company": {
    "McKinsey Buddy Case": "McKinsey",
    "Strategy& India": "Strategy&",
    "Strategy& ME": "Strategy&"
  }
}
```

(Every dimension is present even when it has few entries; "E-Commerce", "Food & Beverage", "M&A", "McKinsey", and "Strategy&" appear only as targets — never also as keys; "Abstract" is not an industry, so it maps to `null`; all other values in the pasted lists were already canonical and are omitted.)
