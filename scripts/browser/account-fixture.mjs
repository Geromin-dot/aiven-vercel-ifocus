import { encode } from 'next-auth/jwt';

export async function accountFixture(context, initiallySignedIn = true, options = {}) {
  let authenticated = initiallySignedIn;
  let heldSession = null;
  let tasks = structuredClone(options.tasks || []);
  let orderFailure = Boolean(options.orderFailure);
  let savedOrder = [];
  const token = await encode({ secret: 'history-regression-test-secret', token: {
    sub: 'history-student', sessionId: 'history-login', name: 'History Student', role: 'STUDENT', status: 'ACTIVE',
  } });
  const cookie = `next-auth.session-token=${token}; Path=/; HttpOnly; SameSite=Lax`;
  if (authenticated) await context.addCookies([{ name: 'next-auth.session-token', value: token, url: 'http://127.0.0.1:3106', httpOnly: true }]);
  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const headers = { 'Cache-Control': 'no-store' };
    let data = {};
    if (path === '/api/auth/session') {
      if (heldSession) await heldSession;
      data = authenticated ? { user: { id: 'history-student', sessionId: 'history-login', name: 'History Student', role: 'STUDENT', status: 'ACTIVE', verificationStatus: options.verificationStatus ?? 'VERIFIED' }, expires: '2099-01-01T00:00:00Z' } : null;
    } else if (path === '/api/auth/csrf') data = { csrfToken: 'test-csrf' };
    else if (path === '/api/auth/signout') {
      authenticated = false;
      headers['Set-Cookie'] = 'next-auth.session-token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax';
      data = { url: 'http://127.0.0.1:3106/login' };
    } else if (path === '/api/auth/callback/credentials') {
      authenticated = true;
      headers['Set-Cookie'] = cookie;
      data = { url: 'http://127.0.0.1:3106/dashboard' };
    } else if (path === '/api/user/telemetry') data = { userId: 'history-student', telemetryState: {}, timerPreferences: {}, recoverableFocusSessions: [] };
    else if (path === '/api/push/subscription') data = { configured: false, subscribed: false };
    else if (path === '/api/study-sessions') data = { sessions: [] };
    else if (path === '/api/ai/coach') data = options.coachResponse || {};
    else if (path === '/api/todos/reorder') {
      if (orderFailure) { await route.fulfill({ status: 503, json: { error: 'Test save failure' } }); return; }
      savedOrder = route.request().postDataJSON().orderedIds;
      const byId = new Map(tasks.map(task => [task.id, task]));
      tasks = savedOrder.map(id => byId.get(id)).filter(Boolean);
      data = { success: true };
    }
    else if (path === '/api/todos') data = tasks;
    else if (path === '/api/decks') data = [];
    await route.fulfill({ json: data, headers });
  });
  return {
    savedOrder: () => savedOrder,
    setOrderFailure: value => { orderFailure = value; },
    expire: async () => { authenticated = false; await context.clearCookies(); },
    hold: () => { let release; heldSession = new Promise(resolve => { release = resolve; }); return () => { release(); heldSession = null; }; },
  };
}
