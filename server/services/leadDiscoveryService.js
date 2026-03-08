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
// GOOGLE SEARCH + SCRAPING
// ============================================================

async function searchGoogle(query, country, category, limit) {
  const leads = [];
  const countryLabel = COUNTRY_LABELS[country] || country;
  const catKey = (category || 'fashion').toLowerCase();
  const categoryKw = CATEGORY_KEYWORDS[catKey] || category;

  // Skip aggregatori, marketplace, social, motori di ricerca
  const skip = ['amazon.', 'ebay.', 'zalando.', 'facebook.', 'instagram.', 'linkedin.', 'twitter.',
                'youtube.', 'wikipedia.', 'pinterest.', 'tiktok.', 'reddit.', 'google.',
                'bing.', 'duckduckgo.', 'yahoo.', 'aliexpress.', 'etsy.', 'asos.',
                'vogue.', 'elle.', 'forbes.', 'bloomberg.', 'reuters.',
                'f6s.com', 'crunchbase.', 'glassdoor.', 'indeed.',
                'ecommerceitalia.', 'marketing4ecommerce.', 'shopify.com',
                'woocommerce.com', 'bigcommerce.com', 'squarespace.com',
                // Grandi brand di lusso (l'utente vuole PMI, non marchi famosi)
                'gucci.', 'prada.', 'armani.', 'valentino.', 'versace.',
                'maxmara.', 'dolcegabbana.', 'burberry.', 'chanel.', 'louisvuitton.',
                'dior.', 'fendi.', 'balenciaga.', 'bottegaveneta.', 'benetton.',
                'zara.', 'hm.com', 'mango.', 'uniqlo.', 'primark.'];

  const urls = new Set();

  // Query specifiche per trovare PICCOLI/MEDI brand con ecommerce (non grandi marchi famosi)
  const queries = [
    `small ${catKey} brand ${countryLabel} online store ecommerce`,
    `independent ${catKey} ecommerce ${countryLabel} shop`,
    `emerging ${catKey} brand ${countryLabel} online shop -luxury -outlet -marketplace`
  ];

  for (const searchQuery of queries) {
    if (urls.size >= limit) break;

    // DuckDuckGo HTML search
    try {
      const encodedQuery = encodeURIComponent(searchQuery);
      console.log(`[Discovery] DDG search: "${searchQuery}"`);
      const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodedQuery}`, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow'
      });

      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);

        // Estrai URL reali dai link DDG (parametro uddg=)
        $('a.result__a').each((_, el) => {
          const href = $(el).attr('href') || '';
          const match = href.match(/uddg=([^&]+)/);
          if (match) {
            try {
              const decoded = decodeURIComponent(match[1]);
              const url = new URL(decoded);
              if (!skip.some(s => url.hostname.includes(s)) && url.protocol === 'https:') {
                urls.add(url.origin);
              }
            } catch { /* skip */ }
          }
        });

        console.log(`[Discovery] DDG: ${urls.size} URL totali dopo query`);
      } else {
        console.warn(`[Discovery] DDG failed: HTTP ${response.status}`);
      }
    } catch (err) {
      console.warn('[Discovery] DDG error:', err.message);
    }

    // Rate limit tra query
    await new Promise(r => setTimeout(r, 500));
  }

  // Bing come fallback se DDG ha trovato poco
  if (urls.size < 5) {
    try {
      const bingQuery = `${catKey} brand ${countryLabel} official online store`;
      const encodedQuery = encodeURIComponent(bingQuery);
      console.log(`[Discovery] Bing fallback: "${bingQuery}"`);
      const response = await fetch(`https://www.bing.com/search?q=${encodedQuery}&count=30`, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        redirect: 'follow'
      });

      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);

        // Bing mostra URL reali negli elementi cite
        $('li.b_algo cite').each((_, el) => {
          let text = $(el).text().trim().split(/\s*›\s*/)[0].trim();
          if (text) {
            try {
              const url = new URL(text.startsWith('http') ? text : `https://${text}`);
              if (!skip.some(s => url.hostname.includes(s))) {
                urls.add(url.origin);
              }
            } catch { /* skip */ }
          }
        });

        console.log(`[Discovery] Bing: totale ${urls.size} URL dopo merge`);
      }
    } catch (err) {
      console.warn('[Discovery] Bing fallback error:', err.message);
    }
  }

  console.log(`[Discovery] Google search totale: ${urls.size} URL unici trovati`);

  for (const url of [...urls].slice(0, limit)) {
    const hostname = new URL(url).hostname.replace('www.', '');
    const name = hostname.split('.')[0];
    leads.push({
      company: name.charAt(0).toUpperCase() + name.slice(1),
      website: url,
      country: country,
      source: 'google',
      product_category: category
    });
  }

  return { leads, warning: urls.size === 0 ? 'Nessun risultato da motori di ricerca' : null };
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
        const emailMatches = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        for (const found of emailMatches) {
          if (!/noreply|no-reply|support|admin|webmaster|info@gmail|example\.com/i.test(found)) {
            lead.contact_email = found;
            break;
          }
        }
      }

      // 3. Prova pagine contatti
      // Quick mode (batch grandi): solo 1 pagina (/contatti), timeout 2s
      // Normal mode: tutte e 4, timeout 3s
      if (!lead.contact_email) {
        const contactPaths = quick ? ['/contatti', '/contact'] : ['/contatti', '/contact', '/contacts', '/about'];
        const contactTimeout = quick ? 2000 : 3000;

        for (const contactPath of contactPaths) {
          try {
            const cUrl = new URL(contactPath, url).href;
            const cController = new AbortController();
            const cTimeout = setTimeout(() => cController.abort(), contactTimeout);
            const cRes = await fetch(cUrl, {
              headers: { 'User-Agent': USER_AGENT },
              redirect: 'follow',
              signal: cController.signal
            });
            clearTimeout(cTimeout);
            if (cRes.ok) {
              const cHtml = await cRes.text();
              // Cerca mailto: nel HTML grezzo
              const mailtoMatch = cHtml.match(/mailto:([^\s"'?]+)/);
              if (mailtoMatch) {
                const email = mailtoMatch[1].trim();
                if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/noreply|unsubscribe/i.test(email)) {
                  lead.contact_email = email;
                  break;
                }
              }
              // Cerca email nel testo
              const textEmails = cHtml.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
              for (const found of textEmails) {
                if (!/noreply|no-reply|unsubscribe|webmaster|example\.com/i.test(found)) {
                  lead.contact_email = found;
                  break;
                }
              }
              if (lead.contact_email) break;
            }
          } catch { /* skip — timeout o errore pagina contatti */ }
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
// ORCHESTRATORE — DISCOVER LEADS (sincrono, ritorna risultati direttamente)
// Su Vercel Hobby waitUntil ha solo 15s — usiamo maxDuration 60s sincrono.
// ============================================================

export async function discoverLeads(params) {
  const { query = 'fashion brand', country = 'IT', category = 'fashion', limit = 25, sources = ['apollo', 'google'] } = params;

  let allLeads = [];
  const warnings = [];

  // Fase 1: Ricerca
  console.log(`[Discovery] Start: query="${query}", country=${country}, category=${category}, limit=${limit}, sources=${sources.join(',')}`);

  if (sources.includes('apollo')) {
    const apolloResult = await searchApollo(query, country, category, limit);
    console.log(`[Discovery] Apollo: ${apolloResult.leads.length} lead trovati`);
    allLeads.push(...apolloResult.leads);
    if (apolloResult.warning) warnings.push(apolloResult.warning);
  }

  if (sources.includes('google')) {
    const googleResult = await searchGoogle(query, country, category, limit);
    console.log(`[Discovery] Google: ${googleResult.leads.length} lead trovati`);
    allLeads.push(...googleResult.leads);
    if (googleResult.warning) warnings.push(googleResult.warning);
  }

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
  console.log(`[Discovery] Trovati ${found} lead unici dopo deduplica`);

  // Fase 2: Enrichment — adattivo per batch grandi (max 60s totali su Vercel)
  // Batch piccoli (<=30): 3 paralleli, 8s timeout, scraping contatti completo
  // Batch grandi (>30): 6 paralleli, 4s timeout, solo homepage (no /contatti)
  // Oltre 60 lead: arricchisce solo i primi 60, il resto viene aggiunto con dati base
  const isLargeBatch = allLeads.length > 30;
  const PARALLEL = isLargeBatch ? 6 : 3;
  const ENRICH_TIMEOUT = isLargeBatch ? 5000 : 8000;
  const MAX_ENRICH = 60;

  const leadsToEnrich = allLeads.slice(0, MAX_ENRICH);
  const leadsBasic = allLeads.slice(MAX_ENRICH); // Aggiunti senza enrichment

  let enriched = 0;
  console.log(`[Discovery] Enrichment: ${leadsToEnrich.length} lead da arricchire (parallel=${PARALLEL}, timeout=${ENRICH_TIMEOUT}ms, quick=${isLargeBatch}), ${leadsBasic.length} con dati base`);

  for (let i = 0; i < leadsToEnrich.length; i += PARALLEL) {
    const batch = leadsToEnrich.slice(i, i + PARALLEL);
    await Promise.all(batch.map(lead =>
      Promise.race([
        enrichLead(lead, { quick: isLargeBatch }),
        new Promise(resolve => setTimeout(() => {
          console.warn(`[Discovery] Hard timeout for ${lead.website}`);
          lead.enrichment_data = { ...lead.enrichment_data, error: 'timeout' };
          lead.status = 'enriched';
          resolve(lead);
        }, ENRICH_TIMEOUT))
      ]).catch(err => {
        console.warn(`[Discovery] Enrichment failed for ${lead.website}: ${err.message}`);
      })
    ));
    enriched += batch.length;
    if (i + PARALLEL < leadsToEnrich.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // Lead oltre il cap: aggiungi con dati base (status 'new' — non arricchiti)
  for (const lead of leadsBasic) {
    lead.status = 'new';
    enriched++;
  }

  // Merge tutti i lead per il filtraggio AI
  allLeads = [...leadsToEnrich, ...leadsBasic];

  // Fase 3: Pre-filtering AI (batch piu' grandi per velocizzare)
  const FILTER_BATCH = isLargeBatch ? 20 : 10;
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

  saveStore();
  console.log(`[Discovery] Completato: ${result.added} lead aggiunti, ${result.duplicates} duplicati, ${filteredOut} scartati`);

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
