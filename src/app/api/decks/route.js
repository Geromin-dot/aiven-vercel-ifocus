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

    // Create deck and its cards in a transaction
    const newDeck = await prisma.deck.create({
      data: {
        title: title.trim(),
        description: description ? description.trim() : null,
        userId: session.user.id,
        cards: {
          create: cards.map(c => ({
            front: c.front.trim(),
            back: c.back.trim()
          }))
        }
      },
      include: {
        cards: true
      }
    });

    return NextResponse.json(newDeck, { status: 201 });
  } catch (error) {
    console.error("Error creating deck:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
