// =========================================================================
// EduVet Intelligent Browser Caching Service Worker
// Automatically caches the EduVet Portal shell, styles, fonts, and scripts
// on first load, enabling instantaneous subsequent loading and offline resilience.
// =========================================================================

const CACHE_NAME = 'eduvet-portal-v2';
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/eduvet',
    '/eduvet.html',
    '/eduvet.css',
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js'
];

// 1. Install Event: Cache Core Application Shell Immediately
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[EduVet SW] Pre-caching core application shell...');
            return cache.addAll(PRECACHE_URLS).catch((err) => {
                console.warn('[EduVet SW] Pre-cache partial skip:', err);
            });
        })
    );
});

// 2. Activate Event: Reclaim Clients and Evict Old Cache Generations
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[EduVet SW] Purging legacy cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Fetch Event: Stale-While-Revalidate for HTML, Cache-First for Assets
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Bypass Service Worker for live APIs, Firestore, Paystack, AI Gemini
    if (url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('identitytoolkit.googleapis.com') ||
        url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('api.paystack.co') ||
        url.hostname.includes('generativelanguage.googleapis.com')) {
        return; // Direct network for transactions and live DB sync
    }

    // A. HTML Navigation Requests: Stale-While-Revalidate (Instant load + silent background refresh)
    if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(req).then((cachedResponse) => {
                    const fetchPromise = fetch(req).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(req, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => cachedResponse);

                    // Return cached response instantly (0ms lag), background revalidates
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // B. Static Assets (CSS, JS, Fonts, Images): Cache-First
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(req).then((cachedResponse) => {
                if (cachedResponse) {
                    // Quiet background revalidation
                    fetch(req).then((netRes) => {
                        if (netRes && netRes.status === 200) {
                            cache.put(req, netRes.clone());
                        }
                    }).catch(() => {});
                    return cachedResponse;
                }

                // If not yet in cache, fetch from network and cache for subsequent loads
                return fetch(req).then((netRes) => {
                    if (netRes && netRes.status === 200 && (url.protocol === 'http:' || url.protocol === 'https:')) {
                        cache.put(req, netRes.clone());
                    }
                    return netRes;
                });
            });
        })
    );
});
