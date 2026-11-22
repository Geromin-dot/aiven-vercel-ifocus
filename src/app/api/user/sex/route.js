import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { isSex } from '@/lib/sex';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.error) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!isSex(body?.sex)) return NextResponse.json({ error: 'Please select a sex option.' }, { status: 400 });
  try {
    // The conditional write prevents concurrent requests from replacing a saved choice.
    const result = await prisma.user.updateMany({
      where: { id: session.user.id, sex: null },
      data: { sex: body.sex },
    });
    if (!result.count) return NextResponse.json({ error: 'A sex is already saved. Refresh your profile.' }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Could not save your selection. Please try again.' }, { status: 503 });
  }
}
