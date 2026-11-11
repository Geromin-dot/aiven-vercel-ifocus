export const BREAKGATE_SKIP_THRESHOLD = 5;

export function getBreakGateGuidance(events, now = new Date()) {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const today = events.filter(event => {
    const time = new Date(event?.timestamp ?? event?.date ?? event?.time).getTime();
    return time >= startOfDay && time <= now.getTime();
  });
  const skipped = today.filter(event => event.status === 'skipped').length;
  const completed = today.filter(event => event.status === 'completed').length;
  const canTurnOff = skipped >= BREAKGATE_SKIP_THRESHOLD;
  const message = canTurnOff
    ? `You’ve skipped ${skipped} BreakGate challenges today. Consider turning off BreakGate and reviewing flashcards when you’re ready.`
    : skipped === 1
      ? 'You skipped one BreakGate review. Try reviewing a few flashcards later when you’re ready.'
      : skipped > 1
        ? `You’ve skipped ${skipped} BreakGate challenges today. Try reviewing a few flashcards later when you’re ready.`
        : '';
  return { skipped, completed, canTurnOff, message };
}
