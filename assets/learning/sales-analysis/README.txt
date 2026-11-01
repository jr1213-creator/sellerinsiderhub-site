SELLER INSIDER HUB — SALES ANALYSIS PRACTICE LAB
Guide: https://sellerinsiderhub.com/playbooks/chatgpt-sales-analysis/
Documentation checked November 1, 2026.

Start with sales-events-dirty.csv and the guide. The data is wholly fictional.
Use the answer files after your first attempt. No customer information is included.

Assignment
Produce a clean event file, a cleaning log, a checked channel/product summary,
a chart and a 150–200-word owner memo. Allow 60–90 minutes as a planning estimate.

Files
- sales-events-dirty.csv: 27-row original exercise, deliberately imperfect.
- owner-confirmation.csv: documented synthetic correction for one missing cost.
- sales-analysis-prompts.txt: staged prompts and spreadsheet formulas.
- sales-events-clean.csv: 23-row worked answer after the correction.
- cleaning-log.csv: exact exclusions, label normalization and cost correction.
- sales-analysis-checks.xlsx: Review, Clean and original Raw sheets with formulas.
- sales-analysis-answer-key.json: exact totals and grouped results.
- verify_sales_analysis.py: optional verifier using Python's standard library.
- sales-contribution-chart.png and .svg: original chart of the worked result.

Important definitions
The row key is event_id. The same order_id may appear for a sale and a refund.
Amounts are event totals in USD, not unit amounts. Dates are YYYY-MM-DD.
Refunds are positive deductions. Cancelled rows are uncompleted drafts.
A blank item cost is unknown; numeric zero means a known zero.
No refunded item creates a restock credit, fee reversal or shipping recovery
in this synthetic exercise. Keep costs from the original sale.

Net sales = gross sales - discounts - refunds.
Operational contribution = net sales - item costs - transaction fees - shipping.
Contribution excludes advertising, overhead, owner labor and taxes.
It is not the business's final profit and is not tax/accounting advice.

Spreadsheet route
Import the clean CSV into a sheet called Clean. Keep original fields A–O.
The prompt file explains formulas for columns P–R and summary checks.
Or open sales-analysis-checks.xlsx and inspect its formulas.
Clear Clean!M16 in a disposable copy: total contribution must say Cost missing.
Set it to numeric zero: total contribution becomes 252.90.
Set it to 24: total becomes 228.90. Restore confirmed cost 12: total is 240.90.

Optional Python check
Keep all CSVs and JSON answers beside the script. Run:
python verify_sales_analysis.py
The script does not use the network. It checks fixed controls, refund preservation,
the missing-cost correction and the exact clean-file output using Decimal values.

Verified scope
The exercise calculation was executed locally. The workbook was recalculated
and visually reviewed in its authoring engine, including blank/zero/changed costs.
No native Excel/Google Sheets UI test or live ChatGPT-account execution is claimed.
This is a self-guided practice project, not an accredited credential.
