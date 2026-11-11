export const BREAKGATE_SKIP_THRESHOLD = 5;

export function getBreakGateGuidance(events, now = new Date()) {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const today = events.filter(event => {
    const time = new Date(event?.timestamp ?? event?.date ?? event?.time).getTime();
    return time >= startOfDay && time <= now.getTime();
  });
  const skips = today.filter(event => event.status === 'skipped');
  // Keep the running count when the saved event list rolls over.
  const skipped = skips.reduce((count, event) => Number.isSafeInteger(event.dailySkipNumber)
    ? Math.max(count, event.dailySkipNumber) : count, skips.length);
  const completed = today.filter(event => event.status === 'completed').length;
  const canTurnOff = skipped >= BREAKGATE_SKIP_THRESHOLD;
  const message = canTurnOff
    ? `You’ve skipped ${skipped} BreakGate challenges today. If the extra questions feel like too much, consider turning off BreakGate for now.`
    : skipped === 1
      ? 'You skipped one BreakGate review. Try reviewing a few flashcards later when you’re ready.'
      : skipped > 1
        ? `You’ve skipped ${skipped} BreakGate challenges today. Try reviewing a few flashcards later when you’re ready.`
        : '';
  return { skipped, completed, canTurnOff, message, shouldNotify: canTurnOff && skipped % BREAKGATE_SKIP_THRESHOLD === 0 };
}
