import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/app/api/ai/flashcards/route.js', import.meta.url), 'utf8');
const card = { tag: 'Definition', front: 'Mitosis', keyword: 'Cell division', back: 'Division into two daughter cells.' };

function endpoint({ env = { OPENAI_API_KEY: 'test-secret' }, fetch, reserveDailyAIRequest = async () => ({ allowed: true, limit: 3, used: 1 }), callGemini = () => assert.fail('Unexpected Gemini request') } = {}) {
  const context = vm.createContext({
    process: { env }, fetch, AbortSignal, console: { warn() {}, error() {}, info() {} }, callGemini, reserveDailyAIRequest,
    getServerSession: async () => ({ user: { id: 'student' } }), authOptions: {},
    canUseStudyAI: () => true, AI_VERIFICATION_MESSAGE: '',
    NextResponse: { json: (data, options = {}) => ({ data, status: options.status || 200, headers: options.headers }) },
  });
  vm.runInContext(source.replace(/^import .*;\r?\n/gm, '').replace('export const maxDuration', 'const maxDuration')
    .replace('export async function POST', 'async function POST') + '\nglobalThis.post = POST;', context);
  return body => context.post({ json: async () => body });
}

function completed(cards) {
  return Response.json({ status: 'completed', output: [
    { type: 'reasoning' },
    { type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ cards }) }] },
  ] });
}

test('daily flashcard cap blocks expensive work and malformed uploads consume no allowance', async () => {
  const post = endpoint({ fetch: () => assert.fail('must not call OpenAI'),
    reserveDailyAIRequest: async () => ({ allowed: false, limit: 3, used: 3 }) });
  assert.equal((await post({ type: 'text', text: 'Mitosis is cell division.' })).status, 429);
  const invalid = endpoint({ reserveDailyAIRequest: () => assert.fail('invalid input must not consume allowance') });
  assert.equal((await invalid({ type: 'text', text: 'a'.repeat(35001) })).status, 413);
  assert.equal((await invalid({ type: 'pdf', pdfBase64: 'a'.repeat(4 * 1024 * 1024 + 1) })).status, 413);
});

test('PDF uploads use OpenAI file input with one base64 prefix and preserve the card contract', async () => {
  for (const pdfBase64 of ['JVBERi0xLjQ=', 'data:application/pdf;base64,JVBERi0xLjQ=']) {
    const post = endpoint({ fetch: async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(options.headers.Authorization, 'Bearer test-secret');
      const payload = JSON.parse(options.body);
      assert.equal(payload.model, 'gpt-6-luna');
      assert.equal(payload.store, false);
      assert.equal(payload.input[0].content[0].type, 'input_file');
      assert.equal(payload.input[0].content[0].file_data, 'data:application/pdf;base64,JVBERi0xLjQ=');
      assert.equal(payload.text.format.strict, true);
      assert.match(payload.instructions, /Use only facts supported/);
      return completed([card]);
    } });
    const result = await post({ type: 'pdf', pdfBase64, cardCount: 5 });
    assert.equal(result.status, 200);
    assert.equal(result.headers['X-iFocus-AI-Provider'], 'openai');
    assert.equal(result.data.cards[0].front, card.front);
    assert.match(result.data.cards[0].id, /^gen-/);
  }
});

test('pasted notes use OpenAI text input and retain the existing input length bound', async () => {
  const post = endpoint({ fetch: async (_, options) => {
    const payload = JSON.parse(options.body);
    assert.equal(payload.input[0].content[0].type, 'input_text');
    assert.equal(payload.input[0].content[0].text.length, 35000);
    return completed([card]);
  } });
  assert.equal((await post({ type: 'text', text: 'a'.repeat(35000), cardCount: 'auto' })).status, 200);
});

test('Gemini remains available when the OpenAI key is absent', async () => {
  const post = endpoint({ env: {}, callGemini: async ({ parts }) => {
    assert.equal(parts[0].inlineData.data, 'JVBERi0xLjQ=');
    return [card];
  } });
  const result = await post({ type: 'pdf', pdfBase64: 'JVBERi0xLjQ=' });
  assert.equal(result.status, 200);
  assert.equal(result.headers['X-iFocus-AI-Provider'], 'gemini');
});

test('an empty or malformed card set does not turn into fabricated cards', async () => {
  for (const cards of [[], [null, { front: 'Term' }, { front: '', back: 'Answer' }]]) {
    const post = endpoint({ fetch: async () => completed(cards) });
    const result = await post({ type: 'text', text: 'Term is a definition that could trigger the old fallback.' });
    assert.equal(result.status, 400);
    assert.equal(result.data.cards, undefined);
  }
});

test('provider errors are actionable and do not expose credentials or provider response bodies', async () => {
  const post = endpoint({ fetch: async () => new Response('secret provider details', { status: 429 }) });
  const result = await post({ type: 'text', text: 'Mitosis is cell division.' });
  assert.equal(result.status, 500);
  assert.match(result.data.error, /try again/i);
  assert.doesNotMatch(result.data.error, /test-secret|secret provider details/);
});

test('incomplete and refused responses return errors without creating a deck', async () => {
  for (const response of [{ status: 'incomplete', output: [] }, {
    status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Unable to help' }] }],
  }]) {
    const post = endpoint({ fetch: async () => Response.json(response) });
    const result = await post({ type: 'pdf', pdfBase64: 'JVBERi0xLjQ=' });
    assert.equal(result.status, 500);
    assert.equal(result.data.cards, undefined);
  }
});

test('invalid inputs are rejected before calling either provider', async () => {
  const post = endpoint({ fetch: () => assert.fail('Invalid input reached OpenAI') });
  for (const body of [{ type: 'other' }, { type: 'pdf', pdfBase64: 123 }, { type: 'text', text: {} },
    { type: 'text', text: 'Mitosis is cell division.', cardCount: 100 }]) {
    assert.equal((await post(body)).status, 400);
  }
});
