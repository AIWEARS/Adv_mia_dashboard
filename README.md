# MIA Dashboard

Dashboard operativa per **[MIA](https://itsmia.it)** — piattaforma AI per fashion e-commerce che genera foto prodotto con modelli AI, virtual try-on, lookbook e campagne social.

**Live:** [adv-mia-dashboard.vercel.app](https://adv-mia-dashboard.vercel.app)

---

## Cosa fa

La dashboard ha due macro-funzioni:

1. **Diagnosi Advertising** — Analizza le performance pubblicitarie (Google Ads + Meta Ads) di un e-commerce, genera diagnosi AI, piani d'azione e analisi competitor.
2. **Outreach Automation** — Trova brand di moda online, li qualifica con AI, genera email personalizzate e le invia automaticamente via Brevo.

---

## Architettura

```
client/          React + Vite + TailwindCSS (SPA)
server/          Express.js API (serverless su Vercel)
api/index.js     Entry point Vercel serverless
vercel.json      Routing + config deploy
```

**Deploy:** Vercel (serverless functions, max 60s timeout)
**Storage:** In-memory con fallback localStorage lato client (nessun database)
**AI:** Google Gemini 3 Flash Preview
**Email:** Brevo HTTP API (no SMTP)

---

## Le 8 Tab

### Diagnosi Advertising (Tab 1-6)

| Tab | Cosa fa |
|-----|---------|
| **Sintesi** | Punteggio generale 0-100 con KPI principali (CTR, CPC, CPL, ROAS) |
| **Cosa Migliorare** | Problemi identificati con gravita, impatto e azioni suggerite (AI) |
| **Piano 7 Giorni** | Azioni operative settimanali con checkbox progresso |
| **Piano 30 Giorni** | Strategia mensile con milestone e priorita |
| **Competitor** | Analisi competitor con confronto metriche e insight AI |
| **Salute Tracciamento** | Verifica GTM, GA4, pixel Meta, conversioni — stato OK/Warning/Error |

**Flusso dati:**
1. Upload CSV esportati da Google Ads e Meta Ads
2. Il server parsa i CSV e unifica le metriche
3. Gemini AI genera diagnosi, piani d'azione e analisi competitor
4. Risultati mostrati nelle 6 tab con UI card-based

### Outreach Automation (Tab 7-8)

| Tab | Cosa fa |
|-----|---------|
| **Lead Pipeline** | Discovery, qualifica AI, generazione email — pipeline completa |
| **Campagne Outreach** | Creazione campagne, invio email sequenziali via Brevo |

---

## Outreach: Come Funziona

### Step 1 — Discovery Lead

L'utente seleziona paese (IT di default), categoria (fashion, beauty, luxury, accessori, calzature, sportswear) e numero di lead.

**Sorgenti di ricerca:**
- **Brave Search** — Query localizzate in italiano (es. "brand emergente italia shop online", "marchio moda indipendente ecommerce"). Max 20 risultati per query, 3 query per ricerca.
- **Apollo.io** — Ricerca organizzazioni per keyword + paese. Restituisce aziende con dominio, settore, dipendenti.

**Enrichment automatico:**
- Scraping homepage + pagine contatto (/contatti, /contact, /chi-siamo, /about) con Cheerio
- Estrazione email, social, meta description
- Riconoscimento email offuscate ("info [at] dominio [dot] it")
- Deduplicazione per dominio

### Step 2 — Qualifica AI

Gemini analizza ogni lead e assegna:
- **Score 0-100** — quanto il brand e adatto a MIA
- **Tier** (hot/warm/cold/disqualified)
- **Motivo** — spiegazione della qualifica

Criteri ICP (Ideal Customer Profile):
- Piccoli/medi brand fashion con e-commerce attivo
- DNVB, brand emergenti, indie fashion
- Esclusi: grandi brand famosi, marketplace, rivenditori generici

**Batching:** I lead vengono qualificati in gruppi da 10 per evitare il timeout di 60s di Vercel.

### Step 3 — Trova Email (Apollo People Search)

Per i lead senza email, il bottone "Trova Email" cerca contatti reali nelle aziende via Apollo People Search API:
- Priorita: Founder/CEO > Marketing/E-commerce > altri contatti
- Restituisce nome, ruolo, email, LinkedIn

### Step 4 — Generazione Email

Gemini genera una sequenza di 4 email personalizzate per ogni lead:
1. **Email 1** (~80 parole) — Primo contatto diretto
2. **Email 2** — Follow-up con angolo diverso
3. **Email 3** — Prova sociale / urgenza
4. **Email 4** — Ultimo tentativo

**Stile email:**
- Italiano naturale, tono diretto e concreto
- Focus sui vantaggi di MIA: shooting con modelli AI, outfit multipli automatici, risparmio 90% vs shooting tradizionali
- Niente frasi finte/AI ("Ho apprezzato la vostra estetica...", "Nel panorama competitivo...")
- Mittente: Federico di MIA

**Batching:** Email generate in gruppi da 5 lead.

### Step 5 — Campagne e Invio

1. Creare una campagna e assegnare i lead con status "Email Pronte"
2. Verificare connessione Brevo (banner con stato)
3. Inviare Step 1 (prima email della sequenza)
4. Nei giorni successivi, inviare Step 2, 3, 4 come follow-up

**Invio email:**
- Via Brevo HTTP API (no SMTP, compatibile serverless)
- Mittente: `info@itsmia.it` (Federico - MIA)
- Brevo gestisce automaticamente unsubscribe
- Ogni step invia solo ai lead che hanno completato lo step precedente
- Status per lead: Pronta > Invio > Inviata > Errore

---

## API Endpoints

### Diagnosi
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/diagnosis/summary` | Sintesi con score e KPI |
| GET | `/api/diagnosis/full` | Diagnosi completa AI |
| GET | `/api/diagnosis/trends` | Trend temporali metriche |
| GET | `/api/action-plan/7` | Piano azioni 7 giorni |
| GET | `/api/action-plan/30` | Piano azioni 30 giorni |
| GET | `/api/competitors` | Analisi competitor AI |
| GET | `/api/tracking/health` | Stato salute tracciamento |

### CSV Upload
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/csv/upload/google` | Upload CSV Google Ads |
| POST | `/api/csv/upload/meta` | Upload CSV Meta Ads |
| GET | `/api/csv/status` | Stato CSV caricati |
| DELETE | `/api/csv/data` | Cancella dati CSV |

### Outreach
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/outreach/stats` | Statistiche pipeline |
| GET | `/api/outreach/leads` | Lista lead con filtri e paginazione |
| POST | `/api/outreach/leads/import-csv` | Import lead da CSV |
| POST | `/api/outreach/discover` | Discovery automatica lead |
| POST | `/api/outreach/qualify` | Qualifica AI batch |
| POST | `/api/outreach/generate-emails` | Genera email AI batch |
| POST | `/api/outreach/find-emails` | Cerca email via Apollo People Search |
| PUT | `/api/outreach/leads/:id` | Aggiorna singolo lead |
| DELETE | `/api/outreach/leads` | Elimina lead selezionati |

### Campagne
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/outreach/campaigns` | Lista campagne |
| POST | `/api/outreach/campaigns` | Crea campagna |
| PUT | `/api/outreach/campaigns/:id` | Aggiorna campagna |
| DELETE | `/api/outreach/campaigns/:id` | Elimina campagna |
| POST | `/api/outreach/campaigns/:id/export` | Assegna lead a campagna |
| GET | `/api/outreach/email-config` | Stato configurazione Brevo |
| POST | `/api/outreach/campaigns/:id/send` | Invia email step N |

---

## Variabili d'Ambiente

| Variabile | Servizio | Obbligatoria |
|-----------|----------|:------------:|
| `GEMINI_API_KEY` | Google Gemini AI | Si |
| `BREVO_API_KEY` | Brevo (invio email) | Si |
| `BRAVE_SEARCH_API_KEY` | Brave Search (discovery) | Si |
| `APOLLO_API_KEY` | Apollo.io (discovery + email) | Si |
| `JWT_SECRET` | Autenticazione JWT | Si |
| `EMAIL_FROM` | Mittente email (default: info@itsmia.it) | No |
| `EMAIL_FROM_NAME` | Nome mittente (default: Federico - MIA) | No |

---

## Sviluppo Locale

```bash
# Installa dipendenze
npm install
cd client && npm install && cd ..

# Configura .env nella root
GEMINI_API_KEY=...
BREVO_API_KEY=xkeysib-...
BRAVE_SEARCH_API_KEY=...
APOLLO_API_KEY=...
JWT_SECRET=...

# Avvia dev (server + client in parallelo)
npm run dev
```

Server: `http://localhost:3001/api`
Client: `http://localhost:5173`

---

## Deploy su Vercel

```bash
# Push su master → deploy automatico
git push origin master
```

La configurazione in `vercel.json`:
- Build: `npm run build` (Vite compila il client)
- Output: `client/dist`
- API: Serverless function con max 60s timeout
- Routing: `/api/*` → serverless, tutto il resto → SPA

---

## Tech Stack

| Componente | Tecnologia |
|-----------|------------|
| Frontend | React 18 + Vite + TailwindCSS |
| Backend | Express.js (serverless Vercel) |
| AI | Google Gemini 3 Flash Preview |
| Email | Brevo HTTP API |
| Search | Brave Search API |
| CRM/Enrichment | Apollo.io API |
| Scraping | Cheerio (HTML parsing) |
| Auth | JWT (bcryptjs) |
| Icons | Lucide React |
| Deploy | Vercel |
