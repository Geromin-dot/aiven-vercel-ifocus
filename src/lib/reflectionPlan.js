const states = ['Stressed', 'Distracted', 'Motivated', 'Engaged'];
const priority = task => ({ low: 1, medium: 2, normal: 2, high: 3 }[String(task.priority || '').toLowerCase()] || 2);
const normalize = text => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const ignoredWords = new Set(['a', 'an', 'the', 'of', 'and', 'for', 'to', 'my', 'review', 'study', 'read', 'task', 'ang', 'ng', 'sa', 'ko']);
const moodWords = /\b(stress\w*|tired|exhaust\w*|anxious|overwhelm\w*|frustrat\w*|pressure|pagod|antok|inaantok|kinakabahan|nahihirapan|distract\w*|bored?|scroll\w*|phone|lazy|procrastinat\w*|tinatamad|motivat\w*|ready|energ\w*|excit\w*|masigla|gaganahan)\b/i;
const levelValue = value => ({ low: 1, easy: 1, medium: 2, med: 2, high: 3, hard: 3 }[value]);

function unsupportedHealthClaim(advice, reflection) {
  const text = String(advice || '').replace(/[’']/g, '').toLowerCase();
  const conditions = '(?:anxiety(?: disorder)?|depression|adhd|autism|bipolar(?: disorder)?|ocd|ptsd|schizophrenia|insomnia|dyslexia|diabetes|hypertension|hypoglycemia|anemia|asthma|migraine|an? (?:[a-z-]+ ){0,4}(?:disorder|condition|illness|disease|syndrome))';
  const diagnosis = new RegExp(`\\b(?:you (?:have|likely have|probably have|definitely have|clearly have|suffer from|are suffering from)|youve got|you might have|you may have) ${conditions}\\b`);
  const assertions = /\b(?:you (?:are|were|have been) diagnosed|youve been diagnosed|your diagnosis|you (?:are|re) (?:clinically )?(?:depressed|bipolar|autistic|diabetic|anemic|schizophrenic|dehydrated)|you (?:are|re) (?:perfectly )?healthy|nothing (?:is )?wrong with you|you (?:dont|do not|cannot|cant) have (?:a disorder|adhd|anxiety|depression|diabetes)|diagnosed ka|may (?:adhd|anxiety|depression|diabetes|sakit|disorder) ka)\b/;
  const causal = /\b(?:your (?:anxiety|depression|adhd|disorder|condition|illness) (?:is causing|causes|explains)|(?:because of|due to) your (?:anxiety|depression|adhd|disorder|condition|illness)|(?:typing|inactivity|study performance|symptoms) (?:confirms?|proves?|diagnoses?))\b/;
  const inferredAnxiety = /\b(?:you (?:are|re|seem|appear) (?:to be )?anxious|you have anxiety)\b/.test(text)
    && !/\b(?:anxiety|anxious|kinakabahan)\b/i.test(reflection);
  return diagnosis.test(text) || assertions.test(text) || causal.test(text) || inferredAnxiety;
}

// This routes explicit safety language to human support; it is not a diagnosis.
export function generateSafetySupport(value, requested = false) {
  const text = String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const explicit = /\b(?:i (?:really |just )?(?:want|wanna|wish|plan|intend|need) (?:to )?(?:die|kill myself|end my life|hurt myself|harm myself)|i (?:am|feel|feeling) suicidal|im (?:feeling )?suicidal|i (?:dont|do not) want to (?:live|be alive)|i (?:might|will|may|am going to|am about to) (?:kill myself|hurt myself|end my life)|wish i (?:was|were) dead|gusto ko (?:na |nang |ng )?(?:mamatay|magpakamatay)|(?:ayoko|ayaw ko|di ko gusto|hindi ko gusto) (?:na |nang )?(?:mabuhay)|(?:sasaktan|papatayin) ko (?:ang )?sarili ko)\b/.test(text)
    || /^(?:suicidal|kill myself|self harm|magpakamatay)$/.test(text);
  if (!requested && !explicit) return null;
  return { supportOnly: true, supportKind: 'safety', responseSource: 'safety', title: 'Your safety comes first',
    actionPlan: 'You deserve support with this. Please reach out now to a qualified mental health professional, school counselor, or doctor, and tell someone you trust what is happening. Are you safe right now? If you might act on these thoughts or have already hurt yourself, contact local emergency services or go to the nearest emergency department; ask someone you trust to stay with you and move away from anything you could use to hurt yourself.' };
}

export function requestedPriorityOrder(text) {
  const reflection = normalize(text);
  const start = reflection.match(/\b(?:start|begin|unahin|simulan)\s+(?:(?:with|sa|ang|the|a|mga)\s+)*(low|medium|high|easy|hard)\b/)
    || reflection.match(/\b(low|medium|high|easy|hard)(?:\s+(?:priority|difficulty|effort|tasks?))*\s+(?:first|muna|before)\b/)
    || reflection.match(/\b(?:i prefer|id prefer|i want|id like|i would like|gusto ko|mas gusto ko)\s+(?:(?:to|work|on|do|study|tackle|the|a|with|ang|mga|ng|na)\s+)*(low|medium|high|easy|hard)\b/);
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

function validatedTaskPreference(value, text, tasks) {
  const evidence = typeof value?.evidence === 'string' ? value.evidence.trim() : '';
  if (normalize(evidence).length < 3 || !(` ${normalize(text)} `).includes(` ${normalize(evidence)} `)) return null;
  const validIds = new Set(tasks.map(task => String(task.id)));
  const namesTask = id => {
    const title = normalize(tasks.find(task => String(task.id) === id)?.text);
    const quote = ` ${normalize(evidence)} `;
    return title && (quote.includes(` ${title} `) || title.split(' ').some(word => word.length >= 3 && !ignoredWords.has(word) && quote.includes(` ${word} `)));
  };
  const ids = values => [...new Set(Array.isArray(values) ? values.filter(id => typeof id === 'string' && validIds.has(id) && namesTask(id)) : [])];
  const priorityOrder = [...new Set(Array.isArray(value.priorityOrder) ? value.priorityOrder.filter(level => ['low', 'medium', 'high'].includes(level)) : [])];
  const taskIds = ids(value.taskIds);
  const deferredTaskIds = ids(value.deferredTaskIds).filter(id => !taskIds.includes(id));
  if (!priorityOrder.length && !taskIds.length && !deferredTaskIds.length) return null;
  return { evidence, priorityOrder, taskIds, deferredTaskIds };
}

function preferenceComparator(text, taskPreference = null, state = null) {
  const reflection = normalize(text);
  const requested = taskPreference ? taskPreference.priorityOrder.map(levelValue) : requestedPriorityOrder(text);
  const named = task => {
    if (taskPreference) {
      const index = taskPreference.taskIds.indexOf(String(task.id));
      return index < 0 ? Infinity : index;
    }
    const title = normalize(task.text);
    if (!title) return Infinity;
    const full = (` ${reflection} `).indexOf(` ${title} `);
    if (full >= 0) return full;
    const positions = title.split(' ').filter(word => word.length >= 3 && !ignoredWords.has(word))
      .map(word => (` ${reflection} `).indexOf(` ${word} `)).filter(index => index >= 0);
    return positions.length ? Math.min(...positions) : Infinity;
  };
  return (a, b) => {
    if (taskPreference) {
      const aDeferred = taskPreference.deferredTaskIds.indexOf(String(a.id));
      const bDeferred = taskPreference.deferredTaskIds.indexOf(String(b.id));
      if ((aDeferred >= 0) !== (bDeferred >= 0)) return aDeferred >= 0 ? 1 : -1;
      if (aDeferred >= 0 && bDeferred >= 0) return aDeferred - bDeferred;
      const aNamed = named(a), bNamed = named(b);
      if (aNamed !== bNamed) return aNamed < bNamed ? -1 : 1;
    }
    const aLevel = requested.indexOf(priority(a)), bLevel = requested.indexOf(priority(b));
    const aRank = aLevel < 0 ? Infinity : aLevel, bRank = bLevel < 0 ? Infinity : bLevel;
    if (aRank !== bRank) return aRank < bRank ? -1 : 1;
    const aNamed = named(a), bNamed = named(b);
    if (aNamed !== bNamed) return aNamed < bNamed ? -1 : 1;
    return state ? (state === 'Stressed' || state === 'Distracted' ? priority(a) - priority(b) : priority(b) - priority(a)) : 0;
  };
}

export function orderReflectionTasks(tasks, state, text = '', taskPreference = null) {
  const comparePreference = preferenceComparator(text, taskPreference, state);
  return [...tasks].sort((a, b) => {
    const preference = comparePreference(a, b);
    if (preference) return preference;
    return state === 'Stressed' || state === 'Distracted' ? priority(a) - priority(b) : priority(b) - priority(a);
  });
}

export function generateCognitiveFallback(rawText, tasks = [], forcedState, taskPreference = null) {
  const safety = generateSafetySupport(rawText);
  if (safety) return safety;
  const text = String(rawText || '').toLowerCase();
  const activeTasks = Array.isArray(tasks) ? tasks.filter(task => task && task.id != null && !task.completed) : [];
  let state = 'Engaged';
  if (/stress|tired|exhaust|anxious|overwhelm|frustrat|pressure|pagod|antok|inaantok|kinakabahan|nahihirapan/.test(text)) state = 'Stressed';
  else if (/distract|bore|scroll|phone|lazy|procrastinat|tinatamad|di makafocus|hindi makafocus/.test(text)) state = 'Distracted';
  else if (/motivat|ready|energ|excite|let.s go|masigla|gaganahan/.test(text)) state = 'Motivated';
  const neutralRequest = isNeutralOrderRequest(text);
  if (states.includes(forcedState) && !neutralRequest) state = forcedState;
  let targetSessions = state === 'Stressed' ? 2 : state === 'Distracted' ? 3 : 4;
  let workMinutes = state === 'Stressed' ? 15 : state === 'Distracted' ? 20 : state === 'Motivated' ? 50 : 25;
  const sessionMatch = text.match(/(\d+)\s*(?:sessions?|rounds?|cycles?)/i);
  if (sessionMatch) targetSessions = Math.min(5, Math.max(1, Number(sessionMatch[1])));
  const minuteMatch = text.match(/(\d+)\s*(?:mins?|minutes?|m\b)/i);
  if (minuteMatch && Number(minuteMatch[1]) >= 5 && Number(minuteMatch[1]) <= 120) workMinutes = Number(minuteMatch[1]);
  const breakMinutes = workMinutes >= 50 ? 10 : 5;
  const ordered = orderReflectionTasks(activeTasks, state, text, taskPreference);
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
    responseSource: 'fallback', ...(taskPreference ? { taskPreference } : {}) };
}

export function normalizeReflectionPlan(parsed, text, tasks = []) {
  const healthSupport = parsed?.healthSupport === true || parsed?.supportKind === 'health';
  const safety = generateSafetySupport(text, parsed?.supportOnly === true && !healthSupport);
  if (safety) return safety;
  if (healthSupport) return { supportOnly: true, supportKind: 'health', responseSource: 'support',
    title: 'Health questions need professional advice',
    actionPlan: 'A study reflection or typing pattern cannot establish or rule out a health condition. Please speak with a qualified healthcare professional for an assessment. iFocus can help with study goals and pacing; it cannot confirm diagnoses or recommend medical treatment.' };
  const activeTasks = tasks.filter(task => task && task.id != null && !task.completed);
  const taskPreference = validatedTaskPreference(parsed?.taskPreference, text, activeTasks);
  const fallback = generateCognitiveFallback(text, tasks, parsed?.state, taskPreference);
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
  // Enforce the requested first/last groups; let the coach choose unspecified
  // follow-up tasks. Mood defaults apply when the student gave no order.
  const hasOrderPreference = taskPreference || requestedPriorityOrder(text).length > 0;
  const orderedIds = candidates.sort(preferenceComparator(text, taskPreference, hasOrderPreference ? null : fallback.state)).map(task => String(task.id));
  const correctedState = isNeutralOrderRequest(text) && parsed?.state && parsed.state !== 'Engaged';
  const invalidOrder = activeTasks.length > 0 && ids.length === 0;
  const contradictedPreference = orderedIds.some((id, index) => id !== originalOrder[index]);
  const clinicalLanguage = unsupportedHealthClaim(parsed?.actionPlan, text);
  const useFallback = correctedState || invalidOrder || contradictedPreference || clinicalLanguage || !parsed?.actionPlan?.trim?.();
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
