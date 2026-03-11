/**
 * GEMINI AI SERVICE
 * Servizio centralizzato per tutte le interazioni con Gemini 3 Flash Preview.
 * Gestisce client singleton, cache TTL, prompt templates e validazione risposte.
 * Fallback: se API key mancante o errore, ritorna null (il chiamante usa la logica statica).
 */

let GoogleGenAI;
try {
  const mod = await import('@google/genai');
  GoogleGenAI = mod.GoogleGenAI;
} catch (e) {
  console.warn('[GeminiService] @google/genai not available:', e.message);
  GoogleGenAI = null;
}

// --- Client singleton ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let client = null;

function getClient() {
  if (!client && GEMINI_API_KEY && GoogleGenAI) {
    client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return client;
}

export function isGeminiAvailable() {
  return !!(GEMINI_API_KEY && GoogleGenAI);
}

// --- Cache TTL ---
const cache = new Map();
const CACHE_TTL_DIAGNOSIS = 5 * 60 * 1000;     // 5 minuti
const CACHE_TTL_ACTION_PLAN = 10 * 60 * 1000;  // 10 minuti
const CACHE_TTL_COMPETITORS = 60 * 60 * 1000;  // 1 ora
const CACHE_TTL_SOCIAL_ANALYSIS = 2 * 60 * 60 * 1000; // 2 ore

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data, ttlMs) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function clearCache(key) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

function simpleHash(obj) {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// --- Dati mock in formato unified per modalita demo ---
export function buildMockUnified() {
  return {
    spesa_totale: 2847, spesa_google: 712, spesa_meta: 2135,
    impressioni_totali: 45000, click_totali: 980,
    conversioni: { lead_preventivo: 23, click_webapp: 156, registrazioni: 12, acquisti: 3 },
    costo_per_lead: 123.78, ctr_medio: 2.1, roas: 1.8,
    campagne: [
      { piattaforma: 'Google Ads', nome: 'Search - AI Fashion Photography', spesa: 412, click: 180, impressioni: 12000 },
      { piattaforma: 'Google Ads', nome: 'Search - Virtual Model Shooting', spesa: 300, click: 95, impressioni: 8000 },
      { piattaforma: 'Meta Ads', nome: 'Awareness - AI Shooting Digitale', spesa: 1200, click: 420, impressioni: 15000 },
      { piattaforma: 'Meta Ads', nome: 'Lead Gen - Demo Piattaforma', spesa: 935, click: 285, impressioni: 10000 }
    ],
    dati_giornalieri: []
  };
}

// --- Helper: estrai JSON da testo libero ---
function extractJson(text) {
  // Prova prima il parsing diretto
  try {
    return JSON.parse(text);
  } catch {
    // Cerca il blocco JSON piu grande nel testo
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Nessun JSON trovato nella risposta');
  }
}

// ============================================================
// DIAGNOSI AI
// ============================================================

export async function generateDiagnosis(unifiedData) {
  const cacheKey = `diagnosis_${simpleHash(unifiedData)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const ai = getClient();
  if (!ai) return null;

  const prompt = `Sei un esperto di advertising digitale specializzato in Google Ads e Meta Ads.
Analizza i dati delle campagne pubblicitarie di MIA (itsmia.it).

DATI CAMPAGNE:
${JSON.stringify(unifiedData, null, 2)}

CONTESTO BUSINESS:
- MIA (itsmia.it) e' una piattaforma AI di shooting digitale per fashion e-commerce
- Genera foto professionali di modelle che indossano capi di abbigliamento usando AI generativa
- Target: fashion retailer e aziende e-commerce che necessitano di visual per cataloghi prodotto
- Due modalita: Self-service (utente crea da solo) e Tailor (MIA gestisce tutto)
- Webapp: app.miafashion.it (piattaforma di creazione contenuti)
- Azienda: AISEM SRL, Milano, fondata 2023
- Funnel: Annuncio > Landing (itsmia.it) > Webapp > Registrazione > Acquisto/Abbonamento
- Benchmark settore SaaS/AI tools B2B: CPL 50-150 euro, CTR > 1.5%

RISPONDI IN ITALIANO con questo formato JSON esatto:
{
  "issues": [
    {
      "id": "stringa_identificativa_unica",
      "area": "area del problema (creativita, budget, conversioni, funnel, targeting)",
      "titolo": "titolo breve e chiaro",
      "gravita": "alta|media|critica",
      "descrizione": "spiegazione dettagliata con numeri specifici dai dati",
      "impatto": "quale impatto ha sui risultati",
      "azione": "azione concreta e specifica per risolvere"
    }
  ],
  "suggerimenti": [
    {
      "id": "stringa_identificativa",
      "titolo": "titolo del suggerimento",
      "descrizione": "spiegazione dettagliata"
    }
  ]
}

Regole:
- Genera 3-7 issues basate sui dati reali (non inventare numeri)
- Genera 3-5 suggerimenti pratici e specifici per il settore AI SaaS/fashion tech
- Usa gravita "critica" solo per problemi gravi (zero lead, budget sprecato)
- Usa gravita "alta" per problemi importanti (CPL troppo alto, CTR basso)
- Usa gravita "media" per miglioramenti possibili
- Sii specifico: cita i numeri dai dati forniti
- Le azioni devono essere concrete e attuabili, non generiche`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: 'MEDIUM' },
        responseMimeType: 'application/json'
      }
    });

    const parsed = extractJson(response.text);
    const result = validateDiagnosisResponse(parsed);
    setCache(cacheKey, result, CACHE_TTL_DIAGNOSIS);
    return result;
  } catch (error) {
    console.error('[GeminiService] Diagnosis error:', error.message);
    return null;
  }
}

function validateDiagnosisResponse(parsed) {
  const result = {
    issues: [],
    suggerimenti: [],
    fonte: 'ai',
    ultimo_aggiornamento: new Date().toISOString()
  };

  if (Array.isArray(parsed.issues)) {
    result.issues = parsed.issues
      .filter(i => i.titolo && i.descrizione)
      .map((issue, idx) => ({
        id: issue.id || `ai_issue_${idx}`,
        area: issue.area || 'generale',
        titolo: String(issue.titolo),
        gravita: ['alta', 'media', 'critica'].includes(issue.gravita) ? issue.gravita : 'media',
        descrizione: String(issue.descrizione),
        impatto: String(issue.impatto || ''),
        azione: String(issue.azione || '')
      }));
  }

  if (Array.isArray(parsed.suggerimenti)) {
    result.suggerimenti = parsed.suggerimenti
      .filter(s => s.titolo && s.descrizione)
      .map((sug, idx) => ({
        id: sug.id || `ai_sug_${idx}`,
        titolo: String(sug.titolo),
        descrizione: String(sug.descrizione)
      }));
  }

  return result;
}

// ============================================================
// COMPETITOR ANALYSIS (con Google Search grounding)
// ============================================================

export async function generateCompetitorAnalysis() {
  const cacheKey = 'competitors';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const ai = getClient();
  if (!ai) return null;

  const prompt = `Sei un analista di marketing digitale specializzato in SaaS e AI tools per il fashion.

MIA (itsmia.it) e' una piattaforma AI italiana di shooting digitale per fashion e-commerce.
Genera foto professionali di modelle che indossano capi di abbigliamento usando intelligenza artificiale generativa.
Target: fashion retailer e aziende e-commerce. Due modalita: Self-service e Tailor (servizio gestito).
Azienda: AISEM SRL, Milano, fondata 2023.

Cerca su Google i principali competitor di MIA nel settore AI fashion photography / AI-generated model imagery / virtual try-on per e-commerce.
NON suggerire brand di moda su misura - MIA NON vende vestiti, vende un servizio AI di shooting fotografico.

COMPETITOR OBBLIGATORI DA INCLUDERE:
- Aiora Studio (aiorastudio.com) - competitor diretto, DEVE essere analizzato
- MakeIt Real (makeit-real.com) - competitor diretto, DEVE essere analizzato
- Genera Space (generaspace.ai) - competitor diretto, DEVE essere analizzato

Cerca anche altri competitor come: piattaforme che generano foto di modelle con AI per cataloghi e-commerce, virtual photography, AI model generation tools.

Analizza: strategia pubblicitaria, posizionamento, punti di forza/debolezza, stile creativo.

RISPONDI IN ITALIANO con questo formato JSON esatto:
{
  "competitors": [
    {
      "id": "comp_1",
      "nome": "nome competitor",
      "dominio": "dominio.com",
      "descrizione": "descrizione del competitor e posizionamento",
      "punti_forza": ["punto 1", "punto 2", "punto 3"],
      "punti_deboli": ["punto 1", "punto 2", "punto 3"],
      "comunicazione": "descrizione della strategia di comunicazione",
      "creativita": "descrizione dello stile creativo degli annunci",
      "score": 75
    }
  ],
  "cose_che_fanno_meglio": ["cosa 1", "cosa 2", "cosa 3"],
  "opportunita_per_differenziarsi": ["opportunita 1", "opportunita 2"],
  "idee_annunci": [
    {
      "id": "idea_1",
      "copy": "testo dell'annuncio suggerito per MIA",
      "angolo": "angolo comunicativo utilizzato",
      "formato": "formato consigliato (immagine, video, carosello)"
    }
  ]
}

Regole:
- Analizza ALMENO 5-7 competitor (i 3 obbligatori + altri trovati online)
- Lo score va da 0 a 100 (competitivita rispetto a MIA)
- Genera 4-6 cose che i competitor fanno meglio
- Genera 4-6 opportunita per differenziarsi
- Genera 5-8 idee annunci creative e specifiche per MIA
- Basa le informazioni su dati reali trovati online
- RISPONDI SOLO con il JSON, senza testo aggiuntivo`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: 'HIGH' }
      },
      tools: [{ googleSearch: {} }]
    });

    const parsed = extractJson(response.text);
    const result = validateCompetitorResponse(parsed);
    setCache(cacheKey, result, CACHE_TTL_COMPETITORS);
    return result;
  } catch (error) {
    console.error('[GeminiService] Competitor error:', error.message);
    return null;
  }
}

function validateCompetitorResponse(parsed) {
  const result = {
    competitors: [],
    cose_che_fanno_meglio: [],
    opportunita_per_differenziarsi: [],
    idee_annunci: []
  };

  if (Array.isArray(parsed.competitors)) {
    result.competitors = parsed.competitors
      .filter(c => c.nome)
      .map((comp, idx) => ({
        id: comp.id || `comp_${idx + 1}`,
        nome: String(comp.nome),
        dominio: String(comp.dominio || ''),
        descrizione: String(comp.descrizione || ''),
        punti_forza: Array.isArray(comp.punti_forza) ? comp.punti_forza.map(String) : [],
        punti_deboli: Array.isArray(comp.punti_deboli) ? comp.punti_deboli.map(String) : [],
        comunicazione: String(comp.comunicazione || ''),
        creativita: String(comp.creativita || ''),
        score: typeof comp.score === 'number' ? Math.max(0, Math.min(100, comp.score)) : 70
      }));
  }

  if (Array.isArray(parsed.cose_che_fanno_meglio)) {
    result.cose_che_fanno_meglio = parsed.cose_che_fanno_meglio.map(String);
  }

  if (Array.isArray(parsed.opportunita_per_differenziarsi)) {
    result.opportunita_per_differenziarsi = parsed.opportunita_per_differenziarsi.map(String);
  }

  if (Array.isArray(parsed.idee_annunci)) {
    result.idee_annunci = parsed.idee_annunci
      .filter(i => i.copy)
      .map((idea, idx) => ({
        id: idea.id || `idea_${idx + 1}`,
        copy: String(idea.copy),
        angolo: String(idea.angolo || ''),
        formato: String(idea.formato || '')
      }));
  }

  return result;
}

// ============================================================
// ACTION PLAN DINAMICO
// ============================================================

export async function generateActionPlan(unifiedData, days) {
  const cacheKey = `actionplan_${days}_${simpleHash(unifiedData)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const ai = getClient();
  if (!ai) return null;

  const numActions = days === 7 ? '5-8' : '8-12';
  const timeframe = days === 7
    ? 'i prossimi 7 giorni. Le azioni devono essere veloci e attuabili subito. Usa "Giorno 1", "Giorno 2", ecc.'
    : 'i prossimi 30 giorni. Le azioni possono essere piu strutturali e strategiche. Usa "Settimana 1", "Settimana 2", ecc.';

  const prompt = `Sei un consulente di advertising digitale per MIA (itsmia.it), piattaforma AI di shooting digitale per fashion e-commerce.

DATI CAMPAGNE ATTUALI:
${JSON.stringify(unifiedData, null, 2)}

CONTESTO:
- MIA genera foto professionali di modelle con AI per cataloghi e-commerce fashion
- Target: fashion retailer e aziende e-commerce
- Webapp: app.miafashion.it (piattaforma di creazione contenuti AI)
- Funnel: Annuncio > Landing (itsmia.it) > Webapp > Registrazione > Acquisto/Abbonamento
- Piattaforme: Google Ads e Meta Ads
- Benchmark SaaS/AI tools B2B: CPL 50-150 euro, CTR > 1.5%

Crea un piano d'azione pratico per ${timeframe}

RISPONDI IN ITALIANO con questo formato JSON esatto:
{
  "description": "descrizione breve dell'obiettivo del piano",
  "actions": [
    {
      "id": "identificativo_unico",
      "titolo": "titolo chiaro dell'azione",
      "descrizione": "spiegazione dettagliata passo passo di cosa fare",
      "giorno": "Giorno X o Settimana X",
      "tempo_stimato": "tempo necessario (es: 30 minuti, 1 ora, 2 ore)",
      "difficolta": "bassa|media|alta",
      "impatto": "alto|medio|basso",
      "priorita": "alta|media|bassa",
      "completed": false
    }
  ]
}

Regole:
- Genera ${numActions} azioni
- Ordina per priorita (le piu importanti prima)
- Le azioni devono essere specifiche e basate sui dati forniti
- Ogni azione deve avere istruzioni chiare e attuabili
- Il campo "completed" deve essere sempre false
- Considera i problemi reali: CPL, CTR, conversioni, distribuzione budget tra piattaforme`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: 'MEDIUM' },
        responseMimeType: 'application/json'
      }
    });

    const parsed = extractJson(response.text);
    const result = validateActionPlanResponse(parsed, days);
    setCache(cacheKey, result, CACHE_TTL_ACTION_PLAN);
    return result;
  } catch (error) {
    console.error('[GeminiService] ActionPlan error:', error.message);
    return null;
  }
}

function validateActionPlanResponse(parsed, days) {
  const result = {
    description: parsed.description || `Piano d'azione a ${days} giorni generato dall'AI`,
    actions: []
  };

  if (Array.isArray(parsed.actions)) {
    result.actions = parsed.actions
      .filter(a => a.titolo && a.descrizione)
      .map((action, idx) => ({
        id: action.id || `ai_${days}_${idx}`,
        titolo: String(action.titolo),
        descrizione: String(action.descrizione),
        giorno: String(action.giorno || `${days === 7 ? 'Giorno' : 'Settimana'} ${idx + 1}`),
        tempo_stimato: String(action.tempo_stimato || '1 ora'),
        difficolta: ['bassa', 'media', 'alta'].includes(action.difficolta) ? action.difficolta : 'media',
        impatto: ['alto', 'medio', 'basso'].includes(action.impatto) ? action.impatto : 'medio',
        priorita: ['alta', 'media', 'bassa'].includes(action.priorita) ? action.priorita : 'media',
        completed: false
      }));
  }

  return result;
}

// ============================================================
// COMMENTI SMART METRICHE
// ============================================================

export async function generateMetricComments(unifiedData) {
  const cacheKey = `metrics_${simpleHash(unifiedData)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const ai = getClient();
  if (!ai) return null;

  const prompt = `Sei un analista di advertising per MIA (itsmia.it), piattaforma AI di shooting digitale per fashion e-commerce.

DATI CAMPAGNE:
- Spesa totale: ${unifiedData.spesa_totale} euro (Google: ${unifiedData.spesa_google}, Meta: ${unifiedData.spesa_meta})
- Lead (preventivi): ${unifiedData.conversioni.lead_preventivo}
- Costo per lead: ${unifiedData.costo_per_lead} euro
- Click webapp: ${unifiedData.conversioni.click_webapp}
- Registrazioni: ${unifiedData.conversioni.registrazioni}
- Acquisti: ${unifiedData.conversioni.acquisti}
- CTR medio: ${unifiedData.ctr_medio}%
- ROAS: ${unifiedData.roas}

Per ciascuna metrica scrivi un commento interpretativo breve (1-2 frasi) in italiano.
Usa benchmark del settore SaaS/AI tools B2B. Sii specifico con i numeri.

RISPONDI con questo formato JSON:
{
  "spesa_totale": "commento",
  "lead": "commento",
  "costo_per_lead": "commento",
  "click_webapp": "commento",
  "registrazioni": "commento",
  "acquisti": "commento",
  "ctr": "commento",
  "roas": "commento"
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: 'LOW' },
        responseMimeType: 'application/json'
      }
    });

    const parsed = extractJson(response.text);
    setCache(cacheKey, parsed, CACHE_TTL_DIAGNOSIS);
    return parsed;
  } catch (error) {
    console.error('[GeminiService] MetricComments error:', error.message);
    return null;
  }
}

// ============================================================
// ANALISI SOCIAL/ADV COMPETITOR
// ============================================================

export async function generateCompetitorSocialAnalysis(competitorName, competitorDomain) {
  const cacheKey = `social_${competitorName.toLowerCase().replace(/\s+/g, '_')}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const ai = getClient();
  if (!ai) return null;

  const prompt = `Sei un analista di marketing digitale. Devi analizzare la comunicazione social e advertising di: ${competitorName} (${competitorDomain})

MIA (itsmia.it) e' il nostro brand - piattaforma AI italiana di shooting digitale per fashion e-commerce.

REGOLA FONDAMENTALE: RIPORTA SOLO INFORMAZIONI VERIFICATE.
- NON inventare numeri, copy, hashtag o dati che non hai trovato online
- Se non trovi un dato, scrivi "Non rilevato" - MAI inventare
- Per ogni sezione indica il livello di attendibilita' dei dati
- Cerca su Facebook Ad Library (https://www.facebook.com/ads/library/) per le ads reali
- Cerca i profili social reali su Instagram, LinkedIn, TikTok
- Analizza il sito web ${competitorDomain} per il messaging

CERCA SU GOOGLE informazioni verificabili su:
1. "${competitorName}" site:facebook.com/ads/library - ads attive reali
2. "${competitorName}" Instagram / LinkedIn / TikTok - profili social reali
3. ${competitorDomain} - sito web, messaggi, copy reali
4. "${competitorName}" reviews OR case study - articoli e fonti terze

RISPONDI IN ITALIANO con questo formato JSON esatto:
{
  "competitor": "${competitorName}",
  "attendibilita": "alta|media|bassa",
  "nota_attendibilita": "spiegazione di quanti dati reali hai trovato e quanti sono stime",
  "fonti_trovate": ["url o descrizione fonte 1", "url o descrizione fonte 2"],
  "meta_ads": {
    "attivo": true,
    "num_ads_stimato": "range o 'Non rilevato'",
    "formati_principali": ["formato verificato"],
    "copy_esempi": ["SOLO copy reali trovati online, oppure array vuoto se non trovati"],
    "cta_principali": ["CTA verificate"],
    "tone_of_voice": "basato su dati reali o 'Non rilevato'",
    "punti_chiave": ["solo punti verificati"]
  },
  "social_content": {
    "piattaforme_attive": ["solo piattaforme dove hai trovato profili reali"],
    "frequenza_post": "basata su dati reali o 'Non rilevato'",
    "temi_ricorrenti": ["solo temi verificati dai post reali"],
    "hashtag_principali": ["solo hashtag trovati nei post reali"],
    "engagement_stimato": "basato su dati reali o 'Non rilevato'",
    "formato_prevalente": "basato su dati reali o 'Non rilevato'"
  },
  "messaging": {
    "usp_principale": "dal sito web reale",
    "angoli_comunicativi": ["dal sito e ads reali"],
    "target_percepito": "dal posizionamento reale",
    "differenziazione_vs_mia": "basata su dati reali"
  },
  "valutazione_complessiva": "sintesi basata SOLO su cio' che hai effettivamente trovato",
  "suggerimenti_per_mia": ["suggerimento 1 basato su dati reali", "suggerimento 2"]
}

Regole CRITICHE:
- attendibilita "alta" = hai trovato fonti dirette (Ad Library, profili social, sito). "media" = hai trovato alcune info ma non tutto. "bassa" = pochi dati trovati, molte stime.
- Se non trovi ads nella Facebook Ad Library, metti "attivo": false e "Non rilevato" nei campi
- NON generare copy di fantasia. Se non trovi copy reali, lascia l'array vuoto []
- Elenca le fonti reali che hai consultato nel campo "fonti_trovate"
- RISPONDI SOLO con il JSON`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: 'HIGH' }
      },
      tools: [{ googleSearch: {} }]
    });

    const parsed = extractJson(response.text);
    const result = validateSocialAnalysisResponse(parsed, competitorName);
    setCache(cacheKey, result, CACHE_TTL_SOCIAL_ANALYSIS);
    return result;
  } catch (error) {
    console.error('[GeminiService] SocialAnalysis error:', error.message);
    return null;
  }
}

function validateSocialAnalysisResponse(parsed, competitorName) {
  const result = {
    competitor: parsed.competitor || competitorName,
    meta_ads: {
      attivo: parsed.meta_ads?.attivo ?? false,
      num_ads_stimato: String(parsed.meta_ads?.num_ads_stimato || 'Non rilevato'),
      formati_principali: Array.isArray(parsed.meta_ads?.formati_principali) ? parsed.meta_ads.formati_principali.map(String) : [],
      copy_esempi: Array.isArray(parsed.meta_ads?.copy_esempi) ? parsed.meta_ads.copy_esempi.map(String) : [],
      cta_principali: Array.isArray(parsed.meta_ads?.cta_principali) ? parsed.meta_ads.cta_principali.map(String) : [],
      tone_of_voice: String(parsed.meta_ads?.tone_of_voice || 'Non rilevato'),
      punti_chiave: Array.isArray(parsed.meta_ads?.punti_chiave) ? parsed.meta_ads.punti_chiave.map(String) : []
    },
    social_content: {
      piattaforme_attive: Array.isArray(parsed.social_content?.piattaforme_attive) ? parsed.social_content.piattaforme_attive.map(String) : [],
      frequenza_post: String(parsed.social_content?.frequenza_post || 'Non rilevato'),
      temi_ricorrenti: Array.isArray(parsed.social_content?.temi_ricorrenti) ? parsed.social_content.temi_ricorrenti.map(String) : [],
      hashtag_principali: Array.isArray(parsed.social_content?.hashtag_principali) ? parsed.social_content.hashtag_principali.map(String) : [],
      engagement_stimato: String(parsed.social_content?.engagement_stimato || 'Non rilevato'),
      formato_prevalente: String(parsed.social_content?.formato_prevalente || 'Non rilevato')
    },
    messaging: {
      usp_principale: String(parsed.messaging?.usp_principale || 'Non rilevato'),
      angoli_comunicativi: Array.isArray(parsed.messaging?.angoli_comunicativi) ? parsed.messaging.angoli_comunicativi.map(String) : [],
      target_percepito: String(parsed.messaging?.target_percepito || 'Non rilevato'),
      differenziazione_vs_mia: String(parsed.messaging?.differenziazione_vs_mia || 'Non rilevato')
    },
    valutazione_complessiva: String(parsed.valutazione_complessiva || 'Analisi non disponibile'),
    suggerimenti_per_mia: Array.isArray(parsed.suggerimenti_per_mia) ? parsed.suggerimenti_per_mia.map(String) : [],
    attendibilita: String(parsed.attendibilita || 'bassa'),
    nota_attendibilita: String(parsed.nota_attendibilita || 'Livello di attendibilita\' non specificato dall\'AI.'),
    fonti_trovate: Array.isArray(parsed.fonti_trovate) ? parsed.fonti_trovate.map(String) : []
  };

  return result;
}
