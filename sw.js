/* ACE Workbench service worker: keeps the panel and every app page on the device so the Workbench opens with no signal.
   Only files from this site are kept. Google Sheet sync (script.google.com) and satellite tiles always go to the network.
   VERSION is stamped by build-pages.py from the files' content; a new VERSION makes phones fetch the new files. */
const VERSION = "20d33136fa1c";
const CACHE = "aw-" + VERSION;
const FILES = [
  "./", "index.html", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "icons/logo.svg", "icons/favicon-64.png",
  "apps/unit-desk.html", "apps/time-log.html", "apps/databases.html", "apps/fx/fx.css", "apps/fx/fx.js", "apps/sr-desk.html", "apps/sr-dashboard.html", "apps/rss-desk.html", "apps/title-to-shapefile.html",
  "apps/vendor/leaflet.css", "apps/vendor/leaflet.js", "apps/vendor/proj4.js", "apps/vendor/fflate.js",
  "apps/vendor/control-points.js", "apps/vendor/e2c-template.js",
  "apps/vendor/images/layers.png", "apps/vendor/images/layers-2x.png",
  "apps/vendor/images/marker-icon.png", "apps/vendor/images/marker-icon-2x.png", "apps/vendor/images/marker-shadow.png",
];

self.addEventListener("install", e => {
  // A file left out of the build (for example a vendor file not published) must not stop the rest from being kept.
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => c.add(new Request(f, { cache: "reload" })).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("aw-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;           // Sheets, tiles: network only, untouched
  // Page first from the device (fast, works offline), then refreshed in the background for next time.
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const r = await net;
    return r || (req.mode === "navigate" ? c.match("index.html") : Response.error());
  }));
});
