// Timer math is independent of React, request timing, and background callbacks.
export function isTimerSessionOngoing(state) {
  if (!state) return false;
  return Boolean(state.isRunning || state.presencePaused || state.breakGatePending ||
    state.isFocus === false || Number(state.sessionCount) > 1 ||
    (Number(state.totalTime) > 0 && Number(state.timeLeft) < Number(state.totalTime)));
}

export function remainingTime(state, now = Date.now()) {
  if (!state) return 0;
  if (state.presencePaused || !state.isRunning || !state.targetEndTime) {
    return Math.max(0, Number(state.timeLeft) || 0);
  }
  return Math.max(0, Math.ceil((state.targetEndTime - now) / 1000));
}

export function presenceInterval(state, preferences = {}) {
  return Math.max(60, Number(preferences.activePresenceInterval) * 60 || Number(state?.activePresenceIntervalSeconds) || 300);
}

export function settlePresence(state, preferences = {}, now = Date.now()) {
  if (!state?.isRunning || !state.isFocus || state.presencePaused || preferences.activePresenceEnabled === false) return state;
  const total = Number(state.totalTime) || 1500;
  const interval = presenceInterval(state, preferences);
  const baseline = Math.max(0, Number(state.lastPresenceCheckElapsed) || 0);
  const dueElapsed = Math.min(total, baseline + interval);
  // Completion wins when the next check would fall at/after the end of focus.
  if (baseline + interval >= total || total - remainingTime(state, now) < dueElapsed) return state;
  // Freeze at the FIRST missed check, even if the OS suspended JS for hours.
  // Never move an already recorded countdown backwards during legacy recovery.
  const remaining = Math.min(Number(state.timeLeft) || total, total - dueElapsed);
  return {
    ...state, isRunning: false, targetEndTime: null, presencePaused: true,
    timeLeft: remaining, lastPresenceRemaining: remaining,
    lastPresenceCheckElapsed: total - remaining, lastPresenceElapsed: total - remaining,
    updatedAt: now,
  };
}

export function toggleTimerState(state, preferences = {}, now = Date.now()) {
  const settled = settlePresence(state, preferences, now);
  if (settled.presencePaused || settled.breakGatePending) return settled;
  const remaining = remainingTime(settled, now);
  return {
    ...settled, timeLeft: remaining, isRunning: !settled.isRunning,
    targetEndTime: settled.isRunning ? null : now + remaining * 1000,
    activePresenceIntervalSeconds: presenceInterval(settled, preferences),
    updatedAt: now,
  };
}

export function confirmPresence(state, now = Date.now(), resume = true) {
  // Ignore old notification actions after a reset, manual pause, or new session.
  if (!state?.presencePaused) return state;
  const remaining = Math.max(0, Number(state.timeLeft) || 0);
  const elapsed = Math.max(0, (Number(state.totalTime) || 1500) - remaining);
  return {
    ...state, isRunning: resume, presencePaused: false, timeLeft: remaining,
    targetEndTime: resume ? now + remaining * 1000 : null,
    lastPresenceCheckElapsed: elapsed, lastPresenceElapsed: elapsed,
    lastPresenceRemaining: remaining, updatedAt: now,
  };
}

export function getTimerDeviceId() {
  let id = localStorage.getItem('ifocus_timer_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('ifocus_timer_device_id', id);
  }
  return id;
}

export function recoveryFromCheckpoint(checkpoint) {
  if (!checkpoint?.isFocus || checkpoint.breakGatePending || checkpoint.recoveryResolved) return null;
  const duration = Math.max(0, Math.floor((Number(checkpoint.totalTime) || 0) - (Number(checkpoint.timeLeft) || 0)));
  if (!duration) return null;
  return {
    id: checkpoint.timerSessionId || `legacy-${checkpoint.updatedAt || checkpoint.targetEndTime}`,
    duration, totalTime: checkpoint.totalTime, date: new Date(checkpoint.updatedAt || Date.now()).toISOString(),
  };
}
