import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const source = await readFile(new URL('../src/lib/credentialsLogin.js', import.meta.url), 'utf8');
const { createCredentialsLogin } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const reply = (data, ok = true) => ({ ok, json: async () => data });

test('preparing login gets CSRF once; submitting avoids provider discovery and session reload', async () => {
  const calls = [];
  const login = createCredentialsLogin(async (url, options) => {
    calls.push(url);
    assert.equal(options.credentials, 'same-origin');
    if (url === '/api/auth/csrf') return reply({ csrfToken: 'csrf-test' });
    assert.equal(options.body.get('csrfToken'), 'csrf-test');
    assert.equal(options.body.get('callbackUrl'), '/dashboard');
    assert.equal(options.body.get('email'), 'student');
    assert.equal(options.body.get('password'), 'password');
    return reply({ url: 'https://example.com/dashboard' });
  });
  await Promise.all([login.prepare(), login.prepare()]);
  const result = await login.submit('student', 'password');
  assert.deepEqual(calls, ['/api/auth/csrf', '/api/auth/callback/credentials']);
  assert.deepEqual(result, { ok: true, url: '/dashboard' });
});

test('double submission shares one login request and cannot replace its session twice', async () => {
  let posts = 0;
  let resolve;
  const delayed = new Promise(done => { resolve = done; });
  const login = createCredentialsLogin(async url => {
    if (url === '/api/auth/csrf') return reply({ csrfToken: 'csrf-test' });
    posts++;
    await delayed;
    return reply({ url: '/dashboard' });
  });
  const first = login.submit('student', 'password');
  const second = login.submit('student', 'password');
  assert.equal(first, second);
  resolve();
  await Promise.all([first, second]);
  assert.equal(posts, 1);
});

test('invalid credentials and account holds remain actionable and allow retry', async () => {
  let error = 'CredentialsSignin';
  const login = createCredentialsLogin(async url => url === '/api/auth/csrf'
    ? reply({ csrfToken: 'csrf-test' })
    : reply({ url: `/api/auth/error?error=${encodeURIComponent(error)}` }, false));
  assert.equal((await login.submit('student', 'wrong')).error, 'CredentialsSignin');
  error = 'ACCOUNT_ON_HOLD:Review required';
  assert.equal((await login.submit('student', 'password')).error, error);
});

test('failed preparation and expired CSRF can be retried without a false success', async () => {
  let csrfCount = 0;
  let expire = true;
  const login = createCredentialsLogin(async url => {
    if (url === '/api/auth/csrf') {
      csrfCount++;
      if (csrfCount === 1) throw new Error('Offline');
      return reply({ csrfToken: 'csrf-test' });
    }
    return reply({ url: expire ? '/api/auth/signin?csrf=true' : '/dashboard' });
  });
  await assert.rejects(login.prepare(), /Offline/);
  await assert.rejects(login.submit('student', 'password'), /expired/);
  expire = false;
  assert.equal((await login.submit('student', 'password')).ok, true);
  assert.equal(csrfCount, 3);
});

test('login protocol works with the installed NextAuth handler and creates a readable session', async () => {
  const require = createRequire(import.meta.url);
  const { AuthHandler } = require('../node_modules/next-auth/core/index.js');
  const CredentialsProvider = require('next-auth/providers/credentials').default;
  const cookies = new Map();
  let authorized = 0;
  const options = {
    secret: 'isolated-test-secret-for-nextauth-protocol',
    logger: { error() {}, warn() {}, debug() {} },
    session: { strategy: 'jwt' },
    providers: [CredentialsProvider({
      async authorize(credentials) {
        authorized++;
        return credentials.password === 'correct' ? { id: 'student', name: 'Test Student' } : null;
      },
    })],
  };
  const request = async (path, init = {}) => {
    const parts = path.split('/').filter(Boolean);
    const result = await AuthHandler({ options, req: {
      action: parts[2], providerId: parts[3], method: init.method || 'GET',
      headers: { host: 'localhost:3000' }, query: {},
      cookies: Object.fromEntries(cookies), body: init.body ? Object.fromEntries(init.body) : {},
    } });
    for (const cookie of result.cookies || []) cookies.set(cookie.name, cookie.value);
    return { ok: (result.status || 200) < 400, json: async () => result.redirect ? { url: result.redirect } : result.body };
  };
  const login = createCredentialsLogin(request);
  assert.equal((await login.submit('student', 'correct')).ok, true);
  assert.equal(authorized, 1);
  assert.ok(cookies.get('next-auth.session-token'));
  const session = await (await request('/api/auth/session')).json();
  assert.equal(session.user.name, 'Test Student');

  const rejected = await request('/api/auth/callback/credentials', {
    method: 'POST', body: new URLSearchParams({ email: 'student', password: 'correct', csrfToken: 'invalid', callbackUrl: '/dashboard', json: 'true' }),
  });
  assert.match((await rejected.json()).url, /csrf=true/);
  assert.equal(authorized, 1, 'invalid CSRF must never reach password verification');

  const csrf = await (await request('/api/auth/csrf')).json();
  await request('/api/auth/signout', {
    method: 'POST', body: new URLSearchParams({ csrfToken: csrf.csrfToken, callbackUrl: '/login', json: 'true' }),
  });
  const signedOutSession = await (await request('/api/auth/session')).json();
  assert.equal(signedOutSession?.user, undefined, 'after signout the same cookie jar must no longer authenticate');
});
