# Comparison routing: current implementation and Next.js equivalent

Reviewed 2026-11-02 against source commit `05ade0d` and the official documentation linked below. The routing hardening described in section 2 is implemented in the existing Python/JavaScript stack. The Next.js examples are an architectural reference, not a deployed migration or a complete replacement application.

## 1. What the publication already serves

The Python generator already produces complete HTML for nine researched comparison articles. React or Next.js is not required to make these pages programmatic or readable without JavaScript. `data/editorial.json` supplies article content; `data/catalog.json` supplies 47 tools. `scripts/build_site.py`, `publication_components.py`, and `decision_components.py` render the pages and their working decision tools.

The pre-change report at source commit `05ade0d` lists 129 pages and 125 sitemap entries; there are 130 HTML files when the 404 document is included. This release adds one research page, producing 130 pages, 126 sitemap entries and 131 HTML files including the 404 document. The report's `indexed` count means inclusion in the site's index/sitemap, not a claim that any search engine has indexed those URLs. One inspected comparison (`chatgpt-vs-claude`) contains its full article, five tables, 23 table rows, canonical, and structured data in its initial HTML.

| Route | Current behavior | Next.js equivalent |
| --- | --- | --- |
| `/comparisons/` | Indexable editorial hub | `app/comparisons/page.tsx` |
| `/comparisons/{slug}/` | Nine curated, indexable articles | `app/comparisons/[slug]/page.tsx` |
| `/compare/` and `?tools=a,b` | Browser workspace; up to three selected tools; `noindex,follow`; canonical `/compare/` | Static server page plus a client workspace component |
| `/tool/{slug}/` | 47 indexable tool profiles | `app/tool/[slug]/page.tsx` |
| `/tool-library/` and category routes | Tool discovery and filtering | Static pages with client filtering |

The workspace already removes unknown IDs and duplicate selections. Its selected column order is intentional and separate from pair identity. The 47 tools allow 1,081 distinct two-tool combinations, but only the following nine have reviewed editorial articles. The registry must never manufacture the other combinations.

| Canonical article slug | Editorial tool order | Lookup identity |
| --- | --- | --- |
| `mailerlite-vs-kit` | `mailerlite`, `kit` | `kit`, `mailerlite` |
| `mailerlite-vs-omnisend` | `mailerlite`, `omnisend` | `mailerlite`, `omnisend` |
| `zapier-vs-make` | `zapier`, `make` | `make`, `zapier` |
| `notion-vs-airtable` | `notion`, `airtable` | `airtable`, `notion` |
| `hubspot-vs-pipedrive` | `hubspot`, `pipedrive` | `hubspot`, `pipedrive` |
| `canva-vs-adobe-express` | `canva`, `adobe-express` | `adobe-express`, `canva` |
| `shopify-vs-etsy` | `shopify`, `etsy` | `etsy`, `shopify` |
| `chatgpt-vs-claude` | `chatgpt`, `claude` | `chatgpt`, `claude` |
| `buffer-vs-metricool` | `buffer`, `metricool` | `buffer`, `metricool` |

Each canonical is `https://sellerinsiderhub.com/comparisons/{slug}/`. Sorting is for lookup only: `kit,mailerlite` must resolve to the established `mailerlite-vs-kit` URL. It must not swap `chooseFirst`/`chooseSecond`, pricing columns, or other order-dependent editorial content.

## 2. Two bounded improvements in the current stack

### A shared, validated registry

`scripts/comparison_routes.py` builds the registry from the existing curated article list. It rejects unsafe or duplicate slugs, pairs without exactly two distinct known tools, duplicate unordered pairs, and reverse aliases that collide with canonical or other alias routes. It does not parse incoming slugs into arbitrary product names.

Integration in `scripts/build_site.py`:

```python
from comparison_routes import build_comparison_registry

# Run before writing output or rendering article columns.
COMPARISON_REGISTRY = build_comparison_registry(COMPARISONS, TOOLS)

# Add this field to the existing browser catalogue projection.
public_catalog['comparisons'] = COMPARISON_REGISTRY.public_entries()

# Add to the existing Netlify redirect tuples before writing _redirects.
redirects.extend((source, target, '301!')
                 for source, target in COMPARISON_REGISTRY.redirects())
```

The small browser projection contains only `title`, `url`, and `toolIds`. Each already-reviewed pair gets reverse aliases in four forms: bare path, trailing slash, `.html`, and `/index.html`. All point directly to its established canonical article. Existing canonical `.html` and `/index.html` redirects remain. No alias receives its own HTML document, sitemap entry, or Article identity.

### Connect the workspace to an existing recommendation

`site-assets/hub.js` shows a contextual link above the comparison table when exactly two selected IDs match a published guide in either order. It preserves the chosen table order and shared query URL. One tool, three tools, and an unreviewed pair continue to work without an invented guide or forced navigation. `/compare/` stays `noindex,follow` and out of the sitemap.

Focused verification:

```sh
python3 scripts/test_comparison_routes.py
node scripts/test_analytics.cjs
# After the normal site build:
python3 scripts/test_comparison_routes.py --built
```

The browser tests execute the production script inside the existing isolated DOM/network harness. They cover A/B and B/A, unchanged column/query order, no matching article, more than two selections, and removal/restoration of the link after changing a selection. The built check verifies the actual catalogue, redirects, canonical article HTML, absence of alias HTML, sitemap coverage, and noindex workspace.

## 3. Next.js App Router equivalent

Retain the existing public URL vocabulary. Use one dynamic segment, `[slug]`, rather than introducing a new `/compare/[first]/[second]` structure. Route parameters are asynchronous in the current App Router examples. `generateStaticParams` enumerates the curated slugs; `dynamicParams = false` rejects parameters outside that set. This example deliberately leaves Cache Components disabled because its model does not support `dynamicParams`. [Static parameters](https://nextjs.org/docs/app/api-reference/functions/generate-static-params), [dynamicParams](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/dynamicParams).

Suggested module responsibilities:

| Module | Responsibility |
| --- | --- |
| `lib/comparisons.ts` | Validate editorial data; canonical slug and unordered-pair lookup; public projection; reverse aliases |
| `lib/site-schema.ts` | Preserve publisher, author, site, page, Article, and breadcrumb relationships |
| `components/ComparisonArticle.tsx` | Server-render the complete existing article content and table order |
| `components/ComparisonWorkspace.tsx` | Client selection, persistence, table, sharing, and matching-guide link |
| `app/comparisons/page.tsx` | Render the existing editorial hub from the registry |
| `app/comparisons/[slug]/page.tsx` | Static params, canonical metadata, route guard, Article output |
| `app/compare/page.tsx` | Static workspace shell and noindex metadata |
| `app/tool/[slug]/page.tsx` | Preserve all tool profiles and their related-guide links |
| `app/sitemap.ts` | Canonical indexable route registry, with genuine modification dates |
| `app/robots.ts` | Preserve the site's existing crawler policy |
| `public/_redirects`, `public/_headers` | Static hosting aliases, headers, and existing function routes |

### Canonical resolver

The following TypeScript is a reference port of the Python registry. Keep the full editorial record attached for rendering; do not turn the browser projection into the article's content source.

```ts
// lib/comparisons.ts
import editorial from '@/data/editorial.json'
import catalog from '@/data/catalog.json'

export const ORIGIN = 'https://sellerinsiderhub.com'
type Comparison = {
  id: string; title: string; summary: string; toolIds: string[]
  publishedAt: string; modifiedAt?: string; lastReviewed: string
  sourceUrls: string[]
} & Record<string, unknown>

const safeSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const knownTools = new Set(catalog.tools.map(tool => tool.id))
const bySlug = new Map<string, Comparison>()
const byPair = new Map<string, Comparison>()
export const comparisons = editorial.comparisons as Comparison[]

function pairKey(ids: readonly string[]): string | undefined {
  if (ids.length !== 2 || ids[0] === ids[1] ||
      ids.some(id => !safeSlug.test(id) || !knownTools.has(id))) return
  return [...ids].sort().join('|')
}

for (const article of comparisons) {
  const key = Array.isArray(article.toolIds) ? pairKey(article.toolIds) : undefined
  if (!safeSlug.test(article.id) || !article.title?.trim() || !key ||
      bySlug.has(article.id) || byPair.has(key)) {
    throw new Error(`Invalid or duplicate comparison: ${article.id}`)
  }
  bySlug.set(article.id, article)
  byPair.set(key, article)
}

export const comparisonPath = (article: Comparison) =>
  `/comparisons/${article.id}/`
export const comparisonBySlug = (slug: string) => bySlug.get(slug)
export function comparisonForTools(ids: readonly string[]) {
  const key = pairKey(ids)
  return key ? byPair.get(key) : undefined
}
export const publicComparisons = comparisons.map(article => ({
  title: article.title, url: comparisonPath(article), toolIds: article.toolIds,
}))

const aliases = new Set<string>()
export const comparisonRedirects = comparisons.flatMap(article => {
  const reverse = `${article.toolIds[1]}-vs-${article.toolIds[0]}`
  if (reverse === article.id) return []
  if (bySlug.has(reverse) || aliases.has(reverse)) {
    throw new Error(`Comparison alias collision: ${reverse}`)
  }
  aliases.add(reverse)
  return ['', '/', '.html', '/index.html'].map(ending => ({
    source: `/comparisons/${reverse}${ending}`,
    destination: comparisonPath(article),
  }))
})
```

A future production port should keep the existing catalogue validation as a build gate too. The registry is a publication allowlist: adding a tool does not add any comparisons. An article is added by supplying reviewed content and explicitly including it in `editorial.comparisons`.

### Static article route and metadata

The layout can define the title template `%s | Seller Insider Hub`; page titles below then remain unadorned. The renderer and schema helper below are ports of the existing publication components, not supplied Next.js libraries. They must retain all substantive sections, source links, decision tools, accessibility, and author details.

```tsx
// app/comparisons/[slug]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  ORIGIN, comparisons, comparisonBySlug, comparisonPath,
} from '@/lib/comparisons'
import { comparisonGraph } from '@/lib/site-schema'
import ComparisonArticle from '@/components/ComparisonArticle'

export const dynamicParams = false
export function generateStaticParams() {
  return comparisons.map(article => ({ slug: article.id }))
}

type Props = { params: Promise<{ slug: string }> }
async function requiredArticle({ params }: Props) {
  const { slug } = await params
  const article = comparisonBySlug(slug)
  if (!article) notFound()
  return article
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const article = await requiredArticle(props)
  const canonical = ORIGIN + comparisonPath(article)
  const image = ORIGIN + '/assets/brand/seller-insider-hub-social.png'
  return {
    title: article.title,
    description: article.summary,
    alternates: { canonical },
    openGraph: {
      type: 'article', url: canonical, title: article.title,
      description: article.summary,
      publishedTime: article.publishedAt,
      modifiedTime: article.modifiedAt ?? article.lastReviewed,
      images: [image],
    },
    twitter: { card: 'summary_large_image', images: [image] },
  }
}

export default async function Page(props: Props) {
  const article = await requiredArticle(props)
  const graph = comparisonGraph(article)
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{
      __html: JSON.stringify(graph).replace(/</g, '\\u003c'),
    }} />
    <ComparisonArticle article={article} />
  </>
}
```

`generateMetadata` supports canonical and social metadata, but JSON-LD remains an explicit script. Use the actual publication/review dates, including `lastReviewed` where `modifiedAt` is absent. Validate the route before starting a streamed response: `notFound()` after streaming begins can leave HTTP 200 with a noindex instruction; before streaming it can produce the intended 404. [Metadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata), [notFound](https://nextjs.org/docs/app/api-reference/functions/not-found).

Preserve these existing entity identities in `comparisonGraph`:

| Entity/relationship | Existing identity |
| --- | --- |
| Organization/publisher | `https://sellerinsiderhub.com/#publisher` |
| Person/author | `https://sellerinsiderhub.com/authors/jennie-malone/#person` |
| WebSite | `https://sellerinsiderhub.com/#website` |
| Article's WebPage | `{canonical}#webpage` |
| Article `mainEntityOfPage` | Reference to `{canonical}#webpage` |
| Breadcrumbs | Home → Comparisons → existing canonical article |

The current Article and BreadcrumbList do not each have a separate `@id`; that is not a missing-field defect. Preserve Article headline, description, dates, author, publisher, language, and source citations. No fabricated Review or AggregateRating is needed. Sorting the lookup key must not alter entity identity or article meaning.

### The interactive workspace stays separate

```tsx
// app/compare/page.tsx
import { Suspense } from 'react'
import type { Metadata } from 'next'
import ComparisonWorkspace from '@/components/ComparisonWorkspace'

export const metadata: Metadata = {
  title: 'Compare tools',
  alternates: { canonical: 'https://sellerinsiderhub.com/compare/' },
  robots: { index: false, follow: true },
}
export default function Page() {
  return <>
    <h1>Compare tools for your business</h1>
    <Suspense fallback={<p>Loading your comparison tools…</p>}>
      <ComparisonWorkspace />
    </Suspense>
  </>
}
```

The client component reads `tools` with `useSearchParams`, validates known IDs, removes duplicates, preserves order, limits the selection to three, and uses the same public registry for the editorial link. A production static build requires a Suspense boundary around a client component using that hook. Access browser storage only in browser effects. Keep the editorial article body outside client-only rendering. [useSearchParams](https://nextjs.org/docs/app/api-reference/functions/use-search-params).

### Build, hosting, and ISR choices

For the present file-backed editorial workflow, the closest equivalent is:

```ts
// next.config.ts — reference only
import type { NextConfig } from 'next'
const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  cacheComponents: false,
  images: { unoptimized: true }, // Or retain ordinary existing picture/img tags.
}
export default config
```

Publish `out/` in this variant. All approved article parameters are known at build time. Keep aliases and MIME/cache rules in the exported Netlify `_redirects`/`_headers`: Next.js redirects, rewrites, headers, dynamic fallback, and ISR are unavailable in a static export. A source-content change triggers a new build; an ISR timer cannot fetch a newer committed JSON file into an existing bundle. [Static exports](https://nextjs.org/docs/app/guides/static-exports).

If a future CMS actually requires article updates between deployments, choose Netlify's Next.js runtime/OpenNext integration instead of static export. It supports the App Router, server rendering, and ISR. Use Node execution and controlled revalidation of approved content. Keep `dynamicParams = false` with the non-Cache-Components model unless the publication deliberately adopts a runtime allowlist. `generateStaticParams` is not rerun during ISR, so newly approved slugs still need a build under that policy. Do not enable on-demand arbitrary pair pages merely to avoid deployments. [ISR](https://nextjs.org/docs/app/guides/incremental-static-regeneration), [Netlify Next.js](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/).

Cache Components is a different caching model. The current documentation explicitly makes `dynamicParams` unavailable when it is enabled and describes `ensureStatic` separately. Do not combine examples from both models without redesigning the publication boundary and testing real HTTP behavior. [Route segment configuration](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config).

## 4. Migration gates and concrete acceptance criteria

There is no present SEO or routing need to migrate this publication. If React-based product work later justifies it, port in a preview branch and compare the entire existing site before changing hosting:

1. Preserve the nine exact article paths, 47 tool-profile paths, all other public routes, existing asset/feed URLs, and slash behavior. Enumerate the complete current 126-entry sitemap as the baseline; it is not sufficient to migrate only the comparison directory.
2. Confirm all existing comparison HTML contains the full verdict, dimensions, use cases, pricing caveats, recommendations, evidence, author, and decision controls before JavaScript executes. Preserve the order-dependent first/second fields.
3. Assert A/B and B/A resolve to the same established article. Duplicate unordered pairs and alias collisions fail the build. Unknown or same-tool public pair routes return a real HTTP 404, with no substitute auto-written page.
4. Assert each reverse alias has one permanent redirect to the established canonical URL; inspect actual response status and Location. No alias or query workspace URL appears in the sitemap. Preserve canonical `.html` and `/index.html` aliases too.
5. Keep one canonical per page, the existing schema entity references, genuine article dates, author attribution, source citations, and breadcrumbs. Test malformed/unknown slugs before streaming and verify actual HTTP status, not only the rendered 404 message.
6. Verify the workspace link for both orders of a known pair; no guide link for unreviewed pairs or three selections; sharing and chosen column order remain intact. Preserve local workspace imports/exports and blocked-storage behavior.
7. Preserve consent-aware analytics, existing native forms and their success/failure behavior, the investor authentication/functions boundary, RSS/Atom/Pinterest feed separation, sitemap rules, IndexNow key, and crawler policy. Netlify documents additional integration requirements for Forms with Next.js; do not assume a framework switch preserves form detection automatically.
8. Run the current full build/check gate, adapt tests to the preview output only as needed, and compare route status, metadata, initial HTML, and representative interactions before switching production. Reuse existing genuine assets and content; make no traffic or ranking promise from a framework change.

The useful shipped change is a reliable path from a selected tool pair to its existing researched recommendation, with one canonical article per reviewed pair. Its success should be measured through real usage and acquisition data; this source audit contains no evidence of traffic gains.
