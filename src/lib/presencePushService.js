import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { planPresencePush, presencePushPayload } from './presencePushPolicy.js';

export function jobToken(secret, subscriptionId, generation) {
  return createHmac('sha256', secret).update(`ifocus-presence:${subscriptionId}:${generation}`).digest('hex');
}

export function verifyJobToken(secret, subscriptionId, generation, authorization) {
  if (!secret || typeof subscriptionId !== 'string' || typeof generation !== 'string' || subscriptionId.length > 100 || generation.length > 100) return false;
  const expected = Buffer.from(`Bearer ${jobToken(secret, subscriptionId, generation)}`);
  const received = Buffer.from(authorization || '');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function createPresencePushService({ db, publish, send, now = Date.now }) {
  async function sync(subscriptionId, state, prefs, version, authSessionId) {
    const plan = planPresencePush(state, prefs, now());
    let job;
    // Serialize updates from Start/Pause/Continue and ignore delayed requests.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        job = await db.$transaction(async tx => {
          const existing = await tx.presencePushJob.findUnique({ where: { subscriptionId } });
          if (existing && existing.version > version) return null;
          const unchanged = existing && (plan
            ? existing.checkId === plan.checkId && Number(existing.dueAt) === Number(plan.dueAt) && existing.authSessionId === authSessionId
            : existing.status === 'CANCELLED');
          if (unchanged) return tx.presencePushJob.update({ where: { subscriptionId }, data: { version } });
          const data = { generation: randomUUID(), version, authSessionId,
            timerSessionId: plan?.timerSessionId || null, checkId: plan?.checkId || null,
            dueAt: plan?.dueAt || null, remainingSeconds: plan?.remainingSeconds || 0,
            status: plan ? 'PENDING' : 'CANCELLED', scheduledAt: null, leaseUntil: null, deliveredAt: null };
          return tx.presencePushJob.upsert({ where: { subscriptionId },
            create: { subscriptionId, ...data }, update: data });
        }, { isolationLevel: 'Serializable' });
        break;
      } catch (error) {
        if (error.code !== 'P2034' || attempt === 2) throw error;
      }
    }
    if (!job || job.status !== 'PENDING') return { scheduled: false };
    if (job.scheduledAt) return { scheduled: true };
    await publish(job);
    await db.presencePushJob.updateMany({ where: { subscriptionId, generation: job.generation, status: 'PENDING' }, data: { scheduledAt: new Date(now()) } });
    return { scheduled: true };
  }

  async function deliver(subscriptionId, generation) {
    const job = await db.presencePushJob.findUnique({ where: { subscriptionId }, include: { subscription: { include: { user: { select: { status: true, currentSessionId: true } } } } } });
    if (!job || job.generation !== generation || job.status !== 'PENDING') return { skipped: true };
    const subscription = job.subscription;
    const user = subscription.user;
    if (user.status !== 'ACTIVE' || !job.authSessionId || user.currentSessionId !== job.authSessionId || now() - Number(job.dueAt) > 15 * 60000) {
      await db.presencePushJob.updateMany({ where: { subscriptionId, generation }, data: { status: 'CANCELLED' } });
      return { skipped: true };
    }
    if (Number(job.dueAt) > now() + 1000) throw new Error('Presence check is not due yet');
    const claimed = await db.presencePushJob.updateMany({ where: { subscriptionId, generation, status: 'PENDING',
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date(now()) } }] }, data: { leaseUntil: new Date(now() + 45000) } });
    if (!claimed.count) throw new Error('Push delivery is already in progress');
    try {
      await send(subscription, presencePushPayload(job));
      await db.presencePushJob.updateMany({ where: { subscriptionId, generation },
        data: { status: 'DELIVERED', deliveredAt: new Date(now()), leaseUntil: null } });
      return { delivered: true };
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await db.pushSubscription.deleteMany({ where: { id: subscriptionId, endpoint: subscription.endpoint } });
        return { expired: true };
      }
      await db.presencePushJob.updateMany({ where: { subscriptionId, generation, status: 'PENDING' }, data: { leaseUntil: null } });
      throw error; // Let QStash retry transient delivery failures.
    }
  }
  return { sync, deliver };
}
