let checkpointRequest = Promise.resolve();

export function syncTimerCheckpoint(checkpoint) {
  checkpointRequest = checkpointRequest.catch(() => {}).then(async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetch('/api/user/telemetry', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
          signal: AbortSignal.timeout(5000),
          body: JSON.stringify({ telemetryState: { activeTimerState: checkpoint } }),
        });
        if (response.ok) return;
        if (!(response.status >= 500) || attempt === 1) break;
      } catch (error) {
        if (attempt === 1 || globalThis.navigator?.onLine === false) throw error;
      }
    }
    throw new Error('Timer checkpoint could not be verified.');
  });
  return checkpointRequest;
}

export function queueStudySession(payload) {
  const key = 'ifocus_pending_study_sessions';
  const pending = JSON.parse(localStorage.getItem(key) || '[]');
  if (!pending.some(item => item.timerSessionId === payload.timerSessionId)) pending.push(payload);
  localStorage.setItem(key, JSON.stringify(pending));
}

export function removeQueuedStudySession(timerSessionId) {
  const key = 'ifocus_pending_study_sessions';
  const pending = JSON.parse(localStorage.getItem(key) || '[]');
  const remaining = pending.filter(item => item.timerSessionId !== timerSessionId);
  if (remaining.length) localStorage.setItem(key, JSON.stringify(remaining));
  else localStorage.removeItem(key);
}

export async function saveVerifiedStudySession(payload) {
  // Let the Start/Pause checkpoint reach the server before asking to record time.
  if (payload.completed || payload.score === 100) await checkpointRequest.catch(() => {});
  else await checkpointRequest;
  const response = await fetch('/api/study-sessions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Your study time could not be verified.');
  const record = data.session;
  const history = JSON.parse(localStorage.getItem('ifocus_session_history') || '[]');
  const remaining = history.filter(item => item.timerSessionId !== payload.timerSessionId && item.id !== record.id &&
    !(payload.recoveryId && item.recoveryId === payload.recoveryId));
  remaining.push({ id: record.id, timerSessionId: payload.timerSessionId, recoveryId: payload.recoveryId,
    date: record.createdAt, duration: record.duration / 60, durationSeconds: record.duration, type: 'pomodoro', synced: true });
  localStorage.setItem('ifocus_session_history', JSON.stringify(remaining.slice(-200)));
  const historyForStats = remaining.filter(item => item.verification !== 'pending');
  const today = new Date().toDateString();
  const todaySessions = historyForStats.filter(item => new Date(item.date).toDateString() === today);
  const dates = new Set(historyForStats.map(item => new Date(item.date).toDateString()));
  let streak = 0;
  const day = new Date();
  while (dates.has(day.toDateString())) { streak++; day.setDate(day.getDate() - 1); }
  localStorage.setItem('ifocus_focus_stats', JSON.stringify({ date: today, sessions: todaySessions.length,
    minutes: todaySessions.reduce((sum, item) => sum + (item.durationSeconds != null ? item.durationSeconds / 60 : Number(item.duration) || 0), 0), streak }));
  window.dispatchEvent(new CustomEvent('ifocus_stats_updated'));
  removeQueuedStudySession(payload.timerSessionId || payload.recoveryId);
  return data;
}
