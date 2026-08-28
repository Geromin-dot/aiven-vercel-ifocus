import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI is not configured (Missing API Key)." }, { status: 500 });
    }

    const prompt = `
You are an AI study coach analyzing a student's reflection journal entry.

Student Reflection: "${text}"

Your job is to do TWO things:
1. Categorize the student's emotional state into EXACTLY ONE of the following FOUR categories: Stressed, Distracted, Motivated, or Engaged.
   - We trust the student's own reflection. If they express they are feeling stressed, anxious, tired, or overwhelmed, classify them as "Stressed".
2. Write a thoughtful, personalized 2-3 sentence action plan. Give them GENUINE, highly specific psychological advice, cognitive behavioral strategies, or study techniques tailored to the EXACT subject or worry they mentioned.

Reply STRICTLY in valid JSON format like this, without markdown blocks:
{
  "state": "Stressed",
  "actionPlan": "It's completely valid to feel exhausted. Let's take it easy and just knock out a small quick win to build momentum."
}
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
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
      actionPlan: parsed.actionPlan || "Keep up the great work!"
    });

  } catch (error) {
    console.error("AI Coach Route Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
