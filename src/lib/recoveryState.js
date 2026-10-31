export function mergeResolvedSessions(...lists) {
  return [...new Set(lists.flatMap(list => Array.isArray(list) ? list : [])
    .filter(id => typeof id === 'string' && id.length > 0))].slice(-100);
}

// Merge even when a GET response started before a local Save/Discard completed.
export function applyResolvedSessions(userId, remoteIds = []) {
  if (!userId) return [];
  const key = `ifocus_resolved_timer_sessions_${userId}`;
  const ids = mergeResolvedSessions(JSON.parse(localStorage.getItem(key) || '[]'), remoteIds);
  localStorage.setItem(key, JSON.stringify(ids));
  const pendingKey = `ifocus_interrupted_session_${userId}`;
  const pending = JSON.parse(localStorage.getItem(pendingKey) || 'null');
  if (pending && (ids.includes(pending.id) || Number(pending.duration) < 60)) localStorage.removeItem(pendingKey);
  return ids;
}
