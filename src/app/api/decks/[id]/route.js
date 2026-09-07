import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const deck = await prisma.deck.findFirst({
      where: {
        id: id,
        userId: session.user.id
      },
      include: {
        cards: true
      }
    });

    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    return NextResponse.json(deck);
  } catch (error) {
    console.error("Error fetching deck:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const deck = await prisma.deck.findFirst({
      where: {
        id: id,
        userId: session.user.id
      }
    });

    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    // Delete cards and deck (Prisma cascades onDelete)
    await prisma.card.deleteMany({
      where: { deckId: id }
    });

    await prisma.deck.delete({
      where: { id: id }
    });

    return NextResponse.json({ message: "Deck deleted successfully" });
  } catch (error) {
    console.error("Error deleting deck:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
