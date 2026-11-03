import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/lib/gemini.js', import.meta.url), 'utf8');
let instance = 0;
const load = () => import(`data:text/javascript;base64,${Buffer.from(source + `\n// instance ${++instance}`).toString('base64')}`);

test('Quick Reflection can request a fresh response without the duplicate-prompt cache', async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.GEMINI_API_KEY;
  const previousKeys = process.env.GEMINI_API_KEYS;
  process.env.GEMINI_API_KEYS = 'test-key';
  let calls = 0;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ actionPlan: `Advice ${++calls}` }) }] } }] }) });
  try {
    const { callGemini } = await load();
    const request = { parts: [{ text: 'I am ready to study' }], generationConfig: { responseMimeType: 'application/json' } };
    await callGemini(request);
    await callGemini(request);
    assert.equal(calls, 1);
    assert.equal((await callGemini({ ...request, cache: false })).actionPlan, 'Advice 2');
    assert.equal((await callGemini({ ...request, cache: false })).actionPlan, 'Advice 3');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
    if (previousKeys === undefined) delete process.env.GEMINI_API_KEYS; else process.env.GEMINI_API_KEYS = previousKeys;
  }
});

test('the overall AI deadline bounds fallback attempts instead of multiplying the per-call timeout', async () => {
  const previousFetch = globalThis.fetch;
  const previousKeys = process.env.GEMINI_API_KEYS;
  process.env.GEMINI_API_KEYS = 'test-key';
  let calls = 0;
  globalThis.fetch = async (_, { signal }) => {
    calls++;
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  };
  try {
    const { callGemini } = await load();
    const start = Date.now();
    await assert.rejects(callGemini({ parts: [{ text: 'deadline test' }], timeoutMs: 5000, totalTimeoutMs: 30, maxRetries: 0, cache: false }));
    assert.ok(Date.now() - start < 500);
    assert.ok(calls <= 2);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKeys === undefined) delete process.env.GEMINI_API_KEYS; else process.env.GEMINI_API_KEYS = previousKeys;
  }
});

test('the AI deadline also covers a response body that stalls after headers arrive', async () => {
  const previousFetch = globalThis.fetch;
  const previousKeys = process.env.GEMINI_API_KEYS;
  process.env.GEMINI_API_KEYS = 'test-key';
  globalThis.fetch = async (_, { signal }) => ({
    ok: true,
    json: () => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Body stalled', 'AbortError')), { once: true })),
  });
  try {
    const { callGemini } = await load();
    const start = Date.now();
    await assert.rejects(callGemini({ parts: [{ text: 'stalled response' }], timeoutMs: 5000, totalTimeoutMs: 30, maxRetries: 0, cache: false }));
    assert.ok(Date.now() - start < 500);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKeys === undefined) delete process.env.GEMINI_API_KEYS; else process.env.GEMINI_API_KEYS = previousKeys;
  }
});
