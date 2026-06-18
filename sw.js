// APBO Siswa Service Worker
// Digabung dengan OneSignal SW agar tidak konflik scope (lihat dokumentasi
// OneSignal "Integrating Multiple Service Workers"). Baris importScripts di
// bawah WAJIB ada di baris paling atas file ini.
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

const CACHE_NAME = 'apbosiswa-v2';
const RUNTIME_CACHE = 'apbosiswa-runtime-v2';
// index.html & '/' SENGAJA tidak di-precache di sini —
// supaya halaman utama selalu network-first (lihat fetch handler di bawah)
const SHELL_ASSETS = ['/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(SHELL_ASSETS))
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

  // NETWORK-FIRST untuk halaman utama (HTML) — update selalu langsung kepakai.
  // Cache cuma dipakai sebagai fallback kalau benar-benar offline.
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

  // STALE-WHILE-REVALIDATE untuk asset lain (CSS/JS/gambar/dll) — tetap cepat.
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

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
