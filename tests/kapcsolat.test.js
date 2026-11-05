import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler, { validate, looksLikeBot } from '../api/kapcsolat.js';

const jo = { nev: 'Kovács Anna', telefon: '30 123 4567', email: '', kor: '6 éves', program: 'mozaik', ok: ['szorongas', 'xss'], uzenet: 'Szia <b>', hivas: 'delutan', adatkezeles: true, t: String(Date.now() - 60000) };

function fakeRes() {
  return { statusCode: 0, headers: {}, body: '', setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } };
}

test('validálás: jó adat átmegy, ismeretlen ok kiesik', () => {
  const { data, errors } = validate(jo);
  assert.deepEqual(errors, []);
  assert.deepEqual(data.okok, ['szorongas']);
  assert.equal(data.program, 'mozaik');
});

test('validálás: hiányzó név, elérhetőség, hozzájárulás', () => {
  const { errors } = validate({ kor: '5' });
  assert.ok(errors.includes('nev') && errors.includes('elerhetoseg') && errors.includes('adatkezeles'));
});

test('bot-szűrés: honeypot és túl gyors kitöltés', () => {
  assert.equal(looksLikeBot({ weboldal: 'spam.com' }), true);
  assert.equal(looksLikeBot({ t: String(Date.now()) }), true);
  assert.equal(looksLikeBot(jo), false);
});

test('handler: ment a Supabase-be és e-mailt küld', async () => {
  process.env.SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  process.env.RESEND_API_KEY = 'r';
  process.env.NOTIFY_EMAIL = 'a@b.hu';
  const calls = [];
  globalThis.fetch = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return { ok: true, text: async () => '' }; };
  const res = fakeRes();
  await handler({ method: 'POST', body: jo }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls[0].url, 'https://x.supabase.co/rest/v1/kapcsolat_uzenetek');
  assert.equal(calls[0].body.nev, 'Kovács Anna');
  assert.equal(calls[1].url, 'https://api.resend.com/emails');
  assert.match(calls[1].body.html, /Szia &lt;b&gt;/);
});

test('handler: hibás adatra 422, GET-re 405', async () => {
  let res = fakeRes(); await handler({ method: 'POST', body: { nev: '' } }, res); assert.equal(res.statusCode, 422);
  res = fakeRes(); await handler({ method: 'GET' }, res); assert.equal(res.statusCode, 405);
});

test('handler: ha a Supabase hibázik, de az e-mail megy, akkor is ok', async () => {
  globalThis.fetch = async (url) => (url.includes('supabase') ? { ok: false, status: 500, text: async () => 'x' } : { ok: true, text: async () => '' });
  const res = fakeRes(); await handler({ method: 'POST', body: jo }, res);
  assert.equal(res.statusCode, 200);
});
