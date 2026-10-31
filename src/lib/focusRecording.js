import { createHash } from 'node:crypto';
import { verifiedFocusSeconds } from './focusClock.js';

export async function recordVerifiedFocus(tx, userId, input, now = Date.now()) {
  const timerId = input.timerSessionId || input.recoveryId;
  if (typeof timerId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,199}$/.test(timerId) ||
      (input.recoveryId && input.recoveryId !== timerId)) throw new Error('A server-tracked timer session is required.');
  const id = `focus-${createHash('sha256').update(`${userId}:${timerId}`).digest('hex')}`;
  // One saved record per focus session, including retries and recovery on another device.
  let existing = await tx.studySession.findFirst({ where: { id, userId } });
  if (!existing && input.recoveryId) {
    const legacyId = `recovery-${createHash('sha256').update(`${userId}:${timerId}`).digest('hex')}`;
    existing = await tx.studySession.findFirst({ where: { id: legacyId, userId } });
  }
  if (existing) return existing;
  const user = await tx.user.findUnique({ where: { id: userId }, select: { telemetryState: true } });
  const telemetry = JSON.parse(user?.telemetryState || '{}');
  const sessions = telemetry.focusClock?.sessions || [];
  const entry = sessions.find(item => item.id === timerId);
  const { duration, entry: settled } = verifiedFocusSeconds(entry, input.duration, Boolean(input.recoveryId), now);
  let deck = input.deckId ? await tx.deck.findFirst({ where: { id: input.deckId, userId } }) : null;
  deck ||= await tx.deck.findFirst({ where: { userId } });
  deck ||= await tx.deck.create({ data: { userId, title: 'General Focus Sessions', description: 'Recorded focus time' } });
  const record = await tx.studySession.create({ data: { id, userId, deckId: deck.id, duration,
    score: duration >= settled.plannedMs / 1000 - 2 ? 100 : 0, createdAt: new Date(now) } });
  telemetry.focusClock.sessions = sessions.map(item => item.id === timerId ? { ...settled, claimedId: id } : item);
  await tx.user.update({ where: { id: userId }, data: { telemetryState: JSON.stringify(telemetry) } });
  return record;
}
