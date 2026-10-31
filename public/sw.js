const CACHE_NAME = 'ifocus-pwa-v6';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon.svg',
  '/favicon.ico'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('PWA Pre-cache skipped some assets:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and API/Auth requests
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-first for page navigations, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return caches.match('/');
        });
      })
    );
    return;
  }

  // Stale-While-Revalidate for images, icons, and static assets
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});

// Background Active Presence Watchdog (fires even if page is backgrounded or screen locked)
let backgroundPresenceTimer = null;

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SCHEDULE_BACKGROUND_PRESENCE_CHECK') {
    if (backgroundPresenceTimer) clearTimeout(backgroundPresenceTimer);
    const delay = Math.max(1000, Number(event.data.delayMs) || 300000);
    const remainingSeconds = Math.max(0, Number(event.data.remainingSeconds) || 0);
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    const formatted = `${m}m ${s < 10 ? '0' : ''}${s}s`;

    backgroundPresenceTimer = setTimeout(() => {
      self.registration.showNotification('iFocus Active Presence Check', {
        body: `Timer: ${formatted} remaining. Are you still studying? Tap to continue or pause.`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        tag: 'ifocus-presence',
        renotify: true,
        requireInteraction: true,
        actions: [
          { action: 'resume', title: 'I am still here' },
          { action: 'pause', title: 'Stay Paused' }
        ],
        data: { url: '/dashboard' }
      });
    }, delay);
  } else if (event.data?.type === 'CANCEL_BACKGROUND_PRESENCE_CHECK') {
    if (backgroundPresenceTimer) {
      clearTimeout(backgroundPresenceTimer);
      backgroundPresenceTimer = null;
    }
  }
});

// Notification Click Event (PWA & iOS WebKit support with action buttons)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'resume') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        if (clientList && clientList.length > 0) {
          clientList.forEach((client) => client.postMessage({ type: 'IFOCUS_RESUME_PRESENCE' }));
          return clientList[0].focus();
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow('/dashboard?resumePresence=1');
        }
      })
    );
    return;
  }

  if (event.action === 'pause') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        clientList.forEach((client) => client.postMessage({ type: 'IFOCUS_PAUSE_PRESENCE' }));
      })
    );
    return;
  }

  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
