import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch full user data tree
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        decks: {
          include: {
            cards: true,
            sessions: true
          }
        },
        studySessions: true,
        todos: true
      }
    });

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const exportPayload = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      user: {
        id: userData.id,
        name: userData.name,
        username: userData.username,
        email: userData.email,
        createdAt: userData.createdAt
      },
      stats: {
        totalDecks: userData.decks.length,
        totalCards: userData.decks.reduce((sum, d) => sum + d.cards.length, 0),
        totalStudySessions: userData.studySessions.length,
        totalTodos: userData.todos.length
      },
      decks: userData.decks,
      studySessions: userData.studySessions,
      todos: userData.todos
    };

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="ifocus_export_${userData.username || 'user'}_${new Date().toISOString().slice(0, 10)}.json"`
      }
    });
  } catch (error) {
    console.error("Error exporting user data:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
