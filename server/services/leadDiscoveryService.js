/**
 * LEAD DISCOVERY SERVICE
 * Ricerca automatica lead fashion da Apollo.io + Google scraping.
 * Enrichment siti web con cheerio + pre-filtering AI con Gemini.
 */

import * as cheerio from 'cheerio';
import { addLeads, updateJob, saveStore } from './outreachStore.js';
import { isOutreachGeminiAvailable } from './outreachGeminiService.js';

const APOLLO_API_KEY = process.env.APOLLO_API_KEY || '';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const COUNTRY_LABELS = {
  IT: 'Italy', ES: 'Spain', FR: 'France', DE: 'Germany', UK: 'United Kingdom', US: 'United States'
};

const CATEGORY_KEYWORDS = {
  fashion: 'fashion apparel clothing brand',
  beauty: 'beauty cosmetics skincare brand',
  luxury: 'luxury brand designer',
  accessori: 'fashion accessories bags jewelry',
  calzature: 'shoes footwear sneakers brand'
};

// ============================================================
// APOLLO.IO SEARCH
// ============================================================

async function searchApollo(query, country, category, limit) {
  if (!APOLLO_API_KEY) {
    console.log('[Discovery] Apollo API key non configurata, skip');
    return [];
  }

  const leads = [];
  const countryLabel = COUNTRY_LABELS[country] || country;
  const categoryKw = CATEGORY_KEYWORDS[category] || category;

  try {
    // Step 1: Cerca aziende
    const orgResponse = await fetch('https://api.apollo.io/v1/mixed_companies/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: APOLLO_API_KEY,
        q_organization_keyword_tags: [`${query} ${categoryKw}`],
        organization_locations: [countryLabel],
        per_page: Math.min(limit, 100),
        page: 1
      })
    });

    if (!orgResponse.ok) {
      console.error('[Discovery] Apollo org search failed:', orgResponse.status);
      return [];
    }

    const orgData = await orgResponse.json();
    const orgs = orgData.organizations || [];

    for (const org of orgs.slice(0, limit)) {
      const lead = {
        company: org.name || '',
        website: org.website_url || '',
        country: country,
        source: 'apollo',
        estimated_employees: org.estimated_num_employees || 0,
        product_category: category,
        enrichment_data: {
          linkedin_url: org.linkedin_url || '',
          founded_year: org.founded_year,
          industry: org.industry || ''
        }
      };

      // Step 2: Cerca contatti per questa azienda
      if (org.id) {
        try {
          const peopleResponse = await fetch('https://api.apollo.io/v1/mixed_people/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: APOLLO_API_KEY,
              organization_ids: [org.id],
              per_page: 3,
              page: 1,
              person_titles: ['founder', 'ceo', 'cmo', 'marketing manager', 'ecommerce manager', 'head of marketing']
            })
          });

          if (peopleResponse.ok) {
            const peopleData = await peopleResponse.json();
            const people = peopleData.people || [];
            if (people.length > 0) {
              const person = people[0];
              lead.contact_name = `${person.first_name || ''} ${person.last_name || ''}`.trim();
              lead.contact_email = person.email || '';
              lead.contact_title = person.title || '';
              lead.contact_linkedin = person.linkedin_url || '';
            }
          }
        } catch (e) {
          // Skip errore contatto singolo
        }
      }

      leads.push(lead);
    }
  } catch (err) {
    console.error('[Discovery] Apollo search error:', err.message);
  }

  return leads;
}

// ============================================================
// GOOGLE SEARCH + SCRAPING
// ============================================================

async function searchGoogle(query, country, category, limit) {
  const leads = [];
  const countryLabel = COUNTRY_LABELS[country] || country;
  const categoryKw = CATEGORY_KEYWORDS[category] || category;
  const searchQuery = `${query} ${categoryKw} ${countryLabel} ecommerce site`;

  try {
    // Usa DuckDuckGo HTML (non richiede API key, meno restrittivo di Google)
    const encodedQuery = encodeURIComponent(searchQuery);
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodedQuery}`, {
      headers: { 'User-Agent': USER_AGENT }
    });

    if (!response.ok) {
      console.error('[Discovery] DuckDuckGo search failed:', response.status);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Estrai URL dai risultati
    const urls = new Set();
    $('a.result__a').each((_, el) => {
      const href = $(el).attr('href') || '';
      // DuckDuckGo wrappa gli URL, estraiamo l'URL effettivo
      const match = href.match(/uddg=([^&]+)/);
      if (match) {
        try {
          const decoded = decodeURIComponent(match[1]);
          const url = new URL(decoded);
          // Filtra risultati non-brand (marketplace, social, news)
          const skip = ['amazon.', 'ebay.', 'zalando.', 'facebook.', 'instagram.', 'linkedin.', 'twitter.',
                        'youtube.', 'wikipedia.', 'pinterest.', 'tiktok.', 'reddit.'];
          if (!skip.some(s => url.hostname.includes(s))) {
            urls.add(url.origin);
          }
        } catch {
          // URL non valido
        }
      }
    });

    // Anche link diretti
    $('a.result__url').each((_, el) => {
      const text = $(el).text().trim();
      if (text && !text.includes(' ')) {
        try {
          const url = new URL(text.startsWith('http') ? text : `https://${text}`);
          urls.add(url.origin);
        } catch { /* skip */ }
      }
    });

    for (const url of [...urls].slice(0, limit)) {
      const hostname = new URL(url).hostname.replace('www.', '');
      leads.push({
        company: hostname.split('.')[0].charAt(0).toUpperCase() + hostname.split('.')[0].slice(1),
        website: url,
        country: country,
        source: 'google',
        product_category: category
      });
    }
  } catch (err) {
    console.error('[Discovery] Google search error:', err.message);
  }

  return leads;
}

// ============================================================
// WEBSITE ENRICHMENT (scraping con cheerio)
// ============================================================

async function enrichLead(lead) {
  if (!lead.website) return lead;

  const url = lead.website.startsWith('http') ? lead.website : `https://${lead.website}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      lead.enrichment_data = { ...lead.enrichment_data, error: `HTTP ${response.status}` };
      return lead;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Titolo e descrizione
    lead.enrichment_data = {
      ...lead.enrichment_data,
      site_title: ($('title').text() || '').trim().substring(0, 200),
      site_description: ($('meta[name="description"]').attr('content') || '').trim().substring(0, 500)
    };

    // Migliora nome company dal titolo se generico
    if (lead.source === 'google' && $('title').text()) {
      const title = $('title').text().trim();
      const cleanName = title.split(/[|\-–—]/)[0].trim();
      if (cleanName && cleanName.length > 2 && cleanName.length < 60) {
        lead.company = cleanName;
      }
    }

    // Detect piattaforma ecommerce
    const htmlLower = html.toLowerCase();
    if (htmlLower.includes('shopify') || htmlLower.includes('cdn.shopify.com')) {
      lead.ecommerce_platform = 'shopify';
      lead.has_ecommerce = true;
    } else if (htmlLower.includes('woocommerce') || htmlLower.includes('wp-content')) {
      lead.ecommerce_platform = 'woocommerce';
      lead.has_ecommerce = true;
    } else if (htmlLower.includes('magento') || htmlLower.includes('mage-')) {
      lead.ecommerce_platform = 'magento';
      lead.has_ecommerce = true;
    } else if (htmlLower.includes('prestashop')) {
      lead.ecommerce_platform = 'prestashop';
      lead.has_ecommerce = true;
    } else if (htmlLower.includes('bigcommerce')) {
      lead.ecommerce_platform = 'bigcommerce';
      lead.has_ecommerce = true;
    } else if (htmlLower.includes('/cart') || htmlLower.includes('add-to-cart') || htmlLower.includes('add_to_cart')) {
      lead.ecommerce_platform = 'custom';
      lead.has_ecommerce = true;
    } else {
      lead.has_ecommerce = false;
    }

    // Stima SKU
    const productLinks = $('a[href*="/product"], a[href*="/prodott"], a[href*="/shop/"]').length;
    const productItems = $('[class*="product"], [data-product-id]').length;
    lead.estimated_sku_count = Math.max(productLinks, productItems);

    // Qualita foto
    const imgs = $('img');
    let highRes = 0;
    let totalProductImgs = 0;
    imgs.each((_, el) => {
      const src = $(el).attr('src') || '';
      const alt = $(el).attr('alt') || '';
      if (/product|prodott|item|shop|catalog/i.test(src + alt)) {
        totalProductImgs++;
        if (/1024|1200|1500|2000|large|grande/i.test(src)) {
          highRes++;
        }
      }
    });
    if (totalProductImgs > 0) {
      const ratio = highRes / totalProductImgs;
      lead.current_photo_quality = ratio >= 0.5 ? 'good' : ratio >= 0.2 ? 'medium' : 'poor';
    }

    // Instagram handle
    $('a[href*="instagram.com/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const match = href.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
      if (match && !['p', 'reel', 'stories', 'explore'].includes(match[1])) {
        lead.instagram_handle = match[1];
      }
    });

    // Email di contatto (nel footer o pagina contatti)
    const bodyText = $('body').text();
    const emailMatch = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch && !lead.contact_email) {
      // Filtra email generiche tipo noreply, support
      const found = emailMatch[0];
      if (!/noreply|no-reply|support|admin|webmaster|info@gmail/i.test(found)) {
        lead.contact_email = found;
      }
    }

    lead.status = 'enriched';
  } catch (err) {
    lead.enrichment_data = { ...lead.enrichment_data, error: err.message };
  }

  return lead;
}

// ============================================================
// PRE-FILTERING AI CON GEMINI
// ============================================================

async function preFilterBatch(leads) {
  if (!isOutreachGeminiAvailable()) {
    // Se Gemini non e' disponibile, passa tutti i lead
    return leads.map(l => ({ ...l, ai_relevant: true }));
  }

  let GoogleGenAI;
  try {
    const mod = await import('@google/genai');
    GoogleGenAI = mod.GoogleGenAI;
  } catch {
    return leads.map(l => ({ ...l, ai_relevant: true }));
  }

  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const leadsData = leads.map(l => ({
    company: l.company,
    website: l.website,
    ecommerce_platform: l.ecommerce_platform || 'unknown',
    has_ecommerce: l.has_ecommerce,
    product_category: l.product_category || 'unknown',
    site_title: l.enrichment_data?.site_title || '',
    site_description: l.enrichment_data?.site_description || '',
    estimated_sku_count: l.estimated_sku_count || 0,
    current_photo_quality: l.current_photo_quality || 'unknown'
  }));

  const prompt = `Analizza questi ${leadsData.length} potenziali lead per MIA (itsmia.it), piattaforma AI per foto prodotto fashion.

LEAD:
${JSON.stringify(leadsData, null, 2)}

Per ognuno rispondi: e' un brand fashion/beauty/lifestyle rilevante con e-commerce attivo che potrebbe beneficiare di foto prodotto AI?

Rispondi con un JSON array:
[{"company": "...", "relevant": true/false, "confidence": 0-100, "reason": "..."}]

Criteri:
- relevant=true: brand fashion/beauty/accessori CON e-commerce attivo
- relevant=false: non-fashion (ristoranti, software, servizi), marketplace, luxury brand enormi, no e-commerce
- confidence: quanto sei sicuro (0-100)`;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    let results;
    try {
      results = JSON.parse(response.text);
    } catch {
      const match = response.text.match(/\[[\s\S]*\]/);
      results = match ? JSON.parse(match[0]) : null;
    }

    if (Array.isArray(results)) {
      return leads.map((lead, i) => {
        const result = results[i] || results.find(r => r.company === lead.company);
        if (result) {
          lead.ai_relevant = result.relevant !== false && (result.confidence || 0) >= 40;
          lead.enrichment_data = {
            ...lead.enrichment_data,
            ai_filter_reason: result.reason || '',
            ai_filter_confidence: result.confidence || 0
          };
        } else {
          lead.ai_relevant = true; // Se manca il risultato, includilo
        }
        return lead;
      });
    }
  } catch (err) {
    console.error('[Discovery] AI pre-filter error:', err.message);
  }

  // Fallback: tutti passano
  return leads.map(l => ({ ...l, ai_relevant: true }));
}

// ============================================================
// ORCHESTRATORE — DISCOVER LEADS (processata come job)
// ============================================================

export async function discoverLeads(jobId, params) {
  const { query = 'fashion brand', country = 'IT', category = 'fashion', limit = 25, sources = ['apollo', 'google'] } = params;

  let allLeads = [];

  // Fase 1: Ricerca
  updateJob(jobId, { progress: 0, phase: 'searching' });

  if (sources.includes('apollo')) {
    const apolloLeads = await searchApollo(query, country, category, limit);
    console.log(`[Discovery] Apollo: ${apolloLeads.length} lead trovati`);
    allLeads.push(...apolloLeads);
  }

  if (sources.includes('google')) {
    const googleLeads = await searchGoogle(query, country, category, limit);
    console.log(`[Discovery] Google: ${googleLeads.length} lead trovati`);
    allLeads.push(...googleLeads);
  }

  // Deduplica per website
  const seen = new Set();
  allLeads = allLeads.filter(l => {
    const key = (l.website || '').replace(/https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const found = allLeads.length;
  console.log(`[Discovery] Trovati ${found} lead unici dopo deduplica`);
  updateJob(jobId, { total: found, phase: 'enriching' });

  // Fase 2: Enrichment
  let enriched = 0;
  for (const lead of allLeads) {
    await enrichLead(lead);
    enriched++;
    updateJob(jobId, { progress: enriched, phase: 'enriching' });
    // Rate limiting: 1.5s tra richieste
    if (enriched < allLeads.length) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // Fase 3: Pre-filtering AI
  updateJob(jobId, { phase: 'filtering' });
  const FILTER_BATCH = 10;
  let filteredLeads = [];

  for (let i = 0; i < allLeads.length; i += FILTER_BATCH) {
    const batch = allLeads.slice(i, i + FILTER_BATCH);
    const filtered = await preFilterBatch(batch);
    filteredLeads.push(...filtered);
  }

  const relevant = filteredLeads.filter(l => l.ai_relevant);
  const filteredOut = filteredLeads.length - relevant.length;

  console.log(`[Discovery] AI filter: ${relevant.length} rilevanti, ${filteredOut} scartati`);

  // Fase 4: Salva nello store
  const result = addLeads(relevant.map(l => ({
    ...l,
    source: `auto-discovery-${l.source}`,
    status: 'enriched'
  })));

  updateJob(jobId, {
    status: 'completed',
    progress: found,
    phase: 'done',
    results: {
      found,
      enriched,
      filtered_out: filteredOut,
      added: result.added,
      duplicates: result.duplicates
    }
  });
  saveStore();
}
