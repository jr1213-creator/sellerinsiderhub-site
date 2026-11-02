# Subject identities and research datasets

The graph describes what a reader can actually find on the page. It does not
promise rankings, AI citations, or eligibility for a Google software rich result.
The helper adds no prices, offers, reviews, star ratings, licenses, or publication
dates. Existing publisher and author identities stay unchanged.

## Software subjects

`scripts/schema_components.py` exposes:

```python
software_entity_id(tool_id, by_id, *, origin=ORIGIN)
software_subject_graph(tool_ids, by_id, categories=None, *, route, origin=ORIGIN)
```

`by_id` is the existing catalog lookup, and `categories` is the existing
`{category_id: category_record}` mapping. Unknown IDs fail instead of quietly
creating a fictitious tool. Repeated IDs are deduplicated in their original order.

Every occurrence of a tool shares this identity:

```text
https://sellerinsiderhub.com/tool/<catalog-id>/#software
```

Comparison, tutorial, and feature-article nodes contain only `SoftwareApplication`,
the stable `@id`, the catalog `name`, and its official `website` as `url`. These are
subject descriptions, not a claim that the publication owns the software or that
every listed tool was personally tested. Affiliate destination URLs are not used
as the software's identity or official website.

Only a route exactly matching `/tool/<catalog-id>/` adds that tool's visible
`description`, `featureList`, and category label as `applicationSubCategory`.
It does not repeat a profile's full description and features on an article where
those details are absent. All rich profile fields come directly from the same
catalog values used to render the profile.

### Generator integration

The caller owns its Article/WebPage objects and passes each content record's
actual `toolIds`; tool profiles pass `[tool['id']]`. Do not extract entity names
from prose or infer tool IDs from keywords.

```python
subjects = software_subject_graph(
    tool_ids, BY_ID, CATEGORIES, route=route, origin=ORIGIN,
)
if subjects['about']:
    webpage['about'] = subjects['about']
    article_node['about'] = subjects['about']
graph.extend(subjects['nodes'])
article_node['@id'] = ORIGIN + route + '#article'
article_node['mainEntityOfPage'] = {'@id': webpage['@id']}
webpage['mainEntity'] = {'@id': article_node['@id']}
```

The Article remains the main entity of an editorial tool profile; the software
is its subject. Keep the existing `/#publisher` and
`/authors/jennie-malone/#person` identities and attribution.

## Research datasets

```python
dataset_node(metadata, output_dir, *, origin=ORIGIN)
```

The research exporter supplies this metadata after writing its real downloads:

| Input key | Meaning |
| --- | --- |
| `route` | Canonical local dataset page route with a trailing slash. |
| `name`, `description` | Text rendered on the dataset page. |
| `version` | Content-derived dataset version supplied by the exporter. |
| `source_dates` | Original ISO dates on which source facts were checked. |
| `distributions` | Objects with `path`, `encodingFormat`, and `name` for real CSV/JSON files. |
| `methodology_url` | The dataset page's canonical `#methodology` URL. |
| `measurementTechnique` | The actual compilation and normalization method. |
| `isBasedOn` | The official source URLs actually used. |

The Dataset has a stable `<canonical>#dataset` ID, publisher reference, version,
methodology, original sources, and `DataDownload` entries. The helper checks that
each download resolves inside `output_dir`, exists, matches its stated CSV/JSON
format, and contains data. It never fetches remote URLs or creates downloads.

Source-check dates are explicitly labeled in `measurementTechnique`. They are
not relabeled as `datePublished`, `dateModified`, or `temporalCoverage`: a source
verification date is neither a publication date nor a measured time series.
Build time is not evidence of fresh research. No license is inferred.

```python
dataset = dataset_node(asset['dataset_metadata'], OUT, origin=ORIGIN)
graph.append(dataset)
webpage['mainEntity'] = {'@id': dataset['@id']}
```

The dataset page needs no additional Article node merely to describe the same
resource. Its visible content must include the metadata description, a real
`id="methodology"` section, and links to the same downloadable files.

## Focused verification

Run helper checks without building or publishing:

```sh
python3 scripts/test_schema_graph.py
```

After the normal site build, also check the rendered profiles, comparisons,
tutorials, feature guides, and dataset graph:

```sh
python3 scripts/test_schema_graph.py --built
```

The latter checks visible profile facts, stable subject identities, matching
Article/WebPage `about` links, preserved author/publisher references, resolution
of local graph references, and real dataset files. It does not run a build.

## Platform limits and references

Reviewed against official documentation on November 2, 2026:

- [Google's generative AI guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide): no special AI schema is required; Google ignores `llms.txt` for Search ranking and visibility.
- [Google's software application feature](https://developers.google.com/search/docs/appearance/structured-data/software-app): rich-result requirements include actual offer and review/rating data. The subject nodes here deliberately make no eligibility claim.
- [Google structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies): markup must accurately describe the page; syntactic validity alone does not guarantee a search appearance.
- [Schema.org Guide](https://schema.org/Guide): this is a valid vocabulary type, but vocabulary validity and Google feature support are different questions.
- [Google documentation updates](https://developers.google.com/search/updates): FAQ rich results stopped appearing on May 7, 2026. [HowTo rich results](https://developers.google.com/search/blog/2023/08/howto-faq-changes) were deprecated in September 2023. Visible useful answers still belong in articles.
- [Google Dataset documentation](https://developers.google.com/search/docs/appearance/structured-data/dataset): Dataset metadata can support Dataset Search discovery, without guaranteeing chatbot citations or traffic.
