/* Service worker du Challenge OUEST 1.
   Changez VERSION à chaque mise à jour importante pour forcer le rafraîchissement. */
const VERSION = "ouest1-v1";
const CORE = ["./", "index.html", "fond.jpg", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION)
    .then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* Réseau d'abord (avec délai max), sinon la dernière version gardée */
function networkFirst(req, key, timeoutMs) {
  return caches.open(VERSION).then((cache) => new Promise((resolve) => {
    let done = false;
    const fallback = () => cache.match(key).then((r) => r || cache.match("./"))
      .then((r) => { if (!done) { done = true; resolve(r || Response.error()); } });
    const t = setTimeout(fallback, timeoutMs);
    fetch(req).then((res) => {
      if (res && res.ok) cache.put(key, res.clone());
      clearTimeout(t);
      if (!done) { done = true; resolve(res); }
    }).catch(() => { clearTimeout(t); fallback(); });
  }));
}

/* Cache d'abord (images, icônes), mis à jour en arrière-plan */
function staleWhileRevalidate(req) {
  return caches.open(VERSION).then((cache) => cache.match(req).then((hit) => {
    const net = fetch(req).then((res) => {
      if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith("/admin.html") || url.pathname.endsWith("/sw.js")) return; // admin : toujours en direct
    if (url.pathname.endsWith("/data.json")) {
      e.respondWith(networkFirst(req, new Request(url.origin + url.pathname), 6000));
      return;
    }
    if (req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith("/")) {
      e.respondWith(networkFirst(req, new Request(url.origin + url.pathname), 5000));
      return;
    }
    e.respondWith(staleWhileRevalidate(req));
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(staleWhileRevalidate(req));
  }
});
