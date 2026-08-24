/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, Serwist } from "serwist";

// Declare the global interface for the Service Worker context
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Initialize Serwist with the default Next.js cache and the injected manifest
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // OSM map tiles: long-lived CacheFirst so previously-viewed map areas render offline. Placed
    // before defaultCache so it wins over its generic cross-origin NetworkFirst catch-all.
    {
      matcher: ({ url }) => url.hostname.endsWith(".tile.openstreetmap.org"),
      handler: new CacheFirst({
        cacheName: "osm-tiles",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 2000, // ~30MB at ~15KB/tile — enough for areas actually revisited
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days — tiles rarely change
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        // Must be a plain static file under public/ — @serwist/next precaches that directory
        // automatically, whereas an app-router page's rendered document does not end up in the
        // precache manifest (only its JS chunk does), so it can't be used as a fallback target.
        url: "/offline.html",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
