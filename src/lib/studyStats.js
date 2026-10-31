// Local history stores minutes; database durations are explicitly stored in seconds.
// Do not infer units from magnitude: a long focus session can exceed 180 minutes.
export function sessionMinutes(session) {
  if (session?.verification === 'pending') return 0;
  if (session?.durationSeconds != null && Number.isFinite(Number(session.durationSeconds))) {
    return Math.max(0, Number(session.durationSeconds)) / 60;
  }
  const raw = Number(session?.duration);
  const duration = Number.isFinite(raw) ? Math.max(0, raw) : 0;
  return session?.durationUnit === 'seconds' ? duration / 60 : duration;
}

export function formatFocusMinutes(value) {
  const raw = Number(value);
  const minutes = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
