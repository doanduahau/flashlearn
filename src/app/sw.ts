/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import { NetworkFirst, Serwist } from "serwist";
import type { PrecacheEntry } from "serwist";

declare global {
  interface WorkerGlobalScope {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
};

// Read-mostly pages we want to keep viewable offline once visited. The HTML
// is keyed by URL: on a shared device a later account could see the previous
// account's cached page when offline. Accepted for this personal-PWA MVP.
const OFFLINE_PAGES = ["/dashboard", "/sets", "/sets/library"];

const serwist = new Serwist({
  precacheEntries: [
    ...(self.__SW_MANIFEST ?? []),
    // The /offline shell is a navigation fallback target, so it must be
    // precached even if it was not picked up by the automatic manifest.
    { url: "/offline", revision: null },
  ],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    ...defaultCache,
    {
      // Cache the four main read pages with NetworkFirst: with a connection we
      // fetch fresh and update the cache; without one we serve the last HTML.
      // networkTimeoutSeconds keeps a flaky connection from hanging for long.
      matcher: ({ request, url }) =>
        request.mode === "navigate" &&
        url.origin === self.location.origin &&
        (url.pathname === "/dashboard" ||
          url.pathname === "/sets" ||
          url.pathname === "/sets/library" ||
          url.pathname.startsWith("/sets/")),
      handler: new NetworkFirst({
        cacheName: "capystudy-pages-v1",
        networkTimeoutSeconds: 5,
      }),
    },
  ],
  fallbacks: {
    entries: [
      {
        // Any offline navigation that is not covered by a cached page (e.g. a
        // route never visited) falls back to the /offline shell from W1.
        url: "/offline",
        matcher: ({ request }) => request.mode === "navigate",
      },
    ],
  },
});

serwist.addEventListeners();
