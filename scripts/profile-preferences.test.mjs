import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const deviceSource = await read('src/lib/studyDevice.js');
const device = await import(`data:text/javascript;base64,${Buffer.from(deviceSource).toString('base64')}`);
const json = (body, options = {}) => ({ body, status: options.status || 200 });

test('email registration rejects a missing/invalid sex and saves the selected Male or Female value', async () => {
  const sex = await import(`data:text/javascript;base64,${Buffer.from(await read('src/lib/sex.js')).toString('base64')}`);
  let created;
  const context = vm.createContext({ ...sex, NextResponse: { json }, console: { log() {}, error() {} },
    bcrypt: { hash: async () => 'test-hash' }, prisma: { user: {
      findFirst: async () => null, findUnique: async () => null,
      create: async ({ data }) => { created = data; return { id: 'new-student', ...data }; },
    } },
  });
  const source = await read('src/app/api/auth/register/route.js');
  vm.runInContext(source.replace(/^import .*;\r?\n/gm, '').replace('export async function POST', 'async function POST') + '\nglobalThis.post=POST;', context);
  const details = { name: 'Test Student', username: 'student-test', email: 'student@example.test', password: 'test-password', yearLevel: '2nd Year' };
  const post = body => context.post({ json: async () => body });
  assert.equal((await post(details)).status, 400);
  assert.equal((await post({ ...details, sex: 'Woman' })).status, 400);
  for (const value of ['Male', 'Female']) {
    assert.equal((await post({ ...details, sex: value })).status, 201);
    assert.equal(created.sex, value);
    assert.equal(created.role, 'STUDENT');
  }
});

test('device preference can be changed repeatedly and profile updates cannot change saved sex', async () => {
  let user = { id: 'student', sex: 'Male', studyDevice: null, name: 'Student', _count: { studySessions: 0, decks: 0, todos: 0 } };
  let session = { user: { id: 'student', role: 'STUDENT' } };
  const context = vm.createContext({ ...device, console, authOptions: {}, studentYearLevel: () => '2nd Year',
    getServerSession: async () => session, NextResponse: { json }, prisma: {
      user: { findUnique: async ({ select }) => { assert.equal(select.studyDevice, true); return user; },
        update: async ({ data }) => { user = { ...user, ...data }; return user; } },
      todo: { count: async () => 0 }, studySession: { aggregate: async () => ({ _sum: { duration: 0 } }) },
    },
  });
  const source = await read('src/app/api/user/profile/route.js');
  vm.runInContext(source.replace(/^import .*;\r?\n/gm, '').replaceAll('export async function', 'async function') + '\nglobalThis.put=PUT;globalThis.get=GET;', context);
  const put = body => context.put({ json: async () => body });
  assert.equal((await put({ studyDevice: 'anything' })).status, 400);
  for (const studyDevice of ['mobile', 'pc', 'both']) {
    assert.equal((await put({ studyDevice, sex: 'Female' })).status, 200);
    assert.equal(user.sex, 'Male');
    assert.equal((await context.get({})).body.user.studyDevice, studyDevice);
  }
  session = null;
  assert.equal((await put({ studyDevice: 'mobile' })).status, 401);
  assert.equal((await context.get({})).status, 401);
});

test('admin overview returns the current self-reported device preference and sex', async () => {
  const count = async () => 0;
  const aggregate = async () => ({ _sum: { duration: 0 } });
  const context = vm.createContext({ console, NextResponse: { json }, authOptions: {},
    getServerSession: async () => ({ user: { role: 'ADMIN' } }),
    prisma: { user: { count, findMany: async ({ select }) => {
      assert.equal(select.studyDevice, true);
      assert.equal(select.sex, true);
      return [{ id: 'student', studyDevice: 'both', sex: 'Female', _count: { decks: 0, studySessions: 0, todos: 0 },
        studySessions: [], todos: [], decks: [] }];
    } }, deck: { count }, card: { count }, studySession: { count, aggregate } },
  });
  const source = await read('src/app/api/admin/overview/route.js');
  vm.runInContext(source.replace(/^import .*;\r?\n/gm, '').replace('export async function GET', 'async function GET') + '\nglobalThis.get=GET;', context);
  const result = await context.get({});
  assert.equal(result.status, 200);
  assert.equal(result.body.students[0].studyDevice, 'both');
  assert.equal(result.body.students[0].sex, 'Female');
});
