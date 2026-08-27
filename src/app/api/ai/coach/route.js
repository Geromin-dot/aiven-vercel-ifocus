import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text } = await req.json();
    if (!text || text.trim() === "") {
      return NextResponse.json({ error: "Reflection text is required" }, { status: 400 });
    }

    // Simulated AI Processing Delay to feel authentic
    await new Promise(resolve => setTimeout(resolve, 1800));

    // Simulated AI Response based on keywords
    let response = "That's a great start. Taking a moment to reflect is the first step toward better focus. Let's break this down into smaller, manageable chunks and tackle it one Pomodoro at a time.";
    
    const lowerText = text.toLowerCase();
    if (lowerText.includes("distracted") || lowerText.includes("focus")) {
      response = "It sounds like you're struggling with distractions right now. I recommend using the Pomodoro timer on your left. Put your phone in another room and commit to just 25 minutes of unbroken focus on one single task.";
    } else if (lowerText.includes("tired") || lowerText.includes("sleep") || lowerText.includes("exhausted")) {
      response = "Fatigue is the enemy of productivity. If you're feeling this tired, pushing harder won't help. Hydrate, stretch, or take a 15-minute power nap before continuing.";
    } else if (lowerText.includes("overwhelmed") || lowerText.includes("too much") || lowerText.includes("stress")) {
      response = "When everything feels overwhelming, your brain panics. Let's dump all those tasks into your To-Do list, prioritize them, and only look at the very top item. You can do this.";
    } else if (lowerText.includes("procrastinat")) {
      response = "Procrastination usually comes from feeling overwhelmed by a task. Make the first step incredibly small—so small it feels silly to fail. What's a 2-minute action you can take right now?";
    }

    return NextResponse.json({ 
      feedback: response
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
