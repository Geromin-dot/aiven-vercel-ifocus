import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { text, tasks } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI is not configured (Missing API Key)." }, { status: 500 });
    }
    
    const taskListStr = tasks && tasks.length > 0 
      ? tasks.map(t => `${t.id}: ${t.text} (Priority: ${t.priority})`).join('\n')
      : "No active tasks.";

    const prompt = `
You are an empathetic, human-like AI study coach & cognitive strategist analyzing a student's daily reflection and task list.

Student Reflection: "${text}"

Current Tasks:
${taskListStr}

Your mission is to think like an expert human mentor and do THREE things:
1. Categorize the student's emotional state into EXACTLY ONE category: "Stressed", "Distracted", "Motivated", or "Engaged".
   - Trust the student's authentic self-reflection (if they feel anxious, tired, stressed, drained, or overwhelmed -> "Stressed"; if driven, energized, excited -> "Motivated"; if wandering, restless -> "Distracted"; if focused, calm -> "Engaged").

2. Determine the optimal, human-tailored order for the tasks:
   - **First Priority - Explicit Student Intent:** If the student explicitly expresses a preference or request (e.g., "start with math", "let me do the medium task first", "I want to finish Filipino today", "let's do biology first"), ALWAYS respect and honor their request by placing that task at the top!
   - **Semantic Task & Real-World Difficulty Analysis:** Evaluate what each task actually demands from a human being (e.g., writing a 10-page research paper, analyzing complex literature, or solving advanced math/science is heavy cognitive load; quick flashcard review, organizing a desk, or physical activity like dance/stretching are low-friction quick wins and energizing resets).
   - **Adaptive Coaching Sequencing:**
     - *Stressed / Exhausted / Anxious:* If no specific task was requested, prioritize low-cognitive-friction or active resets first to build gentle dopamine and momentum, pushing intimidating high-cognitive tasks to later.
     - *Motivated / Engaged:* If no specific task was requested, place the most challenging, high-impact cognitive tasks first during peak mental focus.
     - *Distracted:* Prioritize concrete, structured, bite-sized active tasks with clear boundaries.

3. Write a warm, encouraging, 2-3 sentence action plan:
   - Acknowledge their exact reflection and any specific subject or preference they mentioned.
   - Conversationally explain why you sequenced the tasks this way and offer a supportive, practical study technique (e.g., Pomodoro warm-up, Feynman technique, active recall, brain dump).

Reply STRICTLY in valid JSON format like this:
{
  "state": "Stressed",
  "orderedIds": ["<id_1>", "<id_2>", "<id_3>"],
  "actionPlan": "I hear that you want to start with math first to warm up! We'll tackle math with a gentle focus block..."
}
(Make sure orderedIds contains the exact 'id' strings from Current Tasks, containing ALL task IDs in the recommended order.)
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API Error:", errText);
      return NextResponse.json({ error: "Failed to generate AI response: " + errText }, { status: response.status });
    }

    const data = await response.json();
    let aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    // Safety fallback in case it still wraps in markdown
    aiText = aiText.replace(/```json/gi, '').replace(/```/gi, '').trim();
    const parsed = JSON.parse(aiText);

    return NextResponse.json({
      state: parsed.state || "Engaged",
      orderedIds: parsed.orderedIds || [],
      actionPlan: parsed.actionPlan || "Keep up the great work!"
    });

  } catch (error) {
    console.error("AI Coach Route Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
