# MIA Outreach — Sistema di Lead Generation & Cold Email

Sistema integrato nella dashboard MIA per trovare, qualificare e contattare brand fashion/beauty che potrebbero beneficiare di foto prodotto AI.

---

## Architettura

```
Dashboard (React)
  |-- Tab "Lead Pipeline"     --> gestione lead, ricerca automatica, qualificazione AI
  |-- Tab "Campagne Outreach" --> creazione campagne, generazione email, export
  |
  v
Express API (/api/outreach/*)
  |-- outreachStore.js          --> storage in-memory + JSON persistence
  |-- outreachGeminiService.js  --> qualificazione AI + generazione email (Gemini)
  |-- leadDiscoveryService.js   --> ricerca automatica lead (Apollo + Google scraping)
  |
  v
mia-outreach/ (Python standalone)
  |-- Script CLI per pipeline offline (scraping, enrichment, email gen, export)
```

---

## Flusso Completo

### 1. Acquisizione Lead

**Opzione A — Ricerca automatica (Trova Lead)**

Click "Trova Lead" nel tab Lead Pipeline:
1. Configura query, paese, categoria, limite e fonti (Google Search / Apollo.io)
2. Il sistema cerca brand fashion su DuckDuckGo e/o Apollo.io
3. Deduplica risultati per dominio web
4. Arricchisce ogni lead scrappando il sito con cheerio:
   - Piattaforma ecommerce (Shopify, WooCommerce, Magento, etc.)
   - Stima SKU (conta link/elementi prodotto)
   - Qualita foto prodotto (analisi dimensioni immagini)
   - Instagram handle (link social nel footer)
   - Email di contatto (estrazione dal sito)
5. Filtra con Gemini AI (batch da 10): scarta lead non-fashion, senza ecommerce, fuori target
6. Solo i lead rilevanti entrano nella pipeline con status `enriched`

**Opzione B — Import CSV**

Upload CSV con colonne: company, email, contact_name, website, country, product_category, etc.

**Opzione C — Script Python (mia-outreach/)**

Pipeline offline con 5 script sequenziali (vedi sezione dedicata sotto).

### 2. Qualificazione AI

Click "Qualifica AI" nel tab Lead Pipeline:
1. Invia lead a Gemini (`gemini-3.1-flash-lite-preview`) in batch da 10
2. Per ogni lead, Gemini valuta:
   - **ICP Score** (0-100) — quanto il lead corrisponde al profilo cliente ideale MIA
   - **Priority** — `hot` (score >= 70) / `warm` (score >= 50)
   - **Pain point** — problema specifico che MIA risolve per quel brand
   - **Hook** — aggancio personalizzato per la prima email
   - **Recommended service** — servizio MIA piu adatto
3. Lead aggiornati con status `qualified`

### 3. Generazione Email

Seleziona lead qualificati > click "Genera Email":
1. Per ogni lead, Gemini genera:
   - **Sequenza HOT** (score >= 70): 3 email + 1 follow-up breakup
   - **Sequenza WARM** (score 50-69): 2 email + 1 follow-up breakup
2. Per ogni email: oggetto A/B testing (2 varianti)
3. Personalizzazione basata su pain point, hook, settore, piattaforma
4. Lingua automatica basata sul paese
5. Lead aggiornati con status `email_ready`

### 4. Campagne & Export

Nel tab "Campagne Outreach":
1. Crea campagna (nome, tipo, date)
2. Assegna lead alla campagna
3. Export CSV formato Instantly.ai con campi mappati:
   - email, first_name, last_name, company_name, website
   - custom1-5 (corpi email sequenza)
4. Lead marcati come `exported`

### 5. Tracking

Stati del lead nella pipeline:
```
new -> enriched -> qualified -> email_ready -> exported -> contacted -> replied -> converted
                                                                                -> disqualified
```

---

## API Endpoints

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/outreach/stats` | Statistiche pipeline |
| GET | `/api/outreach/leads` | Lista lead (filtri, paginazione) |
| POST | `/api/outreach/leads` | Importa lead JSON |
| POST | `/api/outreach/leads/csv` | Importa lead da CSV |
| POST | `/api/outreach/discover` | Ricerca automatica lead |
| PATCH | `/api/outreach/leads/:id` | Aggiorna lead |
| DELETE | `/api/outreach/leads` | Elimina lead (body: {ids}) |
| POST | `/api/outreach/qualify` | Qualificazione AI (async job) |
| POST | `/api/outreach/generate-emails` | Generazione email (async job) |
| GET | `/api/outreach/jobs/:jobId` | Status job asincrono (polling) |
| GET | `/api/outreach/campaigns` | Lista campagne |
| POST | `/api/outreach/campaigns` | Crea campagna |
| PATCH | `/api/outreach/campaigns/:id` | Aggiorna campagna |
| DELETE | `/api/outreach/campaigns/:id` | Elimina campagna |
| GET | `/api/outreach/export/:campaignId` | Export CSV Instantly.ai |

### Job Asincroni

Le operazioni pesanti (qualify, generate-emails, discover) usano un pattern asincrono:
1. POST crea un job, ritorna `{jobId, status: 'processing', total}`
2. Frontend fa polling ogni 2 secondi su `GET /jobs/:jobId`
3. Job ritorna `{status, progress, total, phase, results}`
4. Al completamento: `status: 'completed'`

---

## Script Python (mia-outreach/)

Pipeline offline alternativa per uso da terminale.

```bash
cd mia-outreach
pip install -r requirements.txt
cp .env.example .env  # configura API keys
```

| Script | Input | Output | Descrizione |
|--------|-------|--------|-------------|
| `01_scrape_leads.py` | Apollo API / CSV | `data/leads_raw.json` | Scraping lead da Apollo.io |
| `02_enrich_leads.py` | `leads_raw.json` | `data/leads_enriched.json` | Arricchimento siti web |
| `03_qualify_leads.py` | `leads_enriched.json` | `data/leads_qualified.json` | Qualificazione AI con Gemini |
| `04_write_emails.py` | `leads_qualified.json` | `data/leads_with_emails.json` | Generazione email personalizzate |
| `05_export_campaign.py` | `leads_with_emails.json` | `data/campaign_*.csv` | Export per Instantly.ai |

Esecuzione sequenziale:
```bash
python 01_scrape_leads.py --source apollo --country IT --limit 50
python 02_enrich_leads.py
python 03_qualify_leads.py --min-score 50
python 04_write_emails.py --sequence auto
python 05_export_campaign.py --format instantly
```

---

## Configurazione

### Variabili d'ambiente (.env)

```
GEMINI_API_KEY=...         # Obbligatorio per qualificazione AI e generazione email
APOLLO_API_KEY=...         # Opzionale per ricerca lead su Apollo.io
```

### ICP Scoring (mia-outreach/config/icp_scoring.json)

Pesi configurabili per il calcolo dello score ICP:
- `has_ecommerce`: 25 punti
- `product_category_match`: 20 punti
- `photo_quality_poor`: 15 punti (opportunita miglioramento)
- `estimated_sku_count`: fino a 15 punti
- `social_presence`: fino a 10 punti
- `company_size`: fino a 15 punti

---

## Stack Tecnico

- **Backend**: Node.js + Express
- **Frontend**: React + Tailwind CSS + Lucide icons
- **AI**: Google Gemini (`gemini-3.1-flash-lite-preview`)
- **Scraping**: cheerio (Node.js), BeautifulSoup (Python)
- **Search**: DuckDuckGo HTML, Apollo.io API
- **Storage**: JSON file persistence (`server/data/outreach-store.json`)
- **Email tool**: Export CSV compatibile con Instantly.ai
