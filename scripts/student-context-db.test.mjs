import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { PrismaClient } from '@prisma/client';

test('database enforces daily caps under concurrent requests and preserves identity/device data', { skip: process.env.IFOCUS_DB_TEST !== '1' }, async () => {
  const prisma = new PrismaClient();
  const userId = `ifocus-context-test-${randomUUID()}`;
  try {
    await prisma.user.create({ data: { id: userId, name: 'Temporary feature test' } });
    const source = await readFile(new URL('../src/lib/aiDailyUsage.js', import.meta.url), 'utf8');
    const context = vm.createContext({ prisma });
    vm.runInContext(source.replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '') + '\nglobalThis.reserve=reserveDailyAIRequest;', context);
    const reflection = await Promise.all(Array.from({ length: 17 }, () => context.reserve(userId, 'reflection')));
    const flashcards = await Promise.all(Array.from({ length: 8 }, () => context.reserve(userId, 'flashcards')));
    assert.equal(reflection.filter(result => result.allowed).length, 10);
    assert.equal(flashcards.filter(result => result.allowed).length, 3);
    const records = await prisma.aiDailyUsage.findMany({ where: { userId } });
    assert.deepEqual(records.map(record => [record.feature, record.count]).sort(), [['flashcards', 3], ['reflection', 10]]);
    const identities = await Promise.all(['Male', 'Female'].map(sex => prisma.user.updateMany({ where: { id: userId, sex: null }, data: { sex } })));
    assert.equal(identities.reduce((sum, result) => sum + result.count, 0), 1);
    await prisma.user.update({ where: { id: userId }, data: { studyDevice: 'mobile' } });
    await prisma.user.update({ where: { id: userId }, data: { studyDevice: 'both' } });
    assert.equal((await prisma.user.findUnique({ where: { id: userId } })).studyDevice, 'both');
  } finally {
    // Deletes only this test-created account; its usage/session children cascade.
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
