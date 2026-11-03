import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/app/api/auth/[...nextauth]/route.js', import.meta.url), 'utf8');
function authWith(userQueries, jobQueries = {}) {
  let loginNumber = 0;
  const context = vm.createContext({
    prisma: { user: userQueries, presencePushJob: jobQueries }, process: { env: {} },
    console: { log() {}, error() {} }, randomUUID: () => `login-${++loginNumber}`,
    PrismaAdapter: () => ({}), GoogleProvider: options => options,
    CredentialsProvider: options => options, NextAuth: () => ({}),
    bcrypt: { compare: async (password, hash) => password === 'correct' && hash === 'hash' },
  });
  vm.runInContext(source.replace(/^import .*;\r?\n/gm, '')
    .replace('export const authOptions', 'const authOptions')
    .replace('export { handler as GET, handler as POST };', 'globalThis.auth = authOptions;'), context);
  return context.auth;
}

test('credential login loads only authentication fields and still checks password and account holds', async () => {
  let accountStatus = 'ACTIVE';
  const auth = authWith({ async findFirst({ select }) {
    assert.equal(select.password, true);
    assert.equal(select.currentSessionId, undefined);
    assert.equal(select.telemetryState, undefined);
    assert.equal(select.timerPreferences, undefined);
    return { id: 'student', password: 'hash', status: accountStatus };
  } });
  const provider = auth.providers[1];
  assert.equal((await provider.authorize({ email: 'student', password: 'correct' })).id, 'student');
  await assert.rejects(provider.authorize({ email: 'student', password: 'wrong' }), /Invalid credentials/);
  accountStatus = 'ON_HOLD';
  await assert.rejects(provider.authorize({ email: 'student', password: 'correct' }), /ACCOUNT_ON_HOLD/);
});

test('multiple devices keep separate valid sessions without updating the user record', async () => {
  const auth = authWith({
    async update() { assert.fail('login must not overwrite a shared currentSessionId'); },
    async findUnique({ select }) {
      assert.equal(select.currentSessionId, undefined);
      return { id: 'student', status: 'ACTIVE', role: 'STUDENT', currentSessionId: 'legacy-login' };
    },
  });
  const first = await auth.callbacks.jwt({ token: {}, user: { id: 'student', status: 'ACTIVE' } });
  const second = await auth.callbacks.jwt({ token: {}, user: { id: 'student', status: 'ACTIVE' } });
  assert.notEqual(first.sessionId, second.sessionId);
  assert.equal((await auth.callbacks.jwt({ token: first })).error, undefined);
  assert.equal((await auth.callbacks.jwt({ token: second })).error, undefined);
});

test('deleted users remain invalid even when multiple-device login is allowed', async () => {
  const auth = authWith({ async findUnique() { return null; } });
  assert.equal(await auth.callbacks.jwt({ token: { sub: 'student', sessionId: 'login-1' } }), null);
});

test('subsequent session reads still refresh account restrictions', async () => {
  const auth = authWith({ async findUnique() {
    return { id: 'student', currentSessionId: 'active', status: 'ON_HOLD', statusReason: 'Review required', role: 'STUDENT' };
  } });
  const token = await auth.callbacks.jwt({ token: { sub: 'student', sessionId: 'active' } });
  assert.equal(token.status, 'ON_HOLD');
  assert.equal(token.statusReason, 'Review required');
  assert.equal(await auth.callbacks.session({ token, session: { user: {} } }), null);
});

test('signout cancels only jobs belonging to this login, leaving another device active', async () => {
  let filter;
  const auth = authWith({}, { async updateMany({ where, data }) {
    filter = where;
    assert.equal(data.status, 'CANCELLED');
  } });
  await auth.events.signOut({ token: { sub: 'student', sessionId: 'phone-login' } });
  assert.equal(filter.authSessionId, 'phone-login');
  assert.equal(filter.subscription.userId, 'student');
});

test('a verified current session clears an old conflict marker', async () => {
  const auth = authWith({ async findUnique() {
    return { id: 'student', currentSessionId: 'active', status: 'ACTIVE', role: 'STUDENT' };
  } });
  const token = await auth.callbacks.jwt({ token: { sub: 'student', sessionId: 'active', error: 'CONCURRENT_LOGIN' } });
  assert.equal(token.error, undefined);
  const session = await auth.callbacks.session({ token, session: { user: {} } });
  assert.equal(session.user.id, 'student');
  assert.equal(session.error, undefined);
});
