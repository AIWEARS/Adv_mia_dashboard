#!/usr/bin/env python3
"""
05_export_campaign.py — Export campagna per Instantly.ai e altri tool.

Formati supportati:
- Instantly.ai CSV (default)
- Generic CSV
- JSON

Input:  data/leads_with_emails.json
Output: data/campaign_<name>_instantly.csv
"""

import argparse
import csv
import json
import os
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

DATA_DIR = Path(__file__).parent / "data"


def export_instantly(leads, output_path, campaign_name):
    """Export in formato Instantly.ai CSV."""
    fieldnames = [
        "email",
        "first_name",
        "last_name",
        "company_name",
        "website",
        "custom1",  # Subject A
        "custom2",  # Subject B
        "custom3",  # Email body (prima email)
        "custom4",  # Pain point
        "custom5",  # ICP Score
    ]

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for lead in leads:
            contact_name = lead.get("contact_name", "")
            parts = contact_name.split(" ", 1) if contact_name else ["", ""]
            first_name = parts[0] if len(parts) > 0 else ""
            last_name = parts[1] if len(parts) > 1 else ""

            row = {
                "email": lead.get("contact_email", ""),
                "first_name": first_name,
                "last_name": last_name,
                "company_name": lead.get("company", ""),
                "website": lead.get("website", ""),
                "custom1": lead.get("email_subject_a", lead.get("email_subject_1_a", "")),
                "custom2": lead.get("email_subject_b", lead.get("email_subject_1_b", "")),
                "custom3": lead.get("email_body_1", ""),
                "custom4": lead.get("pain_point", ""),
                "custom5": str(lead.get("icp_score", "")),
            }
            writer.writerow(row)

    print(f"  Instantly.ai CSV: {output_path}")
    return output_path


def export_generic_csv(leads, output_path):
    """Export CSV generico con tutti i campi."""
    if not leads:
        print("  Nessun lead da esportare.")
        return None

    all_keys = set()
    for lead in leads:
        all_keys.update(lead.keys())

    priority_fields = [
        "company", "website", "contact_name", "contact_email", "contact_title",
        "country", "icp_score", "priority", "status", "pain_point", "hook",
        "email_subject_a", "email_subject_b", "email_body_1",
    ]
    other_fields = sorted(all_keys - set(priority_fields))
    fieldnames = [f for f in priority_fields if f in all_keys] + other_fields

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for lead in leads:
            writer.writerow(lead)

    print(f"  Generic CSV: {output_path}")
    return output_path


def export_json(leads, output_path):
    """Export JSON."""
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(leads, f, indent=2, ensure_ascii=False)

    print(f"  JSON: {output_path}")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Export campagna outreach MIA")
    parser.add_argument("--input", default=str(DATA_DIR / "leads_with_emails.json"),
                        help="File input (default: data/leads_with_emails.json)")
    parser.add_argument("--format", choices=["instantly", "csv", "json", "all"], default="instantly",
                        help="Formato export (default: instantly)")
    parser.add_argument("--campaign-name", default=None,
                        help="Nome campagna (default: timestamp)")
    parser.add_argument("--min-score", type=int, default=50,
                        help="Score minimo (default: 50)")
    parser.add_argument("--only-with-email", action="store_true", default=True,
                        help="Esporta solo lead con email (default: True)")
    parser.add_argument("--priority", choices=["hot", "warm", "all"], default="all",
                        help="Filtra per priorita (default: all)")

    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"[ERROR] File non trovato: {input_path}")
        print("Esegui prima 04_write_emails.py")
        return

    with open(input_path, "r", encoding="utf-8") as f:
        leads = json.load(f)

    filtered = leads

    if args.min_score > 0:
        filtered = [l for l in filtered if (l.get("icp_score") or 0) >= args.min_score]

    if args.only_with_email:
        filtered = [l for l in filtered if l.get("contact_email")]

    if args.priority != "all":
        filtered = [l for l in filtered if l.get("priority") == args.priority]

    filtered = [l for l in filtered if l.get("email_body_1")]

    campaign_name = args.campaign_name or datetime.now().strftime("campaign_%Y%m%d_%H%M")

    print(f"\nExport campagna: {campaign_name}")
    print(f"  Lead totali: {len(leads)}")
    print(f"  Lead filtrati: {len(filtered)}")
    print(f"  Formato: {args.format}")

    if not filtered:
        print("\n[WARN] Nessun lead corrisponde ai filtri.")
        return

    if args.format in ("instantly", "all"):
        export_instantly(filtered, DATA_DIR / f"{campaign_name}_instantly.csv", campaign_name)

    if args.format in ("csv", "all"):
        export_generic_csv(filtered, DATA_DIR / f"{campaign_name}_full.csv")

    if args.format in ("json", "all"):
        export_json(filtered, DATA_DIR / f"{campaign_name}.json")

    hot = sum(1 for l in filtered if l.get("priority") == "hot")
    warm = sum(1 for l in filtered if l.get("priority") == "warm")

    print(f"\nRiepilogo export:")
    print(f"  HOT:  {hot} lead")
    print(f"  WARM: {warm} lead")
    print(f"  Totale: {len(filtered)} lead pronti per invio")


if __name__ == "__main__":
    main()
