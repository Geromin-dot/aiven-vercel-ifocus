import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.error) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderedIds } = await req.json();
    if (!Array.isArray(orderedIds) || orderedIds.length > 500 || orderedIds.some(id => typeof id !== 'string' || !id.trim()) || new Set(orderedIds).size !== orderedIds.length) {
      return NextResponse.json({ error: 'Provide a unique list of task IDs.' }, { status: 400 });
    }

    // A missing/foreign/deleted task rolls back the entire order instead of
    // returning success after silently updating only part of the list.
    await prisma.$transaction(async tx => {
      for (const [index, id] of orderedIds.entries()) {
        const result = await tx.todo.updateMany({ where: { id, userId: session.user.id }, data: { orderIndex: index } });
        if (result.count !== 1) {
          const error = new Error('Your task list changed. Refresh it and retry saving the order.');
          error.code = 'TASK_LIST_CHANGED';
          throw error;
        }
      }
    }, { isolationLevel: 'Serializable' });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === 'TASK_LIST_CHANGED' || error.code === 'P2034' ? 409 : 500 });
  }
}
