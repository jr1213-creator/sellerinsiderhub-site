# Software plan cost and capacity data

## Publication scope

The initial dataset compiles 17 existing plan observations across eight products
and four comparison contexts from data/decision-evidence.json. The union of plan
and capacity citations is 18 primary-source records. The original evidence check
date is November 1, 2026; neither the exporter nor a normal build changes it.

This is a curated planning reference, not an industry spending survey,
representative product census, measured AI-quality benchmark, complete stack
budget, or observed return on investment. Six records are free plans. This initial
normalized export supports the ledger's USD amounts; it does not average prices
across billing units or convert unknowns to zero.

The larger catalog is intentionally outside this release: its 128 price rows
include monthly/annual presentations of plans, EUR quotes, one-time charges,
listing fees, outcome prices, and incomplete/custom quotes. Counting or averaging
those rows as comparable monthly subscriptions would be misleading.

## Single evidence source and public fields

The research_components.py module reads the reviewed decision ledger. It does not
fetch prices or maintain a second editable vendor price list. A field allowlist
creates the public snapshot; unrelated private/account fields are never copied.

Each observation retains the stable tool/plan identifier, source check date,
USD currency, billing unit, minimum quantity, monthly payment, annual amount,
annual monthly equivalent, price-band scope, feature states, capacity states,
fair-use review thresholds, notes, primary-source IDs/URLs, and related comparisons.

Amounts are per the stated billing unit. Zero means no charge. Unknown monthly
or annual amounts remain JSON null/blank CSV cells with explicit states. An
unavailable annual offer is separate from an annual price that was not verified.
An annual zero for a free plan does not assert an annual contract.

Capacity values distinguish finite, unlimited subject to source scope/fair use,
not separately metered, and unknown. A review threshold is not a hard usage cap.
Boolean features preserve true, false, and unknown states.

The annual equivalent divides the recorded annual amount by twelve and rounds
to two decimal places. MailerLite annual totals use the annual discount already
recorded in the ledger; Zapier's annual total uses its recorded annual-billing
monthly equivalent. The export identifies those derivations and preserves their
existing notes. No higher tier, usage overage, or unknown charge is extrapolated.

## Worked examples

The page and JSON include four disclosed examples:

- Twelve monthly ChatGPT Plus payments versus the recorded Claude Pro annual
  payment obligation. This is billing arithmetic, not a quality comparison.
- Email recipient sends using the existing calculator's peak-list, broadcast,
  new-entrant and welcome-email defaults.
- Separate Zapier task and Make credit totals using the existing simple-run
  assumptions. These meters are not treated as equivalent work units.
- Buffer Essentials paid-channel multiplication using the existing social
  comparison's channel count, without claiming a paid plan is necessary.

Tests compare the email, automation and channel calculations with the existing
JavaScript calculator. None of these examples is an observed customer result,
revenue estimate, time-saved measurement, or API entitlement claim.

## Primary-source cross-check before initial release

On November 2, 2026, the relevant official sources were re-opened to check the
critical prices, billing bases, allowances, and distinctions before exposing this
existing snapshot as a download. This release retains the ledger's actual
November 1 dates rather than pretending every field was newly researched.

| Product | Cross-check and source |
| --- | --- |
| ChatGPT | Plus monthly payment, absent annual billing, API billed separately: https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus |
| Claude | Pro monthly amount, exact upfront annual charge, individual plan scope: https://claude.com/pricing |
| Zapier | Free task allowance; Professional annual-billing rate and 750-task tier: https://zapier.com/blog/zapier-pricing/ . Total-step limit: https://help.zapier.com/hc/en-us/articles/8496181445261-Zap-limits |
| Make | Free credits and Core entry quote in Make's own June 18, 2026 article: https://www.make.com/blog/best-marketing-automation-tools . The current pricing page's extracted text does not expose the dynamic paid-price cards: https://www.make.com/pricing . The retained note identifies the article basis. |
| MailerLite | Plan names, Free allowances, steps and active-automation limits, annual discount: https://www.mailerlite.com/pricing . Entry paid-tier quantities: https://www.mailerlite.com/blog/squarespace-email-marketing |
| Kit | Free broadcast allowance and absence of sequences/visual automations: https://help.kit.com/en/articles/16627071-the-kit-free-plan . Creator monthly price and user count: https://help.kit.com/en/articles/4494683-creator-vs-pro-choose-the-right-plan . Exact annual total: https://kit.com/pricing |
| Buffer | Monthly/annual per-channel tiers: https://support.buffer.com/articles/buffer-pricing-and-features-6pJrOPuzIt . Free queue and paid 5,000-post fair-use queue limit: https://buffer.com/pricing |
| Metricool | USD monthly/annual brand bundles and excluded Free networks: https://metricool.com/pricing/ . Review threshold, rather than a hard cap: https://help.metricool.com/fair-use-policy-for-social-media-scheduling-e3tnm |

No conflicting critical value was found in those checks. This is not a guarantee
that checkout, all usage rules, or every source sentence will remain unchanged.
No vendor account, subscription, integration, or API was exercised.

## Versioning and durable downloads

The snapshot ID is the first 16 hexadecimal characters of SHA-256 over the
canonical public payload, excluding its own ID. The payload includes source
dates, source records, method, observations, contexts, and scenario arithmetic.
It contains no current build timestamp.

Files use /downloads/research/software-plan-costs-<snapshot_id>.json and .csv.
JSON and CSV bytes are deterministic, with UTF-8 encoding and LF newlines.
Structured CSV cells contain JSON; numeric unknowns remain empty with explicit
state columns.

The reviewed initial pair is stored under research-data/software-plan-costs/.
Normal builds validate every archived JSON hash, matching filename, matching CSV,
and exact canonical bytes, then copy the releases to public output. They also
compute the current release from reviewed evidence and require its exact JSON/CSV
pair to exist in the archive before publishing. They never edit the source
archive. An unarchived current release, missing/incomplete pair, modified bytes,
or unpaired archived file blocks publication with an actionable error.

Before publishing a later changed release, deliberately archive the new pair
after reviewing the evidence and output. Keep all old pairs. Do not infer
historical prices from old vendor pages, fabricate intervening snapshots, or
replace a previous file with corrected bytes under the same ID. Corrections
produce a new content-derived ID.

For an intentional reviewed release, make_snapshot(evidence, origin) creates the
public payload, and snapshot_files(snapshot) returns a mapping of filenames to
exact bytes. Write each new pair into the source archive as a separate review
step, refusing to replace any existing filename with different bytes. A normal
site build performs neither this write nor any source-date refresh.

## Integration contract

Call build_research_asset(DECISION_EVIDENCE, ORIGIN, OUT) from the generator after
its output directory is prepared. The default archive is resolved relative to
the repository root; tests may supply a fourth archive_dir argument.

The return value contains:

- route, title, description, and body. Body contains static content below the
  site's own hero/H1 and needs no new client script.
- snapshot_id, source_checked_at, source_dates, and explicit counts.
- downloads and published_files describing generated public files.
- dataset_metadata for the shared schema helper: route, name, description,
  version, source_dates, distributions (path, encodingFormat, name),
  methodology_url, measurementTechnique, and isBasedOn source URLs.

Source dates mean evidence verification dates, not publication timestamps or a
market time series. The shared schema layer should use the real site publisher,
link the WebPage to this Dataset, and omit any unestablished license. The new
research page may use its actual publication/modification date separately.

## Verification

Run python3 scripts/test_research_data.py for provenance, sample boundaries,
unknown/zero distinctions, billing arithmetic, serialization, escaping and
archive durability. Run python3 scripts/test_research_data.py --built after the
complete site build to check the page, Dataset schema, exact exports and archive.
These are local checks; they never submit traffic or test live vendor accounts.
