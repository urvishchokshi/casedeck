# Casedeck

Case interview preparation platform for ISB students — a central place to browse cases, track practice progress, find mock-interview partners, and access casebooks and frameworks during placement prep.

> **Status:** app shell with placeholder pages. Auth, database, and real content come in later phases.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- Tailwind CSS v4 (design tokens as CSS variables in `src/app/globals.css`)
- [lucide-react](https://lucide.dev) icons
- Planned: Supabase (auth + Postgres), deployed on Vercel

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/cases`. Other routes: `/login`, `/dashboard`, `/match`, `/casebooks`, `/frameworks`.

Production build:

```bash
npm run build
npm start
```

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
    login/            # standalone page, no sidebar
    page.tsx          # / → redirects to /cases
  components/
    AppShell.tsx      # sidebar (desktop) / top bar + drawer (mobile)
    PageHeader.tsx
    ui/               # Button, Card, Pill, Collapsible
```

## Roadmap

1. **Supabase schema** — tables for cases, casebooks, users, progress, ratings, partner profiles
2. **Microsoft auth** — Azure AD sign-in restricted to `@isb.edu` accounts via Supabase Auth
3. **Content pipeline** — ingest casebook PDFs into structured case records
4. **Case library** — real search, filters, case detail with solutions
5. **Tracking** — mark done / self-score / save for later, dashboard stats and charts
6. **Matching** — practice-partner discovery with availability and WhatsApp reveal
