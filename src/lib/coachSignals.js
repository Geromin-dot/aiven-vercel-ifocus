export function signalTime(signal) {
  const value = signal?.timestamp ?? signal?.date ?? signal?.time;
  const time = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

export function isIdleSignal(signal) {
  return /idle|inactivity/i.test(`${signal?.state || ''} ${signal?.sentiment || ''} ${signal?.type || ''} ${signal?.reason || ''}`);
}

// Read every source by time rather than giving a storage key permanent priority.
export function latestCoachSignal(signals, { since = 0, lastActivity = 0 } = {}) {
  return signals.filter(signal => signal && signalTime(signal) > since &&
    !(isIdleSignal(signal) && lastActivity > signalTime(signal)))
    .sort((a, b) => signalTime(b) - signalTime(a))[0] || null;
}

export function formatCoachInsight(signal) {
  if (!signal) return null;
  const state = String(signal.state || signal.sentiment || signal.type || '').toLowerCase();
  const idle = isIdleSignal(signal);
  const stressed = !idle && /stress|friction|tension|frustrat|overwhelm/.test(state);
  const fatigued = !idle && /fatigue|hesitant/.test(state);
  const distracted = /distract/.test(state);
  const energetic = /motivat|energ|ready/.test(state);
  const guidance = idle ? {
    reason: 'You were inactive for a while without a focus timer running. Start with one small task to ease back into studying.',
    actionPlan: 'Choose a manageable task and try a short focus session. You can build up your pace once you feel ready.',
    steps: ['Choose one small task', 'Start a short focus session', 'Check your progress before the next task'],
  } : stressed ? {
    reason: signal.source?.startsWith('keystroke')
      ? 'Your recent typing showed frequent corrections or input friction. If the task feels difficult, take a moment to slow down and regroup.'
      : 'Your latest reflection indicates stress or frustration. A gentler study pace may help you get started.',
    actionPlan: 'Pause briefly if you need to, then choose one manageable task. Continue with a shorter focus block and reassess how you feel afterward.',
    steps: ['Pause and take a few slow breaths', 'Choose one manageable task', 'Resume with a short focus block'],
  } : fatigued ? {
    reason: 'Your latest interaction suggests a slower study pace or tiredness. Give yourself room to recover before tackling harder material.',
    actionPlan: 'Take a brief stretch or water break if needed. Return with a lighter task and a shorter focus block.',
    steps: ['Check whether you need a short break', 'Choose a lighter task', 'Return at a comfortable pace'],
  } : distracted ? {
    reason: 'Your latest reflection indicates distraction. A clear, smaller task can help you regain focus.',
    actionPlan: 'Reduce distractions and choose one specific goal for your next focus block. Check that goal before moving on.',
    steps: ['Reduce distractions', 'Set one clear study goal', 'Work on that goal for one focus block'],
  } : energetic ? {
    reason: 'Your latest reflection indicates that you feel energetic and ready to study.',
    actionPlan: 'Use that energy for a priority task. Follow your recommended focus rhythm and take your scheduled breaks.',
    steps: ['Choose a priority task', 'Begin your recommended focus block', 'Take your scheduled break'],
  } : {
    reason: 'Your latest interaction shows that you are active and ready to continue at a steady pace.',
    actionPlan: 'Choose your next study goal and follow a comfortable focus rhythm. Check in with yourself as you go.',
    steps: ['Choose your next study goal', 'Start a comfortable focus block', 'Check your progress and take a break'],
  };
  const reason = signal.reason || signal.text;
  const shortLabel = /^(high friction|hesitant|steady flow|fast flow|calibrating\.{0,3}|ready)$/i.test(String(reason || '').trim());
  const isIntervention = idle || stressed || fatigued || distracted;
  return { ...signal, reason: !reason || shortLabel ? guidance.reason : reason,
    actionPlan: signal.actionPlan || signal.aiReply?.message || guidance.actionPlan,
    isIntervention, steps: guidance.steps,
    protocolTitle: idle ? 'Focus Kickstart Steps' : isIntervention ? 'Guided Focus Reset' : 'Next Study Steps' };
}

export function clearIdleOnActivity(storage, userName, now) {
  let cleared = false;
  const keys = ['ifocus_latest_telemetry', 'ifocus_active_idle_alert',
    `ifocus_telemetry_insight_${userName}`, 'ifocus_telemetry_insight_anonymous'];
  for (const key of keys) {
    const value = JSON.parse(storage.getItem(key) || 'null');
    if (isIdleSignal(value) && signalTime(value) <= now) {
      storage.removeItem(key);
      cleared = true;
    }
  }
  if (!cleared) return null;
  const signal = JSON.parse(storage.getItem('ifocus_latest_telemetry') || 'null') || {
    state: 'Engaged', reason: 'Activity resumed. Observing your current study interaction.',
    source: 'activity_resumed', timestamp: new Date(now).toISOString(),
  };
  for (const key of [keys[0], keys[2], keys[3]]) storage.setItem(key, JSON.stringify(signal));
  return signal;
}

// Current coaching is an estimate from the latest interaction, not a lifetime penalty.
// Older BreakGate records remain in history but do not override a newer reflection.
export function currentCoachResilience({ signal, events = [], since = 0, isStress, isFatigued, isDistracted, isIdle }) {
  const baseline = isStress ? 65 : isFatigued ? 75 : isDistracted || isIdle ? 80 : 100;
  const cutoff = Math.max(since, signalTime(signal));
  const currentEvents = events.filter(event => signalTime(event) > cutoff);
  const completedEvents = currentEvents.filter(event => event.status === 'completed').length;
  const skippedEvents = currentEvents.length - completedEvents;
  const staminaPct = Math.max(0, Math.min(100, baseline - skippedEvents * 20 + completedEvents * 5));
  const context = isStress ? 'Your latest interaction indicates strain; a lighter study block is advised.'
    : isFatigued ? 'Your latest interaction indicates fatigue; use a gentler study pace.'
    : isDistracted ? 'Your latest interaction indicates distraction; try a shorter focus block.'
    : isIdle ? 'Recent inactivity detected; start with a manageable focus block.'
    : signal ? 'Based on your latest interaction.' : 'Ready for your next focus session.';
  return { staminaPct, skippedEvents, completedEvents, totalEvents: currentEvents.length,
    subtext: skippedEvents ? `${context} ${skippedEvents} BreakGate skip(s) since then.` : context };
}
