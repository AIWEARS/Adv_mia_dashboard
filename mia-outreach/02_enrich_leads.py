#!/usr/bin/env python3
"""
02_enrich_leads.py — Arricchimento lead con scraping web e social.

Per ogni lead:
- Scrape sito web (titolo, descrizione, piattaforma ecommerce, catalogo prodotti)
- Check Instagram (handle, followers stimati)
- Analisi qualita foto prodotto

Input:  data/leads_raw.json
Output: data/leads_enriched.json
"""

import argparse
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from tqdm import tqdm

load_dotenv()

DATA_DIR = Path(__file__).parent / "data"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


def detect_ecommerce_platform(html, headers_dict=None):
    """Rileva piattaforma ecommerce dal sorgente HTML."""
    html_lower = html.lower()

    if "shopify" in html_lower or "cdn.shopify.com" in html_lower:
        return "shopify"
    if "woocommerce" in html_lower or "wp-content" in html_lower:
        return "woocommerce"
    if "magento" in html_lower or "mage" in html_lower:
        return "magento"
    if "prestashop" in html_lower:
        return "prestashop"
    if "bigcommerce" in html_lower:
        return "bigcommerce"
    if "/cart" in html_lower or "/checkout" in html_lower or "add-to-cart" in html_lower:
        return "custom_ecommerce"

    return "unknown"


def estimate_sku_count(soup):
    """Stima numero prodotti dal sito."""
    product_indicators = [
        soup.find_all(class_=re.compile(r"product", re.I)),
        soup.find_all(attrs={"data-product-id": True}),
        soup.find_all("a", href=re.compile(r"/products?/", re.I)),
    ]

    max_count = 0
    for items in product_indicators:
        max_count = max(max_count, len(items))

    if max_count == 0:
        collection_links = soup.find_all("a", href=re.compile(r"/collections?/|/categor", re.I))
        if collection_links:
            return "50+"

    return str(max_count) if max_count > 0 else "unknown"


def assess_photo_quality(soup):
    """Valutazione basica qualita foto prodotto."""
    img_tags = soup.find_all("img")
    product_imgs = [
        img for img in img_tags
        if img.get("src") and any(
            kw in (img.get("src", "") + img.get("alt", "")).lower()
            for kw in ["product", "prodott", "item", "shop", "catalog"]
        )
    ]

    if not product_imgs:
        return "unknown"

    high_res = 0
    for img in product_imgs[:20]:
        src = img.get("src", "")
        width = img.get("width", "")
        if any(size in src for size in ["1024", "1200", "1500", "2000", "large", "grande"]):
            high_res += 1
        elif width and int(re.sub(r"\D", "", width) or "0") >= 800:
            high_res += 1

    ratio = high_res / max(len(product_imgs[:20]), 1)
    if ratio >= 0.7:
        return "good_quality"
    elif ratio >= 0.3:
        return "inconsistent_quality"
    else:
        return "poor_quality"


def find_instagram(soup, domain):
    """Trova handle Instagram dal sito."""
    ig_links = soup.find_all("a", href=re.compile(r"instagram\.com/", re.I))
    for link in ig_links:
        href = link.get("href", "")
        match = re.search(r"instagram\.com/([a-zA-Z0-9_.]+)", href)
        if match:
            handle = match.group(1)
            if handle not in ("p", "reel", "stories", "explore"):
                return handle
    return None


def scrape_website(url):
    """Scrape dati dal sito web del lead."""
    if not url:
        return {}

    if not url.startswith("http"):
        url = "https://" + url

    try:
        resp = requests.get(url, headers=HEADERS, timeout=15, allow_redirects=True)
        resp.raise_for_status()
        html = resp.text
        soup = BeautifulSoup(html, "html.parser")

        title = soup.title.string.strip() if soup.title and soup.title.string else ""
        meta_desc = ""
        meta_tag = soup.find("meta", attrs={"name": "description"})
        if meta_tag:
            meta_desc = meta_tag.get("content", "").strip()

        return {
            "site_title": title[:200],
            "site_description": meta_desc[:500],
            "ecommerce_platform": detect_ecommerce_platform(html),
            "estimated_sku_count": estimate_sku_count(soup),
            "current_photo_quality": assess_photo_quality(soup),
            "instagram_handle": find_instagram(soup, urlparse(url).netloc),
            "enriched_at": datetime.now().isoformat(),
        }

    except requests.RequestException as e:
        return {"enrichment_error": str(e), "enriched_at": datetime.now().isoformat()}


def main():
    parser = argparse.ArgumentParser(description="Arricchimento lead con scraping web")
    parser.add_argument("--input", default=str(DATA_DIR / "leads_raw.json"),
                        help="File input lead (default: data/leads_raw.json)")
    parser.add_argument("--output", default=str(DATA_DIR / "leads_enriched.json"),
                        help="File output (default: data/leads_enriched.json)")
    parser.add_argument("--skip-enriched", action="store_true",
                        help="Salta lead gia arricchiti")
    parser.add_argument("--delay", type=float, default=2.0,
                        help="Delay tra richieste in secondi (default: 2.0)")

    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"[ERROR] File non trovato: {input_path}")
        print("Esegui prima 01_scrape_leads.py")
        return

    with open(input_path, "r", encoding="utf-8") as f:
        leads = json.load(f)

    print(f"Lead da arricchire: {len(leads)}")

    for lead in tqdm(leads, desc="Enrichment"):
        if args.skip_enriched and lead.get("enriched_at"):
            continue

        website = lead.get("website", "")
        if website:
            enrichment = scrape_website(website)
            lead.update(enrichment)
            time.sleep(args.delay)
        else:
            lead["enrichment_error"] = "No website"

    output_path = Path(args.output)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(leads, f, indent=2, ensure_ascii=False)

    enriched = sum(1 for l in leads if l.get("enriched_at") and not l.get("enrichment_error"))
    errors = sum(1 for l in leads if l.get("enrichment_error"))
    print(f"\nRisultati:")
    print(f"  Arricchiti: {enriched}")
    print(f"  Errori: {errors}")
    print(f"  Salvati in: {output_path}")


if __name__ == "__main__":
    main()
