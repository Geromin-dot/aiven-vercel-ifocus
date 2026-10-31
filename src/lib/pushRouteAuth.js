import { getServerSession } from 'next-auth';
import { authOptions } from '../app/api/auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

export async function pushRouteAuth(req) {
  if (req.method !== 'GET' && req.headers.get('origin') !== new URL(req.url).origin) {
    return { error: NextResponse.json({ error: 'Invalid request origin' }, { status: 403 }) };
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.error) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (session.user.status && session.user.status !== 'ACTIVE') return { error: NextResponse.json({ error: 'Account is not active' }, { status: 403 }) };
  return { session };
}

export async function pushJson(req) {
  const raw = await req.text();
  if (raw.length > 16384) throw new Error('Request too large');
  return JSON.parse(raw);
}
