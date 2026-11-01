export function signalTime(signal) {
  const value = signal?.timestamp ?? signal?.date ?? signal?.time;
  const time = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

export function isIdleSignal(signal) {
  return /idle|inactivity/i.test(`${signal?.state || ''} ${signal?.sentiment || ''} ${signal?.type || ''} ${signal?.reason || ''}`);
}

// Read every source by time rather than giving a storage key permanent priority.
export function latestCoachSignal(signals, { since = 0, lastActivity = 0 } = {}) {
  return signals.filter(signal => signal && signalTime(signal) > since &&
    !(isIdleSignal(signal) && lastActivity > signalTime(signal)))
    .sort((a, b) => signalTime(b) - signalTime(a))[0] || null;
}

export function clearIdleOnActivity(storage, userName, now) {
  let cleared = false;
  const keys = ['ifocus_latest_telemetry', 'ifocus_active_idle_alert',
    `ifocus_telemetry_insight_${userName}`, 'ifocus_telemetry_insight_anonymous'];
  for (const key of keys) {
    const value = JSON.parse(storage.getItem(key) || 'null');
    if (isIdleSignal(value) && signalTime(value) <= now) {
      storage.removeItem(key);
      cleared = true;
    }
  }
  if (!cleared) return null;
  const signal = JSON.parse(storage.getItem('ifocus_latest_telemetry') || 'null') || {
    state: 'Engaged', reason: 'Activity resumed. Observing your current study interaction.',
    source: 'activity_resumed', timestamp: new Date(now).toISOString(),
  };
  for (const key of [keys[0], keys[2], keys[3]]) storage.setItem(key, JSON.stringify(signal));
  return signal;
}

// Current coaching is an estimate from the latest interaction, not a lifetime penalty.
// Older BreakGate records remain in history but do not override a newer reflection.
export function currentCoachResilience({ signal, events = [], since = 0, isStress, isFatigued, isDistracted, isIdle }) {
  const baseline = isStress ? 65 : isFatigued ? 75 : isDistracted || isIdle ? 80 : 100;
  const cutoff = Math.max(since, signalTime(signal));
  const currentEvents = events.filter(event => signalTime(event) > cutoff);
  const completedEvents = currentEvents.filter(event => event.status === 'completed').length;
  const skippedEvents = currentEvents.length - completedEvents;
  const staminaPct = Math.max(0, Math.min(100, baseline - skippedEvents * 20 + completedEvents * 5));
  const context = isStress ? 'Your latest interaction indicates strain; a lighter study block is advised.'
    : isFatigued ? 'Your latest interaction indicates fatigue; use a gentler study pace.'
    : isDistracted ? 'Your latest interaction indicates distraction; try a shorter focus block.'
    : isIdle ? 'Recent inactivity detected; start with a manageable focus block.'
    : signal ? 'Based on your latest interaction.' : 'Ready for your next focus session.';
  return { staminaPct, skippedEvents, completedEvents, totalEvents: currentEvents.length,
    subtext: skippedEvents ? `${context} ${skippedEvents} BreakGate skip(s) since then.` : context };
}
