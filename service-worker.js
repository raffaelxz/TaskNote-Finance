const CACHE_NAME = 'tasknote-v3';
const OFFLINE_PAGE = '/offline.html';

// Aset yang di-pre-cache saat install (app shell)
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/assets/style.css',
  '/assets/icons/icon-192x192-A.png',
  '/assets/icons/icon-512x512-B.png',
  // Font & library eksternal (opsional, cache saat pertama kali dimuat)
];

// Domain eksternal yang boleh di-cache (CDN)
const CACHEABLE_ORIGINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
];

// ── INSTALL: pre-cache app shell ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[TaskNote SW] Pre-caching app shell...');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: hapus cache versi lama ─────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[TaskNote SW] Menghapus cache lama:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: strategi per tipe request ─────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Lewati request non-GET
  if (request.method !== 'GET') return;

  // Lewati request chrome-extension dan lainnya
  if (!['http:', 'https:'].includes(url.protocol)) return;

  // 1. Aset CDN → Cache First (stabil, jarang berubah)
  if (CACHEABLE_ORIGINS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 2. Aset lokal statis (CSS, JS, gambar, ikon) → Cache First
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.match(/\.(css|js|png|jpg|jpeg|webp|svg|ico|woff2?)$/)
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 3. Halaman HTML → Network First dengan fallback offline
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // 4. Lainnya → Network First
  event.respondWith(networkFirst(request));
});

// ── STRATEGI CACHE ────────────────────────────────────────────

// Cache First: cari di cache dulu, kalau tidak ada baru fetch
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Aset tidak tersedia offline.', { status: 503 });
  }
}

// Network First: ambil dari network, simpan ke cache, fallback ke cache
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Tidak ada koneksi internet.', { status: 503 });
  }
}

// Network First dengan fallback halaman offline khusus
async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Tampilkan halaman offline
    const offlinePage = await caches.match(OFFLINE_PAGE);
    return offlinePage || new Response(
      `<!DOCTYPE html>
      <html lang="id">
      <head><meta charset="UTF-8"><title>TaskNote — Offline</title>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>
        body{font-family:system-ui,sans-serif;background:#080808;color:#fff;
          display:flex;align-items:center;justify-content:center;
          min-height:100vh;text-align:center;padding:20px}
        h2{font-size:1.3rem;margin-bottom:10px;color:#c0ff8c}
        p{color:#888;font-size:.9rem;line-height:1.6}
        button{margin-top:20px;background:#c0ff8c;color:#000;border:none;
          padding:12px 28px;border-radius:100px;font-weight:700;cursor:pointer}
      </style></head>
      <body>
        <div>
          <div style="font-size:2.5rem;margin-bottom:16px">📡</div>
          <h2>Kamu sedang offline</h2>
          <p>Periksa koneksi internetmu<br>dan coba lagi.</p>
          <button onclick="location.reload()">Coba Lagi</button>
        </div>
      </body></html>`,
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

// ── BACKGROUND SYNC (opsional, untuk fitur masa depan) ────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-income-data') {
    console.log('[TaskNote SW] Background sync:', event.tag);
    // Tambahkan logika sinkronisasi data di sini jika diperlukan
  }
});

// Listener untuk Periodic Background Sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-finance-data') {
    event.waitUntil(fetchAndCacheData()); // Fungsi untuk update data keuangan
  }
});

// Logic sederhana untuk Offline Support
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// ── PUSH NOTIFICATION (opsional) ─────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {
    title: 'TaskNote Finance',
    body: 'Waktunya cek alokasi keuangan bulan ini! 💰',
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/assets/icons/icon-192x192-A.png',
      badge: '/assets/icons/icon-192x192-A.png',
      vibrate: [100, 50, 100],
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
