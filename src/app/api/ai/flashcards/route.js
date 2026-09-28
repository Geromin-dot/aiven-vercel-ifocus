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

    const isAutoCount = !cardCount || cardCount === 0 || cardCount === 'auto';
    const countPrompt = isAutoCount
      ? "comprehensively extract and generate flashcards covering ALL primary concepts, definitions, formulas, and enumerations found in the material (typically between 12 to 30 cards depending on document depth)."
      : `generate exactly ${cardCount} high-yield flashcards covering the most critical and testable concepts.`;

    const systemInstructions = `
You are an expert educational AI, cognitive mnemonic specialist, and active-recall test designer.
Your task is to analyze the provided educational material and ${countPrompt}

CRITICAL FLASHCARD & ENUMERATION RULES:
1. The "front" MUST ONLY be the term, core concept, formula name, or a concise, clear question. It MUST NOT give away the answer or definition.
2. The "keyword" (MANDATORY): Provide a short, punchy 1-4 word MEMORY ANCHOR or quick summary phrase that triggers instant recall (e.g. "Never Trust, Always Verify", "Cell Energy Factory", "Signed Data Token").
3. The "back" MUST contain the concise definition, key points, or formula. Keep it punchy, memorable, and clear (1-3 sentences max).
4. SMART ENUMERATIONS & LISTS (HIGH PRIORITY):
   - Whenever the notes contain lists, sequences, steps, or categories (e.g., '4 Principles of OOP', '5 Phases of SDLC', '7 OSI Layers', 'Types of Memory'):
   - Create a dedicated enumeration flashcard!
   - The "front" MUST explicitly ask for the list (e.g. "Enumerate the 4 Principles of OOP" or "List the 5 Phases of the Software Lifecycle").
   - The "back" MUST format each item with clear numbering and short summary on new lines:
     "1. Encapsulation (Bundling data and methods)\n2. Abstraction (Hiding complex implementation)\n3. Inheritance (Reusing class hierarchy)\n4. Polymorphism (Multiple forms for single interface)"
5. The "tag" MUST categorize the card: "Definition", "Enumeration", "Concept", "Formula", "Date", or "Fact".
6. If the material is messy or OCR-extracted, intelligently ignore formatting glitches, headers, or page numbers.

Return the output STRICTLY as a valid JSON array of objects with this schema:
[
  {
    "tag": "Definition",
    "front": "Term or Question",
    "keyword": "Quick Memory Hook / Key Concept",
    "back": "Clear and concise explanation or answer"
  }
]
`;

    let parts = [];

    if (type === 'pdf') {
      const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '').trim();
      parts.push({
        inlineData: {
          mimeType: "application/pdf",
          data: cleanBase64
        }
      });
      parts.push({
        text: `${systemInstructions}\n\nAnalyze the uploaded PDF document and generate flashcards according to the rules above.`
      });
    } else {
      const truncatedText = text.substring(0, 35000);
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
        tag: c.tag || (c.front && c.front.toLowerCase().includes('enumerate') ? 'Enumeration' : 'Concept'),
        front: c.front || 'Concept',
        keyword: c.keyword || '',
        back: c.back || 'Definition'
      }))
    });

  } catch (error) {
    console.error("AI Flashcard Generation Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
