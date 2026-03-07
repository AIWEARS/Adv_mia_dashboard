#!/usr/bin/env python3
"""
04_write_emails.py — Generazione email personalizzate con Gemini AI.

Per ogni lead qualificato:
- Genera sequenza email (HOT: 3+1 follow-up, WARM: 2+1 follow-up)
- Subject A/B testing
- Personalizzazione basata su pain point e hook

Input:  data/leads_qualified.json
Output: data/leads_with_emails.json
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
DATA_DIR = Path(__file__).parent / "data"

LANGUAGE_MAP = {
    "IT": "italiano", "ES": "spagnolo", "FR": "francese",
    "DE": "tedesco", "PT": "portoghese", "NL": "olandese",
}

EMAIL_SYSTEM_PROMPT = """Sei un copywriter esperto di cold email B2B per MIA (itsmia.it), una webapp SaaS di AI fashion photography.

TONO E STILE:
- Professionale ma conversazionale
- Diretto, no fluff
- Max 150 parole per email
- Mai aggressivo o spammy
- Personalizzato: ogni email deve contenere almeno 1 riferimento specifico al brand

VALUE PROPOSITION MIA:
- Foto prodotto AI di qualita professionale in 2 minuti
- Costo 90% inferiore rispetto a shooting tradizionale
- Consistenza visiva su tutto il catalogo
- Scalabilita illimitata
- Webapp: itsmia.it

FIRMA: Marco | MIA - AI Fashion Photography | itsmia.it
GDPR: ogni email DEVE terminare con {{unsubscribe}} placeholder

IMPORTANTE: Non usare emoji. Non usare grassetto eccessivo. Scrivi come un professionista del settore che parla a un collega."""


def get_client():
    """Inizializza client Gemini."""
    if not GOOGLE_API_KEY:
        print("[ERROR] GOOGLE_API_KEY non configurata.")
        sys.exit(1)

    try:
        from google import genai
        return genai.Client(api_key=GOOGLE_API_KEY)
    except ImportError:
        print("[ERROR] Pacchetto google-genai non installato.")
        sys.exit(1)


def get_language(country):
    """Mappa paese a lingua."""
    return LANGUAGE_MAP.get(country, "inglese")


def generate_email(client, lead, email_number, sequence_type, language):
    """Genera una singola email personalizzata."""
    from google.genai import types

    total_emails = 4 if sequence_type == "hot" else 3
    is_followup = email_number == total_emails

    if is_followup:
        prompt_type = "Follow-up breakup (ultima email, tono leggero, porta aperta)"
    elif email_number == 1:
        prompt_type = "Intro con pain point specifico, presenta MIA come soluzione"
    elif email_number == 2:
        if sequence_type == "hot":
            prompt_type = "Social proof e caso d'uso specifico per il loro settore"
        else:
            prompt_type = "Proposta soft con link a demo"
    elif email_number == 3:
        prompt_type = "Urgenza soft + offerta concreta (trial gratuito)"
    else:
        prompt_type = "Email generica di outreach"

    prompt = f"""Scrivi l'email #{email_number} di {total_emails} per questo lead.

LEAD:
- Brand: {lead.get('company', 'N/A')}
- Sito: {lead.get('website', 'N/A')}
- Settore: {lead.get('product_category', 'fashion')}
- Pain point: {lead.get('pain_point', 'costi shooting fotografici')}
- Hook: {lead.get('hook', '')}
- Piattaforma ecommerce: {lead.get('ecommerce_platform', 'N/A')}
- Score ICP: {lead.get('icp_score', 'N/A')}
- Contatto: {lead.get('contact_name', '')}

TIPO EMAIL: {prompt_type}
SEQUENZA: {sequence_type.upper()} ({total_emails} email totali)
LINGUA: {language}
NUMERO EMAIL: {email_number}/{total_emails}

Rispondi SOLO con il testo dell'email (senza oggetto).
Includi firma "Marco | MIA - AI Fashion Photography | itsmia.it" e {{{{unsubscribe}}}} alla fine."""

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=EMAIL_SYSTEM_PROMPT,
                    temperature=0.7,
                    thinking_config=types.ThinkingConfig(thinking_budget=1024),
                ),
            )
            return response.text.strip()

        except Exception as e:
            if attempt < 2:
                time.sleep(2 ** attempt)
            else:
                return f"[ERRORE GENERAZIONE: {e}]"


def generate_subjects(client, lead, email_number, language):
    """Genera 2 varianti subject A/B."""
    from google.genai import types

    prompt = f"""Genera 2 varianti di oggetto email per A/B testing.

BRAND: {lead.get('company', 'N/A')}
PAIN POINT: {lead.get('pain_point', '')}
HOOK: {lead.get('hook', '')}
LINGUA: {language}
EMAIL #: {email_number}

Regole:
- Max 50 caratteri per subject
- Personalizzato con nome brand o settore
- No clickbait, no caps lock, no emoji
- Variante A: piu diretta
- Variante B: piu curiosa/creativa

Rispondi con un JSON:
{{"subject_a": "...", "subject_b": "..."}}"""

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=EMAIL_SYSTEM_PROMPT,
                    temperature=0.8,
                    thinking_config=types.ThinkingConfig(thinking_budget=512),
                ),
            )

            text = response.text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                text = text.rsplit("```", 1)[0]

            return json.loads(text)

        except Exception as e:
            if attempt < 2:
                time.sleep(2 ** attempt)
            else:
                return {"subject_a": f"Re: {lead.get('company', '')} x MIA", "subject_b": f"Idea per {lead.get('company', '')}"}


def process_lead(client, lead, sequence_type, language):
    """Genera tutte le email per un lead."""
    if sequence_type == "hot":
        num_emails = 4
    else:
        num_emails = 3

    for email_num in range(1, num_emails + 1):
        body = generate_email(client, lead, email_num, sequence_type, language)
        lead[f"email_body_{email_num}"] = body

        subjects = generate_subjects(client, lead, email_num, language)
        lead[f"email_subject_{email_num}_a"] = subjects.get("subject_a", "")
        lead[f"email_subject_{email_num}_b"] = subjects.get("subject_b", "")

        time.sleep(0.5)

    lead["email_subject_a"] = lead.get("email_subject_1_a", "")
    lead["email_subject_b"] = lead.get("email_subject_1_b", "")
    lead["email_sequence_type"] = sequence_type
    lead["emails_generated_at"] = datetime.now().isoformat()
    lead["status"] = "email_ready"

    return lead


def main():
    parser = argparse.ArgumentParser(description="Generazione email AI per outreach MIA")
    parser.add_argument("--input", default=str(DATA_DIR / "leads_qualified.json"),
                        help="File input (default: data/leads_qualified.json)")
    parser.add_argument("--output", default=str(DATA_DIR / "leads_with_emails.json"),
                        help="File output (default: data/leads_with_emails.json)")
    parser.add_argument("--sequence", choices=["hot", "warm", "auto"], default="auto",
                        help="Tipo sequenza (default: auto, basato su score)")
    parser.add_argument("--min-score", type=int, default=50,
                        help="Score minimo per generare email (default: 50)")
    parser.add_argument("--lang", default=None,
                        help="Lingua forzata (default: auto da country)")
    parser.add_argument("--skip-existing", action="store_true",
                        help="Salta lead con email gia generate")

    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"[ERROR] File non trovato: {input_path}")
        print("Esegui prima 03_qualify_leads.py")
        return

    with open(input_path, "r", encoding="utf-8") as f:
        leads = json.load(f)

    eligible = [
        l for l in leads
        if (l.get("icp_score") or 0) >= args.min_score
        and (not args.skip_existing or not l.get("emails_generated_at"))
    ]

    skipped = [l for l in leads if l not in eligible]

    print(f"Lead totali: {len(leads)}")
    print(f"Eligibili (score >= {args.min_score}): {len(eligible)}")
    print(f"Skippati: {len(skipped)}")

    if not eligible:
        print("Nessun lead eligibile per generazione email.")
        return

    client = get_client()

    for lead in tqdm(eligible, desc="Generazione email"):
        score = lead.get("icp_score", 0)

        if args.sequence == "auto":
            seq_type = "hot" if score >= 70 else "warm"
        else:
            seq_type = args.sequence

        language = args.lang or get_language(lead.get("country", ""))

        process_lead(client, lead, seq_type, language)

    all_leads = eligible + skipped
    output_path = Path(args.output)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_leads, f, indent=2, ensure_ascii=False)

    hot_count = sum(1 for l in eligible if l.get("email_sequence_type") == "hot")
    warm_count = sum(1 for l in eligible if l.get("email_sequence_type") == "warm")

    print(f"\nEmail generate:")
    print(f"  HOT sequences: {hot_count} (4 email ciascuna)")
    print(f"  WARM sequences: {warm_count} (3 email ciascuna)")
    print(f"  Totale email: {hot_count * 4 + warm_count * 3}")
    print(f"  Salvati in: {output_path}")


if __name__ == "__main__":
    main()
