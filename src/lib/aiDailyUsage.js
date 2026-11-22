import { prisma } from './prisma';

export const AI_DAILY_LIMITS = { reflection: 10, flashcards: 3 };

export function aiUsageDay(now = Date.now()) {
  return new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function reserveDailyAIRequest(userId, feature) {
  const limit = AI_DAILY_LIMITS[feature];
  if (!limit) throw new Error('Unknown AI feature.');
  const day = aiUsageDay();
  // One atomic conditional upsert keeps simultaneous tabs/devices within the daily limit.
  const rows = await prisma.$queryRaw`
    INSERT INTO "AiDailyUsage" ("userId", "feature", "day", "count")
    VALUES (${userId}, ${feature}, ${day}, 1)
    ON CONFLICT ("userId", "feature", "day") DO UPDATE
      SET "count" = "AiDailyUsage"."count" + 1
      WHERE "AiDailyUsage"."count" < ${limit}
    RETURNING "count"
  `;
  return { allowed: rows.length > 0, limit, used: rows[0]?.count ?? limit, day };
}
