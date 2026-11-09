import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { pruneReflectionTelemetry } from '@/lib/reflectionJournal';

export const maxDuration = 60;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const authorization = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || authorization.length !== expected.length || !timingSafeEqual(authorization, expected)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let after;
  let updated = 0;
  const now = Date.now();
  for (;;) {
    const users = await prisma.user.findMany({
      where: {
        ...(after ? { id: { gt: after } } : {}),
        OR: ['journalHistory', 'reflection_submission', 'reflectionText'].map(value => ({
          telemetryState: { contains: `"${value}` },
        })),
      },
      orderBy: { id: 'asc' },
      select: { id: true, telemetryState: true },
      take: 100,
    });
    if (!users.length) break;
    for (const user of users) {
      let telemetry;
      try { telemetry = JSON.parse(user.telemetryState); } catch { continue; }
      const retained = pruneReflectionTelemetry(telemetry, now);
      if (retained === telemetry) continue;
      // A concurrent sync prunes expired entries itself. Keep its newer state.
      const { count } = await prisma.user.updateMany({
        where: { id: user.id, telemetryState: user.telemetryState },
        data: { telemetryState: JSON.stringify(retained) },
      });
      updated += count;
    }
    after = users.at(-1).id;
  }
  return Response.json({ updated });
}
