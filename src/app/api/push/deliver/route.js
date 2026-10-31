import { NextResponse } from 'next/server';
import { getPushConfig, presencePushService } from '../../../../lib/serverPush';
import { verifyJobToken } from '../../../../lib/presencePushService';
import { pushJson } from '../../../../lib/pushRouteAuth';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req) {
  let body;
  try { body = await pushJson(req); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const config = getPushConfig();
  if (!verifyJobToken(config.secret, body?.subscriptionId, body?.generation, req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!config.configured) return NextResponse.json({ error: 'Server push is not configured' }, { status: 503 });
  try {
    return NextResponse.json(await presencePushService.deliver(body?.subscriptionId, body?.generation));
  } catch (error) {
    console.error('Presence push delivery failed:', error.message);
    return NextResponse.json({ error: 'Delivery will be retried' }, { status: 503 });
  }
}
