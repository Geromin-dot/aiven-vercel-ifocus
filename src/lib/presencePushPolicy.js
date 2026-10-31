const MAX_FOCUS_SECONDS = 12 * 60 * 60;

export function validDeviceId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(value);
}

export function validatePushSubscription(subscription) {
  try {
    const url = new URL(subscription?.endpoint);
    // Never allow a user-supplied subscription to make the server contact private hosts.
    const allowed = ['web.push.apple.com', 'fcm.googleapis.com', 'android.googleapis.com', 'fcm.push.chrome.com'];
    const host = url.hostname;
    const trusted = allowed.includes(host) || host.endsWith('.push.services.mozilla.com') || host.endsWith('.notify.windows.com');
    return url.protocol === 'https:' && !url.port && !url.username && !url.password && trusted &&
      subscription.endpoint.length <= 4096 &&
      /^[A-Za-z0-9_-]{87}={0,2}$/.test(subscription.keys?.p256dh || '') &&
      /^[A-Za-z0-9_-]{22}={0,2}$/.test(subscription.keys?.auth || '');
  } catch { return false; }
}

export function planPresencePush(state, prefs = {}, now = Date.now()) {
  if (!state || typeof state !== 'object') throw new Error('Invalid timer state');
  if (!state.isRunning || !state.isFocus || state.presencePaused || state.breakGatePending || prefs.activePresenceEnabled === false) return null;
  const total = Number(state.totalTime);
  const remaining = Number(state.timeLeft);
  const baseline = Number(state.lastPresenceCheckElapsed || 0);
  const interval = Math.max(60, Number(prefs.activePresenceInterval) * 60 || Number(state.activePresenceIntervalSeconds) || 300);
  const end = Number(state.targetEndTime);
  if (![total, remaining, baseline, interval, end].every(Number.isFinite) ||
      !Number.isInteger(total) || !Number.isInteger(remaining) || !Number.isInteger(baseline) || !Number.isInteger(interval) ||
      total <= 0 || total > MAX_FOCUS_SECONDS || remaining <= 0 || remaining > total || baseline < 0 || baseline >= total ||
      end > now + MAX_FOCUS_SECONDS * 1000 + 60000 || end < now - MAX_FOCUS_SECONDS * 1000 ||
      typeof state.timerSessionId !== 'string' || !state.timerSessionId || state.timerSessionId.length > 100) throw new Error('Invalid timer state');
  const dueElapsed = baseline + interval;
  if (dueElapsed >= total) return null;
  const remainingSeconds = Math.min(remaining, total - dueElapsed);
  const dueAt = end - (total - dueElapsed) * 1000;
  return { timerSessionId: state.timerSessionId, checkId: `${state.timerSessionId}:${remainingSeconds}`,
    remainingSeconds, dueAt: new Date(dueAt) };
}

export function presencePushPayload(job) {
  const seconds = job.remainingSeconds;
  const reading = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return {
    type: 'IFOCUS_PRESENCE_PUSH', title: 'iFocus Active Presence Check',
    body: `Timer paused at ${reading}. Tap to Pause or Continue.`,
    tag: 'ifocus-presence', timestamp: new Date(job.dueAt).getTime(),
    data: { timerSessionId: job.timerSessionId, presenceCheckId: job.checkId, url: '/dashboard' },
  };
}
