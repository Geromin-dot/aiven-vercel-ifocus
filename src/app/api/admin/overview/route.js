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

    // High level metrics (Strictly filtered for registered Students, excluding Admin test accounts)
    const notAdmin = { NOT: { username: "adminUAnursing" } };
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalUsers,
      totalDecks,
      totalCards,
      totalSessions,
      aggregateDuration,
      todaySessionsCount,
      aggregateTodayDuration,
      studentsList
    ] = await Promise.all([
      prisma.user.count({
        where: notAdmin
      }),
      prisma.deck.count({
        where: {
          user: notAdmin
        }
      }),
      prisma.card.count({
        where: {
          deck: {
            user: notAdmin
          }
        }
      }),
      prisma.studySession.count({
        where: {
          user: notAdmin
        }
      }),
      prisma.studySession.aggregate({
        where: {
          user: notAdmin
        },
        _sum: {
          duration: true
        }
      }),
      prisma.studySession.count({
        where: {
          user: notAdmin,
          createdAt: { gte: startOfToday }
        }
      }),
      prisma.studySession.aggregate({
        where: {
          user: notAdmin,
          createdAt: { gte: startOfToday }
        },
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
          image: true,
          status: true,
          statusReason: true,
          statusUpdatedAt: true,
          verificationStatus: true,
          yearLevel: true,
          section: true,
          yearSection: true,
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
            }
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

    const todaySeconds = aggregateTodayDuration._sum.duration || 0;
    const todayHours = Math.floor(todaySeconds / 3600);
    const todayMins = Math.floor((todaySeconds % 3600) / 60);

    const formatDuration = (secs) => {
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      if (h > 0) return `${h}h ${m}m`;
      if (m > 0) return `${m} mins`;
      if (secs > 0) return `${secs}s`;
      return "0m";
    };

    const formattedStudents = studentsList.map((student) => {
      const studentTotalSeconds = student.studySessions.reduce(
        (sum, s) => sum + (s.duration || 0),
        0
      );
      const todaySessions = student.studySessions.filter(
        (s) => new Date(s.createdAt) >= startOfToday
      );
      const studentTodaySeconds = todaySessions.reduce(
        (sum, s) => sum + (s.duration || 0),
        0
      );

      return {
        id: student.id,
        name: student.name || "Anonymous Student",
        username: student.username || "n/a",
        email: student.email || "n/a",
        image: student.image || null,
        status: student.status || "ACTIVE",
        statusReason: student.statusReason || null,
        statusUpdatedAt: student.statusUpdatedAt || null,
        verificationStatus: student.verificationStatus || "PENDING",
        yearLevel: student.yearLevel || null,
        section: student.section || null,
        yearSection: student.yearSection || (student.yearLevel && student.section ? `${student.yearLevel} - ${student.section}` : student.yearLevel || student.section || null),
        createdAt: student.createdAt,
        decksCount: student._count.decks,
        sessionsCount: student._count.studySessions,
        todaySessionsCount: todaySessions.length,
        totalStudySeconds: studentTotalSeconds,
        todayStudySeconds: studentTodaySeconds,
        formattedStudyTime: formatDuration(studentTotalSeconds),
        formattedTodayStudyTime: formatDuration(studentTodaySeconds),
        completedTodos: student.todos.length,
        totalTodos: student._count.todos,
        decks: student.decks.map(d => ({
          id: d.id,
          title: d.title,
          cardsCount: d._count.cards,
          createdAt: d.createdAt
        })),
        recentSessions: student.studySessions.slice(0, 10).map(s => ({
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
        formattedTotalTime: totalHours > 0 ? `${totalHours} hrs ${totalMins} mins` : `${totalMins} mins`,
        todaySessions: todaySessionsCount,
        todayStudyHours: todayHours,
        todayStudyMinutes: todayMins,
        formattedTodayTime: todayHours > 0 ? `${todayHours} hrs ${todayMins} mins` : `${todayMins} mins`
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
