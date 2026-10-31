# Seller Insider Hub: complete product requirements

Date: October 31, 2026. Operator: The Local Upgrade LLC.

This document specifies the complete production publication requested by the owner. It is a requirements baseline, not a claim that every requirement has already been implemented or tested. Record actual implementation evidence separately.

## 1. Product decision and scope

Build SellerInsiderHub.com into a serious editorial publication for small businesses using AI: the depth, clarity, practical usefulness, and accountable editing expected from a major technology publication, with its own original identity. The main product is exceptionally helpful researched reporting, buying advice, and vendor-grade tutorials. Search, comparison, a directory, calculators, and saved work support that reading and implementation experience; accumulating app features or catalog entries is not the measure of quality.

The homepage and navigation must lead with timely reader problems, useful tutorials, explained product decisions, and editorial topic coverage. Present the best relevant work as an editorial publication, rather than leading with a stack-builder funnel or a grid of software logos. Do not copy another publisher's branding, protected assets, or articles.

The scope includes the complete directory, product profiles, comparison system, editorial library, business hubs, interactive tools, workspace, subscription experience, trust materials, and operational foundations described below. Engineering can sequence dependencies; sequencing must not become an unrequested smaller launch, a page-count cap, a forced single niche, or a requirement to prove income before completing the product.

Preserve the established breadth: product and Etsy sellers, ecommerce businesses, creators, local and service businesses, real-estate professionals, coaches, contractors, and appointment-based businesses. Hubs may receive different editorial emphasis as evidence improves, but research does not authorize silently removing these audiences or useful existing pages.

The business should be operable with little direct human interaction. Readers must be able to learn, decide, save, and act without booking a call. Do not make consulting, custom implementation, live coaching, or continuous forum moderation necessary to use the core product.

Commercially promising topics are appropriate when they also serve a demonstrated reader need. Keep affiliate strategy and application administration in the operating layer. Reader-facing pages should contain the necessary concise disclosures near monetized recommendations and in the footer, plus the full policy link, without repeated affiliate explanations or commission-focused promotional copy. Affiliate readiness does not mean a vendor has accepted an application or that visits, signups, or clicks guarantee payment.

## 2. Existing system to preserve and inspect

The inspected repository contains a static HTML site configured for Netlify, shared CSS/JavaScript, a central tool/link file at data/affiliate-links.json, and routes for tool categories, business hubs, problem guides, implementation, comparisons, the AI Setup Generator, editorial standards, disclosure, privacy, terms, and partnerships. It also contains legacy community/Supabase code and a browser-local click demonstration.

Use this code and its working content as the starting point. Keep canonical routes or supply deliberate permanent redirects. Inspect actual current files before assuming this inventory or any older build-check file proves production behavior. A stack migration is justified only by a concrete requirement that the existing architecture cannot reasonably meet.

## 2a. Research drives editorial commissioning

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| RES-01 | Evidence-led topic selection | Each commissioned article/tutorial has a research brief connecting an actual reader problem to observed Google/search results or other identified search signals, current market/product evidence, and the intended helpful outcome. Do not select topics solely because a vendor has a high commission. |
| RES-02 | Honest search observations | Record query, source/search surface, observation date, locale/device where known, pages or question patterns observed, and limits of the observation. An observed result is not a verified ranking position, search-volume estimate, growth rate, or proof of demand. |
| RES-03 | Verifiable market signals | Distinguish primary market research, Google Trends or keyword-tool observations when actually available, current official product releases, vendor claims, and editorial inference. Never invent search volume, trend percentages, keyword difficulty, or competitor traffic. Missing metrics remain unavailable. |
| RES-04 | Research-to-content traceability | Article ID connects to brief ID, query/topic evidence, source IDs, claim/check records, content revision, author/editor identity, and review state. Important claims can be traced to their source and actual check date. |
| RES-05 | Reusable source snapshots | Retain source title, URL, publisher, retrieval date, relevant fact notes or minimal permitted excerpts, scope/version/plan, and an evidence hash or stored snapshot reference when available. Keep research records outside public build output unless intentionally prepared for publication. Do not republish full copyrighted sources or private account material. |
| RES-06 | Primary-source tutorial research | Vendor instructions, API/function behavior, limits, pricing, and platform policies are grounded in current official documentation. If exact UI steps cannot be verified, label a conceptual framework honestly rather than claiming a complete tested tutorial. |
| RES-07 | Commercial and editorial judgment | The commissioning brief separately records reader benefit, useful intent, competitive gap, possible monetization, evidence strength, and update burden. A free/native solution can win. Commission size cannot override factual conclusions. |
| RES-08 | Controlled publication pipeline | Research brief, source collection, AI-assisted drafting, claim verification, editorial QA, and deterministic build are separate recorded stages. No uncontrolled mass generation/publication, assumed research, or automatic publication merely because an AI draft exists. |

## 3. Definition of complete

A requirement is complete when its user-facing behavior works, its content is substantiated, its relevant edge states are handled, and the indicated verification has been recorded. Source-code presence alone is not sufficient evidence.

Use these statuses in the implementation report:

- **Verified:** implemented and checked in the stated environment, with evidence.
- **Implemented; live verification needed:** code is complete, but a hosting or delivery behavior still needs its production check.
- **External configuration needed:** a specific credential, vendor approval, inbox, integration, or owner-controlled setting prevents activation. Name the dependency without publishing secrets.
- **Incomplete:** requested behavior is absent or does not yet satisfy its criteria.

An external dependency remains part of the complete product scope. Build all feasible integration code, documentation, fallback behavior, and tests around it. Report the dependency precisely; do not replace a functioning feature with a success-looking mockup.

## 4. Information architecture and navigation

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| IA-01 | Editorial-first site structure | Primary navigation and homepage emphasize tutorials, useful explainers, buying advice/comparisons, and topic/business coverage. Tools, interactive planning, and saved reading/work remain accessible supporting utilities. Trust and partner materials remain findable without becoming the main reader story. Every destination exists. |
| IA-02 | Intent-based discovery | Visitors can start from a business type, problem, software category, or known vendor and reach useful recommendations without knowing internal taxonomy. |
| IA-03 | Connected editorial coverage | Topic pillars connect explanations, product decisions, exact tutorials, and practical follow-ups. Product profiles and utilities support those articles. Hubs link to substantive coverage; articles link to the next relevant task and their topic context. No orphaned publication pages. |
| IA-04 | Site search | Search covers meaningful tool and content metadata, supports keyboard use, shows result types and clear empty states, and never sends personal query contents into analytics by default. |
| IA-05 | Route preservation | Existing useful URLs remain available or redirect once to a relevant replacement. No redirect loops, unrelated blanket redirects, or broken internal links. |

Suggested surfaces are /tool-library/, /compare/, /business-types/, /implementation/, /guides/, a stack-builder route, /calculators/, and /workspace/. Existing canonical equivalents can be retained. Record the final route map in the implementation report.

## 5. Premium design and accessibility

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| UX-01 | Complete editorial design system | Shared type, color, spacing, components, and restrained motion create a coherent publication. Prioritize reading hierarchy, useful headlines, bylines, source/date metadata, article imagery, related reading, and comfortable long-form layouts. Avoid an attractive homepage with unfinished articles or an app-dashboard aesthetic dominating editorial work. |
| UX-02 | Responsive layouts | Inspect narrow phone, tablet, and desktop widths. Content remains readable, controls usable, and navigation available. Necessary table scrolling is contained and labelled. |
| UX-03 | Accessible interaction | Aim for WCAG 2.2 AA. Include semantic landmarks, sensible heading order, skip link, visible keyboard focus, labelled controls, appropriate contrast, and keyboard-operable filters/dialogs/tabs. Do not claim certification merely from an automated score. |
| UX-04 | Usable touch and motion | Provide comfortably sized touch targets, no hover-only actions, reduced-motion support, and no intrusive autoplay. Focus returns correctly after dialogs close. |
| UX-05 | Reader clarity | Headings and CTAs explain the decision and next action. Keep implementation notes, affiliate administration, debug data, and developer instructions out of product copy. |
| UX-06 | Complete states | Loading, no results, unavailable data, error, saved, removed, and success states are purposeful. Errors offer an action or explanation and are announced accessibly where relevant. |

## 6. Searchable tool directory and vendor profiles

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| DIR-01 | Rich directory | Search by vendor, task, and relevant tags; filter by category, business fit, price model/free availability, skill or setup complexity, and supported use case where sourced. Combine filters, clear them, and show accurate result counts. |
| DIR-02 | Consistent data | Stable vendor IDs connect cards, profiles, comparisons, recommendations, bookmarks, and outbound links. One canonical record supplies shared facts. No duplicates caused by brand renaming or inconsistent capitalization. |
| DIR-03 | Complete taxonomy | Cover the site's established AI assistants, design, automation, email, planning, seller tools, CRM, SEO, scheduling, customer service, reviews, social, phone, and voice/video needs. Expand with real audience needs; do not create empty categories merely to appear comprehensive. |
| DIR-04 | Useful card actions | Cards show the task fit and important limitation, open the profile, add/remove comparison, save/unsave, and offer an honest vendor CTA. Actions remain consistent after filtering. |
| DIR-05 | Durable search state | Appropriate nonpersonal filters and sort state can survive navigation and be represented in shareable URLs. Unknown filter values fail safely. |
| DIR-06 | Honest ordering | Use an explained editorial/default order or transparent sorting. Never present an unsupported rating or commission-weighted rank as an independent quality assessment. |
| PRO-01 | Individual profiles | Each published catalog product has a canonical, crawlable profile with purpose, audience fit, unsuitable cases, practical capabilities, limitations, alternatives, pricing approach, sources, and relevant guides. |
| PRO-02 | Evidence and freshness | Distinguish hands-on observations, desk research, and vendor statements. Date the actual fact check. Unknown price or feature support stays unknown; it is not displayed as zero or false. |
| PRO-03 | Pricing clarity | Explain currency, billing interval, annual commitment, relevant usage/seat limits, and date when numeric prices are shown. Do not compare an annual equivalent with a cancellable monthly price without explanation. |
| PRO-04 | Accurate claims | Remove inherited unsupported numeric review scores unless a documented method and current evidence support them. Do not fabricate testing, users, testimonials, savings, integrations, or partner status. |
| PRO-05 | Working media | Images have rights/permission, useful alt text, correct proportions, and loading fallbacks. Do not substitute a mock screenshot for an actual product demonstration without labelling it. |

## 7. Comparison engine and editorial comparisons

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| CMP-01 | Interactive comparison | Add, remove, and replace products from directory and profile pages. Compare several products side by side with clear limits suited to the interface; this is an interaction limit, not a catalog cap. Selection persists appropriately. |
| CMP-02 | Comparable evidence | Compare job fit, entry approach, relevant limits, complexity, support/integrations when verified, tradeoffs, and alternatives. Show unavailable facts explicitly. Explain when products solve different jobs. |
| CMP-03 | Usable output | Mobile comparison remains legible and keyboard accessible. Visitors can save or share a comparison without exposing personal workspace notes. Invalid or removed IDs have a recovery state. |
| CMP-04 | Editorial depth | Publish useful, unique comparisons across established categories, including the existing automation comparison. Explain who should choose each option, who needs neither, and how to test the fit. Avoid generating every possible pair as thin duplicate content. |
| CMP-05 | Consistency | Profile, directory, and comparison facts resolve to the same records. Editorial conclusions may add nuance but cannot silently contradict the source data. |

## 8. Business hubs, problem hubs, workflows, and knowledge

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| PUB-01 | Complete business hubs | Existing audience groups have substantive hub pages with their main operating needs, relevant systems, connected tutorials, tool choices, cost/complexity tradeoffs, and practical next steps. No generic text with only an audience name swapped. |
| PUB-02 | Problem-led resources | Cover the existing lead, customer-response, scheduling, content, CRM, email, reviews, social, and phone-system problems. Show the manual/native approach alongside software where useful. |
| PUB-03 | Vendor-grade tutorials | Each tutorial names one concrete outcome and relevant product/version/plan; specifies account/access prerequisites, required assets, inputs and setup; supplies exact verified instructions, usable example inputs, expected results, validation, troubleshooting, cleanup/recovery, and ongoing cost/work. Link to the specific official documentation used. A generic multi-vendor outline is not a substitute. |
| PUB-04 | Real examples | Use synthetic or permissioned demonstrations. Clearly label illustrative outcomes. An AI-generated example is not evidence that a real business achieved a result. |
| PUB-05 | Platform-aware guidance | Check current platform restrictions for instructions involving marketplace listings, customer data, marketing permission, or automated posting. Do not infer vendor approval or regulated-data suitability from general integration claims. |
| PUB-06 | Accountable human authorship | Every substantive article identifies the actual accountable human author/editor or responsible publisher with a real biography/contact route. Explain AI assistance accurately. Do not invent a human review, imply the named person tested a product when they did not, or use an anonymous editorial label as a substitute for accountability. Publication, modification, source-check, and test dates have distinct truthful meanings. |
| PUB-07 | Content library navigation | Provide clear category/topic navigation, related resources, readable article layouts, and useful on-page navigation for long guides. Search and browsing do not depend on marketing signup. |
| PUB-08 | Reusable tutorial inputs | Supply usable copyable examples: prompts, sample data, configuration, message templates, or code as relevant. Define placeholders and input/output formats. Examples use synthetic or permitted data and fit the documented product behavior. |
| PUB-09 | Observable validation | A reader can compare the output/state they actually see against a concrete expected result. Include success checks and common failure symptoms with specific likely causes and fixes. Do not replace validation with a vague instruction to see whether it helped. |
| PUB-10 | Honest research and testing labels | State whether the article is documentation-based, independently executed, or partially tested. Identify actual tested tasks and limits. Never claim a workflow was run merely because an AI generated plausible steps. |
| PUB-11 | Useful source sections | Show article-specific authoritative sources, readable source titles, relevant dates, and context for material claims. A generic vendor homepage or an undifferentiated URL list cannot support detailed configuration instructions. |
| PUB-12 | Publication quality gate | The research brief, major claim checks, tutorial completeness, accountable attribution, dates, links, and required structured metadata pass review before the article is marked publication-ready. Record unresolved issues; page count alone is not evidence of quality. |

### Required tutorial anatomy

1. A direct answer or concrete promised result, with who it is for and who needs a different approach.
2. Prerequisites, actual plan/access requirements, source/check dates, and realistic setup assumptions.
3. Usable sample input, prompt, data, or configuration; explain substitutions and sensitive-data handling.
4. Exact steps grounded in current official instructions, with expected intermediate results and illustrative screenshots only when authentic and permitted.
5. Expected final result, specific checks, troubleshooting, and recovery/cleanup.
6. Costs, limits, maintenance, and relevant alternatives without unnecessary tool purchases.
7. Named accountable authorship, honest testing/research method, article-specific sources, and useful related reading.

Longer articles are justified by useful depth, not a word-count target. Broad coverage remains in scope; every published item must earn its place through reader value and evidence.

## 9. Stack builder and calculators

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| INT-01 | Guided stack builder | Accept business type, desired jobs, existing tools, experience, budget, and relevant constraints. Explain recommendations and implementation order. Avoid recommending duplicate products for the same job without a reason. |
| INT-02 | Constraint-aware results | Budget and existing tools affect results. Include a free/native or keep-current-tools outcome. Unknown subscription costs are labelled instead of counted as zero. |
| INT-03 | Honest recommendation logic | Use documented, testable rules and evidence. A deterministic tool must not imply a live AI consultation. Remove arbitrary readiness, confidence, or savings scores unless their meaning and calculation are defensible. |
| INT-04 | Complete plan | Results include why each product fits, its limitations, dependencies, a realistic setup sequence, sources, links, and a save/export path. Editing inputs updates results without losing unrelated saved work. |
| CAL-01 | Useful calculator suite | Include software/stack cost, automation time-and-cost tradeoffs, and seller/storefront decision calculations where relevant. Organize calculators as a coherent surface connected to guides. |
| CAL-02 | Transparent formulas | State inputs, currency, units, assumptions, formula, exclusions, and the difference between estimated time value and cash savings. Test zero, negative, blank, extreme, and inconsistent input cases. |
| CAL-03 | Storefront reality | A marketplace-versus-own-store model includes relevant fixed/variable costs and an explicit assumption about independently acquired demand. Never assume marketplace buyers automatically transfer or that fee savings equal added profit. |
| CAL-04 | Qualified outputs | Outputs are estimates, not income promises. Allow useful sensitivity changes and explain which assumptions affect the answer most. Save/export does not require sending private numbers to an analytics provider. |

## 10. Saved workspace

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| SAV-01 | Actual persistence | Save tools, comparisons, plans, and relevant resources. The workspace shows real saved items, supports removal and clear-all with appropriate confirmation, and handles empty state. |
| SAV-02 | Clear storage model | If storage is browser-local, say saved on this device and explain clearing browser data. Do not imply account login, cloud backup, or cross-device sync. If cloud sync is offered, implement authentication, ownership, deletion, and recovery correctly. |
| SAV-03 | Data portability | Export usable saved work; import only supported versioned data with validation and safe text rendering. Provide printable/readable plans where practical. Malformed data cannot execute code. |
| SAV-04 | Failure handling | Blocked storage, private browsing restrictions, corrupted records, missing vendors, and schema changes do not crash the site. Explain when a save could not persist. |
| SAV-05 | Privacy | Do not place email addresses, private notes, or business-sensitive inputs in public share URLs, analytics events, or repository files. |

## 11. Lead capture and communication

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| SUB-01 | Clear value and permission | Signup describes what the reader will receive. Marketing consent is explicit and unambiguous; optional interests are optional. A requested plan delivery and an ongoing marketing subscription are not silently conflated. |
| SUB-02 | Real submission | Validate input, prevent duplicate accidental submissions, manage pending/error/success states, and connect to the documented storage/provider. A successful HTML response alone must not be described as a delivered email. |
| SUB-03 | Delivery integration | Where email delivery is promised, verify actual provider configuration and recipient delivery. Support required confirmation/unsubscribe behavior and retain appropriate permission evidence privately. |
| SUB-04 | Accessible fallback | Visitors can still save/download usable work when mail delivery is not configured. The UI states the actual available action instead of promising an email it cannot send. |
| SUB-05 | Abuse resistance | Use suitable anti-spam and rate controls, input limits, server validation for server writes, and minimal data collection. Do not expose credentials in browser code. |
| SUB-06 | Low-contact experience | Useful self-service content and a focused FAQ answer routine questions. Contact/correction/partner paths are asynchronous and make no unsupported response-time promise. |

## 12. Affiliate readiness, editorial trust, and partnerships

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| AFF-01 | Central approved-link registry | Record stable vendor ID, official URL, affiliate URL, link/approval state, program/source references, checked date, and relevant restrictions. Use approved links only when actual status and intended destination support them. |
| AFF-02 | Safe fallback | An unapproved, expired, or absent affiliate link falls back to a valid official site with ordinary wording. A normal vendor visit is never reported as a monetized conversion. No placeholder buttons, invented codes, or self-referral tests. |
| AFF-03 | Attribution preservation | Product and trial CTAs use the approved eligible destination. A plain trial URL must not accidentally bypass a valid affiliate link. Respect program restrictions on redirects, parameters, channels, and attribution. |
| AFF-04 | Editorial independence | Product fit and evidence determine recommendations. Keep commission economics separate from public quality judgments. Include useful unaffiliated alternatives. |
| AFF-05 | Concise required disclosure | Clear, concise relationship disclosure accompanies monetized recommendations where required and appears in the footer with a full-policy link. Paid links carry appropriate sponsored handling. Do not repeat affiliate explanations throughout ordinary editorial content or frame the reader experience around commissions. |
| AFF-06 | Partner materials | Provide a professional partner page, real operator identity, editorial methodology, content examples, channel description, and a working contact route. Do not invent audience numbers, conversion rates, approvals, or logos implying endorsement. |
| AFF-07 | Account boundaries | Preparing applications and required information is distinct from submitting applications, accepting contractual terms, or entering tax/payment data. Follow current owner authorization and keep private account evidence outside the public repository. |
| TRU-01 | Complete trust pages | About, editorial standards, corrections, disclosure, privacy, terms, contact, and partnerships accurately match the actual site and data flow. Legal text must not promise unimplemented privacy controls. |

## 13. Analytics, revenue evidence, and privacy

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| MET-01 | Event contract | Document events for meaningful searches/filters, profile views, comparisons, saves, builder/calculator completion, consented signups, and outbound visits. Use stable IDs and coarse classifications, not personal input text. |
| MET-02 | Honest measurement | Browser-local counters are explicitly local demonstrations/preferences, not sitewide analytics. Verify provider event receipt separately from JavaScript dispatch. Do not conflate users, sessions, clicks, and purchasers. |
| MET-03 | Cash-stage separation | Keep subscribers, clicks, vendor events, pending/approved commissions, available balance, reversals, payouts, and bank receipts distinct. Actual account/revenue reporting belongs in an access-controlled operational system. |
| MET-04 | Consent and minimization | Map analytics, storage, forms, embeds, and affiliate tracking to the privacy explanation and applicable choices. Respect chosen settings. Do not quietly load denied optional tracking. |
| MET-05 | No invented business results | No fabricated dashboards, sample revenue displayed as live, unsupported income projections, or public use of private account figures. Use labelled synthetic data only for tests. |

## 14. SEO, performance, security, and maintainability

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| ENG-01 | Crawlable publication | Core directory/profile/guide content and meaningful links are available in generated/static HTML. JavaScript improves discovery rather than leaving important pages at a permanent loading message. |
| ENG-02 | Metadata and indexing | Each indexable page has a relevant unique title, description, canonical URL, social metadata, and truthful structured data. Articles use appropriate Article metadata with actual headline, author, publisher, URL, and publication/modification dates; meaningful visible breadcrumbs match BreadcrumbList; the real publisher is represented as Organization. Do not attach fabricated ratings, testing, authors, or dates. |
| ENG-03 | Useful search quality | Avoid thin affiliate pages, hidden keyword content, fake review schema, and automatically generated near-duplicates. No special markup or AI-answer placement guarantee is promised. |
| ENG-04 | Performance | Measure representative mobile and desktop pages. Optimize images, fonts, script loading, layout stability, and unnecessary requests. Document actual results and environment instead of promising scores not measured. |
| ENG-05 | Safe rendering | Escape/sanitize external and user-derived data, validate URLs and imported state, and avoid unsafe HTML interpolation. Test malicious input in search, builder text, and workspace import. |
| ENG-06 | Deployment reliability | Use a recoverable release with a known commit, useful preview, checked redirects, and recorded smoke tests. Never claim local tests prove deployed forms or external integrations. |
| ENG-07 | Maintainable content | Central data/schema and reusable templates/components prevent drift across profiles and comparisons. Document build/update commands that actually exist. Validate data, links, and meaningful interactions. |
| ENG-08 | Legacy integrations | Verify authorization, row-level access rules, rate limits, moderation, and input handling before exposing legacy community writes. Do not treat a public client key or old SQL file as proof of secure production configuration. |
| ENG-09 | Truthful freshness and crawl controls | Generate sitemap lastmod from actual material page changes, not a single build date. Keep source-checked, reviewed, published, and modified timestamps distinct. Maintain robots and deliberate index/noindex behavior, canonical consistency, internal links, and redirects. Robots rules are not access control. |
| ENG-10 | Search and AI discoverability | Serve substantive article text, sources, bylines, dates, and internal links in static HTML. Use clear answers, useful context, and semantic headings. Optional machine-readable helpers cannot replace substantive crawlable content. Never promise Google rankings, AI-overview inclusion, or citations by AI systems. |
| ENG-11 | Cheap reproducible production | Build the researched content deterministically from reviewed source records using the simplest maintainable pipeline. Normal page builds do not require paid AI calls. Cache/reuse evidence safely and publish only intended assets; research snapshots, private QA/account records, and secrets must not be copied into the public output accidentally. |

## 15. Engineering workstreams and completion evidence

Engineering order may be: inventory and research architecture; editorial topic/brief system and article design; evidence-backed tutorials/comparisons and supporting product records; directory and interactive utilities; forms and affiliate wiring; accessibility/security/SEO checks; deployment verification. These are dependent workstreams within the full requested build, not a smaller replacement product. Editorial research and quality determine what gets commissioned and published; feature quantity does not substitute for useful reporting and instruction.

Maintain a completion matrix with requirement ID, implementation paths, test/inspection evidence, environment, status, and exact remaining dependency. Test representative end-to-end journeys across all major page families, not just isolated buttons:

1. Find a tool, filter results, inspect its evidence, compare alternatives, save a choice, and revisit the workspace.
2. Start from each business hub, follow an applicable workflow, understand its prerequisites, and reach a relevant vendor or free alternative.
3. Complete and edit a stack plan, inspect assumptions, export it, and verify persistence and removal.
4. Exercise calculator boundary cases and confirm units, formula, and interpretation.
5. Submit a permitted test signup, verify provider behavior, and verify unsubscribe/confirmation where promised.
6. Follow approved and ordinary vendor links and confirm destination, disclosure, attribution handling, and truthful event labels.
7. Repeat critical interactions on a narrow phone and by keyboard; verify no data leak through URLs or analytics.
8. Trace a published tutorial from an actual search/market observation through its brief, source records, major claim checks, usable example, expected result, accountable byline, metadata, and static HTML output.

The final delivery report must distinguish what was built, what was verified, what was deployed, and any external configuration still required. No revenue, approval, ranking, security, or accessibility result may be invented to make the report sound complete.
