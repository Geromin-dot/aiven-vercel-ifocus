import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    
    const { id } = await params;
    
    // Ensure the todo belongs to the user
    const existingTodo = await prisma.todo.findUnique({
      where: { id }
    });

    if (!existingTodo || existingTodo.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
    }

    const updateData = {};
    if (body.text !== undefined) updateData.text = body.text;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.completed !== undefined) updateData.completed = body.completed;

    const todo = await prisma.todo.update({
      where: { id },
      data: updateData
    });
    return NextResponse.json(todo);
  } catch (error) {
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
    
    // Ensure the todo belongs to the user
    const existingTodo = await prisma.todo.findUnique({
      where: { id }
    });

    if (!existingTodo || existingTodo.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
    }

    await prisma.todo.delete({
      where: { id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
