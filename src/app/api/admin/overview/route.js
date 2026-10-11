import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "../../../../lib/prisma";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 }
      );
    }

    const isAdmin = session.user.role === "ADMIN" || session.user.username === "adminUAnursing";

    if (!isAdmin) {
      return NextResponse.json(
        { message: "Unauthorized: Administrator access required" },
        { status: 403 }
      );
    }

    // High level metrics
    const [
      totalUsers,
      totalDecks,
      totalCards,
      totalSessions,
      aggregateDuration,
      studentsList
    ] = await Promise.all([
      prisma.user.count({
        where: {
          NOT: {
            username: "adminUAnursing"
          }
        }
      }),
      prisma.deck.count(),
      prisma.card.count(),
      prisma.studySession.count(),
      prisma.studySession.aggregate({
        _sum: {
          duration: true
        }
      }),
      prisma.user.findMany({
        where: {
          NOT: {
            username: "adminUAnursing"
          }
        },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          createdAt: true,
          _count: {
            select: {
              decks: true,
              studySessions: true,
              todos: true
            }
          },
          studySessions: {
            select: {
              id: true,
              duration: true,
              score: true,
              createdAt: true
            },
            orderBy: {
              createdAt: "desc"
            },
            take: 10
          },
          todos: {
            where: { completed: true },
            select: { id: true }
          },
          decks: {
            select: {
              id: true,
              title: true,
              description: true,
              createdAt: true,
              _count: {
                select: {
                  cards: true
                }
              }
            },
            orderBy: {
              createdAt: "desc"
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      })
    ]);

    const totalSeconds = aggregateDuration._sum.duration || 0;
    const totalHours = Math.floor(totalSeconds / 3600);
    const totalMins = Math.floor((totalSeconds % 3600) / 60);

    const formattedStudents = studentsList.map((student) => {
      const studentTotalSeconds = student.studySessions.reduce(
        (sum, s) => sum + (s.duration || 0),
        0
      );
      const studentHours = Math.floor(studentTotalSeconds / 3600);
      const studentMinutes = Math.floor((studentTotalSeconds % 3600) / 60);

      let timeFormatted = "";
      if (studentHours > 0) {
        timeFormatted = `${studentHours}h ${studentMinutes}m`;
      } else if (studentMinutes > 0) {
        timeFormatted = `${studentMinutes} mins`;
      } else if (studentTotalSeconds > 0) {
        timeFormatted = `${studentTotalSeconds}s`;
      } else {
        timeFormatted = "0m";
      }

      return {
        id: student.id,
        name: student.name || "Anonymous Student",
        username: student.username || "n/a",
        email: student.email || "n/a",
        createdAt: student.createdAt,
        decksCount: student._count.decks,
        sessionsCount: student._count.studySessions,
        totalStudySeconds: studentTotalSeconds,
        formattedStudyTime: timeFormatted,
        completedTodos: student.todos.length,
        totalTodos: student._count.todos,
        decks: student.decks.map(d => ({
          id: d.id,
          title: d.title,
          cardsCount: d._count.cards,
          createdAt: d.createdAt
        })),
        recentSessions: student.studySessions.map(s => ({
          id: s.id,
          duration: s.duration,
          score: s.score,
          createdAt: s.createdAt
        }))
      };
    });

    return NextResponse.json({
      metrics: {
        totalStudents: totalUsers,
        totalDecks,
        totalCards,
        totalSessions,
        totalStudyHours: totalHours,
        totalStudyMinutes: totalMins,
        formattedTotalTime: totalHours > 0 ? `${totalHours} hrs ${totalMins} mins` : `${totalMins} mins`
      },
      students: formattedStudents
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    return NextResponse.json(
      { message: "Failed to load administration overview data", error: error.message },
      { status: 500 }
    );
  }
}
