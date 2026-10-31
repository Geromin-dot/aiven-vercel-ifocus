import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getPushConfig, sendWebPush } from '../../../../lib/serverPush';
import { pushRouteAuth, pushJson } from '../../../../lib/pushRouteAuth';
import { validDeviceId } from '../../../../lib/presencePushPolicy';

export const runtime = 'nodejs';

export async function POST(req) {
  const { session, error } = await pushRouteAuth(req);
  if (error) return error;
  if (!getPushConfig().configured) return NextResponse.json({ error: 'Background notifications need server setup' }, { status: 503 });
  let body;
  try { body = await pushJson(req); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  if (!validDeviceId(body?.deviceId)) return NextResponse.json({ error: 'Invalid device' }, { status: 400 });
  try {
    const subscription = await prisma.pushSubscription.findUnique({ where: { userId_deviceId: { userId: session.user.id, deviceId: body?.deviceId } } });
    if (!subscription) return NextResponse.json({ error: 'Enable background notifications first' }, { status: 404 });
    const claim = await prisma.pushSubscription.updateMany({ where: { id: subscription.id,
      OR: [{ lastTestAt: null }, { lastTestAt: { lt: new Date(Date.now() - 15000) } }] }, data: { lastTestAt: new Date() } });
    if (!claim.count) return NextResponse.json({ error: 'Please wait 15 seconds before testing again' }, { status: 429 });
    await sendWebPush(subscription, { type: 'IFOCUS_PUSH_TEST', title: 'iFocus Background Notification Test',
      body: 'Server push is connected. Presence alerts can reach this device while the app is in the background.', tag: 'ifocus-push-test' });
    return NextResponse.json({ sent: true });
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      await prisma.pushSubscription.deleteMany({ where: { userId: session.user.id, deviceId: body?.deviceId } });
      return NextResponse.json({ error: 'This subscription expired. Enable background notifications again.' }, { status: 410 });
    }
    return NextResponse.json({ error: 'Background test failed. Please check server push setup.' }, { status: 503 });
  }
}
