# Pinterest distribution feed

## Implemented scope

The production build writes a separate RSS 2.0 feed at:

`https://sellerinsiderhub.com/feeds/pinterest.xml`

It begins with **one reviewed article**, the Etsy Keyword Starter Kit:

`https://sellerinsiderhub.com/playbooks/etsy-keyword-data-chatgpt/`

The existing `/feed.xml` and `/atom.xml` remain general reader feeds. The new
marketing feed is not added to the SEO sitemap, robots sitemap declarations,
or every page's feed autodiscovery links. It is intended to be connected
deliberately to a suitable Pinterest board after account setup.

The initial kit is already available without signup. It contains three CSV
templates, a product brief, five ChatGPT prompts, and a README. The feed does
not promise search rankings, sales, keyword demand, or automatic email delivery.

## Curated publication and tracking

`PINTEREST_ITEMS` in `scripts/feed_components.py` is the explicit allowlist.
The builder does not automatically send all historical articles to Pinterest.
Add one record per real article only after reviewing its title, description,
destination, and cover. New entries will become publishing candidates after
the connected feed is refreshed; review them with that consequence in mind.

Each item has one `media:content` JPEG reference. There is no second enclosure,
inline description image, or unrelated vendor screenshot to create extra Pins.
The canonical article URL remains the permanent GUID. The publication date
comes from the article's original source record, not the deployment time.

Only the item click link receives these campaign parameters:

| Parameter | Initial value |
| --- | --- |
| `utm_source` | `pinterest` |
| `utm_medium` | `social` |
| `utm_campaign` | `etsy_keyword_starter_kit` |
| `utm_content` | `rss` |

Article canonicals, GUIDs, general feeds, and image URLs do not receive these
campaign parameters. The existing consent-controlled `resource_download`
event can record the kit download when analytics is permitted. Feed publication
and account connection do not establish that visitors or conversions occurred.

## Image provenance

The initial image is the already-published cover:

`/assets/editorial/etsy-keyword-data-chatgpt-social.jpg`

It is a **1200 × 800 JPEG AI-generated editorial illustration**, showing blank
product tags beside fabric and a loupe. It is not a real product photograph,
vendor screenshot, or evidence of search results. The published article retains
its image credit. The image registry in `data/editorial-images.json` supplies
its version and dimensions; the build checks the actual JPEG frame dimensions.

The feed's landscape cover is an existing asset. A future portrait creative
may be reviewed separately; no portrait image has been created by this change.

## Account status and connection steps

**Pinterest account setup, website claim, feed connection, and Pin publication
are not completed by this code change.** The cloud browser returned Access
Denied during the account attempt. The owner needs to use their own browser to
create or sign into the intended dedicated business account and complete the
site's account checks.

After the owner obtains Pinterest's public website-claim verification token,
it can be added to the site through the normal source/build/deploy process.
Do not share a password, OTP, or session token in chat or in this repository.

Once the domain is claimed and the feed has been deployed and checked, connect
this specific feed in Pinterest's RSS publishing settings to the chosen public
board. Confirm that the first Pin has the intended image and article destination
before adding further allowlist entries. Do not queue the same article through
Metricool at the same time as this initial RSS launch.

Official setup reference:
<https://help.pinterest.com/en/business/article/auto-publish-pins-from-your-rss-feed>

## Validation

The build rejects unknown/nonpublic routes, missing pages, `noindex` pages,
incorrect canonicals, duplicate article entries, unsafe paths, missing/invalid
JPEGs, and image-dimension mismatches. It emits the feed with an RSS content
type and a five-minute revalidation cache policy.

Run focused checks and then the repository's required full gate:

```bash
python3 scripts/test_pinterest_feed.py
npm run build
npm run check
```

The standard `npm run check` gate includes the feed's built-file integration test.

After production deployment, check the live feed's HTTP status, content type,
single item/image, campaign click URL, and public image before connecting it.
Actual Pinterest acceptance and publication must be verified in the account;
a valid XML file alone does not establish those outcomes.
