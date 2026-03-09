/**
 * LEAD DISCOVERY SERVICE
 * Ricerca automatica lead fashion da Apollo.io + Google/Bing scraping.
 * Enrichment siti web con cheerio + pre-filtering AI con Gemini.
 */

import * as cheerio from 'cheerio';
import { addLeads, saveStore } from './outreachStore.js';
import { isOutreachGeminiAvailable } from './outreachGeminiService.js';

const APOLLO_API_KEY = process.env.APOLLO_API_KEY || '';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const COUNTRY_LABELS = {
  IT: 'Italy', ES: 'Spain', FR: 'France', DE: 'Germany',
  UK: 'United Kingdom', US: 'United States',
  PT: 'Portugal', NL: 'Netherlands'
};

const CATEGORY_KEYWORDS = {
  fashion: 'fashion apparel clothing brand',
  beauty: 'beauty cosmetics skincare brand',
  luxury: 'luxury brand designer high-end',
  accessori: 'fashion accessories bags jewelry',
  calzature: 'shoes footwear sneakers brand',
  sportswear: 'sportswear activewear athletic brand'
};

// ============================================================
// APOLLO.IO SEARCH
// ============================================================

async function searchApollo(query, country, category, limit) {
  if (!APOLLO_API_KEY) {
    console.warn('[Discovery] APOLLO_API_KEY non configurata — skip Apollo search');
    return { leads: [], warning: 'APOLLO_API_KEY non configurata sul server' };
  }

  const leads = [];
  const countryLabel = COUNTRY_LABELS[country] || country;
  const catKey = (category || 'fashion').toLowerCase();
  const categoryKw = CATEGORY_KEYWORDS[catKey] || category;
  const tags = [...new Set([...catKey.split(/\s+/), ...categoryKw.split(/\s+/)])].filter(t => t.length > 2);

  const PER_PAGE = 25; // Max Apollo
  const maxPages = Math.min(Math.ceil(limit / PER_PAGE), 4); // Max 4 pagine (100 lead)

  try {
    console.log(`[Discovery] Apollo search: tags=${JSON.stringify(tags)}, country="${countryLabel}", limit=${limit}, pages=${maxPages}`);

    for (let page = 1; page <= maxPages && leads.length < limit; page++) {
      const orgResponse = await fetch('https://api.apollo.io/v1/organizations/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': APOLLO_API_KEY
        },
        body: JSON.stringify({
          q_organization_keyword_tags: tags,
          organization_locations: [countryLabel],
          organization_num_employees_ranges: ["1,10", "11,20", "21,50", "51,100", "101,200", "201,500"],
          per_page: PER_PAGE,
          page
        })
      });

      if (!orgResponse.ok) {
        const errBody = await orgResponse.text().catch(() => '');
        console.error(`[Discovery] Apollo page ${page} failed: HTTP ${orgResponse.status} — ${errBody.substring(0, 200)}`);
        if (page === 1) return { leads: [], warning: `Apollo API errore ${orgResponse.status}` };
        break; // Continua con i lead gia' trovati
      }

      const orgData = await orgResponse.json();
      const orgs = orgData.organizations || [];
      const totalEntries = orgData.pagination?.total_entries || 0;
      console.log(`[Discovery] Apollo page ${page}: ${orgs.length} orgs (totale disponibile: ${totalEntries})`);

      if (orgs.length === 0) break; // Nessun altro risultato

      for (const org of orgs) {
        if (leads.length >= limit) break;
        const website = org.website_url || (org.primary_domain ? `https://${org.primary_domain}` : '');
        const lead = {
          company: org.name || '',
          website: website,
          country: country,
          source: 'apollo',
          estimated_employees: org.estimated_num_employees || 0,
          product_category: category,
          enrichment_data: {
            linkedin_url: org.linkedin_url || '',
            founded_year: org.founded_year,
            industry: org.industry || '',
            apollo_id: org.id
          }
        };
        if (lead.company || lead.website) {
          leads.push(lead);
        }
      }

      // Rate limit tra pagine Apollo
      if (page < maxPages && leads.length < limit) {
        await new Promise(r => setTimeout(r, 300));
      }
    }
  } catch (err) {
    console.error('[Discovery] Apollo search error:', err.message);
    return { leads, warning: `Apollo errore: ${err.message}` };
  }

  console.log(`[Discovery] Apollo totale: ${leads.length} lead`);
  return { leads, warning: null };
}

// ============================================================
// WEB SEARCH (Brave Search API — funziona da cloud IPs)
// ============================================================

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY || '';

// Blocklist siti da escludere
const SKIP_DOMAINS = ['amazon.', 'ebay.', 'zalando.', 'facebook.', 'instagram.', 'linkedin.', 'twitter.',
  'youtube.', 'wikipedia.', 'pinterest.', 'tiktok.', 'reddit.', 'google.',
  'bing.', 'duckduckgo.', 'yahoo.', 'aliexpress.', 'etsy.', 'asos.',
  'vogue.', 'elle.', 'forbes.', 'bloomberg.', 'reuters.',
  'f6s.com', 'crunchbase.', 'glassdoor.', 'indeed.',
  'ecommerceitalia.', 'marketing4ecommerce.', 'shopify.com',
  'woocommerce.com', 'bigcommerce.com', 'squarespace.com',
  'gucci.', 'prada.', 'armani.', 'valentino.', 'versace.',
  'maxmara.', 'dolcegabbana.', 'burberry.', 'chanel.', 'louisvuitton.',
  'dior.', 'fendi.', 'balenciaga.', 'bottegaveneta.', 'benetton.',
  'zara.', 'hm.com', 'mango.', 'uniqlo.', 'primark.'];

function extractUrl(raw) {
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    if (u.protocol === 'https:' && !SKIP_DOMAINS.some(s => u.hostname.includes(s))) {
      return u.origin;
    }
  } catch {}
  return null;
}

// Mappa query localizzate per paese
const LOCALIZED_QUERIES = {
  IT: [
    '{cat} brand emergente italia shop online',
    'marchio moda italiano ecommerce indipendente',
    'piccolo brand {cat} italiano negozio online'
  ],
  ES: [
    'marca {cat} emergente espana tienda online',
    'marca moda espanola ecommerce independiente',
    'pequena marca {cat} espanola tienda online'
  ],
  FR: [
    'marque {cat} emergente france boutique en ligne',
    'marque mode francaise ecommerce independante',
    'petite marque {cat} francaise boutique en ligne'
  ],
  DE: [
    '{cat} marke aufstrebend deutschland online shop',
    'deutsche modemarke ecommerce unabhaengig',
    'kleine {cat} marke deutschland online shop'
  ]
};

const SEARCH_LANG_MAP = {
  IT: 'it', ES: 'es', FR: 'fr', DE: 'de', UK: 'en', US: 'en',
  PT: 'pt', NL: 'nl'
};

// --- Brave Search API ---
async function searchBrave(searchQuery, urls, countryCode, searchLang = 'en') {
  try {
    if (!BRAVE_API_KEY) {
      console.warn('[Discovery] Brave API: chiave mancante (BRAVE_SEARCH_API_KEY)');
      return;
    }

    const params = new URLSearchParams({
      q: searchQuery,
      count: '20',
      search_lang: searchLang,
      text_decorations: 'false'
    });

    // Mappa country code a Brave country code
    const braveCountry = {
      IT: 'IT', ES: 'ES', FR: 'FR', DE: 'DE', UK: 'GB', US: 'US'
    }[countryCode];
    if (braveCountry) params.set('country', braveCountry);

    console.log(`[Discovery] Brave API: "${searchQuery}"`);
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY
      }
    });

    console.log(`[Discovery] Brave API status: ${response.status}`);
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn(`[Discovery] Brave API error ${response.status}: ${errText.slice(0, 200)}`);
      return;
    }

    const data = await response.json();
    let found = 0;

    if (data.web && data.web.results) {
      for (const result of data.web.results) {
        const u = extractUrl(result.url);
        if (u) {
          urls.add(u);
          found++;
        }
      }
    }

    console.log(`[Discovery] Brave API: ${found} link estratti, ${urls.size} URL totali`);
  } catch (err) {
    console.warn(`[Discovery] Brave API error: ${err.message}`);
  }
}

// --- Orchestratore ricerca web ---
async function searchGoogle(query, country, category, limit) {
  const leads = [];
  const countryLabel = COUNTRY_LABELS[country] || country;
  const catKey = (category || 'fashion').toLowerCase();
  const urls = new Set();

  // Query localizzate (nella lingua del paese) — no query inglesi, focus locale
  const localQueries = (LOCALIZED_QUERIES[country] || []).map(q => q.replace(/\{cat\}/g, catKey));

  // Fallback: se non ci sono query localizzate per il paese, usa inglese
  const allQueries = localQueries.length > 0
    ? localQueries
    : [
        `${catKey} brand ${countryLabel} online shop`,
        `small ${catKey} brand ${countryLabel} ecommerce store`,
        `independent ${catKey} ${countryLabel} online boutique -luxury -outlet`
      ];
  const searchLang = SEARCH_LANG_MAP[country] || 'en';

  if (!BRAVE_API_KEY) {
    console.warn('[Discovery] BRAVE_SEARCH_API_KEY non configurata — web search disabilitato');
    return { leads, warning: 'Brave Search API key non configurata. Aggiungi BRAVE_SEARCH_API_KEY nelle variabili ambiente.' };
  }

  for (let qi = 0; qi < allQueries.length; qi++) {
    if (urls.size >= limit * 2) break; // Cerchiamo il doppio per compensare filtri
    await searchBrave(allQueries[qi], urls, country, searchLang);
    // Brave API rate limit: 1 req/sec sul piano free
    if (qi < allQueries.length - 1) await new Promise(r => setTimeout(r, 1100));
  }

  console.log(`[Discovery] Brave web search totale: ${urls.size} URL unici`);

  for (const url of [...urls].slice(0, limit)) {
    const hostname = new URL(url).hostname.replace('www.', '');
    const name = hostname.split('.')[0];
    leads.push({
      company: name.charAt(0).toUpperCase() + name.slice(1),
      website: url,
      country: country,
      source: 'brave-search',
      product_category: category
    });
  }

  return { leads, warning: urls.size === 0 ? 'Nessun risultato dalla ricerca web' : null };
}

// ============================================================
// EMAIL EXTRACTION HELPERS
// ============================================================

const EMAIL_BLOCKLIST = /noreply|no-reply|unsubscribe|webmaster|support@|admin@|info@gmail|example\.com|sentry\.|wixpress|squarespace|shopify/i;

/**
 * Estrai email da testo grezzo. Gestisce anche email offuscate.
 */
function extractEmailFromText(text) {
  if (!text) return null;

  // 1. Email standard
  const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  for (const found of emailMatches) {
    if (!EMAIL_BLOCKLIST.test(found)) return found;
  }

  // 2. Email offuscate: "info [at] dominio [dot] it", "info(at)dominio(dot)it"
  const obfuscated = text.match(/[a-zA-Z0-9._%+-]+\s*[\[\(]\s*(?:at|chiocciola)\s*[\]\)]\s*[a-zA-Z0-9.-]+\s*[\[\(]\s*(?:dot|punto)\s*[\]\)]\s*[a-zA-Z]{2,}/gi) || [];
  for (const found of obfuscated) {
    const cleaned = found
      .replace(/\s*[\[\(]\s*(?:at|chiocciola)\s*[\]\)]\s*/gi, '@')
      .replace(/\s*[\[\(]\s*(?:dot|punto)\s*[\]\)]\s*/gi, '.')
      .trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) && !EMAIL_BLOCKLIST.test(cleaned)) {
      return cleaned;
    }
  }

  return null;
}

/**
 * Estrai email da HTML (cerca mailto: + testo)
 */
function extractEmailFromHtml(html) {
  if (!html) return null;

  // 1. mailto: link
  const mailtoMatch = html.match(/mailto:([^\s"'?]+)/);
  if (mailtoMatch) {
    const email = mailtoMatch[1].trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !EMAIL_BLOCKLIST.test(email)) {
      return email;
    }
  }

  // 2. Cerca email nel testo grezzo
  return extractEmailFromText(html);
}

// ============================================================
// WEBSITE ENRICHMENT (scraping con cheerio)
// ============================================================

async function enrichLead(lead, { quick = false } = {}) {
  if (!lead.website) return lead;

  const url = lead.website.startsWith('http') ? lead.website : `https://${lead.website}`;
  const FETCH_TIMEOUT = quick ? 3000 : 5000;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

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
    if ((lead.source === 'brave-search' || lead.source === 'google') && $('title').text()) {
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

    // Email di contatto — cerca in piu' posti
    if (!lead.contact_email) {
      // 1. mailto: links (piu' affidabili)
      $('a[href^="mailto:"]').each((_, el) => {
        if (lead.contact_email) return;
        const href = $(el).attr('href') || '';
        const email = href.replace('mailto:', '').split('?')[0].trim();
        if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          if (!/noreply|no-reply|unsubscribe|webmaster/i.test(email)) {
            lead.contact_email = email;
          }
        }
      });

      // 2. Cerca nel body text della homepage
      if (!lead.contact_email) {
        const bodyText = $('body').text();
        lead.contact_email = extractEmailFromText(bodyText);
      }

      // 3. Prova pagine contatti — fetch parallelo per risparmiare tempo
      if (!lead.contact_email) {
        const contactPaths = quick
          ? ['/contatti', '/contact', '/chi-siamo', '/about']
          : ['/contatti', '/contact', '/contacts', '/about', '/chi-siamo', '/about-us', '/contacto', '/kontakt'];
        const contactTimeout = quick ? 2500 : 3000;

        // Fetch parallelo (tutte le pagine contemporaneamente)
        const contactResults = await Promise.allSettled(
          contactPaths.map(async (contactPath) => {
            const cUrl = new URL(contactPath, url).href;
            const cController = new AbortController();
            const cTimeout = setTimeout(() => cController.abort(), contactTimeout);
            try {
              const cRes = await fetch(cUrl, {
                headers: { 'User-Agent': USER_AGENT },
                redirect: 'follow',
                signal: cController.signal
              });
              clearTimeout(cTimeout);
              if (cRes.ok) return await cRes.text();
            } catch {
              clearTimeout(cTimeout);
            }
            return null;
          })
        );

        for (const result of contactResults) {
          if (lead.contact_email) break;
          if (result.status !== 'fulfilled' || !result.value) continue;
          const cHtml = result.value;
          lead.contact_email = extractEmailFromHtml(cHtml);
        }
      }

      // 4. Fallback: genera info@dominio
      if (!lead.contact_email && lead.website) {
        try {
          const domain = new URL(url).hostname.replace('www.', '');
          lead.contact_email = `info@${domain}`;
          lead.enrichment_data = { ...lead.enrichment_data, email_source: 'generated' };
        } catch {}
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
    current_photo_quality: l.current_photo_quality || 'unknown',
    estimated_employees: l.estimated_employees || 0
  }));

  const prompt = `Analizza questi ${leadsData.length} potenziali lead per MIA (itsmia.it), piattaforma AI per foto prodotto fashion.
MIA e' pensata per PICCOLI e MEDI brand fashion/beauty che vendono online, NON per grandi marchi di lusso famosi.

LEAD:
${JSON.stringify(leadsData, null, 2)}

Per ognuno rispondi: e' un PICCOLO/MEDIO brand fashion/beauty/lifestyle (NON famoso, NON luxury) con e-commerce attivo che potrebbe beneficiare di foto prodotto AI?

Rispondi con un JSON array:
[{"company": "...", "relevant": true/false, "confidence": 0-100, "reason": "..."}]

Criteri FONDAMENTALI - MIA e' per PICCOLI/MEDI brand, NON per grandi aziende famose:
- relevant=true: piccoli/medi brand fashion/beauty/accessori (sotto 500 dipendenti) CON e-commerce attivo che potrebbero beneficiare di foto prodotto AI
- relevant=false: brand di lusso famosi e grandi gruppi (Gucci, Prada, Valentino, Armani, Max Mara, Versace, D&G, Burberry, Zara, H&M, Benetton, ecc.), aziende con 500+ dipendenti, non-fashion (ristoranti, software, servizi, B2B industriale), marketplace, aggregatori, siti senza e-commerce attivo
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
// APOLLO PEOPLE SEARCH + ENRICHMENT — trova email contatti
// Step 1: Search persone per dominio (gratis, no crediti)
// Step 2: Enrich/Reveal email via /people/match (1 credito)
// ============================================================

export async function findEmailsViaApollo(leads) {
  if (!APOLLO_API_KEY) {
    console.warn('[Discovery] APOLLO_API_KEY mancante — skip email lookup');
    return { found: 0, total: 0, warning: 'APOLLO_API_KEY non configurata' };
  }

  const leadsWithoutEmail = leads.filter(l => {
    const email = l.contact_email || '';
    // Salta se ha gia' una email reale (non generata info@)
    return !email || l.enrichment_data?.email_source === 'generated';
  });

  if (leadsWithoutEmail.length === 0) {
    return { found: 0, total: 0, debug: [] };
  }

  console.log(`[Discovery] Apollo email lookup: ${leadsWithoutEmail.length} lead senza email`);
  let found = 0;
  let creditsUsed = 0;
  const debug = []; // Debug info per frontend

  // Batch di 2 (ogni lead fa 2 chiamate: search + enrich)
  const BATCH = 2;
  for (let i = 0; i < leadsWithoutEmail.length; i += BATCH) {
    const batch = leadsWithoutEmail.slice(i, i + BATCH);

    await Promise.all(batch.map(async (lead) => {
      const dbg = { domain: '', step: '', detail: '' };
      try {
        let domain = '';
        try {
          domain = new URL(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`).hostname.replace('www.', '');
        } catch { dbg.step = 'url_parse_fail'; debug.push(dbg); return; }
        dbg.domain = domain;

        // --- STEP 1: Search persone per dominio (gratis) ---
        const searchResp = await fetch('https://api.apollo.io/v1/mixed_people/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': APOLLO_API_KEY
          },
          body: JSON.stringify({
            q_organization_domains: domain,
            per_page: 10
          })
        });

        if (!searchResp.ok) {
          const errBody = await searchResp.text().catch(() => '');
          dbg.step = 'search_http_error';
          dbg.detail = `HTTP ${searchResp.status}: ${errBody.slice(0, 200)}`;
          debug.push(dbg);
          return;
        }

        const searchData = await searchResp.json();
        const people = searchData.people || [];

        if (people.length === 0) {
          dbg.step = 'search_no_people';
          dbg.detail = `0 persone trovate per ${domain}`;
          debug.push(dbg);
          return;
        }

        // Priorita' per ruolo: founder/ceo > marketing > chiunque
        const best = people.find(p => /founder|ceo|owner|titolare|co-founder/i.test(p.title || ''))
          || people.find(p => /marketing|ecommerce|e-commerce|digital|direttore/i.test(p.title || ''))
          || people[0];

        if (!best) {
          dbg.step = 'search_no_match';
          dbg.detail = `${people.length} persone ma nessun match`;
          debug.push(dbg);
          return;
        }

        const personName = `${best.first_name || ''} ${best.last_name || ''}`.trim();
        const personId = best.id || '';

        // Se il search gia' ha l'email (raro ma possibile)
        if (best.email) {
          lead.contact_email = best.email;
          lead.contact_name = personName || lead.contact_name;
          lead.contact_title = best.title || lead.contact_title || '';
          lead.enrichment_data = {
            ...lead.enrichment_data,
            email_source: 'apollo_search',
            linkedin_url: best.linkedin_url || ''
          };
          found++;
          dbg.step = 'search_had_email';
          dbg.detail = `${best.email} (${best.title || 'n/a'})`;
          debug.push(dbg);
          return;
        }

        // --- STEP 2: Enrich/Reveal email (1 credito) ---
        // Prova con ID se disponibile, altrimenti con nome+dominio
        const enrichBody = personId
          ? { id: personId, reveal_personal_emails: true }
          : { first_name: best.first_name, last_name: best.last_name, domain, reveal_personal_emails: true };

        const enrichResp = await fetch('https://api.apollo.io/api/v1/people/match', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': APOLLO_API_KEY
          },
          body: JSON.stringify(enrichBody)
        });

        if (!enrichResp.ok) {
          const errText = await enrichResp.text().catch(() => '');
          dbg.step = 'enrich_http_error';
          dbg.detail = `HTTP ${enrichResp.status}: ${errText.slice(0, 200)} | person=${personName} id=${personId}`;
          debug.push(dbg);
          return;
        }

        const enrichData = await enrichResp.json();
        const person = enrichData.person;
        creditsUsed++;

        if (person && person.email) {
          lead.contact_email = person.email;
          lead.contact_name = [person.first_name, person.last_name].filter(Boolean).join(' ') || lead.contact_name;
          lead.contact_title = person.title || lead.contact_title || '';
          lead.enrichment_data = {
            ...lead.enrichment_data,
            email_source: 'apollo_people',
            email_status: person.email_status || '',
            linkedin_url: person.linkedin_url || lead.enrichment_data?.linkedin_url || ''
          };
          found++;
          dbg.step = 'enrich_ok';
          dbg.detail = `${person.email} (${person.title || 'n/a'}) [${person.email_status || '?'}]`;
        } else {
          dbg.step = 'enrich_no_email';
          dbg.detail = `persona enriched ma email=null | person=${personName} id=${personId} | keys=${person ? Object.keys(person).join(',') : 'null'}`;
        }
        debug.push(dbg);
      } catch (err) {
        dbg.step = 'exception';
        dbg.detail = err.message;
        debug.push(dbg);
      }
    }));

    // Rate limit Apollo
    if (i + BATCH < leadsWithoutEmail.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`[Discovery] Apollo email lookup: trovate ${found}/${leadsWithoutEmail.length} email (${creditsUsed} crediti usati)`);
  console.log(`[Discovery] Apollo debug:`, JSON.stringify(debug, null, 2));
  return { found, total: leadsWithoutEmail.length, creditsUsed, debug };
}

// ============================================================
// ORCHESTRATORE — DISCOVER LEADS (sincrono, max 55s hard deadline)
// Vercel Hobby maxDuration=60s — interrompiamo a 50s per sicurezza.
// ============================================================

export async function discoverLeads(params) {
  const { query = 'fashion brand', country = 'IT', category = 'fashion', limit = 25, sources = ['apollo', 'google'] } = params;

  const START = Date.now();
  const DEADLINE = 50000; // 50s hard deadline (Vercel max=60s, margine 10s)
  const elapsed = () => Date.now() - START;
  const timeLeft = () => DEADLINE - elapsed();

  let allLeads = [];
  const warnings = [];

  // Fase 1: Ricerca (Apollo + Brave in parallelo per risparmiare tempo)
  console.log(`[Discovery] Start: query="${query}", country=${country}, category=${category}, limit=${limit}, sources=${sources.join(',')}`);

  const searchPromises = [];
  if (sources.includes('apollo')) {
    searchPromises.push(searchApollo(query, country, category, limit).then(r => ({ type: 'apollo', ...r })));
  }
  if (sources.includes('google')) {
    searchPromises.push(searchGoogle(query, country, category, limit).then(r => ({ type: 'brave', ...r })));
  }

  const searchResults = await Promise.all(searchPromises);
  for (const r of searchResults) {
    console.log(`[Discovery] ${r.type}: ${r.leads.length} lead trovati`);
    allLeads.push(...r.leads);
    if (r.warning) warnings.push(r.warning);
  }

  console.log(`[Discovery] Ricerca completata in ${elapsed()}ms`);

  // Se nessuna fonte ha trovato nulla
  if (allLeads.length === 0) {
    console.warn(`[Discovery] Nessun lead trovato. Warnings: ${warnings.join('; ')}`);
    return {
      found: 0, enriched: 0, filtered_out: 0, added: 0, duplicates: 0,
      warnings, leads: []
    };
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
  console.log(`[Discovery] ${found} lead unici dopo deduplica, ${timeLeft()}ms rimanenti`);

  // Fase 2: Enrichment — con deadline globale
  // Parallelismo aggressivo (6), timeout breve (3s), sempre quick mode
  const PARALLEL = 6;
  const ENRICH_TIMEOUT = 3000; // 3s hard timeout per lead
  const MAX_ENRICH = Math.min(allLeads.length, 40); // Max 40 lead arricchiti

  const leadsToEnrich = allLeads.slice(0, MAX_ENRICH);
  const leadsBasic = allLeads.slice(MAX_ENRICH);

  let enriched = 0;
  let enrichStopped = false;
  console.log(`[Discovery] Enrichment: ${leadsToEnrich.length} lead, parallel=${PARALLEL}, timeout=${ENRICH_TIMEOUT}ms`);

  for (let i = 0; i < leadsToEnrich.length; i += PARALLEL) {
    // Check deadline prima di ogni batch
    if (timeLeft() < 8000) {
      console.warn(`[Discovery] Deadline vicina (${timeLeft()}ms), stop enrichment a ${enriched}/${leadsToEnrich.length}`);
      enrichStopped = true;
      // Segna i rimanenti come non-arricchiti
      for (let j = i; j < leadsToEnrich.length; j++) {
        leadsToEnrich[j].status = 'new';
      }
      break;
    }

    const batch = leadsToEnrich.slice(i, i + PARALLEL);
    await Promise.all(batch.map(lead =>
      Promise.race([
        enrichLead(lead, { quick: true }),
        new Promise(resolve => setTimeout(() => {
          lead.enrichment_data = { ...lead.enrichment_data, error: 'timeout' };
          lead.status = 'enriched';
          resolve(lead);
        }, ENRICH_TIMEOUT))
      ]).catch(() => {})
    ));
    enriched += batch.length;
  }

  // Lead oltre il cap
  for (const lead of leadsBasic) {
    lead.status = 'new';
  }

  allLeads = [...leadsToEnrich, ...leadsBasic];
  console.log(`[Discovery] Enrichment completato: ${enriched} arricchiti in ${elapsed()}ms`);

  // Fase 2b: Apollo People Search — trova email per lead senza contatto
  if (timeLeft() > 15000) {
    const leadsNoEmail = allLeads.filter(l =>
      !l.contact_email || l.enrichment_data?.email_source === 'generated'
    );
    if (leadsNoEmail.length > 0) {
      // Limita a max 15 lookup per non sforare il timeout
      const maxLookup = Math.min(leadsNoEmail.length, 15);
      const lookupResult = await findEmailsViaApollo(leadsNoEmail.slice(0, maxLookup));
      console.log(`[Discovery] Apollo email: ${lookupResult.found} trovate, ${timeLeft()}ms rimanenti`);
    }
  } else {
    console.warn(`[Discovery] Skip Apollo email lookup (solo ${timeLeft()}ms rimanenti)`);
  }

  // Fase 3: Pre-filtering AI — SOLO se c'e' tempo sufficiente (>10s)
  let filteredOut = 0;
  let relevant;

  if (timeLeft() > 10000) {
    console.log(`[Discovery] AI filter: ${timeLeft()}ms disponibili`);
    const FILTER_BATCH = 20; // Batch grandi per velocita'
    let filteredLeads = [];

    for (let i = 0; i < allLeads.length; i += FILTER_BATCH) {
      if (timeLeft() < 5000) {
        console.warn(`[Discovery] AI filter interrotto per deadline, ${allLeads.length - i} lead non filtrati`);
        // I lead non filtrati passano tutti
        for (let j = i; j < allLeads.length; j++) {
          allLeads[j].ai_relevant = true;
        }
        filteredLeads.push(...allLeads.slice(i));
        break;
      }
      const batch = allLeads.slice(i, i + FILTER_BATCH);
      const filtered = await preFilterBatch(batch);
      filteredLeads.push(...filtered);
    }

    relevant = filteredLeads.filter(l => l.ai_relevant);
    filteredOut = filteredLeads.length - relevant.length;
    console.log(`[Discovery] AI filter: ${relevant.length} rilevanti, ${filteredOut} scartati`);
  } else {
    console.warn(`[Discovery] Skip AI filter (solo ${timeLeft()}ms rimanenti) — tutti i lead accettati`);
    relevant = allLeads;
    warnings.push('Filtro AI saltato per limiti di tempo — usa "Qualifica AI" per filtrare');
  }

  // Fase 4: Salva nello store
  const result = addLeads(relevant.map(l => ({
    ...l,
    source: `auto-discovery-${l.source}`,
    status: l.status === 'new' ? 'new' : 'enriched'
  })));

  saveStore();
  console.log(`[Discovery] Completato in ${elapsed()}ms: ${result.added} aggiunti, ${result.duplicates} duplicati`);

  return {
    found,
    enriched,
    filtered_out: filteredOut,
    added: result.added,
    duplicates: result.duplicates,
    warnings,
    leads: result.leads || []
  };
}
