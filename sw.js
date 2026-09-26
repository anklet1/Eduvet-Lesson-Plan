// =========================================================================
// EduVet Intelligent Multi-Device Cloud Caching Service Worker (v3)
// Architecture based on Modern Caching Principles:
// 1. Service Worker: Intelligent stale-while-revalidate for HTML, cache-first for static assets
// 2. Pre-caching & Cache Warming: Proactively warms app shell, styles, fonts, and scripts
// 3. Low-latency fallback for desktop, tablet, and mobile browsers
// =========================================================================

const CACHE_NAME = 'eduvet-cloud-cache-v3';
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
            console.log('[EduVet SW v3] Pre-caching core application shell & warm assets...');
            return cache.addAll(PRECACHE_URLS).catch((err) => {
                console.warn('[EduVet SW v3] Pre-cache partial skip:', err);
            });
        })
    );
});

// 2. Activate Event: Evict Old Cache Generations (v1, v2, legacy) & Reclaim Clients
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[EduVet SW v3] Purging obsolete cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Message Event: Proactive Cache Warming Triggered by Idle Web Page
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'WARM_CACHE') {
        const urls = event.data.urls || [];
        caches.open(CACHE_NAME).then((cache) => {
            urls.forEach((url) => {
                cache.match(url).then((existing) => {
                    if (!existing) {
                        fetch(url).then((netRes) => {
                            if (netRes && netRes.status === 200) {
                                cache.put(url, netRes);
                            }
                        }).catch(() => {});
                    }
                });
            });
        });
    }
});

// 4. Fetch Event: Stale-While-Revalidate for HTML, Cache-First for Assets
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Bypass Service Worker for live APIs, Firestore, Paystack, AI Gemini
    if (url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('identitytoolkit.googleapis.com') ||
        url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('api.paystack.co') ||
        url.hostname.includes('js.paystack.co') ||
        url.pathname.startsWith('/api/') ||
        url.hostname.includes('generativelanguage.googleapis.com')) {
        return; // Direct network for transactions and live DB sync
    }

    // A. HTML Navigation Requests: Stale-While-Revalidate with Route Normalization & Anti-ERR_FAILED
    if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                // Check cache for this exact request or equivalent route
                let cached = await cache.match(req);
                if (!cached) {
                    if (url.pathname.includes('eduvet')) {
                        cached = (await cache.match('/eduvet')) || (await cache.match('/eduvet.html'));
                    } else if (url.pathname === '/' || url.pathname === '/index.html') {
                        cached = (await cache.match('/')) || (await cache.match('/index.html'));
                    }
                }

                // If cached, return immediately for instant 0ms load and revalidate in background
                if (cached) {
                    fetch(req).then(async (netRes) => {
                        if (netRes && netRes.ok && netRes.status === 200 && !netRes.redirected) {
                            await cache.put(req, netRes.clone());
                        }
                    }).catch(() => {});
                    return cached;
                }

                // If not in cache, fetch from network
                try {
                    const netRes = await fetch(req);
                    // Crucial: If response is redirected (e.g. 308/301), follow target URL cleanly
                    // This prevents Chromium navigation error ERR_FAILED
                    if (netRes.redirected && netRes.url) {
                        const targetRes = await fetch(netRes.url);
                        if (targetRes && targetRes.ok && targetRes.status === 200) {
                            await cache.put(req, targetRes.clone());
                        }
                        return targetRes;
                    }
                    if (netRes && netRes.ok && netRes.status === 200) {
                        cache.put(req, netRes.clone());
                    }
                    return netRes;
                } catch (netErr) {
                    // Offline fallback to any cached app shell
                    const fallback = (await cache.match('/eduvet')) || 
                                     (await cache.match('/eduvet.html')) || 
                                     (await cache.match('/index.html')) || 
                                     (await cache.match('/'));
                    if (fallback) return fallback;
                    throw netErr;
                }
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
