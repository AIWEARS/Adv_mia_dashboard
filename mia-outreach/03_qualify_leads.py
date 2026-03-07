#!/usr/bin/env python3
"""
03_qualify_leads.py — Qualificazione AI lead con Gemini 3.1 Flash Lite.

Per ogni lead:
- Analisi ICP fit (0-100)
- Identificazione pain point
- Hook personalizzato
- Servizio MIA raccomandato
- Priorita (hot/warm/cold)

Batch processing: 10 lead per batch con retry esponenziale.

Input:  data/leads_enriched.json
Output: data/leads_qualified.json
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from tqdm import tqdm

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
MODEL = "gemini-3.1-flash-lite-preview"
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "10"))
MAX_RETRIES = 3
DATA_DIR = Path(__file__).parent / "data"

ICP_SYSTEM_PROMPT = """Sei un esperto di sales intelligence per MIA (itsmia.it), una webapp SaaS di AI fashion photography.

MIA permette ai brand fashion di generare foto prodotto professionali con AI in 2 minuti, eliminando la necessita di costosi shooting fotografici.

IDEAL CUSTOMER PROFILE (ICP):
- Settore: Fashion, beauty, luxury, accessori, calzature, eyewear
- Dimensione: PMI con 5-200 dipendenti, fatturato 500K-50M EUR
- Ecommerce: attivo con catalogo prodotti online (Shopify, WooCommerce, Magento, custom)
- Pain Point: costi elevati shooting, tempi lunghi, qualita foto inconsistente, scalabilita catalogo
- Digital Maturity: attivi su social media, investono in adv digitale
- Geografia: priorita Italia ed Europa

VALUE PROPOSITION MIA:
- Foto prodotto AI di qualita professionale in 2 minuti
- Costo 90% inferiore rispetto a shooting tradizionale
- Consistenza visiva su tutto il catalogo
- Scalabilita illimitata (100 o 10.000 foto, stesso tempo unitario)
- Nessun bisogno di modelle, fotografi, studi
- Integrazione diretta con ecommerce

SCORING (0-100):
- 70-100: HOT — Perfetto ICP fit, priorita massima
- 50-69: WARM — Buon fit, potenziale con nurturing
- 0-49: COLD — Fuori target o bassa probabilita

Per ogni lead, fornisci un JSON con:
{
  "icp_score": <numero 0-100>,
  "icp_reasons": "<motivazioni scoring, 2-3 frasi>",
  "pain_point": "<pain point specifico identificato>",
  "hook": "<hook personalizzato per outreach, 1 frase>",
  "recommended_service": "<servizio MIA piu adatto>",
  "priority": "hot|warm|cold",
  "product_category": "<categoria prodotto del brand>"
}"""


def get_client():
    """Inizializza client Gemini."""
    if not GOOGLE_API_KEY:
        print("[ERROR] GOOGLE_API_KEY non configurata. Impostala nel file .env")
        sys.exit(1)

    try:
        from google import genai
        return genai.Client(api_key=GOOGLE_API_KEY)
    except ImportError:
        print("[ERROR] Pacchetto google-genai non installato.")
        print("Esegui: pip install google-genai")
        sys.exit(1)


def qualify_batch(client, leads_batch, batch_num):
    """Qualifica un batch di lead con Gemini. Retry con backoff esponenziale."""
    leads_data = []
    for lead in leads_batch:
        leads_data.append({
            "company": lead.get("company", ""),
            "website": lead.get("website", ""),
            "country": lead.get("country", ""),
            "industry": lead.get("industry", ""),
            "employee_count": lead.get("employee_count"),
            "ecommerce_platform": lead.get("ecommerce_platform", ""),
            "estimated_sku_count": lead.get("estimated_sku_count", ""),
            "current_photo_quality": lead.get("current_photo_quality", ""),
            "instagram_handle": lead.get("instagram_handle", ""),
            "site_title": lead.get("site_title", ""),
            "site_description": lead.get("site_description", ""),
        })

    prompt = f"""Analizza questi {len(leads_data)} lead e qualifica ciascuno per MIA.

Lead da qualificare:
{json.dumps(leads_data, indent=2, ensure_ascii=False)}

Rispondi con un JSON array con un oggetto per ogni lead, nello stesso ordine.
Ogni oggetto deve avere: icp_score, icp_reasons, pain_point, hook, recommended_service, priority, product_category.

IMPORTANTE: rispondi SOLO con il JSON array, nessun testo aggiuntivo."""

    for attempt in range(MAX_RETRIES):
        try:
            from google.genai import types

            response = client.models.generate_content(
                model=MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=ICP_SYSTEM_PROMPT,
                    temperature=0.3,
                    thinking_config=types.ThinkingConfig(thinking_budget=2048),
                ),
            )

            text = response.text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                text = text.rsplit("```", 1)[0]

            results = json.loads(text)
            if isinstance(results, list) and len(results) == len(leads_batch):
                return results
            else:
                print(f"  [WARN] Batch {batch_num}: risultati {len(results)} != lead {len(leads_batch)}")
                if isinstance(results, list):
                    while len(results) < len(leads_batch):
                        results.append({"icp_score": 0, "priority": "cold", "icp_reasons": "Errore analisi"})
                    return results[:len(leads_batch)]

        except json.JSONDecodeError as e:
            print(f"  [WARN] Batch {batch_num}, tentativo {attempt + 1}: JSON parse error: {e}")
        except Exception as e:
            print(f"  [WARN] Batch {batch_num}, tentativo {attempt + 1}: {e}")

        if attempt < MAX_RETRIES - 1:
            delay = 2 ** attempt
            print(f"  Retry tra {delay}s...")
            time.sleep(delay)

    print(f"  [ERROR] Batch {batch_num}: fallito dopo {MAX_RETRIES} tentativi")
    return [{"icp_score": 0, "priority": "cold", "icp_reasons": "Errore qualificazione"} for _ in leads_batch]


def main():
    parser = argparse.ArgumentParser(description="Qualificazione AI lead con Gemini")
    parser.add_argument("--input", default=str(DATA_DIR / "leads_enriched.json"),
                        help="File input (default: data/leads_enriched.json)")
    parser.add_argument("--output", default=str(DATA_DIR / "leads_qualified.json"),
                        help="File output (default: data/leads_qualified.json)")
    parser.add_argument("--min-score", type=int, default=0,
                        help="Score minimo per includere nel output (default: 0)")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE,
                        help=f"Dimensione batch (default: {BATCH_SIZE})")
    parser.add_argument("--skip-qualified", action="store_true",
                        help="Salta lead gia qualificati")

    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"[ERROR] File non trovato: {input_path}")
        print("Esegui prima 02_enrich_leads.py")
        return

    with open(input_path, "r", encoding="utf-8") as f:
        leads = json.load(f)

    if args.skip_qualified:
        to_qualify = [l for l in leads if not l.get("icp_score")]
        already_qualified = [l for l in leads if l.get("icp_score")]
        print(f"Lead gia qualificati: {len(already_qualified)}")
    else:
        to_qualify = leads
        already_qualified = []

    print(f"Lead da qualificare: {len(to_qualify)}")

    if not to_qualify:
        print("Nessun lead da qualificare.")
        return

    client = get_client()

    batches = [to_qualify[i:i + args.batch_size] for i in range(0, len(to_qualify), args.batch_size)]
    print(f"Batch: {len(batches)} (da {args.batch_size} lead ciascuno)")

    qualified = []
    for batch_num, batch in enumerate(tqdm(batches, desc="Qualificazione AI"), 1):
        results = qualify_batch(client, batch, batch_num)

        for lead, result in zip(batch, results):
            lead.update(result)
            lead["qualified_at"] = datetime.now().isoformat()
            qualified.append(lead)

        if batch_num < len(batches):
            time.sleep(1)

    all_leads = already_qualified + qualified

    if args.min_score > 0:
        all_leads = [l for l in all_leads if (l.get("icp_score") or 0) >= args.min_score]
        print(f"Lead con score >= {args.min_score}: {len(all_leads)}")

    output_path = Path(args.output)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_leads, f, indent=2, ensure_ascii=False)

    hot = sum(1 for l in all_leads if l.get("priority") == "hot")
    warm = sum(1 for l in all_leads if l.get("priority") == "warm")
    cold = sum(1 for l in all_leads if l.get("priority") == "cold")

    print(f"\nRisultati qualificazione:")
    print(f"  HOT (>=70):  {hot}")
    print(f"  WARM (50-69): {warm}")
    print(f"  COLD (<50):  {cold}")
    print(f"  Totale:      {len(all_leads)}")
    print(f"  Salvati in:  {output_path}")


if __name__ == "__main__":
    main()
