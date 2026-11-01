#!/usr/bin/env python3
"""Reproduce the original Seller Insider Hub synthetic sales exercise.

Run: python verify_sales_analysis.py
Uses only Python's standard library. Reads neighboring CSVs. Never uploads data.
All amounts are Decimal values. Expected controls are fixed independently of the
generated answer-key JSON. This script is an exercise verifier, not an importer
for arbitrary vendor exports.
"""
import csv
import json
from collections import Counter, defaultdict
from decimal import Decimal
from pathlib import Path

BASE = Path(__file__).resolve().parent
AMOUNTS = ["gross_sales_usd", "discounts_usd", "refunds_usd", "cogs_usd",
           "payment_fees_usd", "shipping_cost_usd"]

def read_csv(name):
    with (BASE / name).open(newline="", encoding="utf-8") as source:
        return list(csv.DictReader(source))

def check():
    raw = read_csv("sales-events-dirty.csv")
    assert len(raw) == 27, "The source should contain 27 data rows."
    frequency = Counter(row["event_id"] for row in raw)
    assert {k: v for k, v in frequency.items() if v > 1} == {"S003": 2, "R002": 2}
    unique = {}
    for row in raw:
        event_id = row["event_id"]
        if event_id in unique:
            assert unique[event_id] == row, "Conflicting duplicate: resolve before deleting."
        else:
            unique[event_id] = row.copy()
    assert len(unique) == 25
    cancelled = [r["event_id"] for r in unique.values() if r["order_status"] == "cancelled"]
    assert cancelled == ["S021", "S022"]
    eligible = [r.copy() for r in unique.values() if r["order_status"] == "completed"]
    assert len(eligible) == 23
    missing = [r["event_id"] for r in eligible if r["cogs_usd"] == ""]
    assert missing == ["S015"], "Do not treat the blank as zero."
    confirmations = read_csv("owner-confirmation.csv")
    assert len(confirmations) == 1
    confirmation = confirmations[0]
    assert (confirmation["event_id"], confirmation["field_name"], confirmation["confirmed_value"]) == ("S015", "cogs_usd", "12.00")
    grouped = defaultdict(lambda: defaultdict(lambda: Decimal("0")))
    all_totals = defaultdict(lambda: Decimal("0"))
    prepared = []
    for row in eligible:
        row["channel"] = row["channel"].strip().lower()
        assert row["channel"] in {"website", "marketplace"}
        assert row["product_sku"] in {"PAD", "POUCH"}
        assert "2026-09-01" <= row["event_date"] <= "2026-09-30"
        if row["event_id"] == confirmation["event_id"]:
            row[confirmation["field_name"]] = confirmation["confirmed_value"]
        amounts = {field: Decimal(row[field]) for field in AMOUNTS}
        assert all(value >= 0 for value in amounts.values())
        if row["event_type"] == "refund":
            assert int(row["quantity"]) == 0
            assert all(amounts[k] == 0 for k in AMOUNTS if k != "refunds_usd")
        amounts["net_sales_usd"] = amounts["gross_sales_usd"] - amounts["discounts_usd"] - amounts["refunds_usd"]
        amounts["contribution_usd"] = amounts["net_sales_usd"] - amounts["cogs_usd"] - amounts["payment_fees_usd"] - amounts["shipping_cost_usd"]
        for field, amount in amounts.items():
            all_totals[field] += amount
            grouped[row["channel"]][field] += amount
        row.update({key: f"{amounts[key]:.2f}" for key in ["net_sales_usd", "contribution_usd"]})
        prepared.append(row)
    sales = [r for r in eligible if r["event_type"] == "sale"]
    refunds = [r for r in eligible if r["event_type"] == "refund"]
    assert len(sales) == 20 and len(refunds) == 3
    assert len({r["order_id"] for r in sales}) == 20
    assert sum(int(r["quantity"]) for r in sales) == 33
    expected = {"gross_sales_usd": "804.00", "discounts_usd": "34.00", "refunds_usd": "68.00",
                "cogs_usd": "306.00", "payment_fees_usd": "63.10", "shipping_cost_usd": "92.00",
                "net_sales_usd": "702.00", "contribution_usd": "240.90"}
    assert dict(all_totals) == {k: Decimal(v) for k, v in expected.items()}
    assert grouped["website"]["net_sales_usd"] == Decimal("382.00")
    assert grouped["website"]["contribution_usd"] == Decimal("164.00")
    assert grouped["marketplace"]["net_sales_usd"] == Decimal("320.00")
    assert grouped["marketplace"]["contribution_usd"] == Decimal("76.90")
    # A sale and its refund are different events on the same order.
    refunded_order = [r for r in prepared if r["order_id"] == "O1003"]
    assert {r["event_id"] for r in refunded_order} == {"S003", "R001"}
    assert sum(Decimal(r["net_sales_usd"]) for r in refunded_order) == 0
    assert sum(Decimal(r["contribution_usd"]) for r in refunded_order) == Decimal("-20.66")
    supplied_clean = read_csv("sales-events-clean.csv")
    assert prepared == supplied_clean, "Clean file differs from the documented transformations."
    saved = json.loads((BASE / "sales-analysis-answer-key.json").read_text())
    assert all(saved["totals"][k] == v for k, v in expected.items())
    print(json.dumps({"result": "All exercise controls matched", "raw_rows": 27,
                      "retained_events": 23, "completed_orders": 20,
                      "net_sales_usd": "702.00", "contribution_usd": "240.90",
                      "refund_order_O1003_contribution_usd": "-20.66"}, indent=2))

if __name__ == "__main__":
    check()
