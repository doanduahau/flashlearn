/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import { NetworkFirst, NetworkOnly, Serwist } from "serwist";
import type { PrecacheEntry } from "serwist";

declare global {
  interface WorkerGlobalScope {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
};

// App routes that are fully dynamic (server-rendered per request). They must
// NEVER be served from cache — always hit the network. This prevents the SW
// from causing FetchEvent rejections (no-response) when there is no cached
// entry for these routes.
const DYNAMIC_APP_ROUTE_PREFIXES = [
  "/quiz",
  "/study",
  "/runner",
  "/match",
  "/memory",
  "/collections",
  "/history",
  "/statistics",
  "/profile",
  "/settings",
  "/import",
  "/share",
  "/typing",
  "/auth",
  "/api",
];

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
    // Dynamic app routes: always go to network, never serve from cache.
    // This rule must come BEFORE defaultCache so it takes priority.
    {
      matcher: ({ request, url }) =>
        (request.mode === "navigate" || request.destination === "") &&
        url.origin === self.location.origin &&
        DYNAMIC_APP_ROUTE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)),
      handler: new NetworkOnly(),
    },
    // Server Actions and RSC payloads: always network-only.
    {
      matcher: ({ request, url }) =>
        url.origin === self.location.origin &&
        (request.headers.get("next-action") !== null ||
          url.pathname.startsWith("/_next/data/") ||
          url.searchParams.has("_rsc")),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
    {
      // Cache the main read-mostly pages with NetworkFirst: fresh when online,
      // last cached HTML when offline.
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
        // Only use /offline fallback for navigation requests — dynamic routes
        // use NetworkOnly above so they will not reach this handler while online.
        url: "/offline",
        matcher: ({ request }) => request.mode === "navigate",
      },
    ],
  },
});

serwist.addEventListeners();
