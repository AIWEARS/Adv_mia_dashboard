# Deploy su Vercel (guida rapida)

Questa repo è configurata per deploy full-stack:
- Frontend statico da `client/dist`
- API Express esposte come function tramite `api/[...all].js`

## Configurazione già presente
- `vercel.json`
  - `installCommand`: `npm install`
  - `buildCommand`: `npm run build`
  - `outputDirectory`: `client/dist`
  - `rewrites`:
    - `/api/:path*` resta su API (nessun fallback SPA)
    - fallback SPA su `/index.html` solo per richieste HTML
- `package.json`
  - `postinstall` esegue `install:all` e installa anche dipendenze `server` + `client`

## Variabili ambiente consigliate (Project Settings -> Environment Variables)
- `FRONTEND_URL=https://<tuo-dominio-vercel>`
- `JWT_SECRET=<segreto-lungo-e-casuale>`

Se usi integrazioni reali, aggiungi anche:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `META_APP_ID`
- `META_APP_SECRET`
- `GA4_PROPERTY_ID`

## Procedura deploy
1. Apri il progetto su Vercel collegato alla repo GitHub.
2. Branch di deploy: usa la branch della PR oppure `master` dopo merge.
3. Triggera un nuovo deploy (`Redeploy`).
4. Verifica endpoint:
   - `https://<deploy-url>/api/health`

## Errori noti già risolti
- `vite: command not found`
  - risolto con `postinstall` root che installa dipendenze `client`.
- `Function Runtimes must have a valid version`
  - risolto rimuovendo runtime custom non valido da `vercel.json`.

## Nota su conflitti PR
Se GitHub segnala conflitti su `vercel.json`, mantieni questa versione come source of truth.
