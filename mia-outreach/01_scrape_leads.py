#!/usr/bin/env python3
"""
01_scrape_leads.py — Scraping lead da fonti multiple.

Fonti supportate:
- Apollo.io API (enrichment + search)
- Google search (fashion brand directories)
- CSV import manuale

Output: data/leads_raw.json
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv
from tqdm import tqdm

load_dotenv()

APOLLO_API_KEY = os.getenv("APOLLO_API_KEY", "")
HUNTER_API_KEY = os.getenv("HUNTER_API_KEY", "")
DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)


def search_apollo(query, country="IT", limit=50):
    """Cerca aziende su Apollo.io."""
    if not APOLLO_API_KEY:
        print("[WARN] APOLLO_API_KEY non configurata. Skipping Apollo search.")
        return []

    url = "https://api.apollo.io/v1/mixed_companies/search"
    headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
    }

    payload = {
        "api_key": APOLLO_API_KEY,
        "q_organization_keyword_tags": [query],
        "organization_locations": [country],
        "per_page": min(limit, 100),
        "page": 1,
    }

    leads = []
    pages_fetched = 0
    total_needed = limit

    while len(leads) < total_needed:
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            orgs = data.get("organizations", [])

            if not orgs:
                break

            for org in orgs:
                lead = {
                    "company": org.get("name", ""),
                    "website": org.get("website_url", ""),
                    "country": country,
                    "source": "apollo",
                    "industry": org.get("industry", ""),
                    "employee_count": org.get("estimated_num_employees"),
                    "linkedin_url": org.get("linkedin_url", ""),
                    "founded_year": org.get("founded_year"),
                    "scraped_at": datetime.now().isoformat(),
                }
                leads.append(lead)

            pages_fetched += 1
            payload["page"] += 1

            if pages_fetched >= 5:
                break

            time.sleep(1)

        except requests.RequestException as e:
            print(f"[ERROR] Apollo API: {e}")
            break

    return leads[:total_needed]


def search_google_fashion(query, country="IT", limit=30):
    """Cerca brand fashion tramite scraping Google (semplificato)."""
    print(f"[INFO] Google search per: '{query}' (country={country})")
    print("[INFO] Per risultati migliori, usa Apollo.io o importa CSV manualmente.")
    return []


def find_emails_hunter(domain):
    """Trova email di contatto tramite Hunter.io."""
    if not HUNTER_API_KEY:
        return None

    try:
        url = f"https://api.hunter.io/v2/domain-search"
        params = {
            "domain": domain,
            "api_key": HUNTER_API_KEY,
            "limit": 5,
            "type": "personal",
        }
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        emails = data.get("data", {}).get("emails", [])
        if emails:
            best = max(emails, key=lambda e: e.get("confidence", 0))
            return {
                "contact_email": best.get("value", ""),
                "contact_name": f"{best.get('first_name', '')} {best.get('last_name', '')}".strip(),
                "contact_title": best.get("position", ""),
            }
    except requests.RequestException as e:
        print(f"[WARN] Hunter API error for {domain}: {e}")

    return None


def import_from_csv(csv_path):
    """Importa lead da file CSV."""
    import pandas as pd

    df = pd.read_csv(csv_path)

    column_map = {
        "company": ["company", "azienda", "brand", "company_name", "nome"],
        "website": ["website", "sito", "url", "sito_web"],
        "contact_email": ["email", "contact_email", "email_contatto"],
        "contact_name": ["contact", "contact_name", "contatto", "nome_contatto"],
        "country": ["country", "paese", "nazione"],
    }

    leads = []
    for _, row in df.iterrows():
        lead = {"source": "csv_import", "scraped_at": datetime.now().isoformat()}
        for field, aliases in column_map.items():
            for alias in aliases:
                if alias in df.columns and pd.notna(row.get(alias)):
                    lead[field] = str(row[alias]).strip()
                    break
        if lead.get("company") or lead.get("website"):
            leads.append(lead)

    return leads


def deduplicate(leads):
    """Deduplica per website o company name."""
    seen = set()
    unique = []
    for lead in leads:
        key = lead.get("website", "").lower().rstrip("/") or lead.get("company", "").lower()
        if key and key not in seen:
            seen.add(key)
            unique.append(lead)
    return unique


def main():
    parser = argparse.ArgumentParser(description="Scraping lead fashion per MIA outreach")
    parser.add_argument("--source", choices=["apollo", "google", "csv", "all"], default="all",
                        help="Fonte dati (default: all)")
    parser.add_argument("--query", default="fashion brand ecommerce",
                        help="Query di ricerca (default: fashion brand ecommerce)")
    parser.add_argument("--country", default=os.getenv("DEFAULT_COUNTRY", "IT"),
                        help="Codice paese (default: IT)")
    parser.add_argument("--limit", type=int, default=50,
                        help="Numero massimo lead (default: 50)")
    parser.add_argument("--csv-input", type=str, default=None,
                        help="Percorso file CSV per import")
    parser.add_argument("--output", default=str(DATA_DIR / "leads_raw.json"),
                        help="File output (default: data/leads_raw.json)")
    parser.add_argument("--enrich-emails", action="store_true",
                        help="Arricchisci con email da Hunter.io")

    args = parser.parse_args()
    all_leads = []

    # CSV import
    if args.source in ("csv", "all") and args.csv_input:
        print(f"\n--- Import da CSV: {args.csv_input} ---")
        csv_leads = import_from_csv(args.csv_input)
        print(f"  Importati: {len(csv_leads)} lead")
        all_leads.extend(csv_leads)

    # Apollo
    if args.source in ("apollo", "all"):
        print(f"\n--- Apollo.io search: '{args.query}' ---")
        apollo_leads = search_apollo(args.query, args.country, args.limit)
        print(f"  Trovati: {len(apollo_leads)} lead")
        all_leads.extend(apollo_leads)

    # Google
    if args.source in ("google", "all"):
        print(f"\n--- Google search: '{args.query}' ---")
        google_leads = search_google_fashion(args.query, args.country, args.limit)
        print(f"  Trovati: {len(google_leads)} lead")
        all_leads.extend(google_leads)

    # Deduplica
    all_leads = deduplicate(all_leads)
    print(f"\nTotale lead (dopo deduplica): {len(all_leads)}")

    # Enrich email (opzionale)
    if args.enrich_emails and HUNTER_API_KEY:
        print("\n--- Enrichment email (Hunter.io) ---")
        for lead in tqdm(all_leads, desc="Email lookup"):
            website = lead.get("website", "")
            if website and not lead.get("contact_email"):
                domain = website.replace("https://", "").replace("http://", "").split("/")[0]
                email_data = find_emails_hunter(domain)
                if email_data:
                    lead.update(email_data)
                time.sleep(0.5)

    # Salva output
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    existing = []
    if output_path.exists():
        with open(output_path, "r", encoding="utf-8") as f:
            existing = json.load(f)
        print(f"Lead esistenti nel file: {len(existing)}")

    combined = deduplicate(existing + all_leads)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(combined, f, indent=2, ensure_ascii=False)

    print(f"\nSalvati {len(combined)} lead in {output_path}")
    print(f"  Nuovi aggiunti: {len(combined) - len(existing)}")


if __name__ == "__main__":
    main()
