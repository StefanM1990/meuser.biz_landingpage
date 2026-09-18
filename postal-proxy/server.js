// Minimaler Proxy: nimmt Formular-Requests vom Frontend entgegen,
// haengt den geheimen Postal API-Key serverseitig an und leitet an Postal weiter.
// Der Key steht NUR in den Server-Umgebungsvariablen, nie im Browser.
const http = require('http');

const PORT = process.env.PORT || 3000;
const POSTAL_URL = process.env.POSTAL_URL;       // z.B. https://postal01.meuser-webservice.de
const POSTAL_API_KEY = process.env.POSTAL_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});

  if (req.method === 'POST' && req.url === '/api/contact') {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', async () => {
      try {
        const data = JSON.parse(raw || '{}');
        const subject = data.subject || 'Kontaktanfrage';
        const message = data.message || '';
        const name = data.name || '';
        const email = data.email || '';
        const to = data.to;
        const from = data.from;

        if (!POSTAL_URL || !POSTAL_API_KEY) {
          return send(res, 500, { ok: false, error: 'Proxy ist nicht konfiguriert (POSTAL_URL/POSTAL_API_KEY fehlen).' });
        }
        if (!to || !from) {
          return send(res, 400, { ok: false, error: 'Absender-/Empfängeradresse fehlt (im Admin-Bereich unter Postal API konfigurieren).' });
        }

        const postalRes = await fetch(POSTAL_URL.replace(/\/$/, '') + '/api/v1/send/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Server-API-Key': POSTAL_API_KEY },
          body: JSON.stringify({
            to: [to],
            from: from,
            subject: `[Kontaktformular] ${subject}`,
            plain_body: `Name: ${name}\nE-Mail: ${email}\n\n${message}`
          })
        });

        if (!postalRes.ok) {
          const text = await postalRes.text();
          return send(res, 502, { ok: false, error: `Postal antwortete mit ${postalRes.status}: ${text}` });
        }
        return send(res, 200, { ok: true });
      } catch (err) {
        return send(res, 500, { ok: false, error: err.message });
      }
    });
    return;
  }

  send(res, 404, { ok: false, error: 'Not found' });
});

server.listen(PORT, () => console.log(`Postal proxy listening on :${PORT}`));
