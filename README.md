# Seller Insider Hub

A research-led publication that helps small businesses put AI and software to useful work. Tutorials lead the experience; independent comparisons, tool profiles, business guides, worksheets, and decision tools support the reader.

## Build and verify

The production build uses the Python standard library. No framework installation, paid AI call, or external API is needed to render the site.

```bash
python3 scripts/build_site.py
python3 scripts/validate_site.py
node scripts/test_calculators.cjs
```

Netlify runs the build command from `netlify.toml` and publishes `dist/`. The original source pages remain in the repository; selected older routes redirect to the substantially improved tutorials. The build deliberately excludes source code, internal research records, legacy account/community prototypes, and unsubstantiated old scoring data.

## Editorial source of truth

| File | Purpose |
| --- | --- |
| `data/editorial.json` | Complete tutorials, examples, configuration tables, copyable templates, troubleshooting, comparisons, and source records |
| `data/catalog.json` | Tool capabilities, suitability, limitations, official sources, and verified link state |
| `data/research.json` | Market evidence, search observations, reader questions, topic priorities, and evidence limitations; not copied into the public build |
| `scripts/editorial_components.py` | Editorial layouts, worked examples, and publication front page |
| `site-assets/hub.css` | Responsive visual system |
| `site-assets/hub.js` | Search, filters, comparisons, local reading lists, stack builder, calculators, and consent-controlled measurement |

New tutorials must answer a concrete reader question, cite current primary sources for changing product facts, contain an original usable example, and explain the result and common failures. A documentation review must never be presented as a live product test. Source and revision dates reflect actual editorial work, not a rebuild timestamp. Search observations are not search-volume statistics.

## Operations and complete requirements

- [Complete requirements and acceptance criteria](docs/COMPLETE_REQUIREMENTS.md)
- [Claude and Gemini research prompts](docs/AI_RESEARCH_PROMPTS.md)
- [Editorial and business operations](docs/OPERATIONS.md)
- [Verification record and launch dependencies](docs/RELEASE_NOTES.md)

## Connected services

Newsletter and contact forms use static Netlify Forms markup with consent and honeypot controls. Form detection and submission handling must be enabled on the actual hosting project; automatic newsletter delivery needs an authorized email-provider connection. A successful static build does not verify either account setting.

Analytics loads only after consent. Reading lists and saved tool stacks are browser-local and can be exported/imported. There is no claimed cloud account, private analytics dashboard, or live AI assistant behind these browser tools.

Affiliate destinations are centralized in the catalog. Only records with `affiliateStatus: "approved"` and an actual approved `affiliateUrl` use that URL. Other links point to the software provider. Publication quality and reader fit determine the recommendation; commission terms are not used in the matching logic.
