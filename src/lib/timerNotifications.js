export const PRESENCE_NOTIFICATION_ACTIONS = [
  { action: 'pause', title: 'Pause' },
  { action: 'resume', title: 'Continue' },
];

export const presenceCheckId = (state) => `${state?.timerSessionId || 'legacy'}:${state?.timeLeft ?? 0}`;

export function formatNotificationTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

export async function sendTestNotification(body) {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return { accepted: false, registered: false };
  }
  const tag = `ifocus-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const options = { body, tag, icon: '/icons/icon-192x192.png', badge: '/icons/icon-192x192.png',
    timestamp: Date.now(), requireInteraction: true, silent: false, data: { url: '/settings' } };
  try {
    if (navigator.serviceWorker?.register) {
      let registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      if (!registration.active) {
        let timeout;
        try {
          registration = await Promise.race([navigator.serviceWorker.ready,
            new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Notification worker is not ready. Reopen the app and retry.')), 10000); })]);
        } finally { clearTimeout(timeout); }
      }
      // A fresh tag creates a new test rather than silently updating an old one.
      const previous = await registration.getNotifications?.() || [];
      previous.filter(item => item.tag === 'ifocus-test' || item.tag?.startsWith('ifocus-test-')).forEach(item => item.close());
      try { await registration.showNotification('iFocus Notification Test', options); }
      catch (error) {
        if (error.name !== 'TypeError' && error.name !== 'NotSupportedError') throw error;
        await registration.showNotification('iFocus Notification Test', { body, tag, icon: options.icon, data: options.data });
      }
      let registered = null;
      try { if (registration.getNotifications) registered = (await registration.getNotifications({ tag })).length > 0; } catch {}
      return { accepted: true, registered, tag };
    }
    const notification = new Notification('iFocus Notification Test', options);
    notification.onclick = () => { window.focus(); notification.close(); };
    return { accepted: true, registered: null, tag };
  } catch (error) {
    return { accepted: false, registered: false, error: error.message };
  }
}

// Deduplicate one check, not every notification that shares the presence tag.
const pending = new Map();
export function sendSystemNotification(title, body, tag = 'ifocus-presence', actions = [], state = null) {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return Promise.resolve(false);
  }
  const checkId = state ? presenceCheckId(state) : null;
  const key = `${tag}:${checkId || body}`;
  if (pending.has(key)) return pending.get(key);
  const delivery = (async () => {
    const options = {
      body, tag, icon: '/icons/icon-192x192.png', badge: '/icons/icon-192x192.png',
      timestamp: Date.now(),
      data: { url: '/dashboard', timerSessionId: state?.timerSessionId, presenceCheckId: checkId },
    };
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration?.showNotification) {
          const existing = await registration.getNotifications?.({ tag }) || [];
          if (checkId && existing.some(notification => notification.data?.presenceCheckId === checkId)) return true;
          // Replace the previous check, even when it was left in Notification Center.
          try {
            await registration.showNotification(title, { ...options, actions, renotify: true });
          } catch (error) {
            if (error.name !== 'TypeError' && error.name !== 'NotSupportedError') throw error;
            await registration.showNotification(title, options);
          }
          return true;
        }
      }
      // The Notification constructor rejects action buttons; only SW notifications support them.
      const notification = new Notification(title, options);
      notification.onclick = () => { window.focus(); notification.close(); };
      return true;
    } catch (error) {
      console.warn('Notification delivery failed:', error);
      return false;
    }
  })().finally(() => pending.delete(key));
  pending.set(key, delivery);
  return delivery;
}
