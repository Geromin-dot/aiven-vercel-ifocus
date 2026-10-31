import { NextResponse } from 'next/server';
import { callGemini } from '@/lib/gemini';
import { reflectionInputError } from '@/lib/reflectionInput';

function generateCognitiveFallback(rawText, tasks = []) {
  const text = (rawText || '').toLowerCase();
  
  // 1. Detect state from sentiment
  let state = "Engaged";
  if (
    text.includes('stress') || 
    text.includes('tired') || 
    text.includes('exhaust') || 
    text.includes('anxious') || 
    text.includes('overwhelm') || 
    text.includes('fail') || 
    text.includes('drain') || 
    text.includes('hard') || 
    text.includes('pressure')
  ) {
    state = "Stressed";
  } else if (
    text.includes('distract') || 
    text.includes('bore') || 
    text.includes('scroll') || 
    text.includes('phone') || 
    text.includes('lazy') || 
    text.includes('procrastinat')
  ) {
    state = "Distracted";
  } else if (
    text.includes('motivat') || 
    text.includes('ready') || 
    text.includes('energ') || 
    text.includes('excite') || 
    text.includes('win') || 
    text.includes('let\'s go')
  ) {
    state = "Motivated";
  }

  // 2. Intelligent task reordering
  const orderedIds = [];
  if (Array.isArray(tasks) && tasks.length > 0) {
    const taskPool = [...tasks];
    
    // Check if user explicitly mentioned a task name
    const explicitIdx = taskPool.findIndex(t => t.text && text.includes(t.text.toLowerCase().trim()));
    if (explicitIdx !== -1) {
      orderedIds.push(taskPool[explicitIdx].id);
      taskPool.splice(explicitIdx, 1);
    }

    if (state === "Stressed") {
      // Gentle momentum: Low priority first, then Medium, then High
      const low = taskPool.filter(t => t.priority === 'Low');
      const med = taskPool.filter(t => t.priority === 'Medium');
      const high = taskPool.filter(t => t.priority === 'High' || !t.priority);
      [...low, ...med, ...high].forEach(t => orderedIds.push(t.id));
    } else if (state === "Motivated" || state === "Engaged") {
      // Peak performance: High priority first, then Medium, then Low
      const high = taskPool.filter(t => t.priority === 'High');
      const med = taskPool.filter(t => t.priority === 'Medium' || !t.priority);
      const low = taskPool.filter(t => t.priority === 'Low');
      [...high, ...med, ...low].forEach(t => orderedIds.push(t.id));
    } else {
      // Distracted: Concrete structured tasks first
      taskPool.forEach(t => orderedIds.push(t.id));
    }
  }

  // 3. Adaptive session targeting (strictly 1 to 5) & Duration
  let targetSessions = 4;
  let workMinutes = 25;
  let breakMinutes = 5;

  if (state === "Stressed") {
    targetSessions = 2;
    workMinutes = 15;
    breakMinutes = 5;
  } else if (state === "Distracted") {
    targetSessions = 3;
    workMinutes = 20;
    breakMinutes = 5;
  } else if (state === "Motivated") {
    targetSessions = 4;
    workMinutes = 50;
    breakMinutes = 10;
  } else {
    targetSessions = 4;
    workMinutes = 25;
    breakMinutes = 5;
  }

  // Check if student explicitly requested a specific number of sessions
  const sessionMatch = text.match(/(\d+)\s*(?:session|sessions|round|rounds|cycle|cycles)/i);
  if (sessionMatch) {
    const requested = parseInt(sessionMatch[1], 10);
    if (!isNaN(requested)) {
      targetSessions = Math.min(5, Math.max(1, requested));
    }
  }

  // Check if student explicitly requested duration in minutes
  const minMatch = text.match(/(\d+)\s*(?:min|minute|minutes|m\b)/i);
  if (minMatch) {
    const requestedMin = parseInt(minMatch[1], 10);
    if (!isNaN(requestedMin) && requestedMin >= 5 && requestedMin <= 120) {
      workMinutes = requestedMin;
      breakMinutes = requestedMin >= 50 ? 10 : 5;
    }
  }

  // 4. Human-like action plan
  let actionPlan = "I've structured your focus tasks. Let's take it one step at a time with clear focus blocks.";
  if (state === "Stressed") {
    actionPlan = `I hear that you're feeling some friction and stress right now. I've adjusted your plan to a gentle ${workMinutes}-minute focus block with ${targetSessions} short sessions and lighter tasks first to build effortless momentum. You've got this!`;
  } else if (state === "Distracted") {
    actionPlan = `Distractions happen—the key is lowering friction. I've lined up structured, bite-sized tasks across ${targetSessions} focused sessions with a strict ${workMinutes}-minute Pomodoro timer. Close other tabs and let's tackle task #1.`;
  } else if (state === "Motivated") {
    actionPlan = `Love the high energy! I've placed your highest-impact task right at the top and scheduled ${targetSessions} deep work sessions (${workMinutes}m each) to capitalize on your mental clarity.`;
  } else {
    actionPlan = `Solid mindset. I've prioritized your tasks and set a steady ${targetSessions}-session flow state (${workMinutes}m focus). Lock in for a productive study session!`;
  }

  return { state, orderedIds, targetSessions, workMinutes, breakMinutes, actionPlan };
}

export async function POST(request) {
  let body = {};
  try {
    const raw = await request.text();
    if (raw && raw.trim()) {
      body = JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Could not parse request body as JSON:", err);
  }

  const { text, tasks } = body;
  const userText = (text && typeof text === 'string') ? text.trim() : '';
  const inputError = reflectionInputError(userText);
  if (inputError) return NextResponse.json({ error: inputError }, { status: 422 });

  try {
    const taskListStr = tasks && tasks.length > 0 
      ? tasks.map(t => `${t.id}: ${t.text} (Priority: ${t.priority || 'Normal'})`).join('\n')
      : "No active tasks.";

    const prompt = `
You are an empathetic, insightful human study coach & cognitive performance mentor.
Analyze the student's reflection or question: "${userText}"

If the input is only a greeting, random letters, or has no understandable reflection or study request, do not invent an emotional state or a plan. Return only {"needsContext":true}. Do not treat typing speed or a greeting as evidence of motivation.

Current Tasks from Student:
${taskListStr}

Your mission:
1. Categorize emotional state into EXACTLY ONE: "Stressed", "Distracted", "Motivated", or "Engaged".
2. Task Ordering:
   - If tasks are provided, order them logically:
     - Honor explicit student intent first (e.g., if they ask to start with a specific subject, put it first).
     - When Stressed: ease in with lower-friction tasks first to build momentum.
     - When Motivated/Engaged: put the heaviest, highest-impact tasks first during peak alertness.
     - When Distracted: place concrete, structured, bite-sized tasks first.
   - If no tasks are provided, return orderedIds: [].
3. Session & Rhythm Adaptation:
   - targetSessions: Recommend target study sessions as an integer strictly between 1 (lowest) and 5 (highest):
     - 1 or 2 sessions when Stressed (low barrier, gentle sprint to prevent burnout)
     - 3 sessions when Distracted (structured interval pacing)
     - 4 or 5 sessions when Motivated / Engaged (extended deep-work stamina block)
     - If the student explicitly specifies a number of sessions or time commitment, adapt to their wish (clamped between 1 and 5).
   - workMinutes & breakMinutes:
     - Stressed: workMinutes = 15, breakMinutes = 5
     - Distracted: workMinutes = 20, breakMinutes = 5
     - Engaged: workMinutes = 25, breakMinutes = 5
     - Motivated: workMinutes = 50, breakMinutes = 10 (or 25/5 if student mentions shorter duration)
     - If the student explicitly specifies minutes (e.g. "25 min", "15m", "30 mins"), honor that exact duration for workMinutes.
4. Action Plan / Coaching Advice:
   - Provide 2-3 warm, human-like sentences of real study advice tailored directly to their input.
   - Mention the adjusted session structure naturally.
   - CRITICAL: DO NOT constantly tell the student to "do flashcards" or "review flashcards" as a generic default! A real human coach gives diverse, practical strategies (e.g., tackling deep problem sets or heavy analytical reading when energetic; diaphragmatic breathing, hydration, or a brief physical reset when stressed; the 5-minute rule or eliminating tab clutter when distracted; Feynman explanation or practice testing when reviewing). Only mention flashcards if the student specifically asks about flashcards or has a flashcard task in their list.

Reply STRICTLY in valid JSON format:
{
  "state": "Stressed",
  "orderedIds": ["<id_1>", "<id_2>"],
  "targetSessions": 2,
  "workMinutes": 15,
  "breakMinutes": 5,
  "actionPlan": "Empathetic, human-like study advice here..."
}
`;

    const parsed = await callGemini({
      parts: [{ text: prompt }],
      preferredModel: 'gemini-2.5-flash',
      timeoutMs: 25000,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    });

    if (parsed?.needsContext === true) {
      return NextResponse.json({ error: 'Please describe how you feel or what you want to study so the coach has enough context.' }, { status: 422 });
    }
    if (parsed && typeof parsed === 'object' && parsed.actionPlan) {
      const parsedSessions = parseInt(parsed.targetSessions, 10);
      const safeSessions = (!isNaN(parsedSessions) && parsedSessions >= 1 && parsedSessions <= 5)
        ? parsedSessions
        : (parsed.state === "Stressed" ? 2 : parsed.state === "Distracted" ? 3 : 4);

      const parsedWork = parseInt(parsed.workMinutes, 10);
      const safeWork = (!isNaN(parsedWork) && parsedWork >= 5 && parsedWork <= 180)
        ? parsedWork
        : (parsed.state === "Stressed" ? 15 : parsed.state === "Distracted" ? 20 : parsed.state === "Motivated" ? 50 : 25);

      const parsedBreak = parseInt(parsed.breakMinutes, 10);
      const safeBreak = (!isNaN(parsedBreak) && parsedBreak >= 1 && parsedBreak <= 60)
        ? parsedBreak
        : (safeWork >= 50 ? 10 : 5);

      return NextResponse.json({
        state: parsed.state || "Engaged",
        orderedIds: Array.isArray(parsed.orderedIds) ? parsed.orderedIds : [],
        targetSessions: safeSessions,
        workMinutes: safeWork,
        breakMinutes: safeBreak,
        actionPlan: parsed.actionPlan
      });
    }

    // If Gemini parsed output wasn't complete, fall back gracefully
    const fallback = generateCognitiveFallback(userText, tasks);
    return NextResponse.json(fallback);

  } catch (error) {
    console.warn("AI Coach Gemini call failed, using cognitive fallback:", error.message);
    const fallback = generateCognitiveFallback(userText, tasks);
    return NextResponse.json(fallback);
  }
}
