const CACHE_NAME = 'ifocus-pwa-v9';

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
  const remaining = Math.max(0, Math.floor(Number(event.data.remainingSeconds) || 0));
  const presenceCheckId = `${timerSessionId || 'legacy'}:${remaining}`;
  const formatted = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  event.waitUntil(new Promise((resolve) => {
    finishBackgroundCheck = resolve;
    backgroundPresenceTimer = setTimeout(async () => {
      try {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        clients.forEach(client => client.postMessage({ type: 'IFOCUS_PRESENCE_DUE', timerSessionId }));
        const existing = await self.registration.getNotifications({ tag: 'ifocus-presence' });
        if (existing.some(notification => notification.data?.presenceCheckId === presenceCheckId)) return;
        const options = {
          body: `Timer paused at ${formatted}. Continue when you are ready.`,
          icon: '/icons/icon-192x192.png', badge: '/icons/icon-192x192.png',
          tag: 'ifocus-presence', renotify: true, timestamp: Date.now(),
          actions: [{ action: 'pause', title: 'Pause' }, { action: 'resume', title: 'Continue' }],
          data: { url: '/dashboard', timerSessionId, presenceCheckId },
        };
        try {
          await self.registration.showNotification('iFocus Active Presence Check', options);
        } catch (error) {
          if (error.name !== 'TypeError' && error.name !== 'NotSupportedError') throw error;
          const { actions, renotify, ...basicOptions } = options;
          await self.registration.showNotification('iFocus Active Presence Check', basicOptions);
        }
      } catch (_) {
        // Permission or OS suspension must never change recorded focus time.
      } finally { resolve(); }
    }, delay);
  }));
});

// A push event wakes the worker even when iOS has suspended the app.
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload;
    try { payload = event.data?.json(); } catch { /* Always display a notification for a push. */ }
    const presence = payload?.type === 'IFOCUS_PRESENCE_PUSH';
    const data = presence ? payload.data || {} : { url: '/settings' };
    const tag = presence ? 'ifocus-presence' : 'ifocus-push-test';
    const existing = await self.registration.getNotifications({ tag });
    const sameCheck = presence && existing.some(notification => notification.data?.presenceCheckId === data.presenceCheckId);
    const options = {
      body: payload?.body || 'Open iFocus to check your timer.',
      icon: '/icons/icon-192x192.png', badge: '/icons/icon-192x192.png',
      tag, renotify: !sameCheck, timestamp: payload?.timestamp || Date.now(), data,
      ...(presence ? { actions: [{ action: 'pause', title: 'Pause' }, { action: 'resume', title: 'Continue' }] } : {}),
    };
    try {
      await self.registration.showNotification(payload?.title || 'iFocus', options);
    } catch (error) {
      if (error.name !== 'TypeError' && error.name !== 'NotSupportedError') throw error;
      const { actions, renotify, ...basicOptions } = options;
      await self.registration.showNotification(payload?.title || 'iFocus', basicOptions);
    }
    if (presence) {
      cancelBackgroundCheck();
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach(client => client.postMessage({ type: 'IFOCUS_PRESENCE_DUE', timerSessionId: data.timerSessionId, presenceCheckId: data.presenceCheckId }));
    }
  })());
});

// On browsers without notification buttons, tapping the body opens the same controls.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const action = event.action === 'resume' || event.action === 'pause' ? event.action : 'open';
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = clients.find(client => client.url && new URL(client.url).origin === self.location.origin);
    if (client) {
      if (data.timerSessionId) client.postMessage({
        type: action === 'resume' ? 'IFOCUS_RESUME_PRESENCE' : action === 'pause' ? 'IFOCUS_PAUSE_PRESENCE' : 'IFOCUS_OPEN_PRESENCE',
        timerSessionId: data.timerSessionId, presenceCheckId: data.presenceCheckId,
      });
      return client.focus();
    }
    if (self.clients.openWindow) {
      const target = typeof data.url === 'string' && data.url.startsWith('/') && !data.url.startsWith('//') ? data.url : '/dashboard';
      const url = new URL(data.timerSessionId ? '/dashboard' : target, self.location.origin);
      if (data.timerSessionId) {
        url.searchParams.set('presenceAction', action);
        url.searchParams.set('timerSessionId', data.timerSessionId);
        if (data.presenceCheckId) url.searchParams.set('presenceCheckId', data.presenceCheckId);
      }
      return self.clients.openWindow(url.href);
    }
  })());
});
