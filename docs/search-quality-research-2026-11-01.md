# Search quality and implementation evidence

**Reviewed:** 2026-11-01. **Scope:** public primary documentation and the current repository build. This is an implementation ledger, not a diagnosis from a search engine account. No private analytics, customer records, or credentials are included. Machine-readable companion: [`search-quality-evidence.json`](../data/research/search-quality-evidence.json).

## Finding

The reviewed policies do not establish an AI-word blacklist or a blanket exclusion for AI-assisted writing. They emphasize original value, accuracy, and clear authorship, and identify scaled low-value material as a risk. That distinction does **not** prove that any particular Seller Insider Hub URL has escaped a quality issue. The sources do not disclose every ranking signal. [G1–G3]

The release improves the actual reader experience: complete examples, scoped cost calculations, reusable kits, source records, and accountable publication information. These are observable changes. Increased indexing, rankings, citations, or visits remain outcomes to measure after deployment.

## Keep the search stages separate

| Stage | What establishes it | What it does not establish |
| --- | --- | --- |
| Discovery | Search can learn a URL from links or a sitemap. [G8] | A sitemap entry is not an indexed page. |
| Crawling | The crawler can fetch the public resource; robots rules, hosting, authentication, and responses matter. [G5] | A permitted fetch does not guarantee inclusion. |
| Indexing | The engine processes content and selects canonical representations. [G8] | A declared canonical is not proof of the engine's selection. |
| Ranking and serving | Indexed material competes for relevant searches. [G8] | An indexed article need not appear prominently or earn clicks. |
| Google AI features | A supporting link requires an indexed, snippet-eligible page; ordinary SEO applies. No special AI file or schema is required. [G4] | Eligibility does not guarantee an AI Overview or AI Mode citation. |
| ChatGPT search | `OAI-SearchBot` governs automatic search crawling; `GPTBot` concerns training. `ChatGPT-User` handles user-triggered activity and is not the search inclusion control. [O1] | Allowing a crawler does not establish recommendation or citation performance. |

Google's basic eligibility conditions include access for Googlebot, a successful HTTP response, and indexable content. A robots disallow is not a dependable substitute for a crawlable `noindex` directive. [G5]

## Documented quality risks and the editorial response

| Documented principle | Implementation decision for this publication |
| --- | --- |
| Google targets scaled, unoriginal content made primarily to manipulate rankings, regardless of production method. [G2] | Expand existing useful routes around complete jobs. Do not mass-produce near-identical keyword pages. |
| Google encourages accurate bylines and useful author background. [G1] | Identify Jennie Malone and the operating entity; use a real author profile and initials. Keep biography claims limited to information the owner supplied or approved; our editorial rule prohibits fabricated identities and credentials. |
| AI-assisted material still needs accuracy and relevance checks, including metadata. [G3] | Audit claims, labels, sources, titles, alt text, and structured data. AI output itself is not a factual source. |
| Review guidance favors original research, decision factors, and supporting evidence over length. [G6] | Explain fit and constraints; avoid invented scores, comparative performance, and “best” claims unsupported by actual testing. |
| Bing identifies weak automated content, lightly rewritten material, thin affiliate pages, deceptive markup, artificial promotion, and AI-manipulation attempts as risks. [B1] | Publish usable outputs and honest limitations. Affiliate availability is not a selection criterion. Never add hidden instructions aimed at search or answer systems. |
| Visible and structured dates should describe the page's actual publication or update and agree. [G7] | Preserve publication history; distinguish material updates from source checks. A routine rebuild is not new research. |

**Authorship rule:** owner-authorized first-person ghostwriting can communicate the owner's approved views and background. Permission to write in that voice cannot establish that the owner used a product, conducted a test, served a customer, earned a result, or holds a credential. Such claims need separate evidence. This is the publication's editorial application of accurate authorship, not a quoted search-engine rule about ghostwriting.

**Evidence rule:** vendor documentation, editorial recommendations, synthetic examples, proposed trials, and completed demonstrations must remain visibly distinct. The new trial scorecards are evaluation procedures for readers; empty observations must not become fabricated results. A vendor screenshot illustrates the vendor's documentation, not our own account operation.

## What the current release actually implements

Repository paths below are evidence, not promises of search-engine treatment. Observations refer to the build inspected on 2026-11-01; later edits may supersede this snapshot.

| Area | Observed implementation | Evidence and limit |
| --- | --- | --- |
| Accountable publisher | Named bylines, linked author profile, AI-method note, editorial standards, and corrections route. Person, Organization, ProfilePage, and Article metadata correspond to that presentation. | [`authority_components.py`](../scripts/authority_components.py), [`build_site.py`](../scripts/build_site.py). The audit checks publication consistency; it does not independently certify employment history or credentials. Schema is not a measured authority score. |
| Useful buying decisions | Four focused comparisons cover eight tools and 17 plans. Prices record billing units, payment timing, quantities, source dates, and known limits. Unknown prices remain unknown; calculators stop outside verified bands. | [`decision-evidence.json`](../data/decision-evidence.json), [`decision_components.py`](../scripts/decision_components.py), [`decision-tools.js`](../site-assets/decision-tools.js). Source-based arithmetic, not measured product quality. |
| Original worked material | The assistant guide supplies three complete fictional business examples and a five-task trial. Etsy, email, inquiry-follow-up, and receptionist guides include filled inputs, expected outputs, release checks, and failure cases. | Five `content/*-expanded.html` manuscripts; corresponding `data/research/*-upgrade*.json` records. Examples do not establish customer outcomes or account execution. |
| Reusable outputs | Copy targets and generated text kits preserve the practical material. Relevant guides expose completion checks and tools. | [`tutorial_tools.py`](../scripts/tutorial_tools.py), [`tutorial-tools.js`](../site-assets/tutorial-tools.js), [`test_editorial_release.py`](../scripts/test_editorial_release.py). Tests concern site behavior and generated artifacts. |
| Image provenance | Vendor documentation images have source URLs and captions distinguishing them from Hub account screenshots. Synthetic examples are labelled. | [`assistant-upgrade.json`](../data/research/assistant-upgrade.json), [`etsy-workflow-upgrade.json`](../data/research/etsy-workflow-upgrade.json), [`workflow-upgrade-research.json`](../data/research/workflow-upgrade-research.json), [`receptionist-upgrade.json`](../data/research/receptionist-upgrade.json). Images are not independent performance evidence. |
| Source conflicts | Etsy's differing image-capacity instructions are recorded; the workflow uses seven purposeful images without asserting a disputed maximum. Plan units separate tasks from credits and social queues from monthly publishing allowances. | Etsy research record and decision evidence. Reconcile related catalog and comparison copy whenever source facts change. |
| Technical discovery | Build emits canonical links, static article text, internal navigation, sitemap entries, and public crawl permission. Utility pages may be intentionally `noindex`; admin and investor paths are excluded from general crawling. | [`build_site.py`](../scripts/build_site.py), generated `dist/robots.txt`, `dist/sitemap.xml`, and sample article HTML. The inspected headers contain no blanket indexing block. Local files cannot prove live CDN behavior. |
| Historical route | `/tools/ai-assistant-tools` variants resolve to the expanded `/tools/ai-assistant/` guide. | Redirect assertions in `test_editorial_release.py`. Relevant destination content is checked, not just response shape. |
| Date discipline | Records carry publication, modification, or source-review dates; the builder uses stored page dates instead of the current clock for each rebuild. | [`page-dates.json`](../data/page-dates.json), source records, `build_site.py`. Every future material revision still needs an accurate record. |

**Build-report terminology:** `docs/build-report.json` currently reports 123 generated pages and `indexed: 119`. In this code, `indexed` counts local search-index/sitemap entries. It is **not** a count of Google- or Bing-indexed URLs. The generated sitemap inspected here contains 119 URLs.

## Current crawler policy boundary

The generated robots file allows public content through `User-agent: *`. It does not separately restrict `OAI-SearchBot` or `GPTBot`. OpenAI permits those preferences to be controlled independently. [O1] This ledger records the existing setting; it makes no crawler-policy change.

Bing announced new independent training and grounding preferences on **2026-10-30**, with honoring scheduled to begin **2027-02-01**. The official FAQ says traditional search eligibility is separate. Record that future effective date; do not describe the announcement as an already-active control. [B2]

## Public search observation and its limits

The parent research session sampled Google results for **“ai assistant for small business”** on 2026-11-01 and observed editorial comparison lists, vendor offerings, and community discussion. Some result titles claimed testing. Those claims were not independently validated. The useful editorial response is a clear buying decision plus complete business outputs and a reproducible trial. This observation is not a search-volume estimate, a durable ranking list, or evidence that copying a competitor format will work. Detailed competitor positions are deliberately not inferred from this record.

## Unknowns and remaining verification

- **Search outcome:** this ledger has not inspected private indexing reports, manual actions, crawler logs, or post-release performance. It cannot identify why an individual URL is excluded or rank-limited.
- **Live eligibility:** after deployment, inspect representative public URLs, status codes, redirect destinations, final canonicals, headers, robots access, rendered text, sitemap delivery, and search-engine URL inspection. Distinguish a successful local build from a live crawl.
- **Real product behavior:** no new vendor-account workflow execution or head-to-head quality benchmark was performed for this research. Complete actual trials before changing the evidence label to tested.
- **Authority beyond the site:** an accurate profile and citations establish accountability; independent recognition, links, repeated usefulness, or commercial success have not been measured here.
- **Commercial outcome:** no conversion, revenue, time-saving, or traffic uplift is claimed. Maintain page-level change records so later observations can be compared without attributing every change to this release.

## Official source register

All sources were accessed **2026-11-01**. Google and OpenAI documentation was retrieved directly. Bing's JavaScript help pages were available as official-domain indexed text; direct opens returned an application shell. Summaries are paraphrases. No long source excerpts are reproduced.

- **G1:** Google, [Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).
- **G2:** Google, [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies), especially scaled content abuse.
- **G3:** Google, [Guidance on using generative AI content](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content).
- **G4:** Google, [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features).
- **G5:** Google, [Search technical requirements](https://developers.google.com/search/docs/essentials/technical).
- **G6:** Google, [Write high quality reviews](https://developers.google.com/search/docs/specialty/ecommerce/write-high-quality-reviews).
- **G7:** Google, [Influence your byline dates](https://developers.google.com/search/docs/appearance/publication-dates).
- **G8:** Google, [How Search works](https://developers.google.com/search/docs/fundamentals/how-search-works).
- **B1:** Bing, [Webmaster Guidelines](https://www.bing.com/webmasters/help/bing-webmaster-guidelines-30fba23a).
- **B2:** Bing, [New AI Preferences](https://www.bing.com/webmasters/help/new-ai-preferences-2t1cc16d).
- **O1:** OpenAI, [Overview of OpenAI crawlers](https://developers.openai.com/api/docs/bots).
