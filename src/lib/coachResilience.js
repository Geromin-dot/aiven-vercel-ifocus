// Apply recovery evidence after reflection and saved schedule preferences.
export function adaptCoachToResilience({ cognitiveState, recommendedRhythm, staminaPct, skippedEvents, preserveState = false }) {
  const recoveryNeeded = staminaPct < 60 || skippedEvents >= 3;
  const pacingNeeded = recoveryNeeded || skippedEvents > 0 || staminaPct < 80;
  if (!pacingNeeded) return { cognitiveState, recommendedRhythm, recoveryNeeded, pacingNeeded };

  const workLimit = recoveryNeeded ? 15 : skippedEvents >= 2 || staminaPct < 80 ? 20 : 25;
  const match = recommendedRhythm.title.match(/(\d+)m Work \/ (\d+)m Gate/i);
  const workMinutes = Math.min(Number(match?.[1]) || workLimit, workLimit);
  const breakMinutes = 5;
  const color = recoveryNeeded ? '#dc2626' : '#d97706';
  const evidence = `${staminaPct}% study resilience with ${skippedEvents} unrecovered BreakGate skip${skippedEvents === 1 ? '' : 's'} today`;

  return {
    recoveryNeeded,
    pacingNeeded,
    cognitiveState: {
      ...cognitiveState,
      title: preserveState ? cognitiveState.title : recoveryNeeded ? 'Recovery Needed' : 'Rebuilding Study Consistency',
      status: recoveryNeeded ? 'Rest Needed' : 'Pacing Advisory',
      color,
      dotColor: color,
      subtext: `${evidence}. ${recoveryNeeded ? 'Take a recovery break before a lighter study block.' : 'Complete your next BreakGate before increasing the pace.'}`,
    },
    recommendedRhythm: {
      title: `${workMinutes}m Work / ${breakMinutes}m Gate`,
      color,
      subtext: recoveryNeeded
        ? `Take a 5m recovery break first, then resume with ${workMinutes}m focus blocks.`
        : `Shorter focus blocks while rebuilding study resilience; complete each BreakGate.`,
    },
  };
}
