export const REFLECTION_RETENTION_MS = 48 * 60 * 60 * 1000;

function entryTime(entry) {
  const value = entry?.date ?? entry?.timestamp ?? entry?.createdAt;
  return typeof value === 'number' ? value : Date.parse(value);
}

export function retainReflections(entries, now = Date.now()) {
  return Array.isArray(entries)
    ? entries.filter(entry => entryTime(entry) > now - REFLECTION_RETENTION_MS)
    : [];
}

export function mergeReflections(existing, incoming, now = Date.now()) {
  const journal = new Map();
  for (const entry of [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]) {
    if (!Number.isFinite(entryTime(entry))) continue;
    const key = entry.id || entry.date || entry.timestamp || entry.createdAt;
    const saved = journal.get(key);
    journal.set(key, saved ? { ...entry, date: new Date(Math.min(entryTime(saved), entryTime(entry))).toISOString() } : entry);
  }
  return retainReflections([...journal.values()], now).sort((a, b) => entryTime(b) - entryTime(a)).slice(0, 50);
}

export function pruneReflectionTelemetry(telemetry, now = Date.now()) {
  if (!telemetry || typeof telemetry !== 'object') return telemetry;
  let result = telemetry;
  if (Array.isArray(telemetry.journalHistory)) {
    const retained = retainReflections(telemetry.journalHistory, now);
    if (retained.length !== telemetry.journalHistory.length) result = { ...result, journalHistory: retained };
  }
  for (const key of ['latestTelemetry', 'insightData']) {
    const signal = telemetry[key];
    if (String(signal?.source || '').startsWith('reflection_submission') && !retainReflections([signal], now).length) {
      result = { ...result, [key]: null };
    }
  }
  if (typeof telemetry.aiAdjustedDetails?.reflectionText === 'string') {
    const { reflectionText, message, ...timerDetails } = telemetry.aiAdjustedDetails;
    result = { ...result, aiAdjustedDetails: timerDetails };
  }
  return result;
}

export function readReflectionJournal(userName) {
  const keys = [`ifocus_journal_history_${userName}`, 'ifocus_journal_history'];
  const histories = keys.map(key => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      const retained = retainReflections(stored);
      if (Array.isArray(stored) && retained.length !== stored.length) localStorage.setItem(key, JSON.stringify(retained));
      return retained;
    } catch { return []; }
  });
  for (const [key, field] of [
    ['ifocus_latest_telemetry', 'latestTelemetry'],
    [`ifocus_telemetry_insight_${userName}`, 'insightData'],
    ['ifocus_telemetry_insight_anonymous', 'insightData'],
    ['ifocus_ai_adjusted_details', 'aiAdjustedDetails'],
  ]) {
    try {
      const original = JSON.parse(localStorage.getItem(key) || 'null');
      const retained = pruneReflectionTelemetry({ [field]: original })[field];
      if (retained === original) continue;
      if (retained === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(retained));
    } catch {}
  }
  return histories[0];
}
