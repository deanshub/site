@AGENTS.md

# Project Conventions

This is an AI-generated web app. The entire codebase is written and maintained by Claude. Keep things simple, consistent, and easy to extend.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript (strict mode)
- **UI:** shadcn/ui (base-nova style, lucide icons) — add via `bunx shadcn add <component>`
- **Styling:** Tailwind CSS v4 — theme defined in `app/globals.css`
- **Data fetching:** SWR with global `suspense: true` and JSON fetcher (`components/swr-provider.tsx`)
- **Dates:** date-fns
- **Linting:** Biome — `bun run lint` to check, `bun run format` to fix
- **Package manager:** Bun
- **Path aliases:** `@/*` maps to project root

## Rules

- Default to Server Components. Only add `"use client"` when needed (hooks, event handlers, browser APIs).
- Each component gets its own file under `components/`.
- Use named exports only — no default exports.
- Use `cn()` from `@/lib/utils` to merge Tailwind classes.
- Use `twMerge` from `tailwind-merge` for conditional/merged classes.
- Use Suspense boundaries and `loading.tsx`/`error.tsx` for async states — no manual `isLoading` checks.
- Use `date-fns` for all date manipulation. No manual `new Date()` string wrangling.
- Store data as flat JSON in `data/`. Only migrate to SQLite when files aren't enough.

## PWA (Serwist)
- Uses `@serwist/turbopack` (Turbopack-compatible; not `@serwist/next` which is webpack-only).
- `next.config.ts` — wrapped with `withSerwist()`.
- `app/sw.ts` — service worker source (precaching + `defaultCache` runtime caching + offline fallback).
- `app/serwist/[path]/route.ts` — route handler that compiles and serves the SW via esbuild.
- `components/serwist-provider.tsx` — `"use client"` wrapper for `SerwistProvider`.
- `app/~offline/page.tsx` — offline fallback page.
- `app/manifest.ts` — web app manifest (Next.js metadata API).
- `public/icons/` — SVG placeholder icons (192, 512, apple-touch).
- Generated SW files (`public/sw*`) are git-ignored.
