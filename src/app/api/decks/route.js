import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decks = await prisma.deck.findMany({
      where: { userId: session.user.id },
      include: {
        cards: true,
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(decks);
  } catch (error) {
    console.error("Error fetching decks:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, description, cards } = await req.json();

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Deck title is required" }, { status: 400 });
    }

    if (!Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({ error: "At least one card is required to create a deck" }, { status: 400 });
    }

    // Sanitize cards to prevent any undefined, null, or missing property runtime crashes
    const sanitizedCards = cards
      .filter(c => c && (c.front || c.term || c.back || c.definition))
      .map(c => ({
        front: String(c.front || c.term || 'Untitled').trim(),
        back: String(c.back || c.definition || c.answer || 'No description').trim(),
        keyword: c.keyword || c.hint || null,
        tag: c.tag || 'Concept'
      }));

    if (sanitizedCards.length === 0) {
      return NextResponse.json({ error: "No valid cards provided to create deck" }, { status: 400 });
    }

    // Create deck and its cards in a transaction
    const newDeck = await prisma.deck.create({
      data: {
        title: title.trim(),
        description: description ? description.trim() : null,
        userId: session.user.id,
        cards: {
          create: sanitizedCards.map(c => ({
            front: c.front,
            back: c.back
          }))
        }
      },
      include: {
        cards: true
      }
    });

    // Persist keyword and tag into Card table safely
    for (let i = 0; i < newDeck.cards.length; i++) {
      const createdCard = newDeck.cards[i];
      const orig = sanitizedCards[i] || {};
      const kw = orig.keyword;
      const tg = orig.tag;
      if (kw || tg) {
        try {
          await prisma.$executeRawUnsafe(
            'UPDATE "Card" SET keyword = $1, tag = $2 WHERE id = $3;',
            kw, tg, createdCard.id
          );
          createdCard.keyword = kw;
          createdCard.tag = tg;
        } catch (e) {
          console.warn("Could not save card keyword metadata:", e);
        }
      }
    }

    return NextResponse.json(newDeck, { status: 201 });
  } catch (error) {
    console.error("Error creating deck:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
