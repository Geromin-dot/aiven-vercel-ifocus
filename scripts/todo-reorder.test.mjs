import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../src/app/api/todos/reorder/route.js', import.meta.url), 'utf8');
function harness() {
  let records = new Map([['a', { userId: 'student', orderIndex: 0 }], ['b', { userId: 'student', orderIndex: 1 }], ['foreign', { userId: 'other', orderIndex: 0 }]]);
  const context = vm.createContext({ authOptions: {}, getServerSession: async () => ({ user: { id: 'student' } }),
    NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) },
    prisma: { $transaction: async callback => {
      const staged = new Map([...records].map(([id, value]) => [id, { ...value }]));
      const result = await callback({ todo: { updateMany: async ({ where, data }) => {
        const record = staged.get(where.id);
        if (!record || record.userId !== where.userId) return { count: 0 };
        Object.assign(record, data);
        return { count: 1 };
      } } });
      records = staged;
      return result;
    } },
  });
  vm.runInContext(source.replace(/^import .*;\r?\n/gm, '').replace('export async function POST', 'async function POST') + '\nglobalThis.post = POST;', context);
  return { post: orderedIds => context.post({ json: async () => ({ orderedIds }) }), record: id => records.get(id) };
}

test('task order is persisted as the requested indices', async () => {
  const h = harness();
  assert.equal((await h.post(['b', 'a'])).status, 200);
  assert.equal(h.record('b').orderIndex, 0);
  assert.equal(h.record('a').orderIndex, 1);
});

test('missing/foreign tasks roll back the entire order instead of claiming success', async () => {
  const h = harness();
  assert.equal((await h.post(['b', 'foreign'])).status, 409);
  assert.equal(h.record('b').orderIndex, 1);
  assert.equal(h.record('foreign').orderIndex, 0);
  assert.equal((await h.post(['b', 'deleted'])).status, 409);
  assert.equal(h.record('b').orderIndex, 1);
});

test('duplicate IDs are rejected', async () => {
  assert.equal((await harness().post(['a', 'a'])).status, 400);
});
