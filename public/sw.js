// Network-first for pages and data so the schedule is always fresh when online;
// falls back to the last copy we saw when offline. Static icons are cache-first.
const VERSION = "v1";
const CACHE = `budokan-${VERSION}`;
const PRECACHE = ["/", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request, { ignoreVary: true })) ??
      (fallbackUrl && (await cache.match(fallbackUrl, { ignoreVary: true }))) ??
      new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin) return;
  if (request.mode === "navigate") event.respondWith(networkFirst(request, "/"));
  else if (url.pathname === "/api/events") event.respondWith(networkFirst(request));
  else if (/\.(png|svg|webmanifest)$/.test(url.pathname)) event.respondWith(cacheFirst(request));
});
