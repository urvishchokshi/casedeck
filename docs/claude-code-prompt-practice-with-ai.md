# Claude Code prompt — "Practice with AI" on the case detail page

Paste everything below the line into Claude Code from the CaseDeck repo root.

---

Implement the **Practice with AI** feature on the case detail page (`/cases/[id]`). Read `CLAUDE.md` first and follow every convention in it (tokens only, no hex; `Button`/`Pill` primitives; server components by default; strict types; `desk:` breakpoint; motion classes). The full spec for the prompt text lives in `docs/practice-with-ai-prompt.md` — read it before writing any code. Sections 1 and 2 of that doc are the source of truth for the string; do not paraphrase or shorten them.

## What the feature does

Students who don't have a partner available can copy a ready-made prompt, paste it into ChatGPT or Claude, and run the case in voice mode with the model acting as interviewer. The prompt is the base prompt from the doc followed by a case block assembled from the `cases` row. **The prompt text is never shown in the UI** — the student only gets a copy button.

## 1. Prompt builder — `src/lib/practice-prompt.ts`

- Pure, React-free, server-safe module (no `"use client"`, no `server-only` either — it's plain string work).
- Export `PRACTICE_BASE_PROMPT` as a `const` string: the base prompt from section 1 of the doc, verbatim.
- Export `buildPracticePrompt(c: PracticeCaseInput): string` where `PracticeCaseInput = Pick<Case, "title" | "case_types" | "industry" | "difficulty" | "company" | "prompt" | "transcript" | "exhibit_image_urls"> & { casebookName: string }`.
- Assemble the case block exactly as section 2 of the doc specifies, including the field mapping table: `null` industry/difficulty/company → `Not specified`; `case_types` joined with `, `; exhibit count from `exhibit_image_urls.length`, `0` → `none`; transcript turns as `Candidate: ` / `Interviewer: ` one paragraph each (blank line between), in order, text untouched; if `prompt` is null, use the first interviewer turn as the problem statement and drop it from the transcript; `extra_tags` omitted. One blank line between the base prompt and the case block.
- Add a small unit-style sanity check as a `scripts/` throwaway is NOT needed — instead, temporarily `console.log` the output for one case in dev, eyeball it against the filled example in the doc, then remove the log.

## 2. UI — a "Practice with AI" block above the transcript on `/cases/[id]`

- New client component `src/app/(app)/cases/[id]/PracticeWithAI.tsx` (`"use client"`), rendered by the server page **directly above the transcript card**, below the prompt/problem-statement block. The server page builds the string with `buildPracticePrompt` (it already has the case row and the casebook embed — add `name` to the embed if it isn't selected) and passes it as a `prompt: string` prop. The string lives only in props; never render it into the DOM (no hidden textarea, no `data-` attribute).
- Card styling per the Design section: white card, `--line` border, `--r` radius, `--sh` shadow, same padding rhythm as the transcript card. Contents, left to right on `desk:`, stacked below it:
  - A small icon tile (inline SVG, sparkle/mic — keep it simple) + heading **"Practice with AI"** (h3 style used elsewhere on the page) + one muted line: *"Copy the prompt, paste it into ChatGPT or Claude, switch to voice mode and run this case with an AI interviewer. Keep this page open for exhibits, and say "end the case" for feedback."*
  - A primary `Button` **"Copy prompt"** (38px, solid accent). On click: `navigator.clipboard.writeText(prompt)`. On success, swap the label to **"Prompt copied"** with a check icon for ~2 seconds and show a small banner/toast (see below). On failure (clipboard API unavailable/denied), show an inline muted error *"Couldn't copy — try again."*; do not fall back to displaying the prompt.
  - Under the button, a small muted caption: *"Works best in ChatGPT's or Claude's voice mode on your phone."*
- **"Prompt copied" banner**: a compact pill/toast anchored to the card (not a global toast system — nothing like that exists in the repo): `--done-bg`/`--done-fg` tone with the green dot, `cd-pop-in` on mount, auto-dismiss after 2s, conditionally rendered (no exit animation, matching the motion rules). `aria-live="polite"` so screen readers announce it.
- **Peer-practice notice** inside the same card, as its own tinted strip at the bottom (`--tint` background, `--tint-border` border, `--rs` radius — informational, not an error colour). Copy, adjust lightly for fit:
  > **Built for practising with peers.** CaseDeck is designed around practising live with other students — that's what we believe gives the best results. Use the AI interviewer when you can't find a partner, not instead of one. **Find a partner →** (links to `/match`)
  Use an info-circle inline SVG in `--slate`, 13px text, link in accent.
- Mobile (`max-desk:`): button full-width, 44px, everything stacks; no horizontal overflow.
- Wrap in a `cd-fade-up`-friendly structure consistent with the rest of the page (the page root already fades up — don't add a second animation).

## 3. Don'ts

- Don't change the pipeline, schema, types beyond adding `casebookName` to the builder input, or the log dialog.
- Don't add a global toast/provider, a new dependency, or a modal.
- Don't show the prompt text anywhere, including in a `title` attribute or console in production.

## 4. Verify, document, commit

- `npm run build` must pass with zero errors. Test copy in Chrome + Safari on localhost (clipboard requires a secure context — localhost counts).
- Update `CLAUDE.md`: add a **Practice with AI** bullet under the Tracking or a new "Practice with AI" section (builder location, card placement, copy/toast behaviour, the peer notice, the doc reference) and a DONE line in Status.
- Run the `code-reviewer` subagent, address findings, then commit: `feat: Practice with AI prompt copy on case detail`.
