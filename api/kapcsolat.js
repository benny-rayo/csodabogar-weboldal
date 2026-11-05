// Vercel Serverless Function: POST /api/kapcsolat
// A kapcsolati űrlap üzenetét elmenti a Supabase-be, és értesítő e-mailt küld Margarétának (Resend).
//
// Környezeti változók (Vercel > Project > Settings > Environment Variables):
//   SUPABASE_URL                 pl. https://abcd1234.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    Supabase > Project Settings > API > service_role (TITKOS, csak szerveren!)
//   RESEND_API_KEY               opcionális: e-mail értesítéshez (resend.com)
//   NOTIFY_EMAIL                 kinek menjen az értesítő, pl. tataifejlesztes@gmail.com
//   FROM_EMAIL                   feladó, pl. "Csodabogár weboldal <uzenet@csodabogar.hu>" (ellenőrzött domain kell)
//
// Nincs külső csomag: a Supabase REST API-t és a Resend API-t sima fetch-csel hívjuk.

const PROGRAMOK = {
  'nem-tudom': 'Még nem tudja, segítsünk választani',
  'egyeni-fejlesztes': 'Egyéni fejlesztés',
  'iskolaelokeszites': 'Iskolaelőkészítő',
  'mozaik': 'MOZAIK szorongásoldó műhely',
  'meresz-macska': 'Merész Macska',
  'kutyas-foglalkozasok': 'Kutyás foglalkozások Zafírral',
  'baratsagtabor': 'Barátságtábor',
  'szulokonzultacio': 'Szülőkonzultáció',
};
const OKOK = {
  'olvasas-iras': 'olvasás, írás', 'figyelem': 'figyelem, koncentráció', 'szorongas': 'szorongás, félelmek',
  'baratkozas': 'barátkozás, beilleszkedés', 'iskolaerettseg': 'iskolaérettség', 'viselkedes': 'viselkedés', 'egyeb': 'egyéb',
};
const HIVAS = { delelott: 'délelőtt', delutan: 'délután', mindegy: 'mindegy' };

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function reply(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (raw.length > 20000) throw new Error('too_large');
  return JSON.parse(raw || '{}');
}

export function validate(b) {
  const data = {
    nev: str(b.nev, 120),
    telefon: str(b.telefon, 40),
    email: str(b.email, 160).toLowerCase(),
    gyermek_kora: str(b.kor, 80),
    program: PROGRAMOK[b.program] ? b.program : 'nem-tudom',
    okok: Array.isArray(b.ok) ? b.ok.filter((x) => OKOK[x]).slice(0, 10) : [],
    uzenet: str(b.uzenet, 4000),
    hivas_idopont: HIVAS[b.hivas] ? b.hivas : 'mindegy',
    hozzajarulas: b.adatkezeles === true,
    oldal: str(b.oldal, 200),
  };
  const errors = [];
  if (!data.nev) errors.push('nev');
  if (!data.gyermek_kora) errors.push('kor');
  if (!data.telefon && !data.email) errors.push('elerhetoseg');
  if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(data.email)) errors.push('email');
  if (data.telefon && !/^[0-9+()\s/.-]{6,40}$/.test(data.telefon)) errors.push('telefon');
  if (!data.hozzajarulas) errors.push('adatkezeles');
  return { data, errors };
}

export function looksLikeBot(b, now = Date.now()) {
  if (str(b.weboldal, 200)) return true;               // honeypot mező kitöltve
  const t = Number(b.t);
  if (Number.isFinite(t) && t > 0 && now - t < 2500) return true; // 2,5 mp-nél gyorsabb kitöltés
  return false;
}

async function saveToSupabase(data) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('supabase_env_missing');
  const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/kapcsolat_uzenetek`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(`supabase_${r.status}: ${(await r.text()).slice(0, 300)}`);
}

async function notifyByEmail(data) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  const from = process.env.FROM_EMAIL || 'Csodabogár weboldal <onboarding@resend.dev>';
  if (!key || !to) return false;
  const sor = (k, v) => (v ? `<tr><td style="padding:4px 12px 4px 0;color:#6b5a4e;vertical-align:top">${k}</td><td style="padding:4px 0"><strong>${esc(v)}</strong></td></tr>` : '');
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#3B2416">
    <h2 style="color:#143C8C;margin:0 0 12px">Új üzenet a weboldalról</h2>
    <table>${sor('Név', data.nev)}${sor('Telefon', data.telefon)}${sor('E-mail', data.email)}${sor('Gyermek kora', data.gyermek_kora)}
    ${sor('Program', PROGRAMOK[data.program])}${sor('Mi miatt', data.okok.map((o) => OKOK[o]).join(', '))}${sor('Mikor hívható', HIVAS[data.hivas_idopont])}</table>
    ${data.uzenet ? `<p style="margin:16px 0 4px;color:#6b5a4e">Üzenet:</p><p style="white-space:pre-wrap;margin:0">${esc(data.uzenet)}</p>` : ''}
  </div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to: to.split(',').map((s) => s.trim()), subject: `Új jelentkezés: ${data.nev} (${PROGRAMOK[data.program]})`,
      html, ...(data.email ? { reply_to: data.email } : {}),
    }),
  });
  if (!r.ok) throw new Error(`resend_${r.status}: ${(await r.text()).slice(0, 300)}`);
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return reply(res, 405, { ok: false }); }
  let body;
  try { body = await readBody(req); } catch { return reply(res, 400, { ok: false, uzenet: 'Hibás kérés.' }); }

  if (looksLikeBot(body)) return reply(res, 200, { ok: true }); // a botnak sikert mutatunk, de nem mentünk

  const { data, errors } = validate(body);
  if (errors.length) return reply(res, 422, { ok: false, hibak: errors, uzenet: 'Kérjük, ellenőrizze a kötelező mezőket (név, gyermek kora, telefon vagy e-mail, adatkezelési hozzájárulás).' });

  try {
    await saveToSupabase(data);
  } catch (e) {
    console.error('[kapcsolat] mentési hiba', e.message);
    // Ha a mentés nem megy, legalább az e-mail menjen ki, hogy ne vesszen el a jelentkezés.
    try { if (await notifyByEmail(data)) return reply(res, 200, { ok: true }); } catch (e2) { console.error('[kapcsolat] e-mail hiba', e2.message); }
    return reply(res, 500, { ok: false });
  }
  try { await notifyByEmail(data); } catch (e) { console.error('[kapcsolat] e-mail hiba', e.message); }
  return reply(res, 200, { ok: true });
}
