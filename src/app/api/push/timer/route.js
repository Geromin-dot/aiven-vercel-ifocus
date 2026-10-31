import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getPushConfig, presencePushService } from '../../../../lib/serverPush';
import { pushRouteAuth, pushJson } from '../../../../lib/pushRouteAuth';
import { validDeviceId } from '../../../../lib/presencePushPolicy';

export const runtime = 'nodejs';

export async function POST(req) {
  const { session, error } = await pushRouteAuth(req);
  if (error) return error;
  if (!getPushConfig().configured) return NextResponse.json({ configured: false });
  let body;
  try { body = await pushJson(req); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  if (!validDeviceId(body?.deviceId) || !Number.isSafeInteger(body.version) || body.version < Date.now() - 86400000 || body.version > Date.now() + 60000 ||
      !body.state || body.state.deviceId !== body?.deviceId || (body.state.userId && body.state.userId !== session.user.id)) {
    return NextResponse.json({ error: 'Invalid timer checkpoint' }, { status: 400 });
  }
  try {
    const subscription = await prisma.pushSubscription.findUnique({ where: { userId_deviceId: { userId: session.user.id, deviceId: body?.deviceId } } });
    if (!subscription) return NextResponse.json({ subscribed: false });
    // Use the authenticated login identity, never a client-supplied account/session.
    const result = await presencePushService.sync(subscription.id, body.state, body.preferences || {}, body.version, session.user.sessionId);
    return NextResponse.json({ configured: true, subscribed: true, ...result });
  } catch (error) {
    if (error.message === 'Invalid timer state') return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Could not schedule presence push:', error.message);
    return NextResponse.json({ error: 'Could not schedule background alert. Please try again.' }, { status: 503 });
  }
}
