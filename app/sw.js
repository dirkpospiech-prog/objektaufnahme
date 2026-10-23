/* Offline-Cache für die Web-Version (in der Android-App liegen die Dateien ohnehin auf dem Gerät). */
const CACHE = "objektaufnahme-v1.13.1";
const FILES = ["./", "index.html", "styles.css", "app.js", "schema.js", "config.js", "build.js", "vendor/jspdf.umd.min.js", "logo.png", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png",
  "fonts/dm-sans-latin-400-normal.woff2", "fonts/dm-sans-latin-500-normal.woff2", "fonts/dm-sans-latin-600-normal.woff2",
  "fonts/dm-sans-latin-700-normal.woff2", "fonts/playfair-display-latin-600-normal.woff2", "fonts/playfair-display-latin-700-normal.woff2"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  // Netz zuerst (damit Updates sofort ankommen), sonst Cache
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
