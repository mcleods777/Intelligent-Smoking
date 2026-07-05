// ============ Smoker AI — service worker (offline support) ============
// Strategy: NETWORK-FIRST for everything same-origin. Online you always get
// the freshest deploy (no stale-cache traps); offline you get the cached
// copy. /api/* is never cached — sync waits for a connection instead of
// serving stale data.

const CACHE = 'smoker-ai-v1';

const PRECACHE = [
  './',
  'index.html',
  'styles.css',
  'manifest.json',
  'js/ai.js',
  'js/app.js',
  'js/charts.js',
  'js/cuts.js',
  'js/photos.js',
  'js/share.js',
  'js/store.js',
  'js/sync.js',
  'js/woods.js',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/cuts/baby-back-ribs.jpg',
  'assets/cuts/beef-back-ribs.jpg',
  'assets/cuts/beef-cheeks.jpg',
  'assets/cuts/beef-plate-ribs.jpg',
  'assets/cuts/beef-tenderloin.jpg',
  'assets/cuts/brisket.jpg',
  'assets/cuts/chicken-thighs.jpg',
  'assets/cuts/chicken-wings.jpg',
  'assets/cuts/chuck-roast.jpg',
  'assets/cuts/chuck-short-ribs.jpg',
  'assets/cuts/cornish-hens.jpg',
  'assets/cuts/country-ribs.jpg',
  'assets/cuts/duck-breast.jpg',
  'assets/cuts/flanken-ribs.jpg',
  'assets/cuts/fresh-ham.jpg',
  'assets/cuts/lamb-loin-chops.jpg',
  'assets/cuts/lamb-ribs.jpg',
  'assets/cuts/lamb-shoulder.jpg',
  'assets/cuts/leg-of-lamb.jpg',
  'assets/cuts/leg-quarters.jpg',
  'assets/cuts/mackerel.jpg',
  'assets/cuts/picanha.jpg',
  'assets/cuts/picnic-shoulder.jpg',
  'assets/cuts/pork-belly.jpg',
  'assets/cuts/pork-butt.jpg',
  'assets/cuts/pork-chops.jpg',
  'assets/cuts/pork-loin.jpg',
  'assets/cuts/pork-steaks.jpg',
  'assets/cuts/pork-tenderloin.jpg',
  'assets/cuts/prime-rib.jpg',
  'assets/cuts/rack-of-lamb.jpg',
  'assets/cuts/rib-tips.jpg',
  'assets/cuts/salmon.jpg',
  'assets/cuts/sausages.jpg',
  'assets/cuts/shrimp.jpg',
  'assets/cuts/spare-ribs.jpg',
  'assets/cuts/top-round.jpg',
  'assets/cuts/tri-tip.jpg',
  'assets/cuts/turkey-breast.jpg',
  'assets/cuts/venison.jpg',
  'assets/cuts/whole-chicken.jpg',
  'assets/cuts/whole-duck.jpg',
  'assets/cuts/whole-trout.jpg',
  'assets/cuts/whole-turkey.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // add files one at a time so a single miss doesn't abort the whole precache
    await Promise.allSettled(PRECACHE.map(u => cache.add(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

function fetchWithTimeout(req, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(req, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    // generous timeout: slow rural signal beats an instant stale fallback,
    // but a hung request shouldn't block the app forever
    const fresh = await fetchWithTimeout(req, 6000);
    if (fresh && fresh.ok && req.method === 'GET') {
      cache.put(req, fresh.clone()).catch(() => { /* quota — ignore */ });
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === 'navigate') {
      const shell = await cache.match('index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;                      // sync POSTs etc: network only
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            // Anthropic, open-meteo: untouched
  if (url.pathname.includes('/api/')) return;            // sync GETs: never from cache
  event.respondWith(networkFirst(req));
});
