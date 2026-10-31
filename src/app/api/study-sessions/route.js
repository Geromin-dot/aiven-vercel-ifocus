import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "../../../lib/prisma";
import { recordVerifiedFocus } from '../../../lib/focusRecording';

// GET /api/study-sessions - Fetch current user's study sessions & aggregates
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.error) {
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

// Only server-observed elapsed time may create a new focus record.
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.error) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    if (session.user.status && session.user.status !== 'ACTIVE') return NextResponse.json({ message: 'Account is not active' }, { status: 403 });
    const body = await req.json();
    const inputs = Array.isArray(body.batch) ? body.batch : [body];
    if (!inputs.length || inputs.length > 50) return NextResponse.json({ message: 'Invalid batch size' }, { status: 400 });
    const normalize = item => ({ ...item,
      duration: item.durationSeconds ?? (body.batch && item.type === 'pomodoro' ? Number(item.duration) * 60 : item.duration),
    });
    let records;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        records = await prisma.$transaction(async tx => {
          const saved = [];
          for (const item of inputs) saved.push(await recordVerifiedFocus(tx, session.user.id, normalize(item)));
          return saved;
        }, { isolationLevel: 'Serializable' });
        break;
      } catch (error) {
        if (error.code === 'P2034' && attempt < 2) continue;
        throw error;
      }
    }
    return NextResponse.json(body.batch ? { success: true, count: records.length, sessions: records } : { success: true, session: records[0] });
  } catch (error) {
    if (!error.code) return NextResponse.json({ message: error.message || 'Could not verify focus time' }, { status: 422 });
    console.error('POST /api/study-sessions error:', error.message);
    return NextResponse.json({ message: 'Could not save study time. Please try again.' }, { status: 503 });
  }
}
