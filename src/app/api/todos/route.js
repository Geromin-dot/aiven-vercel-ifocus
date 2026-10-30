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

    let userId = session.user.id;
    if (!userId && session.user.email) {
      const u = await prisma.user.findUnique({ where: { email: session.user.email } });
      if (u) userId = u.id;
    }

    const todos = await prisma.todo.findMany({
      where: { userId },
      orderBy: [
        { orderIndex: 'asc' },
        { createdAt: 'desc' }
      ]
    });
    return NextResponse.json(todos);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (!body.text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    let userId = session.user.id;
    if (!userId && session.user.email) {
      const u = await prisma.user.findUnique({ where: { email: session.user.email } });
      if (u) userId = u.id;
    }

    const todo = await prisma.todo.create({
      data: {
        text: body.text,
        completed: false,
        priority: body.priority || 'medium',
        userId
      }
    });
    return NextResponse.json(todo);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
