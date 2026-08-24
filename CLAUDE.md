# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

The import above carries the Next.js agent rules: this is Next.js 16 with breaking changes from older versions. Read `node_modules/next/dist/docs/` before writing framework code, and commit the `AGENTS.md` block if `next dev` regenerates it.

## Commands

- `npm run dev` — dev server (Turbopack; PWA/service worker disabled in dev, see `next.config.ts`)
- `npm run build` — production build (also type-checks; generates `public/sw.js` via Serwist)
- `npm start` — serve production build
- `npm run lint` — ESLint (flat config, `eslint.config.mjs`)

No test framework is configured. `next build` does NOT run ESLint — run `npm run lint` separately. Both should be clean before finishing work.

## Environment

Requires `.env` (gitignored) with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Both are read in `src/lib/supabase.ts`.

## Folder structure

Components are grouped by domain under `src/components/`; shared logic lives in `src/lib/`.

```
src/
  app/                     layout.tsx, page.tsx, globals.css, sw.ts
  components/
    layout/    Topbar, BottomNav, UserMenu
    auth/      AuthWrapper, LoginScreen
    map/       Map, MapWidget, MapSearch, MapClickHandler, PlacesMarkers
    sidebar/   Sidebar, SidebarWrapper
    list/      PlaceList
    search/    GlobalSearch
    tags/      TagSelector, ManageTagsModal
    modals/    Add/Edit/View Place, Add/Edit/Share Trip, Import
  lib/
    supabase.ts   types.ts   events.ts   url.ts   color.ts   tree.ts
    api/          places.ts   trips.ts    categories.ts
```

Path alias: `@/*` → `src/*`. Import cross-domain components by full alias (`@/components/tags/TagSelector`); same-folder siblings may use `./`.

## Architecture

Single-page travel-map app. UI language is Polish. All data lives in Supabase; there is no backend API layer — components query Supabase directly from the browser, gated by RLS.

**Auth gate.** `app/layout.tsx` wraps everything in `AuthWrapper`, which blocks the app behind `LoginScreen` until a Supabase session exists. Because data-fetching components mount before the session may be ready, they also subscribe to `supabase.auth.onAuthStateChange` and refetch when a session arrives (see `Sidebar`). Preserve this when adding data-fetching components — otherwise first-load races leave the UI empty.

**State lives in the URL.** Modals and filters are driven by query params, not React state:
- `?view=map|list` — map vs. list view
- `?modal=add-place|view-place|edit-place|add-trip|edit-trip|manage-tags|share-trip|import-google` plus `placeId` / `tripId`. Modals are always mounted and read the params themselves (except `AddPlaceModal` / `ManageTagsModal`, gated in `page.tsx`).
- `?trips=<comma-names>|none` and `?tags=<comma-names>` — active filters, stored as **names**, resolved to IDs at query time. `?q=<text>` — search.

**Cross-component sync via window CustomEvents.** Components fetch independently; mutations broadcast events instead of lifting state. Listeners read filter values from the event `detail` first (instant), falling back to URL params.

## Conventions — how to write code here

These shared layers exist so components stay thin. Use them; don't reinvent the inline patterns they replaced.

- **`lib/types.ts`** — `Place`, `Trip`, `Category`, `PlaceCategory`. Never type state/props `any`; import these. Fields that can be NULL in the DB (e.g. `lat`/`lng`, most `Place` text fields) are typed `| null` — guard or `?? ""` at use sites.
- **`lib/api/*`** — all Supabase reads/shared mutations. The place-filtering query is `fetchFilteredPlaces(resolvePlaceFilters(event))` — used by both `PlacesMarkers` and `PlaceList`; do not duplicate that filter logic. Also `fetchPendingPlaces`, `deletePlace`, `updatePlaceCoords`, `fetchTrips`, `fetchTripsBasic`, `fetchCategories`. Add new shared queries here rather than inline `supabase.from(...)`.
- **`lib/events.ts`** — `AppEvent` constants (`placesUpdated`, `tripsUpdated`, `filtersChanged`, `searchChanged`) and `emit(name, detail?)`. Never write raw `"places-updated"` strings or `window.dispatchEvent(new Event(...))`. After a mutation, `emit` the matching event so map/list/sidebar refresh. `filtersChanged`/`searchChanged` carry a `detail` payload; `resolvePlaceFilters` reads it.
- **`lib/url.ts`** — `openModal(router, modal, extra?)`, `closeModal(router, keys?)`, `currentParams()`, `pushParams()`. Use these instead of hand-building `new URLSearchParams(window.location.search)` + `router.push('?...', { scroll: false })`.
- **`lib/tree.ts`** — `getAllDescendants(parentId, trips)` (cascading filter toggles) and `childrenOf(trips, parentId)` (recursive trip-tree / `<option>` rendering). Trips form a self-referential tree via `parent_id`.
- **`lib/color.ts`** — `getContrastColor(hex, threshold?)`, `getBrightness(hex)`, `effectiveTagColor(raw)` for rendering category/tag colors. Don't re-implement contrast math.

**Map.** Leaflet via `react-leaflet`. `Map.tsx` dynamically imports `MapWidget` with `ssr: false` (Leaflet needs `window`). Default marker icons are patched from unpkg CDN in `MapWidget`. Leaflet marker refs use the `Marker` type from `leaflet`; geosearch events are cast through `unknown` (the upstream types omit `.location`).

**Geocoding.** Places can be created without coordinates (`lat`/`lng` NULL) — they appear as "pending" in the sidebar. `Sidebar.handleBatchGeocode` uses `leaflet-geosearch` `OpenStreetMapProvider`, throttled ~1.5s/request, saving only on a single confident match.

**Data model (Supabase tables).** `places` (name, lat, lng, note, address, duration, visited, `trip_id`, google_maps_url, additional_link, attached_file, created_at) · `trips` (name, icon, `parent_id` self-referential tree) · `categories` (tags: name, icon, color) · `place_categories` (many-to-many places↔categories) · `trip_members` (sharing; written via the `get_user_id_by_email` RPC). File attachments upload to the `attachments` storage bucket.

**PWA.** Serwist. Service worker source `app/sw.ts` → built to `public/sw.js`; manifest and icons wired in `layout.tsx`. Disabled in dev.

**Lint notes.** Strict rules are on: no `any` (type it or cast via `unknown`), escape literal `"` in JSX (`&quot;`), no unused vars. Async fetch-on-mount effects trip `react-hooks/set-state-in-effect` (false positive, setState runs post-`await`) — the few existing cases carry a targeted `eslint-disable-next-line` with a comment; follow that pattern rather than restructuring.
