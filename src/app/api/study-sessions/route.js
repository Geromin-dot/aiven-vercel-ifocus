import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "../../../lib/prisma";

// GET /api/study-sessions - Fetch current user's study sessions & aggregates
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Authentication required" }, { status: 401 });
    }

    let user = null;
    if (session.user.id) {
      user = await prisma.user.findUnique({ where: { id: session.user.id } });
    }
    if (!user && session.user.email) {
      user = await prisma.user.findUnique({ where: { email: session.user.email } });
    }
    if (!user && session.user.username) {
      user = await prisma.user.findUnique({ where: { username: session.user.username } });
    }

    if (!user) {
      return NextResponse.json({ sessions: [], stats: { totalSessions: 0, totalSeconds: 0, avgScore: 0 } });
    }

    const userId = user.id;
    const studySessions = await prisma.studySession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        deck: {
          select: { id: true, title: true }
        }
      }
    });

    const aggregates = await prisma.studySession.aggregate({
      where: { userId },
      _sum: { duration: true },
      _count: { id: true },
      _avg: { score: true }
    });

    return NextResponse.json({
      sessions: studySessions,
      stats: {
        totalSessions: aggregates._count.id || 0,
        totalSeconds: aggregates._sum.duration || 0,
        avgScore: Math.round(aggregates._avg.score || 0)
      }
    });
  } catch (error) {
    console.error("GET /api/study-sessions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/study-sessions - Save single session or sync batch from client
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Authentication required" }, { status: 401 });
    }

    let user = null;
    if (session.user.id) {
      user = await prisma.user.findUnique({ where: { id: session.user.id } });
    }
    if (!user && session.user.email) {
      user = await prisma.user.findUnique({ where: { email: session.user.email } });
    }
    if (!user && session.user.username) {
      user = await prisma.user.findUnique({ where: { username: session.user.username } });
    }

    if (!user) {
      return NextResponse.json({ sessions: [], stats: { totalSessions: 0, totalSeconds: 0, avgScore: 0 } });
    }

    const userId = user.id;
    const body = await req.json();
    const { duration, score, deckId, batch } = body;

    // Helper: find or create default deck so deckId foreign key is always satisfied
    async function getOrCreateDeck(prefDeckId) {
      if (prefDeckId) {
        const found = await prisma.deck.findUnique({ where: { id: prefDeckId } });
        if (found) return found.id;
      }
      let userDeck = await prisma.deck.findFirst({ where: { userId } });
      if (!userDeck) {
        userDeck = await prisma.deck.create({
          data: {
            title: "General Focus Sessions",
            description: "Default deck for Pomodoro focus time tracking",
            userId
          }
        });
      }
      return userDeck.id;
    }

    // Support batch sync (e.g. from localStorage history)
    if (Array.isArray(batch) && batch.length > 0) {
    const targetDeckId = await getOrCreateDeck(deckId);
      const createdList = [];

      for (const item of batch) {
        const rawDur = parseInt(item.duration) || 0;
        // If minutes from legacy local storage history (item.type === 'pomodoro' and <= 180), convert to seconds
        const durSec = (item.type === 'pomodoro' && rawDur <= 180) ? rawDur * 60 : rawDur;
        if (durSec > 0) {
          const itemDate = item.date ? new Date(item.date) : new Date();
          const existing = await prisma.studySession.findFirst({
            where: {
              userId,
              duration: durSec,
              createdAt: {
                gte: new Date(itemDate.getTime() - 3000),
                lte: new Date(itemDate.getTime() + 3000)
              }
            }
          });
          if (!existing) {
            const itemDeckId = item.deckId || targetDeckId;
            const created = await prisma.studySession.create({
              data: {
                userId,
                deckId: itemDeckId,
                duration: durSec,
                score: typeof item.score === "number" ? item.score : 100,
                createdAt: itemDate
              }
            });
            createdList.push(created);
          }
        }
      }

      return NextResponse.json({ success: true, count: createdList.length });
    }

    // Single session record (duration is sent by client in exact SECONDS)
    const rawDur = parseInt(duration) || 0;
    const durSec = rawDur;
    if (durSec <= 0) {
      return NextResponse.json({ message: "Duration must be greater than 0" }, { status: 400 });
    }

    const targetDeckId = await getOrCreateDeck(deckId);

    const newSession = await prisma.studySession.create({
      data: {
        userId,
        deckId: targetDeckId,
        duration: durSec,
        score: typeof score === "number" ? score : 100,
        createdAt: new Date()
      }
    });

    return NextResponse.json({ success: true, session: newSession });
  } catch (error) {
    console.error("POST /api/study-sessions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
