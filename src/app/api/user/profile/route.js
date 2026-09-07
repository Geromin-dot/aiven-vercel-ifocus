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

    // Fetch user details from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        image: true,
        createdAt: true,
        _count: {
          select: {
            studySessions: true,
            decks: true,
            todos: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Calculate aggregated study session duration and completed tasks
    const completedTodos = await prisma.todo.count({
      where: { userId: userId, completed: true }
    });

    const sessionAggregates = await prisma.studySession.aggregate({
      where: { userId: userId },
      _sum: {
        duration: true
      }
    });

    const totalSeconds = sessionAggregates._sum.duration || 0;
    const focusHours = (totalSeconds / 3600).toFixed(1);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name || user.username || 'Focus User',
        username: user.username || user.email?.split('@')[0] || 'user',
        email: user.email,
        image: user.image || null,
        createdAt: user.createdAt
      },
      stats: {
        totalSessions: user._count.studySessions || 0,
        focusHours: parseFloat(focusHours) || 0,
        completedTasks: completedTodos,
        totalDecks: user._count.decks || 0,
        totalTodos: user._count.todos || 0
      }
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { name, username, image } = body;

    // Validate username if provided and changed
    if (username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username: username.trim(),
          NOT: { id: userId }
        }
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "Username is already taken by another account" },
          { status: 409 }
        );
      }
    }

    // Update user record
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(username !== undefined && { username: username.trim() }),
        ...(image !== undefined && { image: image })
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        image: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      message: "Profile updated successfully",
      user: updatedUser
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
