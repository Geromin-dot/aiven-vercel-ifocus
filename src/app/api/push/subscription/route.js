import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getPushConfig } from '../../../../lib/serverPush';
import { pushRouteAuth, pushJson } from '../../../../lib/pushRouteAuth';
import { validDeviceId, validatePushSubscription } from '../../../../lib/presencePushPolicy';

export const runtime = 'nodejs';

export async function GET(req) {
  const { session, error } = await pushRouteAuth(req);
  if (error) return error;
  const config = getPushConfig();
  if (!config.configured) return NextResponse.json({ configured: false, subscribed: false });
  const deviceId = new URL(req.url).searchParams.get('deviceId');
  try {
    const subscription = validDeviceId(deviceId) ? await prisma.pushSubscription.findUnique({
      where: { userId_deviceId: { userId: session.user.id, deviceId } },
      select: { id: true, job: { select: { scheduledAt: true, status: true } } },
    }) : null;
    return NextResponse.json({ configured: true, publicKey: config.publicKey, subscribed: !!subscription,
      scheduled: subscription?.job?.status === 'PENDING' && !!subscription.job.scheduledAt });
  } catch {
    return NextResponse.json({ configured: false, subscribed: false, setupRequired: true });
  }
}

export async function POST(req) {
  const { session, error } = await pushRouteAuth(req);
  if (error) return error;
  if (!getPushConfig().configured) return NextResponse.json({ error: 'Background notifications need server setup' }, { status: 503 });
  let body;
  try { body = await pushJson(req); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  if (!validDeviceId(body?.deviceId) || !validatePushSubscription(body.subscription)) {
    return NextResponse.json({ error: 'Invalid push subscription' }, { status: 400 });
  }
  const { endpoint, keys } = body.subscription;
  try {
    // A browser can change accounts. Remove its previous account binding and queued job.
    await prisma.$transaction(async tx => {
      await tx.pushSubscription.deleteMany({ where: { endpoint, OR: [
        { userId: { not: session.user.id } }, { deviceId: { not: body?.deviceId } },
      ] } });
      const existing = await tx.pushSubscription.findUnique({ where: { userId_deviceId: { userId: session.user.id, deviceId: body?.deviceId } } });
      if (existing && existing.endpoint !== endpoint) await tx.presencePushJob.deleteMany({ where: { subscriptionId: existing.id } });
      await tx.pushSubscription.upsert({ where: { userId_deviceId: { userId: session.user.id, deviceId: body?.deviceId } },
        create: { userId: session.user.id, deviceId: body?.deviceId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
        update: { endpoint, p256dh: keys.p256dh, auth: keys.auth } });
    });
    return NextResponse.json({ subscribed: true });
  } catch {
    return NextResponse.json({ error: 'Could not save subscription. Check server database setup.' }, { status: 503 });
  }
}

export async function DELETE(req) {
  const { session, error } = await pushRouteAuth(req);
  if (error) return error;
  let body;
  try { body = await pushJson(req); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  if (!validDeviceId(body?.deviceId)) return NextResponse.json({ error: 'Invalid device' }, { status: 400 });
  await prisma.pushSubscription.deleteMany({ where: { userId: session.user.id, deviceId: body?.deviceId } });
  return NextResponse.json({ subscribed: false });
}
