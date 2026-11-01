# Search demand and the next teaching release

Research date: November 1, 2026. This is an editorial decision record, not a forecast of traffic or a claim of competitive parity.

## What was measured

Google Trends was inspected directly with **United States / Past 12 months / Web Search / All categories**, comparing three search terms in one chart. The interface's displayed average relative-interest values were:

| Search term | Displayed average interest |
|---|---:|
| AI chatbot | 64 |
| ChatGPT for business | 26 |
| ChatGPT for Excel | 4 |

Source: [the observed Google Trends comparison](https://trends.google.com/trends/explore?geo=US&q=ChatGPT%20for%20Excel,AI%20chatbot,ChatGPT%20for%20business&hl=en). The table and weekly observations are preserved in `data/research/google-trends-observation-2026-11-01.json`.

These are **sampled, normalized 0–100 interest values**, not monthly searches, percentages of people, revenue opportunity, or probabilities of ranking. Broad chatbot interest includes consumer and nonbusiness intent. The exact long tutorial phrases below were not measured for monthly volume. The latest week is incomplete and is not used to infer a trend or make a forecast. Google's [measurement explanation](https://support.google.com/trends/answer/4365533?hl=en) explains normalization and sampling.

Google's December 2025 [search-trends review](https://business.google.com/us/think/search-and-video/search-trends-marketing-takeaways/) also describes growth in practical questions about what AI can do and how to use it. That is historical, broad corroboration, not a 2026 keyword-volume estimate.

Public keyword-provider extracts were considered but not used to claim narrow current volume: some lacked geography/methodology, some were illustrative keyword templates, and some indexed snippets differed from the opened current pages. No monthly search count has been invented to fill that gap.

## Google result observations

Two Google searches were inspected directly in the browser in English with US search parameters. These are observations from one session on one date, not a depersonalized rank-tracking study. The results for the spreadsheet query stated that results were not personalized. Account/location effects can still affect a search presentation. Private account and precise-location details have been omitted from this record.

### How to use ChatGPT to analyze Excel data

The observed AI Overview already explained file upload, clear instructions, follow-up analysis, and checking the result. Visible organic results included the OpenAI developer community, Querio, Recalc Academy, OpenAI's spreadsheet use-case and Academy pages, Reddit discussions, and a substantial video block. Appearing in the results does not establish the correctness of a page.

The observed People Also Ask questions were:

- Which ChatGPT model is best for Excel?
- What are some good ChatGPT prompts for Excel?
- Can AI analyze my Excel spreadsheet?
- What prompts can I use with ChatGPT to analyze data?

Two pages in that result set were opened and compared. [Querio's guide](https://querio.ai/articles/how-to-use-chatgpt-for-excel-data-analysis) centers setup on an API key and a third-party Excel add-in. [Recalc's guide](https://recalcacademy.com/blog-guide/using-chatgpt-to-summarize-data/) already recommends verifying totals, but its access instructions describe Plus and an older analysis interface. Current OpenAI documentation was used for the new lab's ordinary-upload route, Free usage boundaries, and optional official spreadsheet add-ins. The lab's technical sources are listed in `data/research/sales-analysis-lab.json`.

The competitive review also found substantive existing work from Wharton, iTechGuides, and ExcelDemy. Downloadable data, verification, formulas, and screenshots are not inventions of this publication. Our added value is one complete small-business exercise that can be reconciled: dirty event data, explicit refund rules, a missing cost and correction record, a formula workbook, a standalone decimal verifier, a chart, and a bounded business memo.

**Implemented:** `/playbooks/chatgpt-sales-analysis/`. Its FAQ responds to the observed relevant questions. Its primary teaching goal is a checked report, not a generic list of prompts.

### How to train AI chatbot on your website

The observed AI Overview already covered choosing a no-code product, crawling or uploading sources, instructions, fallback, sandbox tests, and embedding. Visible results included Wix's training documentation, Dante AI, the OpenAI developer community, Labelbox, Google Cloud, Reddit and videos from Howfinity, Dave Swift and Awais Mirza. Sponsored results were present and were not counted as organic evidence.

People Also Ask included training a chatbot and building a website chatbot. It also included unrelated employment intent about getting paid to train bots. That latter query was excluded from the curriculum because it does not match a small-business implementation job.

The broader content review compared guides from ChatBot.com, ChatPress, Newten and Tidio. They already cover important parts of source ingestion, preview testing, installation and maintenance. The gap addressed here is a coherent shop policy packet with expected answers, critical-failure criteria, conflicting-source repair, and a documented end-to-end human handoff.

**Implemented:** `/playbooks/customer-support-knowledge-base/`, preserving the existing route and replacing its shorter treatment with the complete lab. It contains twelve original policy answers, twenty mandatory test cases, five paraphrase retests, two vendor documentation screenshots, a blank observed-results log, and a launch-or-hold procedure.

## Why these two lessons were prioritized

| Decision factor | Sales analysis | Customer support |
|---|---|---|
| Observable interest | Relevant Google result set and nonzero related Trends term | Relevant Google result set and substantial broad chatbot interest |
| Business job | Explain a sales export without overstating the result | Answer approved public questions and deliver unresolved requests to a person |
| Existing results already answer | Uploading, prompting, basic charts and verification advice | Crawling, rules, preview and installation |
| Specific added work | Original dirty dataset, correction, independent controls and worked decision | Complete consistent source packet, exact expected behaviors and real routing evidence |
| Evidence boundary | Synthetic data and locally verified calculations; no claimed live ChatGPT run | Documentation-based configuration; no claimed live Tidio accuracy or delivery test |
| Narrow monthly volume | Unmeasured | Unmeasured |

Selection is an editorial judgment combining relevant search evidence, business usefulness, and an implementable instructional difference. It is not an assertion that these are the largest or easiest keywords in the market.

## Professional learning integration

The six-module `/learn/ai-for-small-business/` path adds objectives, prerequisites, assignments, twelve formative questions with explanations, two acquisition tracks, and a capstone portfolio. Browser-only progress requires both correct checked answers and self-reported evidence criteria. The capstone requires at least 10/12, no zero, no unresolved critical failure, and observed connected tests before suggesting consideration of a live pilot. Contradictory evidence states cannot receive that suggestion.

The competitive curriculum review is recorded separately in `docs/professional-learning-gap-audit-2026-11-01.md`. It distinguishes public syllabi and samples from unseen paid course contents. The new path is a practical self-study product; academic equivalence, instructor assessment, learning outcomes, customer results, market preference and traffic growth remain unproved.

## Follow-up evidence that would change the judgment

After publication, examine actual index coverage and query/page impressions, then clicks and engagement. Evaluate whether readers can complete the exercises and where they get stuck. Those observations can support later improvements; they are not assumed in this release. A measured keyword dataset with geography and date would strengthen prioritization, while a learner study and real workflow evidence would strengthen the professional-training claim.
