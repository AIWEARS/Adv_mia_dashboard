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

const EMAIL_SYSTEM_INSTRUCTION = `Sei Federico, co-founder di MIA.
Scrivi email brevissime e semplici in italiano corretto. Devono sembrare scritte da una persona vera, non da un software.

COS'E' MIA (itsmia.it):
MIA e' un'app che permette ai brand di moda di creare foto dei propri vestiti indossati da modelli virtuali. Funziona cosi': carichi le foto dei tuoi prodotti (anche su sfondo bianco), scegli un modello AI, e in pochi minuti ottieni foto professionali come se avessi fatto uno shooting vero. Costa molto meno di uno shooting tradizionale e si fa tutto online. Si puo' provare gratis su app.miafashion.it.

COME SCRIVERE:
- Scrivi in italiano semplice e corretto, come scriveresti a un conoscente
- Frasi brevi e chiare. Niente paroloni, niente gergo marketing
- Non fare complimenti falsi al brand, non fingere di conoscerli
- Non usare parole come "innovativo", "rivoluzionario", "sinergia", "panorama competitivo"
- Non usare emoji
- Non iniziare con "Spero stia bene", "Mi permetto di", "La contatto per"
- Vai dritto al punto: spiega cosa fa MIA e perche' puo' servirgli
- Chiudi sempre con: Federico, MIA - itsmia.it`;

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
Contatto: ${lead.contact_name}
Categoria: ${lead.product_category}
Lingua: ${language}`;

  switch (emailNumber) {
    case 1:
      return `Scrivi un'email semplice per ${lead.contact_name} di ${lead.company}.

${base}

Scrivi un'email che:
1. Saluta ${lead.contact_name} in modo naturale
2. Spiega in parole semplici cosa fa MIA: un'app dove carichi le foto dei tuoi prodotti e ottieni foto con modelli virtuali che li indossano, in pochi minuti
3. Spiega perche' e' utile per chi ha un e-commerce di moda: costa molto meno di uno shooting fotografico tradizionale e si fa tutto online
4. Dica che possono provarlo gratis su app.miafashion.it
5. Chiudi con: Federico, MIA - itsmia.it

Max 60 parole. Tono semplice e diretto, come un messaggio tra colleghi.
Restituisci SOLO il testo dell'email, senza oggetto.`;

    case 2:
      return `Scrivi un secondo messaggio per ${lead.contact_name} di ${lead.company}. Non hanno risposto al primo.

${base}

Scrivi un'email breve che:
1. NON dire "ti riscrivo" o "volevo fare follow-up"
2. Spiega un vantaggio concreto: le schede prodotto con foto indossate vendono di piu' e generano meno resi rispetto alle foto su sfondo bianco
3. Con MIA possono avere queste foto in pochi minuti partendo dalle foto che hanno gia'
4. Possono provare gratis su app.miafashion.it
5. Chiudi con: Federico, MIA - itsmia.it

Max 60 parole. Tono naturale, come se scrivessi a un conoscente.
Restituisci SOLO il testo dell'email, senza oggetto.`;

    case 3:
      return `Scrivi un terzo messaggio per ${lead.contact_name} di ${lead.company}.

${base}

Scrivi un'email breve che:
1. Parla del risparmio: uno shooting tradizionale costa migliaia di euro e richiede settimane tra organizzazione, fotografi, modelle, studio. Con MIA si fa tutto in pochi minuti e costa una frazione
2. Possono provare gratis su app.miafashion.it per vedere come funziona
3. Chiudi con: Federico, MIA - itsmia.it

Max 60 parole. Tono diretto e amichevole.
Restituisci SOLO il testo dell'email, senza oggetto.`;

    case 4:
      return `Scrivi un ultimo breve messaggio per ${lead.contact_name} di ${lead.company}.

${base}

Scrivi 2-3 righe massimo:
1. Dì che non vuoi disturbare ulteriormente
2. Ricorda solo che MIA permette di creare foto con modelli virtuali per e-commerce di moda
3. Lasciagli il link app.miafashion.it se in futuro vogliono provare
4. Chiudi con: Federico, MIA - itsmia.it

Max 40 parole. Brevissimo e naturale.
Restituisci SOLO il testo dell'email, senza oggetto.`;

    default:
      return `Scrivi un'email semplice per ${lead.contact_name} di ${lead.company}.\n\n${base}\n\nSpiega cosa fa MIA e che possono provarlo gratis su app.miafashion.it. Max 60 parole. Restituisci SOLO il testo.`;
  }
}

// ============================================================
// GENERAZIONE OGGETTI EMAIL (A/B)
// ============================================================

export async function generateEmailSubjects(lead, emailNumber) {
  const ai = getClient();
  if (!ai) return null;

  const language = getLanguage(lead.country);

  const prompt = `Genera 2 oggetti email per ${lead.contact_name} di ${lead.company}.

L'email parla di MIA, un'app per creare foto con modelli virtuali per e-commerce di moda.

Regole:
- Max 45 caratteri per oggetto
- Variante A: semplice e diretta (es: "Foto prodotto per ${lead.company}")
- Variante B: domanda breve (es: "Foto indossate senza shooting?")
- Devono sembrare oggetti scritti da una persona, non da un software
- NO emoji, NO maiuscole, NO punti esclamativi
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
