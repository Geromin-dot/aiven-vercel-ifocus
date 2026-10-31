import { getTimerDeviceId } from './timerState';

export async function pushRequest(path, body, method = 'POST') {
  const response = await fetch(`/api/push/${path}`, {
    method, headers: { 'Content-Type': 'application/json' }, keepalive: true,
    ...(method !== 'GET' ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Background notification request failed');
  return result;
}

export async function getBackgroundPushStatus() {
  return pushRequest(`subscription?deviceId=${encodeURIComponent(getTimerDeviceId())}`, null, 'GET');
}

export async function enableBackgroundPush(config) {
  if (!config?.configured || !config.publicKey) throw new Error('Background notifications need server setup');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('On iPhone, open iFocus from your Home Screen first.');
  // Keep the permission prompt inside the user's tap, before any network wait.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Allow notifications in your phone settings, then try again.');
  await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
  const registration = await navigator.serviceWorker.ready;
  const base64 = config.publicKey.replace(/-/g, '+').replace(/_/g, '/');
  const key = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), char => char.charCodeAt(0));
  let subscription = await registration.pushManager.getSubscription();
  const existingKey = subscription?.options?.applicationServerKey;
  if (subscription && existingKey && String(new Uint8Array(existingKey)) !== String(key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await pushRequest('subscription', { deviceId: getTimerDeviceId(), subscription: subscription.toJSON() });
  window.dispatchEvent(new CustomEvent('ifocus_push_subscription_changed'));
}

export async function disableBackgroundPush() {
  // Cancel on the server before dropping the browser subscription.
  await pushRequest('subscription', { deviceId: getTimerDeviceId() }, 'DELETE');
  const registration = await navigator.serviceWorker?.getRegistration();
  await (await registration?.pushManager?.getSubscription())?.unsubscribe();
  window.dispatchEvent(new CustomEvent('ifocus_push_subscription_changed'));
}

export function pushCheckpoint(state) {
  const deviceId = getTimerDeviceId();
  const previousVersion = Number(localStorage.getItem('ifocus_push_version')) || 0;
  const version = Math.max(Date.now(), previousVersion + 1);
  localStorage.setItem('ifocus_push_version', String(version));
  // A cloud checkpoint belongs to its original device; never schedule it on this one.
  const ownsState = state && state.deviceId === deviceId;
  return pushRequest('timer', { deviceId, version,
    state: ownsState ? state : { deviceId, isRunning: false },
    preferences: JSON.parse(localStorage.getItem('ifocus_timer_preferences') || '{}'),
  });
}
