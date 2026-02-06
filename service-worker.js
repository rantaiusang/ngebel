const CACHE_NAME = 'ngebel-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    // Tambahkan CSS/JS eksternal jika Anda memisahkannya nanti
];

// Install Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(
                keyList.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
});

// Fetch Logic (Ambil data)
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Jika ada di cache, pakai cache. Jika tidak, ambil dari internet.
            return cachedResponse || fetch(event.request);
        })
    );
});
