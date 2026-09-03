# Casedeck

Case interview preparation platform for ISB students — a central place to browse cases, track practice progress, find mock-interview partners, and access casebooks and frameworks during placement prep.

> **Status:** feature-complete (Phases 0–5) and production-hardened. Case library with dynamic filters/search, progress tracking + dashboard, partner matching, casebook downloads, and frameworks — all on Supabase with Microsoft (`@isb.edu`-only) sign-in.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- Tailwind CSS v4 (design tokens as CSS variables in `src/app/globals.css`)
- [Supabase](https://supabase.com) — Postgres, Auth (Azure OAuth), private Storage buckets
- [lucide-react](https://lucide.dev) icons
- Deployed on Vercel

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in Supabase values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/cases` (or `/login` when signed out). Other routes: `/dashboard`, `/match`, `/casebooks`, `/frameworks`.

Production build:

```bash
npm run build
npm start
```

## Production deploy (Vercel)

Checklist for a fresh production deployment:

1. **Vercel environment variables**
   - `NEXT_PUBLIC_SUPABASE_URL` — project URL from Supabase → Settings → API
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public anon key
   - `SUPABASE_SERVICE_ROLE_KEY` — server-only; used by the auth callback to delete non-ISB sign-ups. **Required in practice**: if unset the callback won't 500, but undeleted non-ISB accounts can query the Supabase API directly with the anon key (RLS grants authenticated users read on shared content and match profiles) — the app proxy is not a boundary for that surface
   - `NEXT_PUBLIC_SITE_URL` — the canonical production URL, no trailing slash (e.g. `https://casedeck.example.com`). Required: auth redirects and metadata derive from it. Previews fall back to `VERCEL_URL` automatically.
2. **Supabase → Authentication → URL Configuration**
   - Site URL = the production URL
   - Redirect URLs must include `https://<domain>/auth/callback` (keep `http://localhost:3000/auth/callback` for local dev)
3. **Azure app registration**
   - Redirect URI = `https://<project-ref>.supabase.co/auth/v1/callback`
   - ⚠️ The registration is currently **multi-tenant**, so the `@isb.edu` gate rests on the Azure `email` claim; lock the registration to the ISB tenant (or verify tenant id) before a wide launch.
4. **Database** — apply every file in `supabase/migrations/` (in order) via the Supabase SQL editor; migrations are manual by design.
5. **Notes**
   - Security headers are set in `next.config.ts`; HSTS is not duplicated there because Vercel serves it automatically on HTTPS domains. CSP is deferred (needs nonce plumbing).
   - `/api/health` returns `{ "ok": true }` without auth — point uptime checks at it.
   - `npm run build` must pass with zero errors before deploying.

## Design system

The Casedeck theme (visual reference: `design/casedeck-v2.html`) is built on CSS variables defined on `:root` in `src/app/globals.css` — colors, radii, and shadows. Components only consume tokens via Tailwind arbitrary values (e.g. `bg-[var(--card)]`) — no hardcoded hex values — so the theme can be adjusted by editing that one file. Fonts: Instrument Serif for display headings, Plus Jakarta Sans for UI text, IBM Plex Mono for source-file/code accents (all via `next/font/google`).

## Project structure

```
src/
  app/
    (app)/            # authenticated pages, wrapped in the AppShell layout
      cases/          # /cases and /cases/[id]
      dashboard/
      match/
      casebooks/
      frameworks/
    actions/          # server actions (progress tracking, match profiles)
    api/health/       # unauthenticated uptime-check endpoint
    auth/callback/    # OAuth code exchange + @isb.edu enforcement
    login/            # standalone page, no sidebar
    page.tsx          # / → redirects to /cases
  components/
    AppShell.tsx      # sidebar (desktop) / top bar + drawer (mobile)
    PageHeader.tsx
    ui/               # Button, ButtonLink, Card, Pill, Collapsible, Skeleton
  lib/
    supabase/         # browser, SSR, and admin (service-role) clients
  proxy.ts            # route protection + session refresh (Next 16 middleware)
pipeline/             # casebook PDF → structured cases extraction workflow
scripts/pipeline/     # split / import / upload-book / import-frameworks
supabase/migrations/  # schema, applied manually in the SQL editor
```

## Content pipeline

Cases are extracted from IIM casebook PDFs via a manual Claude-assisted pipeline — see `pipeline/README.md` for the full workflow (`npm run split` → claude.ai extraction chats → `npm run import`).
