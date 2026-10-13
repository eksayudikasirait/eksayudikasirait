// Service Worker Mandiri PWA — UPTD SMP Negeri 7 Kisaran
// Memungkinkan aplikasi dibuka dan berjalan penuh dalam mode offline tanpa koneksi internet.

const CACHE_NAME = 'anbk-smpn7-offline-v5';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
];

// Install: Simpan shell aplikasi ke cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_URLS).catch((err) => {
          console.warn('Gagal precache beberapa asset:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: Bersihkan cache lama & klaim client aktif
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: Strategi Cache-First untuk aset statis dan Network-First dengan Fallback Cache untuk navigasi
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Abaikan request non-GET, endpoint API backend, dan modul dev Vite
  if (req.method !== 'GET') return;
  if (
    url.pathname.startsWith('/__api') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/healthz') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/@')
  ) {
    return;
  }

  // 1. Navigasi Halaman HTML (SPA): Network-First, jika offline fallback ke cache /index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          return caches.match(req).then((cached) => {
            return cached || caches.match('/index.html') || caches.match('/');
          });
        })
    );
    return;
  }

  // 2. Google Fonts & Static Assets: Stale-While-Revalidate
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|woff|woff2|ico)$/)
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const clone = networkRes.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return networkRes;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // 3. Fallback umum
  event.respondWith(
    caches.match(req).then((cached) => {
      return (
        cached ||
        fetch(req).catch(() => {
          if (req.destination === 'image') {
            return caches.match('/pwa-192x192.png');
          }
        })
      );
    })
  );
});
