const states = ['Stressed', 'Distracted', 'Motivated', 'Engaged'];
const priority = task => ({ low: 1, medium: 2, normal: 2, high: 3 }[String(task.priority || '').toLowerCase()] || 2);
const normalize = text => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const ignoredWords = new Set(['a', 'an', 'the', 'of', 'and', 'for', 'to', 'my', 'review', 'study', 'read', 'task', 'ang', 'ng', 'sa', 'ko']);
const moodWords = /\b(stress\w*|tired|exhaust\w*|anxious|overwhelm\w*|frustrat\w*|pressure|pagod|antok|inaantok|kinakabahan|nahihirapan|distract\w*|bored?|scroll\w*|phone|lazy|procrastinat\w*|tinatamad|motivat\w*|ready|energ\w*|excit\w*|masigla|gaganahan)\b/i;
const levelValue = value => ({ low: 1, easy: 1, medium: 2, med: 2, high: 3, hard: 3 }[value]);

export function requestedPriorityOrder(text) {
  const reflection = normalize(text);
  const start = reflection.match(/\b(?:start|begin|unahin|simulan)\s+(?:(?:with|sa|ang|the|a|mga)\s+)*(low|medium|high|easy|hard)\b/)
    || reflection.match(/\b(low|medium|high|easy|hard)(?:\s+(?:priority|difficulty|effort|tasks?))*\s+(?:first|muna)\b/);
  if (!start) return [];
  const order = [levelValue(start[1])];
  // Uncertainty such as "then idk if low or high" is not a second instruction.
  const tail = reflection.slice(start.index + start[0].length).split(/\b(?:idk|not sure|unsure|if|maybe|whether|or|hindi ko alam|di ko alam)\b/)[0];
  for (const match of tail.matchAll(/\b(?:then|next|followed by|tapos|sunod|pagkatapos)\s+(?:(?:the|with|sa|ang|mga)\s+)*(low|medium|high|easy|hard)\b/g)) {
    if (!order.includes(levelValue(match[1]))) order.push(levelValue(match[1]));
  }
  return order;
}

export function isNeutralOrderRequest(text) {
  return requestedPriorityOrder(text).length > 0 && !moodWords.test(text);
}

function preferenceComparator(text) {
  const reflection = normalize(text);
  const requested = requestedPriorityOrder(text);
  const named = task => {
    const title = normalize(task.text);
    if (!title) return Infinity;
    const full = (` ${reflection} `).indexOf(` ${title} `);
    if (full >= 0) return full;
    const positions = title.split(' ').filter(word => word.length >= 3 && !ignoredWords.has(word))
      .map(word => (` ${reflection} `).indexOf(` ${word} `)).filter(index => index >= 0);
    return positions.length ? Math.min(...positions) : Infinity;
  };
  return (a, b) => {
    const aLevel = requested.indexOf(priority(a)), bLevel = requested.indexOf(priority(b));
    const aRank = aLevel < 0 ? Infinity : aLevel, bRank = bLevel < 0 ? Infinity : bLevel;
    if (aRank !== bRank) return aRank < bRank ? -1 : 1;
    const aNamed = named(a), bNamed = named(b);
    return aNamed === bNamed ? 0 : aNamed < bNamed ? -1 : 1;
  };
}

export function orderReflectionTasks(tasks, state, text = '') {
  const comparePreference = preferenceComparator(text);
  return [...tasks].sort((a, b) => {
    const preference = comparePreference(a, b);
    if (preference) return preference;
    return state === 'Stressed' || state === 'Distracted' ? priority(a) - priority(b) : priority(b) - priority(a);
  });
}

export function generateCognitiveFallback(rawText, tasks = [], forcedState) {
  const text = String(rawText || '').toLowerCase();
  const activeTasks = Array.isArray(tasks) ? tasks.filter(task => task && task.id != null && !task.completed) : [];
  let state = 'Engaged';
  if (/stress|tired|exhaust|anxious|overwhelm|frustrat|pressure|pagod|antok|inaantok|kinakabahan|nahihirapan/.test(text)) state = 'Stressed';
  else if (/distract|bore|scroll|phone|lazy|procrastinat|tinatamad|di makafocus|hindi makafocus/.test(text)) state = 'Distracted';
  else if (/motivat|ready|energ|excite|let.s go|masigla|gaganahan/.test(text)) state = 'Motivated';
  if (states.includes(forcedState) && !isNeutralOrderRequest(text)) state = forcedState;
  let targetSessions = state === 'Stressed' ? 2 : state === 'Distracted' ? 3 : 4;
  let workMinutes = state === 'Stressed' ? 15 : state === 'Distracted' ? 20 : state === 'Motivated' ? 50 : 25;
  const sessionMatch = text.match(/(\d+)\s*(?:sessions?|rounds?|cycles?)/i);
  if (sessionMatch) targetSessions = Math.min(5, Math.max(1, Number(sessionMatch[1])));
  const minuteMatch = text.match(/(\d+)\s*(?:mins?|minutes?|m\b)/i);
  if (minuteMatch && Number(minuteMatch[1]) >= 5 && Number(minuteMatch[1]) <= 120) workMinutes = Number(minuteMatch[1]);
  const breakMinutes = workMinutes >= 50 ? 10 : 5;
  const ordered = orderReflectionTasks(activeTasks, state, text);
  const first = ordered[0] ? `Start with “${String(ordered[0].text).slice(0, 120)}”.` : 'Choose one manageable study goal.';
  const advice = state === 'Stressed' ? 'Use a smaller first step and give yourself room to work at a gentler pace.'
    : state === 'Distracted' ? 'Put your phone aside, close unrelated tabs, and work on one concrete step.'
    : state === 'Motivated' ? 'Use your energy for your priority task and check your understanding as you go.'
    : 'Set a clear outcome for this block and check your progress before the next task.';
  const strategy = state === 'Stressed' ? 'Choose one small section or problem, then explain what you understood in your own words before continuing.'
    : state === 'Distracted' ? 'Choose one visible outcome, keep only the materials needed for it open, and note unrelated thoughts for later.'
    : state === 'Motivated' ? 'Work through a practice problem or explain a concept without your notes, then check your understanding before moving on.'
    : 'Set a clear outcome for this block and test what you remember before deciding what needs another pass.';
  return { state, orderedIds: ordered.map(task => task.id), targetSessions, workMinutes, breakMinutes,
    actionPlan: `${first} ${advice} ${strategy} Try ${targetSessions} sessions of ${workMinutes} minutes with ${breakMinutes}-minute breaks, and reassess your pace after the first block.`,
    responseSource: 'fallback' };
}

export function normalizeReflectionPlan(parsed, text, tasks = []) {
  const fallback = generateCognitiveFallback(text, tasks, parsed?.state);
  const activeTasks = tasks.filter(task => task && task.id != null && !task.completed);
  const byId = new Map(activeTasks.map(task => [String(task.id), task]));
  const resolve = value => {
    const identifier = String(value?.id ?? value?.text ?? value ?? '').trim();
    if (byId.has(identifier)) return identifier;
    const matches = activeTasks.filter(task => normalize(task.text) === normalize(identifier));
    return matches.length === 1 ? String(matches[0].id) : null;
  };
  const ids = Array.isArray(parsed?.orderedIds) ? parsed.orderedIds.map(resolve).filter(Boolean) : [];
  const candidates = [...new Set([...ids, ...fallback.orderedIds.map(String)])].map(id => byId.get(id));
  const originalOrder = candidates.map(task => String(task.id));
  const orderedIds = candidates.sort(preferenceComparator(text)).map(task => String(task.id));
  const correctedState = isNeutralOrderRequest(text) && parsed?.state && parsed.state !== 'Engaged';
  const invalidOrder = activeTasks.length > 0 && ids.length === 0;
  const contradictedPreference = orderedIds.some((id, index) => id !== originalOrder[index]);
  const useFallback = correctedState || invalidOrder || contradictedPreference || !parsed?.actionPlan?.trim?.();
  if (useFallback) return { ...fallback, fallbackReason: 'invalid_plan' };
  const bounded = (value, min, max, defaultValue) => {
    const number = Number(value);
    return Number.isInteger(number) && number >= min && number <= max ? number : defaultValue;
  };
  return { ...fallback, orderedIds,
    targetSessions: bounded(parsed?.targetSessions, 1, 5, fallback.targetSessions),
    workMinutes: bounded(parsed?.workMinutes, 5, 120, fallback.workMinutes),
    breakMinutes: bounded(parsed?.breakMinutes, 1, 60, fallback.breakMinutes),
    actionPlan: parsed.actionPlan.trim(),
    responseSource: 'ai',
  };
}

export function applyReflectionTaskOrder(todos, orderedIds) {
  const active = todos.filter(task => !task.completed);
  const completed = todos.filter(task => task.completed);
  const byId = new Map(active.map(task => [String(task.id), task]));
  const order = [...new Set((orderedIds || []).map(String))].map(id => byId.get(id)).filter(Boolean);
  const included = new Set(order.map(task => String(task.id)));
  return [...order, ...active.filter(task => !included.has(String(task.id))), ...completed];
}
