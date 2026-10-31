const CACHE_NAME = 'ifocus-pwa-v7';

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

// Best-effort background delivery. Countdown correctness is persisted by the page,
// because mobile operating systems may terminate a service worker at any time.
let backgroundPresenceTimer = null;
let finishBackgroundCheck = null;

const cancelBackgroundCheck = () => {
  if (backgroundPresenceTimer) clearTimeout(backgroundPresenceTimer);
  backgroundPresenceTimer = null;
  if (finishBackgroundCheck) finishBackgroundCheck();
  finishBackgroundCheck = null;
};

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CANCEL_BACKGROUND_PRESENCE_CHECK') {
    cancelBackgroundCheck();
    return;
  }
  if (event.data?.type !== 'SCHEDULE_BACKGROUND_PRESENCE_CHECK') return;
  cancelBackgroundCheck();
  const { timerSessionId } = event.data;
  const delay = Math.max(0, Number(event.data.delayMs) || 0);
  const remaining = Math.max(0, Number(event.data.remainingSeconds) || 0);
  const formatted = `${Math.floor(remaining / 60)}m ${String(remaining % 60).padStart(2, '0')}s`;
  event.waitUntil(new Promise((resolve) => {
    finishBackgroundCheck = resolve;
    backgroundPresenceTimer = setTimeout(async () => {
      try {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        clients.forEach(client => client.postMessage({ type: 'IFOCUS_PRESENCE_DUE', timerSessionId }));
        const existing = await self.registration.getNotifications({ tag: 'ifocus-presence' });
        if (!existing.length) await self.registration.showNotification('iFocus Active Presence Check', {
          body: `Timer paused at ${formatted}. Continue when you are ready.`,
          icon: '/icons/icon-192x192.png', badge: '/icons/icon-192x192.png',
          tag: 'ifocus-presence', renotify: false, requireInteraction: true,
          actions: [{ action: 'resume', title: 'Continue session' }, { action: 'pause', title: 'Stay paused' }],
          data: { url: '/dashboard', timerSessionId },
        });
      } catch (_) {
        // Permission or OS suspension must never change recorded focus time.
      } finally { resolve(); }
    }, delay);
  }));
});

// Notification Click Event (PWA & iOS WebKit support with action buttons)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'resume') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        if (clientList && clientList.length > 0) {
          clientList.forEach((client) => client.postMessage({ type: 'IFOCUS_RESUME_PRESENCE', timerSessionId: event.notification.data?.timerSessionId }));
          return clientList[0].focus();
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(`/dashboard?resumePresence=1&timerSessionId=${encodeURIComponent(event.notification.data?.timerSessionId || '')}`);
        }
      })
    );
    return;
  }

  if (event.action === 'pause') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        clientList.forEach((client) => client.postMessage({ type: 'IFOCUS_PAUSE_PRESENCE', timerSessionId: event.notification.data?.timerSessionId }));
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
