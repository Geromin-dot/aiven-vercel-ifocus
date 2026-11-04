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
  const unsafeAdvice = /\b(?:(?:take|double|increase|start taking|stop taking) (?:your |some |an? |the )?(?:dose|medication|medicine|pills?|stimulants?|antidepressants?|adderall|ritalin)|(?:skip|avoid|sacrifice) (?:sleep|meals|food|water)|(?:ignore|push through) (?:the |your )?(?:pain|bleeding|symptoms)|(?:you (?:must|should|need to)|you have to) (?:finish|complete).{0,45}before (?:you (?:can )?)?(?:rest|sleep|drink|eat|seek help))\b/.test(text);
  return diagnosis.test(text) || assertions.test(text) || causal.test(text) || inferredAnxiety || unsafeAdvice;
}

// Verified 2026-11-04: PH emergency directory and the local helpline connector.
// Keep contacts deterministic: never accept a phone number invented by the model.
const emergencyContact = { label: 'Philippines: Emergency 911', href: 'tel:911' };
const crisisContact = { label: 'Philippines: NCMH Crisis Hotline 1553 (24/7)', href: 'tel:+631553?oai_link_source=model_response_hotline' };
const safetyConcerns = ['physical', 'wellbeing', 'danger', 'medical', 'emotional'];

function physicalSafetyConcern(value) {
  const text = String(value || '').toLowerCase().replace(/[’']/g, '')
    .replace(/\bdpako\b/g, 'di pa ako').replace(/\bd\s*pa\b/g, 'di pa')
    .replace(/\b(?:di|hindi) pa ko\b/g, 'di pa ako')
    .replace(/\bnattulog\b/g, 'natutulog').replace(/\s+/g, ' ');
  if (/^(?:bleeding|dumudugo|nagdurugo|overdosed?|chest pain|cant breathe|cannot breathe|di makahinga|hindi makahinga)[.!?]*$/.test(text.trim())) return 'physical';
  if (/^(?:nahihilo|dizzy|panic attack|nanginginig|nilalagnat|nasusuka)[.!?]*$/.test(text.trim())) return 'medical';
  // Match personal disclosures rather than health topics in tasks or coursework.
  const bleeding = /\b(?:i(?:m| am) (?:still |currently )?bleeding|bleeding (?:pa )?ako|(?:dumudugo|nagdurugo) (?:pa )?ako|(?:may|meron akong) (?:dugo|sugat))\b/.test(text);
  const emergency = bleeding || /\b(?:i (?:cant|cannot|can not) breathe|(?:hindi|di) ako makahinga|(?:i have|im having) (?:severe chest pain|a seizure)|(?:i just|i have) (?:fainted|collapsed))\b/.test(text);
  const poisoning = /\b(?:i (?:took|swallowed|drank|ingested|overdosed on) (?:too many|too much|a handful of|extra|all (?:my|the)|bleach|poison)|(?:nakainom|uminom) ako ng (?:maraming gamot|sobrang gamot|lason|bleach))\b/.test(text);
  const acute = /\b(?:my chest (?:hurts|is hurting)|(?:masakit|sumasakit|naninikip) (?:ang )?dibdib ko|(?:i am|im) (?:coughing|vomiting|throwing up) blood|(?:nagsusuka|umuubo) ako ng dugo|(?:namamanhid|nanghihina) (?:ang )?(?:isang bahagi|kalahati) ng katawan ko|(?:i am|im) having (?:trouble|difficulty) breathing|(?:my (?:lips|tongue|throat|face)) (?:is |are )?swelling|(?:i have|im having) an? (?:asthma|allergic) attack)\b/.test(text);
  if (emergency || poisoning || acute) return 'physical';
  const danger = /\b(?:i (?:am|feel) unsafe|im unsafe|someone is (?:hurting|threatening|hitting|abusing|forcing) me|(?:my (?:parent|partner|teacher|father|mother|boyfriend|girlfriend)) (?:is )?(?:hitting|hurting|threatening|abusing) me|(?:sinasaktan|binubugbog|inaabuso|pinagbabantaan|ginagahasa) (?:ako|ni)|(?:i (?:want|plan|intend) to|im going to) (?:hurt|kill|attack) (?:someone|my classmates?|my teacher|them))\b/.test(text);
  if (danger) return 'danger';
  const sleep = /\b(?:(?:i (?:have not|havent|did not|didnt)|i still havent) (?:slept|sleep)|(?:hindi|di) (?:pa )?ako (?:natutulog|nakatulog|natulog)|(?:hindi|di) pa(?:ko| ako) (?:natutulog|nakatulog|natulog)|(?:walang|wala akong) tulog|(?:no|without) sleep|awake for)\b/.test(text);
  const hydration = /\b(?:(?:i (?:have not|havent|did not|didnt)) (?:had (?:any )?water|drunk (?:any )?water|drank (?:any )?water)|(?:hindi|di) (?:pa )?ako (?:uminom|nakainom) (?:ng )?(?:tubig|water)|(?:hindi|di) pa(?:ko| ako) (?:uminom|nakainom) (?:ng )?(?:tubig|water)|(?:no|without) water)\b/.test(text);
  const food = /\b(?:i (?:havent|have not|didnt|did not) (?:eaten|eat)|(?:hindi|di) (?:pa )?ako (?:kumain|nakakain)|(?:wala akong|walang) kain|(?:i (?:will|want to|plan to)|ill) (?:skip (?:sleep|meals|food|water)|stay awake|pull an all nighter)|magpupuyat ako|(?:ayoko|ayaw ko) (?:munang? )?(?:kumain|matulog|uminom))\b/.test(text);
  const unsafeStudy = /\b(?:(?:how (?:can|do|should) i|help me|teach me to).{0,60}(?:stay awake (?:for |all )|study (?:for )?(?:24|48|72) hours|(?:skip|avoid|without) (?:sleep|food|water))|(?:anong|ano ang|what) (?:gamot|pills?|drugs?|dose|dosage).{0,60}(?:study|aral|focus|gising|awake)|(?:i (?:want|plan|need) to|should i|can i).{0,35}(?:double|increase|take extra|take someone elses).{0,35}(?:dose|medication|pills?|adderall|ritalin)|(?:i (?:am|feel)|im) (?:drunk|intoxicated|high on).{0,60}(?:study|drive|exam))\b/.test(text);
  const stimulants = /\b(?:(?:i (?:drank|had|took|need|want)|ive had).{0,25}(?:too much (?:coffee|caffeine)|(?:[5-9]|\d{2,}) (?:cups? of coffee|coffees?|energy drinks?))|(?:i (?:want|plan|need) to|help me).{0,35}(?:study|work).{0,25}(?:24|48|72) hours|(?:i (?:will|plan to)|ill) (?:not sleep|avoid sleep|stop eating))\b/.test(text);
  const depleted = /\b(?:i (?:only )?(?:slept|had) (?:only )?(?:[0-3]|one|two|three) hours?(?: of sleep)?|(?:isa|dalawa|tatlo|[0-3])(?:ng)? oras lang (?:ang )?tulog ko|i (?:havent|have not) (?:had a meal|had anything to drink|drunk anything)|(?:i (?:drank|had)|ive had) (?:several|too many) energy drinks)\b/.test(text);
  if (sleep || hydration || food || unsafeStudy || stimulants || depleted) return 'wellbeing';
  // Personal symptoms deserve a health referral even when not obviously urgent.
  if (/\b(?:(?:do i|could i|might i) have (?:adhd|anxiety|depression|diabetes|a disorder|a disease)|diagnose me|am i (?:depressed|bipolar|autistic|diabetic)|may (?:sakit|disorder) ba ako)\b/.test(text)) return 'health';
  const symptoms = /\b(?:(?:i (?:am|feel|have|keep)|im) (?:very |really |so )?(?:dizzy|faint|shaking|trembling|vomiting|sick|feverish|in pain|hallucinating|hearing voices|seeing things|dehydrated)|i have (?:a (?:high )?fever|a (?:severe )?headache|blurred vision|heart palpitations|severe pain)|(?:nahihilo|nanginginig|nasusuka|nilalagnat|nanghihina|may sakit) ako|(?:masakit|sumasakit) (?:ang )?(?:ulo|tiyan|katawan) ko|(?:i (?:am|feel)|im) (?:having a panic attack|panicking)|nagpapanic ako|my heart is (?:racing|pounding)|(?:i (?:cant|cannot|can not)) (?:keep (?:food|water|fluids) down|stop vomiting))\b/.test(text);
  const healthRequest = /\b(?:(?:do i|could i|might i) have (?:adhd|anxiety|depression|diabetes|a disorder|a disease)|(?:diagnose me|am i (?:depressed|bipolar|autistic|diabetic))|may (?:sakit|disorder) ba ako|(?:should i|can i|how (?:much|many)).{0,35}(?:medication|medicine|pills?|antidepressants?|adderall|ritalin)|(?:i (?:want|need) to|help me).{0,35}(?:stop eating|starve myself|purge|make myself vomit))\b/.test(text);
  if (symptoms || healthRequest) return 'medical';
  if (/\b(?:i feel (?:worthless|hopeless)|i (?:cant|cannot) stop crying|(?:wala akong kwenta|wala nang pag asa|hindi ko na kaya|di ko na kaya)|(?:i havent|i have not) slept.{0,30}(?:days|hours))\b/.test(text)) return 'emotional';
  return null;
}

function physicalSupport(concern) {
  if (concern === 'health') return { supportOnly: true, supportKind: 'health', responseSource: 'support',
    title: 'Health questions need professional advice',
    actionPlan: 'A study reflection or typing pattern cannot establish or rule out a health condition. Please speak with a qualified healthcare professional for an assessment. iFocus can help with study goals and pacing; it cannot confirm diagnoses or recommend medical treatment.' };
  if (concern === 'emotional') return { supportOnly: true, supportKind: concern, responseSource: 'safety',
    title: 'You deserve support and a pause',
    actionPlan: 'That sounds difficult to carry. Please pause studying and reach out to someone you trust, a school counselor, or a qualified mental health professional. You do not have to earn rest by completing work. Are you safe right now? In the Philippines, you can contact NCMH Crisis Hotline 1553 for emotional support, available 24/7. If you cannot stay safe or face immediate danger, call local emergency services (911 in the Philippines). Elsewhere, use your local support services.', contacts: [crisisContact] };
  if (concern === 'danger') return { supportOnly: true, supportKind: concern, responseSource: 'safety',
    title: 'Your immediate safety comes first',
    actionPlan: 'Please pause studying. If someone is hurting or threatening you, move to a safer place if you can do so safely and contact a trusted person who is not involved, such as a trusted adult or school safeguarding staff. Avoid confronting the person. If you might hurt someone, put distance between yourself and other people and anything that could cause harm, and seek urgent help. For immediate danger in the Philippines, call 911; elsewhere, use your local emergency service. You do not have to complete a study task before asking for help.', contacts: [emergencyContact] };
  if (concern === 'medical') return { supportOnly: true, supportKind: concern, responseSource: 'safety',
    title: 'Take care of your health first',
    actionPlan: 'Please pause studying and speak with a qualified healthcare professional about what you described. A study coach cannot assess symptoms, confirm a diagnosis, or advise on medication or doses. If you feel unwell, ask someone you trust to stay with you or help you get care. If symptoms are severe, sudden, worsening, or you feel in immediate danger, contact local emergency services (911 in the Philippines). You do not need to finish a focus session or BreakGate before seeking help.', contacts: [] };
  const urgent = concern === 'physical';
  return { supportOnly: true, supportKind: concern, responseSource: 'safety',
    title: urgent ? 'Pause studying and get medical help' : 'Rest and basic needs come first',
    actionPlan: urgent
      ? 'Please stop studying and seek urgent medical help now. Tell someone nearby whom you trust and ask them to stay with you and help you get care. For severe or ongoing bleeding, trouble breathing, chest pain, possible poisoning or overdose, or immediate danger, call 911 in the Philippines or go to the nearest emergency department. Do not drive yourself if you feel unwell. Outside the Philippines, use your local emergency number. You do not need to finish a study task or BreakGate first.'
      : 'Please pause studying now and take care of your basic needs. Make time for sleep, food, and water rather than pushing through a study challenge. Do not use extra medication, stimulants, alcohol, or more caffeine to force yourself to keep studying, and avoid driving if sleepy or impaired. You do not need to finish a focus session or BreakGate first. If you feel unwell or have been awake for a prolonged period, ask someone you trust to help you contact a qualified healthcare professional. For immediate danger, contact local emergency services.',
    contacts: urgent ? [emergencyContact] : [] };
}

// Shared by the browser, API, normalization and offline fallback before any plan.
export function generateSafetySupport(value, requested = false) {
  const text = String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const explicit = /\b(?:i (?:really |just )?(?:want|wanna|wish|plan|intend|need) (?:to )?(?:die|kill myself|end my life|hurt myself|harm myself)|i (?:am|feel|feeling) suicidal|im (?:feeling )?suicidal|i (?:dont|do not) want to (?:live|be alive)|i (?:might|will|may|am going to|am about to) (?:kill myself|hurt myself|end my life)|wish i (?:was|were) dead|gusto ko (?:na |nang |ng )?(?:mamatay|magpakamatay)|(?:ayoko|ayaw ko|di ko gusto|hindi ko gusto) (?:na |nang )?(?:mabuhay)|(?:sasaktan|papatayin) ko (?:ang )?sarili ko)\b/.test(text)
    || /^(?:suicidal|kill myself|self harm|magpakamatay)$/.test(text)
    || /\b(?:i (?:cant|cannot|can not) (?:keep myself|stay) safe|(?:everyone|they|my family) would be better off without me|i (?:want|plan) to end it all|i (?:just )?(?:cut|hurt|harmed) myself|sana (?:hindi|di) na ako magising|gusto ko (?:nang? )?mawala (?:na |nang )?(?:forever|tuluyan))\b/.test(text);
  if (!requested && !explicit) {
    const concern = physicalSafetyConcern(value);
    return concern ? physicalSupport(concern) : null;
  }
  return { supportOnly: true, supportKind: 'safety', responseSource: 'safety', title: 'Your safety comes first',
    actionPlan: 'Please pause studying. You deserve support with this. Please reach out now to a qualified mental health professional, school counselor, or doctor, and tell someone you trust what is happening. Are you safe right now? In the Philippines, NCMH Crisis Hotline 1553 offers 24/7 support. If you might act on these thoughts or have already hurt yourself, contact local emergency services (911 in the Philippines) or go to the nearest emergency department; ask someone you trust to stay with you and move away from anything you could use to hurt yourself. Outside the Philippines, use your local crisis or emergency service.',
    contacts: [emergencyContact, crisisContact] };
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
  const concern = safetyConcerns.includes(parsed?.safetyConcern) ? parsed.safetyConcern
    : safetyConcerns.includes(parsed?.supportKind) ? parsed.supportKind : null;
  const healthSupport = parsed?.healthSupport === true || parsed?.supportKind === 'health';
  const safety = generateSafetySupport(text, parsed?.supportOnly === true && !healthSupport && !concern);
  if (safety) return safety;
  if (concern) return physicalSupport(concern);
  if (typeof parsed?.safetyConcern === 'string' && parsed.safetyConcern.trim()) return physicalSupport('medical');
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
