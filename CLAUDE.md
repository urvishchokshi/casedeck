@AGENTS.md

# Casedeck

## Project

Casedeck (formerly CasePrep) — case interview prep platform for ISB students. Case library with filters, progress tracking, partner matching, casebook downloads, frameworks. Content is extracted from IIM casebook PDFs via a manual Claude-assisted pipeline (scripts split PDFs and render images; extraction JSON is produced in claude.ai chats and bulk-imported). ~200-300 users, ISB-only via Microsoft login with @isb.edu enforcement.

## Stack

- Next.js (App Router, TypeScript, `src/` dir)
- Tailwind CSS
- Supabase (Postgres, Auth, Storage)
- Vercel for deployment
- No component libraries — UI primitives are built in-house

## Conventions

- All colors/radii/shadows come from CSS variables in `src/app/globals.css` — **NEVER hardcode hex values in components**. Consume tokens via Tailwind arbitrary values, e.g. `bg-[var(--card)]`. Font sizes are px literals matching the design (e.g. `text-[13.5px]`).
- Shared UI primitives live in `src/components/ui/` (Button, Card, Pill, Collapsible); other shared components in `src/components/`.
- Everything strictly typed. No `any`.
- Server components by default; add `"use client"` only where interactivity requires it.

## Design

`design/casedeck-v2.html` is the **visual reference ONLY** — its extra features (countdown/target widget, per-case minutes, client/objective/interviewer-style metadata, nav badges, sort controls, cohort stats, rating modal) are out of scope. Adopt only its look.

- **Tokens** (`src/app/globals.css` `:root`): `--ink` #171a19 (text), `--canvas` #f6f5f1 (page bg), `--card` #fff, `--line` / `--line-soft` (borders), `--muted`, `--accent` #15614e (+ `--accent-hover`, `--accent-50/100/200`), `--amber` #a4632c + `--amber-50` (ratings), `--chip` #f1efe9 (neutral pills), `--thead` #fbfaf7 (table header / hover tint), `--on-accent` #fff, `--status-active/idle` (dots); radii `--r` 12px (cards), `--rs` 8px (buttons/inputs), pills are `rounded-full`; shadow `--sh`; composite surfaces `--login-panel` (login right panel gradient), `--ph` (striped image placeholder).
- **Fonts** (next/font/google, variables on `<body>`): `--font-display` Instrument Serif 400 normal+italic (all headings, weight 400, tight line-height — h1–h4 styled globally in globals.css); `--font-ui` Plus Jakarta Sans 400–700 (body, 15px/1.55); `--font-mono` IBM Plex Mono 400/500 (source-file lines, e.g. `font-[family-name:var(--font-mono)]`).
- **Component patterns**: white cards with `--line` border, `--r` radius, `--sh` shadow; buttons 40px tall, `--rs` radius, 13.5px semibold (primary solid accent, secondary outline); pills via `Pill` tones (`chip` neutral, `accent` for case type/done, `amber` for ★ ratings); table headers uppercase 11px letter-spaced on `--thead`; filter rows = 96px muted label + wrapping pill chips (selected = accent bg, white text); sidebar 238px white with dot-indicator nav (active = accent on accent-50 pill); brand mark = 26px/7px-radius accent square with white bold "C" + bold wordmark (`src/components/Brand.tsx`).

## Auth

Microsoft (Azure) OAuth via Supabase Auth, restricted to `@isb.edu` accounts.

- **Flow**: `/login` → `SignInButton` (browser client, `signInWithOAuth({ provider: 'azure' })`, redirectTo `/auth/callback`) → `src/app/auth/callback/route.ts` exchanges the code for a session → redirect to `/cases`.
- **Two-layer @isb.edu enforcement, server-side only** (`isIsbEmail` in `src/lib/auth.ts`):
  1. Callback: non-ISB email → the auth user is deleted via the service-role admin client (`src/lib/supabase/admin.ts`, guarded by `import "server-only"` — never import it into client code), session dropped, redirect `/login?error=domain`.
  2. Proxy: every request re-validates with `getUser()` (never `getSession`); a session with a non-ISB email is signed out and bounced. `(app)/layout.tsx` repeats both checks as belt-and-braces.
  - ⚠️ The Azure provider is **multi-tenant**, so the gate rests on the Azure `email` claim; a hostile tenant could self-assert an @isb.edu email. Locking the Azure app registration to the ISB tenant (or verifying tenant id) is the real fix — revisit before launch.
- **Route protection**: `src/proxy.ts` (Next 16 renamed middleware → proxy). Runs on everything except `_next` assets and dotted files; refreshes the session per the @supabase/ssr cookie pattern (cookies are copied onto redirect responses). Unauthenticated → `/login`; authenticated visiting `/login` → `/cases`.
- **Adding a public route**: add its path to `PUBLIC_PATHS` in `src/proxy.ts` (exact or prefix match).
- `/login?error=domain|auth` drives the error banner on the login page.

## Database

Schema lives in `supabase/migrations/` (`0001_init.sql` base, `0002_pipeline_tags.sql` pipeline tag columns, `0003_company.sql` consulting-firm attribution, `0004_library.sql` frameworks/materials + library-files bucket; applied manually in the Supabase SQL editor). TypeScript mirrors in `src/lib/types.ts`; clients in `src/lib/supabase/` (`client.ts` browser, `server.ts` cookie-based SSR).

- `profiles` — one row per user, auto-created by a trigger on `auth.users` insert; `is_admin` is protected by column-level grants (users can only update `full_name`/`campus`)
- `casebooks` — one per IIM casebook (`slug` unique; `pdf_url` holds the PDF's **storage path** in the `library-files` bucket — a path, NOT a URL; null = no PDF yet, set by `npm run upload-book`)
- `cases` — case content: `prompt`, transcript jsonb (`[{speaker: "interviewer"|"candidate", text}]` turns), solution/exhibit image columns (hold **storage paths**, not URLs), dynamic tags (`case_types`/`extra_tags` `text[]` with GIN indexes, `tags_inferred`), nullable `industry`/`difficulty`/`company` (consulting-firm attribution, verbatim, indexed), `source_start_page` + `printed_pages`, rating aggregates (`avg_rating`, `rating_count` maintained by trigger). **Idempotency key: `UNIQUE (casebook_id, source_start_page)`** — re-imports overwrite in place
- `user_case_progress` — per-user per-case: completed, marked_for_later, self_score (1–10), quality_rating (1–5); `UNIQUE (user_id, case_id)`
- `match_profiles` — partner-matching profile, one row per user (PK = user_id)
- `frameworks` — framework/theory pages: **globally** `UNIQUE (title)` (the import-frameworks upsert key — cross-book title collisions overwrite), nullable `description`, nullable `casebook_id` (on delete **set null** → entry regroups under "General"), `image_paths` jsonb (ordered **storage paths in `case-images`** — same objects the case importer renders), `sort_order`. Select-only RLS; writes service-role only (import script)
- `materials` — standalone study-material downloads: `title`, nullable `description`, `file_path` (storage path in `library-files`), `sort_order`. Select-only RLS; rows added manually via Studio (no script)
- Enums: `difficulty_level`, `partner_status`, `mode_pref`, `campus_type`
- RLS enabled on all tables: users read shared content and write only their own rows; casebooks/cases/frameworks/materials/storage writes are service-role only (import pipeline / Studio)
- Storage: **private** buckets `case-images` (case + framework page renders) and `library-files` (casebook PDFs + study-material files) — authenticated read, service-role writes. Serve via signed URLs.

## Database rules

- Schema changes ONLY via new numbered files in `supabase/migrations/` — never edit an already-applied migration.
- The user applies migrations manually in the Supabase SQL editor. After writing a migration, always tell them to run it.

## Case library filters

/cases filter/search architecture (Phase 2.2):

- **URL search params are the single source of truth** (`?type=A&type=B&difficulty=Easy&industry=…&company=…&casebook=<slug>&rating=4&status=done&marked=1&q=…`) — views are shareable/bookmarkable and back/forward work. Parsing/serializing/counting lives in `src/lib/case-filters.ts` (`parseCaseFilters` validates `difficulty` against the enum, `rating` ∈ {3,4}, `status` ∈ {done,not_done}, `marked` = "1"; text params pass through — unknown values just match nothing).
- **Semantics**: multi-select within a group = OR (`case_types` via array overlap); across groups = AND. Rating is single-select (`gte avg_rating`). The Status group spans two params — `status` (single-select done|not_done) + `marked` flag — and its selected chips OR together (done + marked = completed OR marked_for_later). Search `q` = case-insensitive `ilike` on title OR company, sanitized by **stripping** PostgREST/LIKE metacharacters (`sanitizeSearchQuery`) before interpolation into `.or()`.
- **Server side** (`src/app/(app)/cases/page.tsx`, server component): one filtered Supabase query (`overlaps` for type, `.in` for difficulty/industry/company, `casebooks!inner` embed + `.in("casebook.slug", …)` for casebook — lossless since `casebook_id` is NOT NULL) + an unfiltered facet query deriving distinct chip options + a `casebooks` list + the current user's `user_case_progress` rows, all in one `Promise.all`. Status/marked filtering happens in JS **after** the query ("not started" = absence of a progress row, inexpressible in the SQL filter; fine under the 500 cap). Chip options are unioned with selected-but-unknown values so stale URLs render removable chips. Query capped at `.limit(500)` — pagination is a future enhancement if needed.
- **Client side** (`src/app/(app)/cases/CaseFilters.tsx`): chip toggles + 300ms-debounced search push `router.replace(…, { scroll: false })`; filter state arrives as props from the server (no `useSearchParams`, so no Suspense boundary needed). The Status row is hardcoded client-side (not a `ChipGroup` — it has no facet source); the Rating row always renders even while all ratings are null.

## Tracking

Per-user progress on cases (Phase 3.1). Table `user_case_progress` (see Database); **no delete policy**, so every undo is an UPDATE/upsert, never a delete.

- **Server actions** (`src/app/actions/progress.ts`, `"use server"` — the only mutation path): `markDone(caseId, qualityRating 1–5, selfScore 1–10)` (both scores required, validated server-side; sets `completed_at`), `unmarkDone` (completed false, scores + completed_at null), `toggleMarkedForLater` (read-then-upsert). All derive the user from the session cookie client (never `admin.ts`), upsert on `onConflict: "user_id,case_id"` with payloads that omit untouched columns (upsert only updates provided columns), return `{ ok } | { ok: false, error }` instead of throwing, and `revalidatePath("/cases")` + `revalidatePath("/cases/<id>")`. Writing/nulling `quality_rating` is what fires the `recompute_case_rating` trigger (security definer; averages non-null ratings regardless of `completed`).
- **Case detail** (`/cases/[id]` → `CaseActions.tsx`, client): "Mark done" opens the hand-rolled "Log this case" dialog (5 cumulative-★ quality buttons amber-selected, 10 square self-score buttons accent-selected, save disabled until both chosen, Escape/backdrop close, no note field). Already done → "Done ✓" (accent-50) reopens the dialog pre-filled, with an "Unmark done" text action inside. "Mark for later" toggles optimistically (`useOptimistic` + transition); flagged = amber-50 "Marked ★". Dialog backdrop/shadow tokens: `--overlay`, `--sh-modal`.
- **Library**: Status column/pills — "Done" (accent Pill) and/or "Marked" (amber Pill), else "—" — from a `Map<case_id, progress>` join; same pills on mobile cards.
- **Rating display rule**: show the average only once `rating_count >= MIN_RATINGS_TO_SHOW` (3), else "New" — everywhere, via `shownRating` in `src/lib/rating.ts` / `src/components/RatingPill.tsx`.

## Dashboard

/dashboard (Phase 3.2): read-only personal analytics — no writes, no new tables; server component only. Two queries in `Promise.all`: the user's `user_case_progress` rows with a `case:cases(…)` embed, plus a facet query over all cases; all aggregation happens in TypeScript in `src/lib/dashboard.ts` (pure functions, React-free).

- **Scoring rule** (uniform): a row contributes to averages only when `completed && self_score !== null`; "done" counts use `completed` alone. Multi-type cases count once toward **each** of their `case_types` (Set-deduped per case).
- **Untagged grouping**: null industry/difficulty group under the `UNTAGGED` label, always sorted/shown last. The By-difficulty strip appends an Untagged segment only when null-difficulty cases exist.
- **Weakest ground**: ≤3 lowest-avg groupings across type + industry dimensions; a grouping needs **≥2 scored done cases** (`WEAKEST_MIN_CASES`) to qualify; card skipped entirely when nothing qualifies. Untagged is excluded (not filterable → no honest "Practice →" link). Links go to `/cases?type|industry=<enc>&status=not_done` via the URL-param filter system. Industry bars turn amber below avg 6 (`WEAK_SCORE_THRESHOLD`).
- **Marked for later**: up to 8 (`MARKED_LIMIT`), sorted `updated_at` desc (the only timestamp on marked-only rows); "View all →" → `/cases?marked=1`.
- Zero-done state: real-zero stat cards + one friendly CTA card, nothing else. "Last case" subtitle date = max `completed_at` via `relativeDate` in `src/lib/date.ts` (day-granularity, server-timezone).
- `progress.ts` deliberately does **not** revalidate `/dashboard`: the page reads cookies (Supabase client) so it renders dynamically per-request. Revisit if `staleTimes` is ever tuned.

## Matching

/match partner directory (Phase 4). Table `match_profiles` (see Database); no schema changes, **no filters on this page — deliberate**, it's a browsable directory. `updated_at` is owned by the `set_match_profiles_updated_at` trigger — never written from app code.

- **Server actions** (`src/app/actions/match.ts`, mirrors the `progress.ts` contract — session-derived user, `{ ok } | { ok: false, error }`, generic DB error messages, revalidate `/match` on success only): `upsertMatchProfile` (whatsapp normalized by stripping spaces/dashes then `^\+?\d{8,15}$`, stored normalized; function/industry trimmed non-empty ≤60 chars; campus/mode/status checked against `as const` enum arrays; upsert `onConflict: "user_id"`), `setStatus` (quick toggle; `.update().select()` so a 0-row update — card removed in another tab — reports failure), `deleteMatchProfile` (real delete; RLS has an owner delete policy, unlike `user_case_progress`).
- **Page** (`src/app/(app)/match/page.tsx`, server): one query with a `profile:profiles!inner(full_name, email)` embed (readable — profiles is select-all to authenticated), ordered `updated_at` desc; JS splits self vs others and stable-sorts others available-before-busy (keeps newest-first within each group without relying on SQL enum order). Display name = `full_name` fallback email prefix; `initialsOf` duplicated from `(app)/layout.tsx` (non-exported there).
- **Own-state block** (`MyMatchCard.tsx`, client): no row → "Join the board" card + inline form (Add my card; campus starts unchosen, mode/status default both/available matching DB defaults); has row → compact "Your card" bar with optimistic Available/Busy segmented toggle (`useOptimistic` set inside the transition, disabled while pending; busy-selected = amber-50), "Edit" (inline form swap, pre-filled — not a dialog) and "Remove my card" (confirm dialog cloning the `LogCaseDialog` chrome → `deleteMatchProfile`). Whatsapp input stays free-form; normalization is server-side.
- **Directory cards**: amber initials avatar, campus + mode pills, status dot + label — busy uses `--amber` (deliberate departure from the placeholder's `--status-idle`), available `--status-active`.
- **Reveal model (honest note)**: every signed-in user's server-rendered payload contains **all** WhatsApp numbers — `RevealWhatsApp.tsx` ("Show WhatsApp" → `wa.me/<digits>` "Open WhatsApp" link, digits-only, `+` stripped) is client-side UX friction, **not a security boundary**. Accepted because the page is authenticated ISB-only and numbers are shared consensually by joining; a real boundary would need an RPC/column-split + policy change.

## Library

/casebooks + /frameworks (Phase 5): read-only download/study pages — server components only, no writes, no filters. Both mint 1h signed URLs at read time (batched `createSignedUrls`, one call per bucket, guarded against empty path arrays; sign failures are `console.error`-logged, never thrown — items degrade individually).

- **/casebooks** (`src/app/(app)/casebooks/page.tsx`): card grid of `casebooks` rows with per-book exact case counts (`{ count: "exact", head: true }` per book — immune to the PostgREST row cap). `pdf_url` signed from `library-files` → primary "Download PDF" (`ButtonLink`, new tab); signing failed → disabled "PDF unavailable"; null → disabled "PDF coming soon".
- **/frameworks** (`src/app/(app)/frameworks/page.tsx`): `frameworks` ordered `sort_order` then title, grouped by `casebook_id` (label from the `casebook:casebooks(name)` embed, "From <name>"; null group "General" always last); each entry = serif title + optional description + full-width `ImageCard`s signed from `case-images`. Below it, "Study material": compact list of `materials` rows with signed `library-files` Download buttons — section hidden entirely when the table is empty. Whole-page "Material lands here soon" empty state when both are empty.
- **Adding study materials (Studio path — no script)**: upload the PDF to the `library-files` bucket via Dashboard → Storage, then insert a `materials` row (title, description, `file_path` = the storage path, sort_order) via Table editor/SQL. No app write path by design.
- Shared bits extracted in Phase 5: `src/components/ImageCard.tsx` (was local to `/cases/[id]` — crisp full-width render card with click-to-open + "Image unavailable" fallback) and `src/components/ui/ButtonLink.tsx` (plain `<a>` reusing Button's exported class constants, for signed-URL hrefs).

## Pipeline

Content extraction pipeline (`pipeline/` + `scripts/pipeline/`). Full workflow doc: `pipeline/README.md`. Scripts run via tsx, outside the Next build. **Note:** pipeline scripts are `.mts` — the `mupdf` package is ESM-only (top-level await) and the repo has no `"type": "module"`, so `.ts` scripts would be compiled as CJS and fail to import it.

- **Folder layout**: `pipeline/books.json` (registry `[{ slug, name, college }]`), `plans/` (per-case page plans), `prompts/` (claude.ai prompts), `frameworks/` (per-book framework entries + README), all versioned; `source/` (`<slug>.pdf` casebooks), `chunks/` (generated chunk PDFs + manifest), `inbox/` (extraction JSON from claude.ai chats), all gitignored.
- **Printed-page/offset convention**: all extraction output uses the page numbers **printed in slide footers**. Each plan/manifest carries `printed_page_offset` satisfying `pdf_page = printed_page + printed_page_offset`; the import script will use it to render solution screenshots from the source PDF.
- **Plan schema** (`plans/<slug>.json`, produced by the `prompts/split-plan.md` chat): `{ printed_page_offset, cases: [{ index, title, start, end }] }` — `start`/`end` are 1-based PDF pages, inclusive. Overlapping ranges are errors; gaps are warnings (divider pages).
- **Manifest schema** (`chunks/<slug>/manifest.json`): `{ slug, printed_page_offset, chunks: [{ file, start_page, end_page, case_indices, case_titles }] }`.
- **Dynamic-tag policy** (in `prompts/extraction.md`): tags come **verbatim from the book's slide header line** — never normalized to a predefined list. First header segment → `case_types` (split on "&"/"/"/"+"/"and" into an array), second → `industry`, difficulty word → nearest of Easy/Medium/Hard, rest → `extra_tags`. A segment (or case text) naming the consulting firm the case comes from → `company` (verbatim; judgment-based firm detection, no fixed list; null when unstated — never inferred; shown as a library column + detail pill, filterable via `?company=`). Missing header → fields are inferred (reusing labels seen elsewhere in the book) and flagged `tags_inferred: true` — but `company` is never inferred.
- **Chunk workflow**: register book in `books.json` + drop PDF in `source/` → claude.ai chat with `prompts/split-plan.md` + ToC pages produces `plans/<slug>.json` (chat asks for one calibration fact: the PDF page of the first case) → `npm run split -- --book <slug>` validates the plan and writes `chunks/<slug>/chunk-NN_pAAA-pBBB.pdf` (~8 cases each), `manifest.json`, and `_smoke-test.png` (chunk-01 page 1 at 2x, proving the mupdf render path) → per chunk: claude.ai Project (instructions = `prompts/extraction.md`), attach chunk, save JSON array to `inbox/<slug>/` → `npm run import -- --book <slug>`.
- **Import** (`scripts/pipeline/import.mts`, loads `.env.local` itself for the service-role key): zod-validates every inbox JSON array (code fences stripped; extraction `error` objects and invalid cases go to a skip report, never abort the run; duplicate first-printed-page across files → last wins), renders each needed solution/exhibit page from the **source** PDF at 2x via mupdf (once per unique page), uploads to the private `case-images` bucket at `<slug>/p<printed>.png` (`upsert: true`), and upserts `casebooks` (by slug) + `cases` on **`(casebook_id, source_start_page)`** — `source_start_page` = first printed page. The DB stores **storage paths** in `solution_image_urls`/`exhibit_image_urls`; mint signed URLs at read time. Re-runs are idempotent; inbox files can be kept or deleted.
- **Casebook PDF upload** (`scripts/pipeline/upload-book.mts`): uploads `source/<slug>.pdf` to `library-files/<slug>.pdf` (upsert) and sets `casebooks.pdf_url` to that storage path. The casebook row must already exist (`npm run import` first) — the script never creates it.
- **Frameworks import** (`scripts/pipeline/import-frameworks.mts`, doc: `pipeline/frameworks/README.md`): reads `pipeline/frameworks/<slug>.json` — a hand-written (or claude.ai-produced) array of `{ title, description (nullable), printed_pages: number[], sort_order? }` using printed slide-footer page numbers + the plan's `printed_page_offset`. Renders each page at 2x, uploads to `case-images/<slug>/p<printed>.png` — **pages already rendered by the case import are reused by existence, not re-rendered** (delete the storage folder to force fresh renders after a PDF revision) — and upserts `frameworks` on `title`. Invalid entries → skip report; idempotent re-runs. Requires the casebook row to exist.

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build (must pass with zero errors)
- `npm run split -- --book <slug> [--chunk-size 8]` — split a casebook PDF into chunk PDFs per its plan
- `npm run import -- --book <slug>` — validate inbox extraction JSON, render/upload page images, upsert casebook + cases
- `npm run upload-book -- --book <slug>` — upload the source PDF to `library-files` and set `casebooks.pdf_url`
- `npm run import-frameworks -- --book <slug>` — validate `pipeline/frameworks/<slug>.json`, render/upload framework pages, upsert `frameworks`

## Status

- **Phase 0.1: app shell — DONE** (routes, sidebar/drawer layout, UI primitives, placeholder pages, design tokens)
- **Phase 0.2: Supabase + schema — DONE** (supabase-js + ssr clients, full migration with RLS + triggers + private storage bucket, shared types)
- **Theme: Casedeck design system — DONE** (rename CasePrep → Casedeck, new tokens/fonts, full reskin of shell + all placeholder pages)
- **Phase 0.3: Microsoft auth + isb.edu enforcement — DONE** (Azure OAuth, callback with admin cleanup, proxy session refresh + route protection, real user footer with sign-out). **Phase 0 complete.**
- **Phase 1.1 — DONE** (content pipeline part 1: pipeline/ scaffolding, `npm run split` chunking script with plan validation + mupdf smoke-test render, split-plan + extraction claude.ai prompts)
- **Phase 1.2 — DONE** (content pipeline part 2: `0002_pipeline_tags.sql` — text[] tags, nullable industry/difficulty, `prompt`, `(casebook_id, source_start_page)` idempotency key; `npm run import` script: inbox validation + skip report, mupdf page rendering, storage uploads, casebook/case upserts). **Phase 1 complete.**
- **Phase 2.1 (minimal viewer) — DONE** (/cases library table + mobile cards on real data with dynamic tag pills; /cases/[id] detail: source line, tag pills, prompt, collapsible transcript with shaded interviewer turns, exhibit/solution images via 1h signed URLs from the private bucket; filters + tracking buttons remain disabled placeholders)
- **Phase 2.1.1 — DONE** (visual-QA fixes: `company` field end-to-end — `0003_company.sql`, extraction prompt firm-attribution rule, import script; extra_tags dropped from the library table, desktop subline reduced to "p. N"; detail pill row gains company + muted extra_tags pills)
- **Phase 2.1.2 — DONE** (library table gains a Company column — columns now Case / Casebook / Company / Industry / Type / Difficulty / Rating / Status — plus the first working filter: a Company filter row driven by `?company=` searchParams with options derived from the data; other filter groups remain disabled placeholders for Phase 2.2. ⚠️ /cases now selects `company` explicitly, so migration 0003 must be applied)
- **Phase 2.2 — DONE** (dynamic filter + search system for /cases; see "Case library filters" section)
- **Phase 3.1 — DONE** (live tracking: `src/app/actions/progress.ts` server actions, "Log this case" rating dialog + optimistic mark-for-later on /cases/[id], library Status column + working status/marked filters, `rating_count >= 3` "New" display rule; see "Tracking" section. **Phase 2 complete** — the status column subsumed 2.3)
- **Phase 3.2 — DONE** (personal dashboard: /dashboard rebuilt on real data — stat cards, Cases-by-type + Performance-by-industry bars, Weakest ground with Practice links into the filter system, Marked-for-later list, By-difficulty strip; aggregation in `src/lib/dashboard.ts`, `relativeDate` in `src/lib/date.ts`; see "Dashboard" section. **Phase 3 complete.**)
- **Phase 4 — DONE** (partner matching directory: /match join/edit/remove card with server-validated form, optimistic status toggle, available-first directory with click-to-reveal wa.me links; see "Matching" section)
- **Phase 5 — DONE** (casebooks downloads + frameworks: `0004_library.sql` — `frameworks`/`materials` tables + private `library-files` bucket; `npm run upload-book` + `npm run import-frameworks` scripts; /casebooks card grid with signed PDF downloads + case counts; /frameworks grouped framework images + study-material list; `ImageCard`/`ButtonLink` extracted as shared components; see "Library" section. ⚠️ Both pages require migration 0004 to be applied. **All planned phases complete.**)

## Workflow

- Commit after each verified prompt.
- Update the Status section above at the end of every prompt.
- Use the `code-reviewer` subagent after significant changes.
