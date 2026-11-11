# Postal Proxy

Kleiner Server, der Anfragen des Kontaktformulars entgegennimmt und mit dem
geheimen Postal API-Key (nur serverseitig!) an Postal weiterleitet. Löst das
CORS-Problem und verhindert, dass der API-Key im Browser sichtbar ist.

Absender und Empfänger stehen ausschließlich in den Umgebungsvariablen. Der
Browser kann sie nicht ändern – der Proxy lässt sich also nicht missbrauchen,
um Mails an beliebige Adressen zu verschicken.

## Deployment in Coolify
1. Neue Ressource → Dockerfile-Deployment, dieser Ordner (`postal-proxy/`) als Build-Context.
2. Umgebungsvariablen setzen:
   - `POSTAL_URL` – z. B. `https://postal01.meuser-webservice.de`
   - `POSTAL_API_KEY` – dein Postal API-Key
   - `CONTACT_TO` – Empfänger der Anfragen, z. B. `info@meuser.biz`
   - `CONTACT_FROM` – Absenderadresse, die in Postal freigegeben ist
   - `ALLOWED_ORIGIN` – Domain der Landingpage (Standard: `https://meuser.biz`)
3. Port 3000 exposen, Domain zuweisen (z. B. `proxy.meuser.biz`).
4. Deployen und prüfen: `https://proxy.meuser.biz/health` muss `{"ok":true}` liefern.

## Landingpage verbinden
In `Meuster Landing Page.dc.html` oben im Skript die Konstante setzen:

```js
const CONTACT_ENDPOINT = 'https://proxy.meuser.biz/api/contact';
```

Solange sie leer ist, öffnet das Formular stattdessen eine vorausgefüllte
E-Mail an `CONTACT_EMAIL` – Anfragen gehen also nie verloren.

## Endpoint
`POST /api/contact` mit JSON `{ name, email, subject, message, website }`
→ Antwort `{ ok: true }` oder `{ ok: false, error }`.

- `website` ist ein Honeypot-Feld: Ist es gefüllt (Bot), wird nichts gesendet.
- Höchstens 5 Anfragen pro IP in 10 Minuten, Nachrichten bis 5000 Zeichen.
- Die Absender-Adresse des Besuchers wird als `Reply-To` gesetzt – „Antworten“
  im Mailprogramm geht direkt an ihn.
