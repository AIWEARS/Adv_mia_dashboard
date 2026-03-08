/**
 * OUTREACH GEMINI SERVICE
 * Servizio AI per qualificazione lead e generazione email outreach.
 * Usa gemini-3-flash-preview per qualita' testo italiano superiore.
 */

let GoogleGenAI;
try {
  const mod = await import('@google/genai');
  GoogleGenAI = mod.GoogleGenAI;
} catch (e) {
  console.warn('[OutreachGemini] @google/genai not available:', e.message);
  GoogleGenAI = null;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-3-flash-preview';
let client = null;

function getClient() {
  if (!client && GEMINI_API_KEY && GoogleGenAI) {
    client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return client;
}

export function isOutreachGeminiAvailable() {
  return !!(GEMINI_API_KEY && GoogleGenAI);
}

// --- Helper: estrai JSON da testo ---
function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    // Prova con array
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) return JSON.parse(arrMatch[0]);
    throw new Error('Nessun JSON trovato nella risposta');
  }
}

// --- Helper: sleep per retry ---
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- ICP Scoring Criteria (dal CLAUDE.md) ---
const ICP_SYSTEM_INSTRUCTION = `Sei un esperto analista di business nel settore fashion-tech.
Analizzi brand di moda e valuti la probabilita che beneficino di una piattaforma AI per generare foto prodotto e contenuti fashion.

CONTESTO MIA:
- MIA (itsmia.it) e' una piattaforma AI per fashion e-commerce
- Genera foto prodotto con modelli AI, virtual try-on, lookbook, campagne social
- Abbonamento SaaS mensile su app.miafashion.it
- Riduzione costi shooting del 90%, tempi da settimane a minuti
- Perfetto per brand emergenti, DNVB, piccoli e-commerce fashion

ICP (Ideal Customer Profile):
- Brand moda emergenti e indipendenti (0-50 dipendenti)
- DNVB (Digitally Native Vertical Brands) nel fashion
- E-commerce abbigliamento piccoli e medi
- Brand streetwear, sustainable fashion, slow fashion
- Designer indipendenti che vendono online

SEGNALI POSITIVI:
- Ha e-commerce attivo (Shopify, WooCommerce, etc) con foto qualita bassa/media
- Catalogo medio-grande (50+ SKU)
- Attivo sui social ma con contenuti visivi migliorabili
- Ha raccolto fondi o in fase di crescita
- Vende su marketplace (Zalando, Farfetch, ASOS Marketplace, Etsy)

CHI NON E' IN TARGET:
- Luxury brand affermati (hanno budget per shooting tradizionali)
- Brand senza e-commerce
- Brand di accessori puri (borse, gioielli) - focus e' abbigliamento
- Marketplace/retailer multibrand

Rispondi SOLO in JSON.`;

// ============================================================
// QUALIFICAZIONE LEAD (batch da 10, retry)
// ============================================================

export async function qualifyLeadBatch(leads) {
  const ai = getClient();
  if (!ai) return null;

  const prompt = `Analizza questi brand e assegna un punteggio da 0 a 100 per ciascuno.

LEAD DA QUALIFICARE:
${JSON.stringify(leads.map(l => ({
  id: l.id,
  company: l.company,
  website: l.website,
  product_category: l.product_category,
  ecommerce_platform: l.ecommerce_platform,
  instagram_followers: l.instagram_followers,
  estimated_sku_count: l.estimated_sku_count,
  current_photo_quality: l.current_photo_quality,
  social_activity_score: l.social_activity_score,
  country: l.country,
  estimated_employees: l.estimated_employees,
  has_ecommerce: l.has_ecommerce
})), null, 2)}

Per ogni lead rispondi con questo formato JSON:
{
  "qualifications": [
    {
      "id": "lead_id",
      "score": 75,
      "fit_reason": "Motivo principale per cui sono in target",
      "pain_point": "Il loro problema principale che MIA risolve",
      "hook": "Un aggancio personalizzato per il primo contatto",
      "recommended_service": "content_generation | virtual_tryon | lookbook | social_content",
      "priority": "hot | warm | cold"
    }
  ]
}

Regole scoring:
- Score >= 70: HOT (sequenza email aggressiva)
- Score 50-69: WARM (sequenza standard)
- Score < 50: COLD (skip o nurturing)
- Sii specifico nel pain_point e nell'hook: devono essere personalizzati per il brand
- Il recommended_service deve essere il piu adatto per quel tipo di brand`;

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          systemInstruction: ICP_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json'
        }
      });

      const parsed = extractJson(response.text);
      return validateQualifications(parsed, leads);
    } catch (error) {
      console.error(`[OutreachGemini] Qualify attempt ${attempt + 1}/${maxRetries} failed:`, error.message);
      if (attempt < maxRetries - 1) {
        await sleep(Math.pow(2, attempt) * 1000); // Backoff esponenziale: 1s, 2s, 4s
      }
    }
  }
  return null;
}

function validateQualifications(parsed, leads) {
  const qualifications = parsed.qualifications || parsed;
  if (!Array.isArray(qualifications)) return [];

  return qualifications
    .filter(q => q.id && q.score !== undefined)
    .map(q => ({
      id: String(q.id),
      score: Math.max(0, Math.min(100, parseInt(q.score) || 0)),
      fit_reason: String(q.fit_reason || ''),
      pain_point: String(q.pain_point || ''),
      hook: String(q.hook || ''),
      recommended_service: ['content_generation', 'virtual_tryon', 'lookbook', 'social_content'].includes(q.recommended_service)
        ? q.recommended_service : 'content_generation',
      priority: q.score >= 70 ? 'hot' : q.score >= 50 ? 'warm' : 'cold'
    }));
}

// ============================================================
// GENERAZIONE EMAIL OUTREACH
// ============================================================

const EMAIL_SYSTEM_INSTRUCTION = `Sei Federico, co-founder di MIA (itsmia.it), startup innovativa italiana che aiuta e-commerce di moda a scalare.
Scrivi email brevi, dirette, in italiano naturale. Tono: da imprenditore a imprenditore, informale ma professionale.

COS'E' MIA:
- Piattaforma AI che genera foto prodotto indossate partendo da semplici foto flat (su sfondo bianco)
- Crea modelli AI realistici che indossano i vestiti del brand
- Genera outfit multipli e combinazioni automaticamente
- Da settimane di shooting tradizionali a pochi minuti
- Risparmio fino al 90% rispetto agli shooting tradizionali con modelli e fotografi
- Le schede prodotto con foto indossate convertono molto di piu' e generano meno resi

REGOLE ASSOLUTE — VIETATO usare:
- "Ho sempre apprezzato l'estetica coerente" o qualsiasi complimento finto al brand
- "Ho guardato la tua ultima collezione" o finta familiarita' col brand
- "Mi permetto di", "La contatto per", "Spero stia bene"
- "Resto a disposizione", "Nel panorama competitivo", "Sinergia"
- "Ho notato che il vostro brand...", "Seguo il vostro lavoro..."
- Qualsiasi frase che suoni generica, formale o scritta da AI
- Emoji nel corpo dell'email
- La parola "innovativo/a" riferita a MIA stessa

TONO GIUSTO:
- Vai dritto al punto: cosa fa MIA e perche' conviene
- Parla dei vantaggi concreti (risparmio tempo, soldi, piu' conversioni)
- Scrivi come scriveresti a un collega imprenditore, non a un cliente
- Frasi corte. Niente giri di parole.

FIRMA: Federico, MIA - itsmia.it
CTA: app.miafashion.it`;

export async function generateOutreachEmail(lead, emailNumber, sequenceType) {
  const ai = getClient();
  if (!ai) return null;

  const language = getLanguage(lead.country);
  const prompts = getEmailPrompt(lead, emailNumber, sequenceType, language);

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompts,
        config: {
          systemInstruction: EMAIL_SYSTEM_INSTRUCTION
        }
      });

      let text = response.text?.trim() || null;
      // Safety: rimuovi "Oggetto: ..." se Gemini lo include nonostante le istruzioni
      if (text) {
        text = text.replace(/^(?:Oggetto|Subject|Re):\s*[^\n]+\n+/i, '').trim();
      }
      return text;
    } catch (error) {
      console.error(`[OutreachGemini] Email gen attempt ${attempt + 1}/${maxRetries} failed:`, error.message);
      if (attempt < maxRetries - 1) {
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }
  return null;
}

function getLanguage(country) {
  const map = {
    'italy': 'italiano', 'italia': 'italiano', 'it': 'italiano',
    'spain': 'espanol', 'spagna': 'espanol', 'es': 'espanol',
    'france': 'francais', 'francia': 'francais', 'fr': 'francais',
    'uk': 'english', 'united kingdom': 'english', 'gb': 'english',
    'germany': 'deutsch', 'germania': 'deutsch', 'de': 'deutsch',
    'usa': 'english', 'us': 'english'
  };
  return map[(country || '').toLowerCase()] || 'italiano';
}

function getEmailPrompt(lead, emailNumber, sequenceType, language) {
  const base = `Brand: ${lead.company}
Contatto: ${lead.contact_name}, ${lead.contact_title}
Categoria: ${lead.product_category}
Piattaforma: ${lead.ecommerce_platform}
Pain point: ${lead.pain_point}
Hook: ${lead.hook}
Servizio consigliato: ${lead.recommended_service}
Lingua: ${language}`;

  switch (emailNumber) {
    case 1:
      return `Scrivi la prima email per ${lead.contact_name} di ${lead.company}.

${base}

OBIETTIVO: presentare MIA e i vantaggi concreti per il loro e-commerce.

L'email deve:
- Aprire con una frase diretta (tipo "Ciao [nome], ti scrivo perche'...")
- Spiegare in 2 righe cosa fa MIA: genera foto prodotto indossate da modelli AI partendo da foto flat
- Menzionare 1-2 vantaggi concreti: risparmio 90% vs shooting tradizionali, da settimane a minuti, schede prodotto con foto indossate convertono di piu' e generano meno resi
- CTA: invito a provare su app.miafashion.it
- Max 80 parole
- Chiudi con: Federico, MIA - itsmia.it

ESEMPIO DI TONO GIUSTO (NON copiare, usa come riferimento):
"Ciao Marco, ti scrivo perche' con MIA generiamo foto indossate per e-commerce di moda partendo da semplici foto flat. In pratica: carichi la foto del prodotto, scegli il modello AI, e in pochi minuti hai shooting completi senza fotografi, studi, modelle. Un brand come il tuo risparmia il 90% rispetto a uno shooting tradizionale. Se vuoi provarlo gratis: app.miafashion.it

Federico, MIA - itsmia.it"

IMPORTANTE: Restituisci SOLO il corpo dell'email. NON includere oggetto, "Oggetto:", "Subject:" o simili.`;

    case 2:
      return `Scrivi il follow-up #2 per ${lead.contact_name} di ${lead.company}. Non hanno risposto alla prima email.

${base}

OBIETTIVO: far capire il vantaggio competitivo delle foto indossate sulle schede prodotto.

L'email deve:
- NON iniziare con 'Volevo fare follow-up' o 'Ti riscrivo perche''
- Aprire con un dato/fatto concreto (es: le schede con foto indossate convertono fino al 30% in piu' e generano meno resi)
- Spiegare come MIA risolve questo: outfit multipli generati in automatico da foto flat
- CTA: app.miafashion.it
- Max 80 parole
- Chiudi con: Federico, MIA - itsmia.it

IMPORTANTE: Restituisci SOLO il corpo dell'email. NON includere oggetto.`;

    case 3:
      return `Scrivi la terza email per ${lead.contact_name} di ${lead.company}.

${base}

OBIETTIVO: enfatizzare il risparmio di tempo e soldi rispetto agli shooting tradizionali.

L'email deve:
- Aprire con una domanda diretta (es: "Quanto spendi per uno shooting con modelli e fotografo?")
- Spiegare il risparmio concreto: con MIA da settimane a minuti, costo ridotto del 90%
- Menzionare che si possono creare contenuti digitali variati senza shooting fisici
- CTA: prova gratis su app.miafashion.it
- Max 80 parole
- Chiudi con: Federico, MIA - itsmia.it

IMPORTANTE: Restituisci SOLO il corpo dell'email. NON includere oggetto.`;

    case 4:
      return `Scrivi l'ultima email (breakup) per ${lead.contact_name} di ${lead.company}.

${base}

OBIETTIVO: email breve di chiusura, lasciare la porta aperta.

L'email deve:
- Molto breve e diretta (3-4 righe max)
- Riassumere in una frase cosa fa MIA per e-commerce moda
- Lasciare il link per quando vorranno provare
- CTA: app.miafashion.it
- Max 50 parole
- Chiudi con: Federico, MIA - itsmia.it

IMPORTANTE: Restituisci SOLO il corpo dell'email. NON includere oggetto.`;

    default:
      return `Scrivi un'email di outreach per ${lead.contact_name} di ${lead.company}.\n\n${base}\n\nMax 80 parole. Restituisci SOLO il testo.`;
  }
}

// ============================================================
// GENERAZIONE OGGETTI EMAIL (A/B)
// ============================================================

export async function generateEmailSubjects(lead, emailNumber) {
  const ai = getClient();
  if (!ai) return null;

  const language = getLanguage(lead.country);

  const prompt = `Genera 2 varianti di oggetto email per ${lead.contact_name} di ${lead.company} (${lead.product_category}).

Contesto: l'email presenta MIA, piattaforma che genera foto prodotto indossate per e-commerce moda.

Regole:
- Max 50 caratteri per oggetto
- Variante A: diretta e concreta (es: "Foto indossate per ${lead.company} senza shooting")
- Variante B: domanda o curiosita' (es: "Shooting in 5 minuti?")
- NO emoji, NO clickbait, NO ALL CAPS, NO punti esclamativi
- Lingua: ${language}
- NON usare "innovativo", "rivoluzionario", "game-changer"

Restituisci SOLO un JSON: {"variant_a": "...", "variant_b": "..."}`;

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          systemInstruction: EMAIL_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json'
        }
      });

      const parsed = extractJson(response.text);
      return {
        variant_a: String(parsed.variant_a || ''),
        variant_b: String(parsed.variant_b || '')
      };
    } catch (error) {
      console.error(`[OutreachGemini] Subject gen attempt ${attempt + 1}/${maxRetries} failed:`, error.message);
      if (attempt < maxRetries - 1) {
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }
  return null;
}
