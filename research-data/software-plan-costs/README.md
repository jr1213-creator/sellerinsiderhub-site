# Small-business software plan cost and capacity data

A dated, source-linked planning reference from Seller Insider Hub. Use it to inspect a plan's payment terms beside the features and capacity limits that affect a decision.

## Download the reviewed snapshot

| Item | Value |
| --- | --- |
| Snapshot | `13fba5ce86ba8c0f` |
| Publication date | November 2, 2026 |
| Original source-check date | November 1, 2026 |
| Sample | 17 plan observations, eight tools, four comparison contexts |
| Provenance | 18 official source records, with URLs, scope, and check dates |
| Currency | USD; amounts retain their individual billing units |

- [Download CSV](https://raw.githubusercontent.com/jr1213-creator/sellerinsiderhub-site/main/research-data/software-plan-costs/software-plan-costs-13fba5ce86ba8c0f.csv) · [Browse CSV](software-plan-costs-13fba5ce86ba8c0f.csv)
- [Download JSON](https://raw.githubusercontent.com/jr1213-creator/sellerinsiderhub-site/main/research-data/software-plan-costs/software-plan-costs-13fba5ce86ba8c0f.json) · [Browse JSON](software-plan-costs-13fba5ce86ba8c0f.json)
- [Read the research page, methodology, and worked examples](https://sellerinsiderhub.com/research/software-plan-costs/)

The tools are **ChatGPT, Claude, Zapier, Make, MailerLite, Kit, Buffer, and Metricool**. The sample contains the specific plans already reviewed for four comparison calculators. It does not include every plan from those vendors or represent what small businesses actually spend.

## Read a row correctly

Each `observations` entry in the JSON, or row in the CSV, describes one recorded tool/plan tier within its stated scope. It preserves the plan identity, prices, minimum quantity, billing unit, limits, features, notes, check date, official source links, and related comparisons.

| Fields | How to interpret them |
| --- | --- |
| `monthly_payment_usd`, `annual_total_usd` | Separate payment options. An annual total is the recorded upfront obligation; it is not twelve monthly payments. Check the corresponding price status. |
| `annual_monthly_equivalent_usd`, `annual_amount_basis` | Annual total divided by twelve, rounded to cents, with the recorded or derived basis retained. This equivalent is not a monthly-payment offer. |
| `billing_unit`, `min_quantity`, `price_scope`, `scope` | Identify what the quote covers. Per-channel prices and fixed brand bundles cannot be multiplied or averaged interchangeably. |
| `limits`, `features` | Structured values with explicit states, scope, and supporting evidence where recorded. A missing or unknown value is not an entitlement. |
| `source_ids`, `source_urls`, `checked_at` | Connect the observation to the JSON's source records and the original documentation check. |

**Zero, unknown, and unavailable are different.** A free plan has a numeric zero and a `no_charge` price status. Unknown or unavailable amounts remain JSON `null` or empty CSV cells; their status distinguishes `unknown` from `not_offered`. Do not fill these cells with zero. A zero annual amount for a free plan does not establish an annual contract.

Capacity states distinguish `finite`, `unlimited`, `not_metered`, and `unknown`. Read the accompanying scope: a fair-use review threshold is not a guaranteed hard maximum, and tasks, credits, email sends, seats, channels, and brands measure different things. Feature values preserve true, false, and unknown states. Structured CSV cells contain JSON that can be decoded with `json.loads`.

## Inspect one plan with Python

From the repository root, run this with Python 3. It uses only the standard library, reads the archived file, and makes no network requests:

```python
import json
from pathlib import Path

path = Path("research-data/software-plan-costs/software-plan-costs-13fba5ce86ba8c0f.json")
snapshot = json.loads(path.read_text(encoding="utf-8"))
assert snapshot["snapshot_id"] == "13fba5ce86ba8c0f"
plan = next(row for row in snapshot["observations"]
            if row["observation_id"] == "chatgpt:plus")
fields = ("observation_id", "checked_at", "currency", "billing_unit", "scope",
          "monthly_payment_usd", "monthly_price_status", "annual_total_usd",
          "annual_price_status", "limits", "source_urls")
print(json.dumps({key: plan[key] for key in fields}, indent=2))
```

In this snapshot, the example retains `annual_total_usd: null` alongside `annual_price_status: "not_offered"`. It also prints the plan's scope and official source URL so the amount can be checked in context. To inspect another plan, select its `observation_id` from the file.

## Apply the data to a decision

- [ChatGPT vs Claude](https://sellerinsiderhub.com/comparisons/chatgpt-vs-claude/) — individual subscription payment commitments.
- [Zapier vs Make](https://sellerinsiderhub.com/comparisons/zapier-vs-make/) — separate task and credit estimates for a defined workflow.
- [MailerLite vs Kit](https://sellerinsiderhub.com/comparisons/mailerlite-vs-kit/) — subscriber counts, sends, and automation requirements.
- [Buffer vs Metricool](https://sellerinsiderhub.com/comparisons/buffer-vs-metricool/) — channel and brand quantities, plan gates, and publishing limits.
- [Software cost planner](https://sellerinsiderhub.com/calculators/stack-cost/) — total the actual prices and quantities for your chosen subscriptions.

## Provenance and citation

Suggested citation:

> Seller Insider Hub. (2026-11-02). *Small-business software plan cost and capacity data*, snapshot `13fba5ce86ba8c0f`. Source documentation checked 2026-11-01. https://sellerinsiderhub.com/research/software-plan-costs/

When citing a specific price or limit, also identify the observation and its official vendor source. Link to the versioned [JSON](software-plan-costs-13fba5ce86ba8c0f.json) or [CSV](software-plan-costs-13fba5ce86ba8c0f.csv) so a reader can inspect the same snapshot.

The snapshot is compiled from the [reviewed decision evidence](../../data/decision-evidence.json). Its identifier is derived from the canonical public payload; it is not a new source-check date. Archived releases retain their bytes, and corrections receive a new version. The [full methodology and release procedure](../../docs/RESEARCH_DATA_METHOD.md) explains the sample, calculations, original checks, and archive validation.

## Limits

This is a curated compilation of vendor documentation, not a live feed, industry spending average, original vendor-performance benchmark, measured AI-quality score, or observed return on investment. Worked examples use disclosed inputs and arithmetic; they are not customer results. No historical price trend is inferred from this single snapshot.

Quotes exclude unrecorded taxes, currency conversion, overages, external app/API subscriptions, add-ons, and temporary promotions. Do not extrapolate a recorded tier to a larger account. Check the linked official sources and current checkout terms before buying; publishing or rebuilding these files does not refresh their source dates.
