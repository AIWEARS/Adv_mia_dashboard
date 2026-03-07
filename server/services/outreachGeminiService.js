/**
 * OUTREACH GEMINI SERVICE
 * Servizio AI per qualificazione lead e generazione email outreach.
 * Usa gemini-3.1-flash-lite-preview con thinking HIGH (diverso dal dashboard che usa gemini-3-flash-preview).
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
const MODEL = 'gemini-3.1-flash-lite-preview';
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

const EMAIL_SYSTEM_INSTRUCTION = `Sei un copywriter esperto di cold email per il settore fashion-tech.
Scrivi email brevi, dirette, personalizzate. Tono: da founder a founder.

NON usare mai:
- 'Spero che tu stia bene'
- 'Mi permetto di scriverti'
- Frasi generiche tipo 'nel panorama competitivo attuale'
- Emoji nel corpo dell'email

FIRMA: Federico, MIA - itsmia.it

LINK OBBLIGATORI:
- CTA: app.miafashion.it (prova gratuita)
- In fondo: link unsubscribe {{unsubscribe}} (per GDPR)`;

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

      return response.text?.trim() || null;
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
      return `Scrivi la prima cold email per ${lead.contact_name} di ${lead.company}.

${base}

L'email deve:
- Aprire con un complimento genuino e specifico sul brand
- Presentare brevemente MIA come soluzione al loro pain point
- Includere un dato concreto (riduzione costi shooting del 90%, da settimane a minuti)
- CTA: invito a provare gratuitamente su app.miafashion.it
- Max 120 parole
- Includere in fondo: {{unsubscribe}} per GDPR

Restituisci SOLO il testo dell'email.`;

    case 2:
      return `Scrivi il follow-up #2 per ${lead.contact_name} di ${lead.company}. Non hanno risposto.

${base}

L'email deve:
- NON iniziare con 'Volevo fare follow-up'
- Condividere un caso d'uso concreto (es: 'Un brand simile ha generato l'intero lookbook in 2 ore invece di 3 giorni')
- Mostrare un beneficio specifico per ${lead.product_category}
- CTA: link a app.miafashion.it per provare gratis
- Max 100 parole
- Includere in fondo: {{unsubscribe}}

Restituisci SOLO il testo dell'email.`;

    case 3:
      return `Scrivi la terza email per ${lead.contact_name} di ${lead.company}.

${base}

L'email deve:
- Raccontare brevemente come un brand simile usa MIA
- Enfatizzare il ROI (tempo risparmiato, costi ridotti)
- Creare leggera urgenza senza essere pushy
- CTA: 'Prova gratis - nessuna carta di credito richiesta' -> app.miafashion.it
- Max 100 parole
- Includere in fondo: {{unsubscribe}}

Restituisci SOLO il testo dell'email.`;

    case 4:
      return `Scrivi l'ultima email (breakup) per ${lead.contact_name} di ${lead.company}.

${base}

L'email deve:
- Breve e diretta
- Riconosci che sono impegnati
- Riassumi in una frase il valore di MIA per loro
- Lascia la porta aperta
- CTA finale: link a app.miafashion.it
- Max 80 parole
- Includere in fondo: {{unsubscribe}}

Restituisci SOLO il testo dell'email.`;

    default:
      return `Scrivi un'email di outreach per ${lead.contact_name} di ${lead.company}.\n\n${base}\n\nMax 100 parole. Restituisci SOLO il testo.`;
  }
}

// ============================================================
// GENERAZIONE OGGETTI EMAIL (A/B)
// ============================================================

export async function generateEmailSubjects(lead, emailNumber) {
  const ai = getClient();
  if (!ai) return null;

  const language = getLanguage(lead.country);

  const prompt = `Genera 2 varianti di oggetto email per una cold email a ${lead.contact_name}, ${lead.contact_title} di ${lead.company} (brand di ${lead.product_category}).

L'email parla di: generazione contenuti fashion con AI per ridurre costi shooting.

Regole:
- Max 50 caratteri per oggetto
- Variante A: diretta/professionale
- Variante B: curiosa/creativa
- Personalizza con il nome del brand
- NO emoji, NO clickbait, NO ALL CAPS
- Lingua: ${language}

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
