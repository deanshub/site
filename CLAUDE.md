# Fintrack — Project Conventions

## UI
- Use shadcn/ui components (new-york style, lucide icons).
- Add new shadcn components via `bunx shadcn add <component>`.

## React
- Default to Server Components. Only add `"use client"` when required (e.g., SWR hooks, event handlers, browser APIs).
- Each custom (non-shadcn) component lives in its own file under `components/`.
- Use named exports only — no default exports.

## Data Fetching
- Use SWR (`import useSWR from "swr"`) for client-side data fetching. SWR is configured globally with `suspense: true` and a default JSON fetcher via `SWRProvider` in the root layout.
- Prefer React Suspense boundaries (`<Suspense fallback={...}>`) for loading states instead of manual `isLoading` checks.
- Wrap data-fetching components with React Error Boundaries for error fallback UI.
- Use Next.js `loading.tsx` and `error.tsx` files in route segments for route-level loading and error states.

## Styling
- Tailwind CSS v4. Theme is defined via CSS variables in `app/globals.css`.
- Use `twMerge` from `tailwind-merge` for conditional/merged classes.

## Dates
- Use `date-fns` for all date manipulation (parsing, formatting, arithmetic). No manual `new Date()` string wrangling.

## Language
- TypeScript in strict mode.

## Data Storage
- Store data as flat JSON files in the `data/` directory.
- Only migrate to SQLite if file-based storage becomes insufficient.

## Linting & Formatting
- Biome (not ESLint). Run `bun run lint` to check and `bun run format` to auto-format.

## Package Manager
- Bun.

## Path Aliases
- `@/*` maps to the project root (configured in `tsconfig.json`).

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
