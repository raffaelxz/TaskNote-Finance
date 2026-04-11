// ============================================================
//  TaskNote Finance — Service Worker
//  Proyek: BELAJAR_PWA_PERTAMA
// ============================================================

const CACHE_NAME = 'tasknote-v1';
const OFFLINE_PAGE = './offline.html';

const PRECACHE_ASSETS = [
    './',
    './index.html',
    './offline.html',
    './manifest.json',
    './assets/style.css',

    // Icon PWA
    './icons/icon-192x192-A.png',
    './icons/icon-512x512-B.png',
    './icons/apple-touch-icon.png',

    // Screenshot
    './icons/screenshot1.png',
    './icons/screenshot2.png',

    // Gambar produk
    './icons/baju kain 1.png',
    './icons/baju kain 2.png',
    './icons/baju kain 3.png',
];

const CACHEABLE_ORIGINS = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com',
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[TaskNote SW] Pre-caching aset...');
            return cache.addAll(PRECACHE_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// ── FETCH ─────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;
    if (!['http:', 'https:'].includes(url.protocol)) return;

    if (CACHEABLE_ORIGINS.includes(url.hostname)) {
        event.respondWith(cacheFirst(request));
        return;
    }

    if (url.pathname.startsWith('/assets/') ||
        url.pathname.startsWith('/icons/') ||
        url.pathname.match(/\.(css|js|png|jpg|jpeg|webp|svg|ico|woff2?)$/)) {
        event.respondWith(cacheFirst(request));
        return;
    }

    if (request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(networkFirstWithOfflineFallback(request));
        return;
    }

    event.respondWith(networkFirst(request));
});

// ── STRATEGI ─────────────────────────────────────────────────
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
        return cached || new Response('Tidak ada koneksi.', { status: 503 });
    }
}

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
        const offlinePage = await caches.match('./offline.html');
        return offlinePage || new Response(
            `<!DOCTYPE html><html lang="id">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
            <title>TaskNote — Offline</title>
            <style>body{font-family:system-ui,sans-serif;background:#080808;color:#fff;
            display:flex;align-items:center;justify-content:center;min-height:100vh;
            text-align:center;padding:20px;margin:0}
            h2{font-size:1.3rem;margin-bottom:10px;color:#c0ff8c}
            p{color:#888;font-size:.9rem;line-height:1.6}
            button{margin-top:20px;background:#c0ff8c;color:#000;border:none;
            padding:12px 28px;border-radius:100px;font-weight:700;cursor:pointer}</style>
            </head><body><div>
            <div style="font-size:2.5rem;margin-bottom:16px">📡</div>
            <h2>Kamu sedang offline</h2>
            <p>Periksa koneksi internetmu<br>dan coba lagi.</p>
            <button onclick="location.reload()">Coba Lagi</button>
            </div></body></html>`,
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
    }
}

// ── PUSH NOTIFICATION ────────────────────────────────────────
self.addEventListener('push', (event) => {
    const data = event.data?.json() ?? {
        title: 'TaskNote Finance',
        body: 'Waktunya cek alokasi keuangan bulan ini! 💰',
    };
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: './icons/icon-192x192-A.png',
            badge: './icons/icon-192x192-A.png',
            vibrate: [100, 50, 100],
            data: { url: data.url || './' },
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow(event.notification.data?.url || './'));
});
