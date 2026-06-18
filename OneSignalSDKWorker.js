// OneSignal Service Worker — APBO Siswa
// Menggabungkan OneSignal push handler + PWA caching dalam satu file
// agar tidak ada konflik scope antara dua service worker.

// WAJIB di baris paling atas — OneSignal push notification handler
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// ══════════════════════════════════════════════
//  PWA CACHING LOGIC
// ══════════════════════════════════════════════
const CACHE_NAME = 'apbosiswa-v3';
const RUNTIME_CACHE = 'apbosiswa-runtime-v3';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(['/manifest.json']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('supabase.co')) return;
  if (e.request.url.includes('onesignal.com')) return;

  const url = new URL(e.request.url);
  const isMainDocument = e.request.mode === 'navigate'
    || url.pathname === '/' || url.pathname.endsWith('/index.html');

  // Network-first untuk HTML utama — update selalu langsung kepakai
  if (isMainDocument) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Stale-while-revalidate untuk asset lain
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
