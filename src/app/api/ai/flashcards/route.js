import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { callGemini } from '@/lib/gemini';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in to generate flashcards." }, { status: 401 });
    }

    const { type, text, pdfBase64, cardCount = 8 } = await request.json();

    if (type === 'pdf' && !pdfBase64) {
      return NextResponse.json({ error: "Please upload a valid PDF document." }, { status: 400 });
    }

    if (type === 'text' && (!text || !text.trim())) {
      return NextResponse.json({ error: "Please provide notes or text to generate flashcards." }, { status: 400 });
    }

    const systemInstructions = `
You are an expert educational AI and cognitive learning specialist.
Your task is to analyze the provided educational material and generate exactly ${cardCount} high-quality, high-yield flashcards.

CRITICAL FLASHCARD RULES:
1. The "front" MUST ONLY be the term, core concept, formula name, or a concise, clear question. It MUST NOT give away the answer or definition.
2. The "back" MUST contain the concise definition, solution, key points, or formula. Keep it punchy, memorable, and clear (1-3 sentences max).
3. The "tag" MUST categorize the card: "Definition", "Concept", "Formula", "Date", or "Fact".
4. GROUP ENUMERATIONS: If the material contains a list or sequence, ask for the list on the front (e.g. "Stages of Mitosis") and list the items on the back using newline breaks.
5. If the material is messy or OCR-extracted, intelligently ignore formatting glitches, headers, or page numbers.

Return the output STRICTLY as a valid JSON array of objects with this schema:
[
  {
    "tag": "Definition",
    "front": "Term or Question",
    "back": "Clear and concise explanation or answer"
  }
]
`;

    let parts = [];

    if (type === 'pdf') {
      // Clean base64 string if it includes data URL prefix
      const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '').trim();
      parts.push({
        inlineData: {
          mimeType: "application/pdf",
          data: cleanBase64
        }
      });
      parts.push({
        text: `${systemInstructions}\n\nAnalyze the uploaded PDF document and generate ${cardCount} flashcards according to the rules above.`
      });
    } else {
      // Truncate text to avoid token limits on free tier (approx 30,000 characters)
      const truncatedText = text.substring(0, 30000);
      parts.push({
        text: `${systemInstructions}\n\nMaterial to study:\n"""\n${truncatedText}\n"""`
      });
    }

    const flashcards = await callGemini({
      parts,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    });

    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      return NextResponse.json({ error: "AI could not extract flashcards from this material. Please try with more detailed text." }, { status: 400 });
    }

    return NextResponse.json({
      cards: flashcards.map((c, index) => ({
        id: `gen-${Date.now()}-${index}`,
        tag: c.tag || 'Concept',
        front: c.front || 'Concept',
        back: c.back || 'Definition'
      }))
    });

  } catch (error) {
    console.error("AI Flashcard Generation Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
