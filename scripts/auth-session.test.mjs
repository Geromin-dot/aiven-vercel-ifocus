import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/app/api/auth/[...nextauth]/route.js', import.meta.url), 'utf8');
function authWith(userQueries) {
  const context = vm.createContext({
    prisma: { user: userQueries }, process: { env: {} },
    console: { log() {}, error() {} }, randomUUID: () => 'new-session',
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

test('new login saves the session without a redundant account read', async () => {
  let writes = 0;
  const auth = authWith({
    async update({ where, data, select }) {
      writes++;
      assert.equal(where.id, 'student');
      assert.equal(data.currentSessionId, 'new-session');
      assert.equal(select.id, true);
      assert.equal(Object.keys(select).length, 1);
    },
    async findUnique() { assert.fail('account was already verified during sign-in'); },
  });
  const token = await auth.callbacks.jwt({ token: {}, user: { id: 'student', role: 'STUDENT', status: 'ACTIVE' } });
  assert.equal(token.sessionId, 'new-session');
  assert.equal(writes, 1);
});

test('subsequent session reads still reject concurrent logins and deleted users', async () => {
  const auth = authWith({ async findUnique() { return { id: 'student', currentSessionId: 'other-session' }; } });
  const token = await auth.callbacks.jwt({ token: { sub: 'student', sessionId: 'old-session' } });
  assert.equal(token.error, 'CONCURRENT_LOGIN');
  const deleted = authWith({ async findUnique() { return null; } });
  assert.equal(await deleted.callbacks.jwt({ token: { sub: 'student' } }), null);
});

test('subsequent session reads still refresh account restrictions', async () => {
  const auth = authWith({ async findUnique() {
    return { id: 'student', currentSessionId: 'active', status: 'ON_HOLD', statusReason: 'Review required', role: 'STUDENT' };
  } });
  const token = await auth.callbacks.jwt({ token: { sub: 'student', sessionId: 'active' } });
  assert.equal(token.status, 'ON_HOLD');
  assert.equal(token.statusReason, 'Review required');
});

test('a failed session write cannot issue a new login token', async () => {
  const auth = authWith({ async update() { throw new Error('Database unavailable'); } });
  await assert.rejects(auth.callbacks.jwt({ token: {}, user: { id: 'student' } }), /temporarily unavailable/);
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
