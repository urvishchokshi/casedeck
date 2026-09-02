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

## Database rules

- Schema changes ONLY via new numbered files in `supabase/migrations/` — never edit an already-applied migration.
- The user applies migrations manually in the Supabase SQL editor. After writing a migration, always tell them to run it.

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build (must pass with zero errors)
- (add pipeline commands here when they exist)

## Status

- **Phase 0.1: app shell — DONE** (routes, sidebar/drawer layout, UI primitives, placeholder pages, design tokens)

Upcoming:

- Phase 0.2: Supabase + schema
- Phase 0.3: Microsoft auth (@isb.edu enforcement)
- Phase 1: content pipeline
- Phase 2: case library
- Phase 3: tracking
- Phase 4: matching
- Phase 5: casebooks/frameworks

## Workflow

- Commit after each verified prompt.
- Update the Status section above at the end of every prompt.
- Use the `code-reviewer` subagent after significant changes.
