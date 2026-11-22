import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { AI_DAILY_LIMITS, aiUsageDay } from '@/lib/aiDailyUsage';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.error) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  try {
    const day = aiUsageDay();
    const records = await prisma.aiDailyUsage.findMany({ where: { userId: session.user.id, day } });
    const usage = Object.fromEntries(Object.entries(AI_DAILY_LIMITS).map(([feature, limit]) => {
      const used = records.find(record => record.feature === feature)?.count || 0;
      return [feature, { used, limit, remaining: Math.max(0, limit - used) }];
    }));
    return NextResponse.json({ day, usage }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load AI usage.' }, { status: 503 });
  }
}
