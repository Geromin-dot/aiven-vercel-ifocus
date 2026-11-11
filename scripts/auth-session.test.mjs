import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/app/api/auth/[...nextauth]/route.js', import.meta.url), 'utf8');
function authWith(userQueries, jobQueries = {}, { deleted = [], callbackUrl } = {}) {
  let loginNumber = 0;
  const context = vm.createContext({
    prisma: {
      user: userQueries, presencePushJob: jobQueries,
      deletedLoginIdentifier: { async findUnique({ where }) { return deleted.includes(where.digest) ? where : null; } },
    },
    process: { env: {} }, URL,
    deletedAccountDigest: identifier => identifier.trim().toLowerCase(),
    cookies: async () => ({ get: name => name === 'next-auth.callback-url' ? { value: callbackUrl } : undefined }),
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
  const token = await auth.callbacks.jwt({ token: { sub: 'student', sessionId: 'login-1' } });
  assert.equal(token.error, 'ACCOUNT_DELETED');
  assert.equal(token.sub, undefined);
  const session = await auth.callbacks.session({ token, session: { user: { name: 'Student' } } });
  assert.equal(session.error, 'ACCOUNT_DELETED');
  assert.equal(session.user, undefined);
});

test('deleted email and username show the deletion error until a new account exists', async () => {
  let user = null;
  const auth = authWith({ findFirst: async () => user }, {}, { deleted: ['old-user', 'old@example.com'] });
  const { authorize } = auth.providers[1];
  await assert.rejects(authorize({ email: ' Old-User ', password: 'correct' }), /ACCOUNT_DELETED/);
  await assert.rejects(authorize({ email: 'OLD@example.com', password: 'correct' }), /ACCOUNT_DELETED/);
  await assert.rejects(authorize({ email: 'unknown', password: 'correct' }), /Invalid credentials/);
  user = { id: 'new-account', password: 'hash', status: 'ACTIVE' };
  assert.equal((await authorize({ email: 'old-user', password: 'correct' })).id, 'new-account');
});

test('deleted Google accounts receive the notice and can explicitly register again', async () => {
  const deleted = ['old@example.com'];
  const user = { email: 'old@example.com' };
  const account = { provider: 'google' };
  const queries = { findUnique: async () => null };
  const signIn = authWith(queries, {}, { deleted }).callbacks.signIn;
  assert.equal(await signIn({ user, account }), '/login?error=ACCOUNT_DELETED');
  const register = authWith(queries, {}, { deleted, callbackUrl: 'https://example.com/dashboard?register=google' }).callbacks.signIn;
  assert.equal(await register({ user, account }), true);
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

test('AI verification follows the live account and is withheld when the lookup fails', async () => {
  let verificationStatus = 'VERIFIED';
  const auth = authWith({ async findUnique() {
    if (!verificationStatus) throw new Error('Database unavailable');
    return { id: 'student', status: 'ACTIVE', role: 'STUDENT', verificationStatus };
  } });
  const token = { sub: 'student', sessionId: 'login-1' };
  const session = async () => auth.callbacks.session({ session: { user: {} }, token: await auth.callbacks.jwt({ token }) });
  assert.equal((await session()).user.verificationStatus, 'VERIFIED');
  verificationStatus = 'PENDING';
  assert.equal((await session()).user.verificationStatus, 'PENDING');
  verificationStatus = null;
  assert.equal((await session()).user.verificationStatus, null);
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
