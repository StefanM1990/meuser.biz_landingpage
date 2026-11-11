// Minimaler Proxy: nimmt Anfragen des Kontaktformulars entgegen und leitet sie
// mit dem geheimen Postal API-Key an Postal weiter.
// Key, Absender und Empfänger stehen NUR in den Server-Umgebungsvariablen –
// der Browser kann nicht bestimmen, wohin die Mail geht.
const http = require('http');

const PORT = process.env.PORT || 3000;
const POSTAL_URL = process.env.POSTAL_URL;           // z. B. https://postal01.meuser-webservice.de
const POSTAL_API_KEY = process.env.POSTAL_API_KEY;
const CONTACT_TO = process.env.CONTACT_TO;           // Empfänger, z. B. info@meuser.biz
const CONTACT_FROM = process.env.CONTACT_FROM;       // Absender, z. B. kontaktformular@meuser.biz
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://meuser.biz';

const MAX_BODY = 20 * 1024;                          // 20 KB reichen für jede Anfrage
const RATE_WINDOW_MS = 10 * 60 * 1000;               // 10 Minuten …
const RATE_MAX = 5;                                  // … höchstens 5 Anfragen pro IP
const hits = new Map();

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  });
  res.end(JSON.stringify(body));
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? String(fwd).split(',')[0] : req.socket.remoteAddress || '').trim();
}

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > RATE_MAX;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) if (!list.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(ip);
}, RATE_WINDOW_MS).unref();

const clean = (v, max) => String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim().slice(0, max);
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true });

  if (req.method === 'POST' && req.url === '/api/contact') {
    let raw = '';
    let tooBig = false;
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BODY) { tooBig = true; req.destroy(); }
    });
    req.on('end', async () => {
      if (tooBig) return;
      try {
        if (!POSTAL_URL || !POSTAL_API_KEY || !CONTACT_TO || !CONTACT_FROM) {
          return send(res, 500, { ok: false, error: 'Proxy ist nicht vollständig konfiguriert.' });
        }
        if (rateLimited(clientIp(req))) {
          return send(res, 429, { ok: false, error: 'Zu viele Anfragen. Bitte später erneut versuchen.' });
        }

        const data = JSON.parse(raw || '{}');
        // Honeypot: echte Besucher sehen dieses Feld nicht. Bots bekommen ein „ok“, es wird nichts gesendet.
        if (data.website) return send(res, 200, { ok: true });

        const name = clean(data.name, 120);
        const email = clean(data.email, 200);
        const subject = clean(data.subject, 150) || 'Kontaktanfrage';
        const message = String(data.message == null ? '' : data.message).trim().slice(0, 5000);

        if (!name || !message || !isEmail(email)) {
          return send(res, 400, { ok: false, error: 'Bitte Name, gültige E-Mail-Adresse und Nachricht angeben.' });
        }

        const postalRes = await fetch(POSTAL_URL.replace(/\/$/, '') + '/api/v1/send/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Server-API-Key': POSTAL_API_KEY },
          body: JSON.stringify({
            to: [CONTACT_TO],
            from: CONTACT_FROM,
            reply_to: email,
            subject: `[Kontaktformular] ${subject}`,
            plain_body: `Name: ${name}\nE-Mail: ${email}\n\n${message}`
          })
        });

        if (!postalRes.ok) {
          console.error('Postal error', postalRes.status, await postalRes.text());
          return send(res, 502, { ok: false, error: 'Versand fehlgeschlagen.' });
        }
        return send(res, 200, { ok: true });
      } catch (err) {
        console.error(err);
        return send(res, 400, { ok: false, error: 'Ungültige Anfrage.' });
      }
    });
    return;
  }

  send(res, 404, { ok: false, error: 'Not found' });
});

server.listen(PORT, () => console.log(`Postal proxy listening on :${PORT}`));
