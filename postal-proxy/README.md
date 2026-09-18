# Postal Proxy

Kleiner Server, der Formular-Anfragen entgegennimmt und mit dem geheimen
Postal API-Key (nur serverseitig!) an Postal weiterleitet. Löst das
CORS-Problem und verhindert, dass der API-Key im Browser sichtbar ist.

## Deployment in Coolify
1. Neue Ressource → Dockerfile-Deployment, dieser Ordner (`postal-proxy/`) als Build-Context.
2. Umgebungsvariablen setzen:
   - `POSTAL_URL` – z. B. `https://postal01.meuser-webservice.de`
   - `POSTAL_API_KEY` – dein Postal API-Key
   - `ALLOWED_ORIGIN` – deine Landingpage-Domain (statt `*` in Produktion)

   Absender-/Empfängeradresse werden NICHT hier gesetzt, sondern kommen aus dem
   Admin-Bereich der Landing Page (Postal API → Absender-/Empfänger-Adresse).
3. Port 3000 exposen, Domain zuweisen (z. B. `proxy.meuser.biz`).
4. Deployen.

## Endpoint
`POST /api/contact` mit JSON `{ name, email, subject, message, to }`
→ leitet die Mail über Postal weiter, Antwort `{ ok: true }` oder `{ ok: false, error }`.

## Im Admin-Bereich der Landingpage
Trage bei "Postal API" nur die **Proxy-URL** ein (z. B. `https://proxy.meuser.biz`) —
kein API-Key mehr im Frontend nötig.
