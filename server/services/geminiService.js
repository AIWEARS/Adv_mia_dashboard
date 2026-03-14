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
const CACHE_TTL_PED_MIA = 4 * 60 * 60 * 1000; // 4 ore

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

export async function generateDiagnosis(unifiedData, competitorData = null) {
  const cacheKey = `diagnosis_v2_${simpleHash(unifiedData)}_${competitorData ? simpleHash(competitorData) : 'nocomp'}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const ai = getClient();
  if (!ai) return null;

  // Prepara sezione competitor per il prompt
  let competitorSection = '';
  if (competitorData) {
    competitorSection = `

ANALISI COMPETITOR GIA' EFFETTUATA:
${competitorData.competitors ? competitorData.competitors.map(c => `- ${c.nome} (${c.dominio}): ${c.descrizione || ''}
  Punti di forza: ${(c.punti_forza || []).join(', ')}
  Punti deboli: ${(c.punti_deboli || []).join(', ')}
  Comunicazione: ${c.comunicazione || 'N/A'}
  Creativita: ${c.creativita || 'N/A'}`).join('\n') : 'Nessun competitor analizzato'}

COSA I COMPETITOR FANNO MEGLIO DI MIA:
${(competitorData.cose_che_fanno_meglio || []).map((c, i) => `${i + 1}. ${c}`).join('\n') || 'Non disponibile'}

OPPORTUNITA PER DIFFERENZIARSI:
${(competitorData.opportunita_per_differenziarsi || []).map((o, i) => `${i + 1}. ${o}`).join('\n') || 'Non disponibile'}

IDEE ANNUNCI DAI COMPETITOR:
${(competitorData.idee_annunci || []).map(i => `- "${i.copy}" (angolo: ${i.angolo}, formato: ${i.formato})`).join('\n') || 'Non disponibile'}`;
  }

  // Calcola metriche aggregate per il prompt
  const totalSpend = unifiedData.spesa_totale || 0;
  const totalClicks = unifiedData.click_totali || 0;
  const totalImpressions = unifiedData.impressioni_totali || 0;
  const totalLeads = unifiedData.conversioni?.lead_preventivo || 0;
  const cpl = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : 'N/A (0 lead)';
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0';
  const cpc = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : 'N/A';

  const prompt = `Sei un consulente senior di advertising digitale specializzato in SaaS B2B. Devi analizzare i dati REALI delle campagne di MIA e fornire un'analisi IMPIETOSA e CONCRETA.

=== DATI CAMPAGNE REALI ===
${JSON.stringify(unifiedData, null, 2)}

=== METRICHE AGGREGATE (calcolate dai dati) ===
- Spesa totale: ${totalSpend} euro
- Click totali: ${totalClicks}
- Impressioni totali: ${totalImpressions}
- Lead totali: ${totalLeads}
- CPL: ${cpl} euro
- CTR: ${ctr}%
- CPC: ${cpc} euro

=== CONTESTO BUSINESS MIA ===
- MIA (itsmia.it) = piattaforma AI di shooting digitale per fashion e-commerce
- Genera foto professionali di modelle con AI generativa
- Target: fashion retailer e aziende e-commerce (B2B)
- Webapp: app.miafashion.it
- Funnel: Annuncio > Landing (itsmia.it) > Webapp > Registrazione > Acquisto/Abbonamento

=== BENCHMARK DI RIFERIMENTO (SaaS B2B / AI Tools) ===
- CTR Google Search: benchmark 3-5%, accettabile >2%, critico <1%
- CTR Meta Ads: benchmark 1-2%, accettabile >0.8%, critico <0.5%
- CPC Google Search: benchmark 2-5 euro, buono <2 euro, alto >5 euro
- CPC Meta: benchmark 0.50-2 euro, buono <1 euro, alto >3 euro
- CPL (costo per lead): benchmark 50-100 euro, accettabile <150 euro, critico >200 euro
- CR landing page: benchmark 3-5%, minimo accettabile 2%
- Frequenza Meta: ideale 1.5-3, troppo alta >4 (ad fatigue)
- CPM Meta: benchmark 5-15 euro, alto >20 euro
${competitorSection}

=== ISTRUZIONI PER L'ANALISI ===

Analizza OGNI SINGOLA CAMPAGNA e l'insieme dei dati. Per ogni metrica indica CHIARAMENTE:
- Il valore attuale
- Il benchmark di riferimento
- Se e' buono, nella media, o critico
- COSA FARE CONCRETAMENTE per migliorarlo

NON dare consigli generici tipo "migliora il targeting" o "ottimizza le creativita".
DA' istruzioni OPERATIVE tipo:
- "Il CTR di questa campagna e' 0.5%, cioe' MENO DELLA META del benchmark (1-2%). Questo significa che le persone vedono l'annuncio ma non cliccano. Devi: 1) Cambiare la headline con un gancio numerico es. 'Riduci del 90% i costi di shooting' 2) Testare 3 varianti di immagine con before/after 3) Restringere il pubblico ai soli decision maker fashion"

RISPONDI IN ITALIANO con questo formato JSON esatto:
{
  "analisi_campagne": [
    {
      "nome_campagna": "nome esatto della campagna dai dati",
      "piattaforma": "Google Ads o Meta Ads",
      "verdetto": "buona|da_ottimizzare|critica|da_spegnere",
      "metriche": {
        "spesa": 0,
        "click": 0,
        "impressioni": 0,
        "ctr": 0,
        "cpc": 0,
        "conversioni": 0,
        "cpl": 0
      },
      "confronto_benchmark": "CTR X% vs benchmark Y% = SOPRA/SOTTO media. CPC X euro vs benchmark Y euro = OK/ALTO. CPL X euro vs obiettivo <100 euro = OK/CRITICO",
      "problemi": ["problema specifico con NUMERI: 'CTR 0.3% = 6x sotto benchmark 2%'", "altro problema con dati"],
      "cosa_fare": ["azione OPERATIVA specifica: 'Vai su Google Ads > Campagna X > Annunci > Crea variante con headline: ...'", "altra azione con step precisi"]
    }
  ],
  "issues": [
    {
      "id": "id_unico",
      "area": "creativita|budget|conversioni|funnel|targeting|landing_page|copy",
      "titolo": "titolo breve e diretto",
      "gravita": "critica|alta|media",
      "descrizione": "descrizione con NUMERI SPECIFICI dai dati e confronto con benchmark",
      "impatto": "impatto economico: 'Stai sprecando X euro/mese perche...' oppure 'Potresti ottenere X lead in piu se...'",
      "azione": "STEP OPERATIVI numerati:\n1. Apri Google/Meta Ads\n2. Vai su...\n3. Modifica...\n4. Risultato atteso: ..."
    }
  ],
  "da_competitor": [
    {
      "id": "comp_insight_1",
      "competitor": "nome del competitor",
      "cosa_fanno": "cosa fa il competitor CONCRETAMENTE (es: 'usano video before/after negli annunci Meta con hook nei primi 3 secondi')",
      "come_applicarlo": "COME MIA puo copiare questa strategia: step 1, step 2, step 3",
      "priorita": "alta|media|bassa",
      "tipo": "copy|creativita|targeting|formato|landing|offerta"
    }
  ],
  "azioni_immediate": [
    {
      "id": "azione_1",
      "titolo": "titolo azione chiaro e specifico",
      "descrizione": "COSA FARE passo per passo. Esempio: 'Apri Meta Ads Manager > Vai sulla campagna X > Duplicala > Nel duplicato cambia: 1) Pubblico: restringi a...' 2) Copy: usa headline...'",
      "tempo_stimato": "30 min|1 ora|2 ore|mezza giornata",
      "impatto_atteso": "risultato numerico atteso: 'CTR atteso +50%, risparmio stimato X euro/mese'",
      "priorita": "alta|media|bassa"
    }
  ],
  "copy_suggeriti": [
    {
      "id": "copy_1",
      "titolo_annuncio": "headline PRONTA da copiare e incollare",
      "descrizione_annuncio": "description PRONTA da copiare e incollare",
      "angolo": "angolo comunicativo (risparmio|qualita|velocita|tecnologia|social_proof)",
      "piattaforma": "Google Ads|Meta Ads|Entrambe",
      "formato": "search|display|video|carosello|story|reel",
      "perche_funziona": "spiegazione breve di perche questo copy dovrebbe convertire meglio"
    }
  ],
  "budget_consiglio": {
    "budget_attuale": "distribuzione attuale con numeri: 'Google: X euro (Y%), Meta: Z euro (W%)'",
    "budget_consigliato": "nuova distribuzione con motivazione numerica",
    "motivazione": "basata sui dati: 'La campagna X su Google ha CPL Y, mentre su Meta ha CPL Z, quindi...'",
    "risparmio_stimato": "quanto si puo risparmiare o quanti lead in piu ottenere"
  }
}

REGOLE CRITICHE:
- analisi_campagne: analizza OGNI singola campagna. Il campo "confronto_benchmark" deve avere numeri reali vs benchmark
- issues: 3-7 problemi REALI. Mai generico. Sempre con numeri dai dati e confronto benchmark
- da_competitor: 3-6 insight CONCRETI (se competitor data disponibile). Con step operativi
- azioni_immediate: 5-8 azioni ordinate per priorita. Ogni azione deve essere un TUTORIAL operativo
- copy_suggeriti: 3-5 copy PRONTI ALL'USO, con headline e description complete, non abbozzi
- budget_consiglio: con numeri specifici e risparmio stimato
- OGNI dato che citi deve venire dalla tabella dati fornita, MAI inventare numeri
- Se una campagna ha speso soldi senza conversioni, il verdetto DEVE essere "da_spegnere" o "critica"
- Se il CPL e' sopra 200 euro, e' CRITICO. Se e' sopra 150 euro e' da_ottimizzare. Se e' sotto 80 euro e' buono`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: 'HIGH' },
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
    analisi_campagne: [],
    issues: [],
    da_competitor: [],
    azioni_immediate: [],
    copy_suggeriti: [],
    budget_consiglio: null,
    fonte: 'ai',
    ultimo_aggiornamento: new Date().toISOString()
  };

  if (Array.isArray(parsed.analisi_campagne)) {
    result.analisi_campagne = parsed.analisi_campagne
      .filter(c => c.nome_campagna)
      .map((camp, idx) => ({
        nome_campagna: String(camp.nome_campagna),
        piattaforma: String(camp.piattaforma || ''),
        verdetto: ['buona', 'da_ottimizzare', 'critica', 'da_spegnere'].includes(camp.verdetto) ? camp.verdetto : 'da_ottimizzare',
        metriche: camp.metriche || {},
        confronto_benchmark: String(camp.confronto_benchmark || ''),
        problemi: Array.isArray(camp.problemi) ? camp.problemi.map(String) : [],
        cosa_fare: Array.isArray(camp.cosa_fare) ? camp.cosa_fare.map(String) : []
      }));
  }

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

  if (Array.isArray(parsed.da_competitor)) {
    result.da_competitor = parsed.da_competitor
      .filter(c => c.cosa_fanno && c.come_applicarlo)
      .map((comp, idx) => ({
        id: comp.id || `comp_insight_${idx}`,
        competitor: String(comp.competitor || ''),
        cosa_fanno: String(comp.cosa_fanno),
        come_applicarlo: String(comp.come_applicarlo),
        priorita: ['alta', 'media', 'bassa'].includes(comp.priorita) ? comp.priorita : 'media',
        tipo: String(comp.tipo || 'generale')
      }));
  }

  if (Array.isArray(parsed.azioni_immediate)) {
    result.azioni_immediate = parsed.azioni_immediate
      .filter(a => a.titolo && a.descrizione)
      .map((action, idx) => ({
        id: action.id || `azione_${idx}`,
        titolo: String(action.titolo),
        descrizione: String(action.descrizione),
        tempo_stimato: String(action.tempo_stimato || '1 ora'),
        impatto_atteso: String(action.impatto_atteso || ''),
        priorita: ['alta', 'media', 'bassa'].includes(action.priorita) ? action.priorita : 'media'
      }));
  }

  if (Array.isArray(parsed.copy_suggeriti)) {
    result.copy_suggeriti = parsed.copy_suggeriti
      .filter(c => c.titolo_annuncio)
      .map((copy, idx) => ({
        id: copy.id || `copy_${idx}`,
        titolo_annuncio: String(copy.titolo_annuncio),
        descrizione_annuncio: String(copy.descrizione_annuncio || ''),
        angolo: String(copy.angolo || ''),
        piattaforma: String(copy.piattaforma || 'Entrambe'),
        formato: String(copy.formato || 'search'),
        perche_funziona: String(copy.perche_funziona || '')
      }));
  }

  if (parsed.budget_consiglio) {
    result.budget_consiglio = {
      budget_attuale: String(parsed.budget_consiglio.budget_attuale || ''),
      budget_consigliato: String(parsed.budget_consiglio.budget_consigliato || ''),
      motivazione: String(parsed.budget_consiglio.motivazione || ''),
      risparmio_stimato: String(parsed.budget_consiglio.risparmio_stimato || '')
    };
  }

  // Backward compatibility: generate suggerimenti from azioni_immediate
  result.suggerimenti = result.azioni_immediate.map((a, idx) => ({
    id: `sug_${idx}`,
    titolo: a.titolo,
    descrizione: a.descrizione
  }));

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
