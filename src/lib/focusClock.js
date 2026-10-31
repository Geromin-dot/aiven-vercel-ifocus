// Basic capstone integrity check: count server elapsed time, never browser duration.
// This is not proof that a student was paying attention.
export function settleFocusClock(entry, now) {
  if (!entry || entry.runningSince == null || entry.claimedId || entry.discarded) return entry;
  const limit = Math.min(entry.plannedMs, entry.intervalMs ? entry.presenceBaseMs + entry.intervalMs : entry.plannedMs);
  const elapsedMs = Math.min(limit, entry.elapsedMs + Math.max(0, now - entry.runningSince));
  return { ...entry, elapsedMs, runningSince: elapsedMs < limit ? now : null };
}

export function advanceFocusClock(clock = {}, state, prefs = {}, loginId, now = Date.now()) {
  clock = clock && typeof clock === 'object' ? clock : {};
  if (!state || typeof state.timerSessionId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,99}$/.test(state.timerSessionId)) return clock;
  const version = Number(state.updatedAt);
  if (!Number.isFinite(version) || version > now + 60000 || version < (clock.version || 0)) return clock;
  const sessions = (Array.isArray(clock.sessions) ? clock.sessions : []).map(entry => ({ ...settleFocusClock(entry, now) }));
  let entry = sessions.find(item => item.id === state.timerSessionId);
  // Only one focus session per account can earn elapsed time at a time.
  sessions.forEach(item => { item.runningSince = null; });
  if (!entry && state.isRunning && state.isFocus) {
    const total = Number(state.totalTime);
    if (!Number.isInteger(total) || total <= 0 || total > 43200) return { version, sessions };
    entry = { id: state.timerSessionId, loginId, plannedMs: total * 1000, elapsedMs: 0,
      intervalMs: prefs.activePresenceEnabled === false ? 0 : Math.max(60, Math.min(43200, Number(prefs.activePresenceInterval) * 60 || 300)) * 1000,
      presenceBaseMs: 0, runningSince: null };
    sessions.push(entry);
  }
  if (entry && !entry.claimedId && !entry.discarded && entry.loginId === loginId && state.isRunning && state.isFocus && !state.presencePaused && !state.breakGatePending) {
    const confirmedMs = Number(state.lastPresenceCheckElapsed) * 1000;
    // A stale heartbeat cannot continue past a missed presence check.
    if (entry.intervalMs && confirmedMs > entry.presenceBaseMs && Math.abs(confirmedMs - entry.elapsedMs) <= 2000 && entry.elapsedMs >= entry.presenceBaseMs + entry.intervalMs - 2000) {
      entry.presenceBaseMs = entry.elapsedMs;
    }
    const atPresenceCheck = entry.intervalMs && entry.elapsedMs >= entry.presenceBaseMs + entry.intervalMs;
    if (!atPresenceCheck && entry.elapsedMs < entry.plannedMs) entry.runningSince = now;
  }
  return { version, sessions: sessions.slice(-100) };
}

export function resolveFocusClock(clock = {}, resolvedIds = [], now = Date.now()) {
  return { ...clock, sessions: (clock.sessions || []).map(item => resolvedIds.includes(item.id) && !item.claimedId
    ? { ...settleFocusClock(item, now), runningSince: null, discarded: true } : item) };
}

export function verifiedFocusSeconds(entry, requested, recovery = false, now = Date.now()) {
  const settled = settleFocusClock(entry, now);
  if (!settled || settled.discarded) throw new Error('This session has no server-verified study time. Start a new timer while connected.');
  const seconds = Math.min(Math.round(settled.elapsedMs / 1000), Math.floor(settled.plannedMs / 1000));
  if (!Number.isInteger(requested) || requested <= 0 || requested > seconds + 2) throw new Error('Requested time exceeds the server-verified focus time.');
  const duration = Math.min(seconds, requested);
  if (duration < (recovery ? 60 : 1)) throw new Error(recovery ? 'Unfinished sessions need at least one verified minute.' : 'No elapsed focus time has been verified yet.');
  return { duration, entry: { ...settled, runningSince: null } };
}
