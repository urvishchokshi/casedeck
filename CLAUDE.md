@AGENTS.md

# CasePrep

## Project

CasePrep — case interview prep platform for ISB students. Case library with filters, progress tracking, partner matching, casebook downloads, frameworks. Content is extracted from IIM casebook PDFs via a manual Claude-assisted pipeline (scripts split PDFs and render images; extraction JSON is produced in claude.ai chats and bulk-imported). ~200-300 users, ISB-only via Microsoft login with @isb.edu enforcement.

## Stack

- Next.js (App Router, TypeScript, `src/` dir)
- Tailwind CSS
- Supabase (Postgres, Auth, Storage)
- Vercel for deployment
- No component libraries — UI primitives are built in-house

## Conventions

- All colors/radii/type sizes come from CSS variables in `src/app/globals.css` — **NEVER hardcode hex values in components** (the theme will be swapped in later). Consume tokens via Tailwind arbitrary values, e.g. `bg-[var(--color-surface)]`.
- Shared UI primitives live in `src/components/ui/` (Button, Card, Pill, Collapsible); other shared components in `src/components/`.
- Everything strictly typed. No `any`.
- Server components by default; add `"use client"` only where interactivity requires it.

## Database

Schema lives in `supabase/migrations/0001_init.sql` (applied manually in the Supabase SQL editor). TypeScript mirrors in `src/lib/types.ts`; clients in `src/lib/supabase/` (`client.ts` browser, `server.ts` cookie-based SSR).

- `profiles` — one row per user, auto-created by a trigger on `auth.users` insert; `is_admin` is protected by column-level grants (users can only update `full_name`/`campus`)
- `casebooks` — one per IIM casebook (`slug` unique, optional `pdf_url` for downloads)
- `cases` — case content: transcript jsonb, solution/exhibit image URLs, filters (industry, case_type, difficulty), rating aggregates (`avg_rating`, `rating_count` maintained by trigger). **Idempotency key: `UNIQUE (casebook_id, source_file)`** — re-imports overwrite in place
- `user_case_progress` — per-user per-case: completed, marked_for_later, self_score (1–10), quality_rating (1–5); `UNIQUE (user_id, case_id)`
- `match_profiles` — partner-matching profile, one row per user (PK = user_id)
- Enums: `difficulty_level`, `partner_status`, `mode_pref`, `campus_type`
- RLS enabled on all tables: users read shared content and write only their own rows; casebooks/cases/storage writes are service-role only (import pipeline)
- Storage: **private** bucket `case-images` (authenticated read; service-role writes). Serve via signed URLs.

## Database rules

- Schema changes ONLY via new numbered files in `supabase/migrations/` — never edit an already-applied migration.
- The user applies migrations manually in the Supabase SQL editor. After writing a migration, always tell them to run it.

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build (must pass with zero errors)
- (add pipeline commands here when they exist)

## Status

- **Phase 0.1: app shell — DONE** (routes, sidebar/drawer layout, UI primitives, placeholder pages, design tokens)
- **Phase 0.2: Supabase + schema — DONE** (supabase-js + ssr clients, full migration with RLS + triggers + private storage bucket, shared types)

Upcoming:

- Phase 0.3: Microsoft auth (@isb.edu enforcement) — must add auth middleware/proxy for session refresh (server client's `setAll` relies on it)
- Phase 1: content pipeline
- Phase 2: case library
- Phase 3: tracking
- Phase 4: matching
- Phase 5: casebooks/frameworks

## Workflow

- Commit after each verified prompt.
- Update the Status section above at the end of every prompt.
- Use the `code-reviewer` subagent after significant changes.
