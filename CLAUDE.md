# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

The import above carries the Next.js agent rules: this is Next.js 16 with breaking changes from older versions. Read `node_modules/next/dist/docs/` before writing framework code, and commit the `AGENTS.md` block if `next dev` regenerates it.

## Commands

- `npm run dev` — dev server (Turbopack; PWA/service worker disabled in dev, see `next.config.ts`)
- `npm run build` — production build (generates `public/sw.js` via Serwist)
- `npm start` — serve production build
- `npm run lint` — ESLint (flat config, `eslint.config.mjs`)

No test framework is configured.

## Environment

Requires `.env` (gitignored) with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Both are read in `src/lib/supabase.ts`.

## Architecture

Single-page travel-map app. UI language is Polish. All data lives in Supabase; there is no backend API layer — components query Supabase directly from the browser.

**Auth gate.** `src/app/layout.tsx` wraps everything in `AuthWrapper`, which blocks the app behind `LoginScreen` until a Supabase session exists. Because data-fetching components mount before the session may be ready, they also subscribe to `supabase.auth.onAuthStateChange` and refetch when a session arrives (see `Sidebar.tsx`). Preserve this pattern when adding data-fetching components — otherwise first-load races leave the UI empty.

**Supabase client.** `src/lib/supabase.ts` exports a single browser client using the anon key. Access control relies on Supabase RLS, not server code. `page.tsx` is an async Server Component but only reads `searchParams`; it does no server-side data fetching.

**State lives in the URL.** Modals and filters are driven by query params, not React state:
- `?view=map|list` — map vs. list view
- `?modal=add-place|view-place|edit-place|add-trip|edit-trip|manage-tags|share-trip|import` plus `placeId` / `tripId` — which modal renders. Modals are always mounted and read the params themselves (except `AddPlaceModal` / `ManageTagsModal`, gated in `page.tsx`).
- `?trips=<comma-names>|none` and `?tags=<comma-names>` — active filters, stored as **names**, resolved to IDs at query time.

Navigate with `router.push('?...', { scroll: false })`; build params from `new URLSearchParams(window.location.search)`.

**Cross-component sync via window CustomEvents.** Since components fetch independently, mutations broadcast `window` events instead of lifting state:
- `places-updated` — a place changed; markers and pending-list refetch
- `trips-updated` — trips/categories changed; sidebar refetches
- `filters-changed` — carries `{ isEmpty, trips, tags }` in `detail` so listeners apply filters immediately without waiting on the router URL update
- `search-changed` — text search changed

When you mutate data, dispatch the matching event. `PlacesMarkers` reads filter values from the event `detail` first, falling back to URL params — pass `detail` for instant updates.

**Map.** Leaflet via `react-leaflet`. `Map.tsx` dynamically imports `MapWidget` with `ssr: false` (Leaflet needs `window`). Default marker icons are patched from unpkg CDN in `MapWidget.tsx`. `PlacesMarkers` holds the filter→query logic (trips → `trip_id`, tags → `place_categories` join table).

**Geocoding.** Places can be created without coordinates (`lat`/`lng` NULL) — these appear as "pending" in the sidebar. `Sidebar.handleBatchGeocode` uses `leaflet-geosearch` `OpenStreetMapProvider` to resolve them, throttled ~1.5s/request, saving only on a single confident match.

**Data model (Supabase tables).** `places` (name, lat, lng, note, address, `trip_id`, created_at) · `trips` (name, icon, `parent_id` — self-referential tree, rendered recursively in `Sidebar.renderTree` / filtered via `getAllDescendants`) · `categories` (tags: name, icon) · `place_categories` (many-to-many places↔categories).

**PWA.** Serwist. Service worker source is `src/app/sw.ts` → built to `public/sw.js`; manifest and icons wired in `layout.tsx`. Disabled in dev.

**Path alias.** `@/*` → `src/*`.
