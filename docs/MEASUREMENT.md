# Traffic and measurement

## Production collection

**Primary audience metric: Umami Visitors for the selected calendar month**, in
America/New_York time. For daily monitoring select Today or Yesterday in the
same dashboard. Use the period total, not the sum of daily visitor counts.
Report the source and dates alongside an audience estimate. The first month
contains data only from installation on November 11, 2026 onward.

The private dashboard is
`https://cloud.umami.is/analytics/us/websites/55870533-736a-4919-8db7-0e336c261698?date=0month`.
The managed Hobby plan is free: one website, 100,000 events per month, six months
of retention. It has no paid subscription, recordings, or public sharing enabled.
Export period summaries before retention expires if longer history is needed.

The shared `site-assets/hub.js` integration loads Umami's official tracker once
on the exact production hosts. It records one pageview per loaded document,
not directory filtering, search typing, or `history.replaceState` changes.
Only sanitized page paths, campaign slugs, referring origins (internal paths),
page titles, language, and screen size are passed to the provider. No form
contents, search queries, click IDs, distinct user IDs, or replay data are sent.
Known bots are filtered by Umami; local automation (`navigator.webdriver`),
preview hosts, and prerenders are excluded in the integration. This is a visitor
estimate, not a count of verified individuals: IP/browser changes, shared
connections, blockers, and unidentified bots can affect it. Umami rotates its
IP/browser-derived identifier monthly; a range spanning that boundary can count
a returning browser again. Never add Umami, GA4, and Netlify users together.

Umami needs no analytics cookie and does not depend on the Google opt-in. A
previous or new Disable analytics choice stops both browser counters. Supported
GPC/DNT signals also stop them. The footer opens preferences on request; there
is no automatic popup. The privacy policy explains the actual collection.

For owner and QA browsers, set `localStorage.setItem('umami.disabled', '1')` on
the production origin before browsing. This provider-standard exclusion also
disables GA4 in the shared integration. Remove that key only to resume counting.
It is browser-specific, so another device needs its own exclusion. Automated
tests must block collection or use a separate, clearly identified test fixture.

Netlify Web Analytics and Observability remain the operational sources for raw
requests, crawlers, and AI-agent activity. Their IP-based totals include bots
and are **not** the primary audience figure. An AI chatbot fetching an article
is not a person visiting the site. A reader following a chatbot link is counted
by the browser tracker, with the referring site or safe UTM labels when present.

## Optional Google Analytics

The existing GA4 measurement ID is `G-164NDV6713`. The website loads its Google
tag only after a visitor explicitly allows analytics. Only the exact production
hosts `sellerinsiderhub.com` and `www.sellerinsiderhub.com` may collect events;
local previews and Netlify aliases do not send traffic to this property.

Visitors who decline, ignore the choice, or block the Google tag are absent from
the GA4 report. Search Console clicks and impressions are a separate
measurement and do not depend on a visitor accepting this site's analytics.
Do not describe Analytics users as every person who visited the website.

The existing `outbound_tool_click` event records `tool_id`, `link_type`
(`affiliate` or `vendor`), and an enumerated `placement` (`tool_profile`,
`tutorial_tools`, `comparison_tools`, `legacy_content`, or `other`). Approved
affiliate actions use the catalog's exact destination and a sponsored link
relationship. These events measure outbound visits; only the vendor's reports
can establish attributed signups, approved commissions, or payouts. No
destination URL, account identifier, or arbitrary placement text is added to
this event.

Consent is effective immediately on the current page even when browser storage
cannot save it. Revocation disables collection and clears GA cookies; storage
events propagate a changed or cleared choice to other open tabs. A failed save
displays an explanation instead of claiming the preference was persisted.

## Form and feed events

`form_submission_accepted` records one validated, successful HTTP response per
form on the current page. Its only business parameter is the allowlisted
`form_name`: `sih-newsletter` or `sih-contact`. It does not include email addresses,
names, messages, topics, consent fields, or other submitted values. Invalid inputs,
HTTP failures, unconfirmed requests, and recognizable error pages produce no event.
Repeated submits while a request or confirmation navigation is pending do not
produce another POST or event.

For the newsletter, this means an **accepted signup request**, not a confirmed
subscriber, successful email-provider sync, or delivered message. Check Netlify
submission records and the authorized email provider separately. Contact forms
also receive corrections and privacy requests, so do not classify every contact
submission as a sales lead. The shared, directly accessible `/thank-you/` URL is
not evidence of a completed signup. Any GA4 key-event configuration and receipt
of this custom event still require account-level verification.

After a successful submission, confirmation navigation waits for the Google tag's
event-processing callback, with an independent 800-millisecond timeout fallback.
It navigates immediately when tracking is not allowed or the event cannot be
queued. The callback and fallback can navigate only once. A callback is not proof
that Google received or attributed the event.

`feed_open` records a click on a same-origin link to `/feed.xml` or `/atom.xml`,
with only `feed_format: rss` or `feed_format: atom`. It measures feed-link interest,
not a subscription, a successful feed fetch, reader-app article visits, crawler
activity, or AI citations. Feed URLs and canonical item links remain unchanged;
the Atom feed continues to serve as a discovery sitemap. Both new events use the
same live analytics consent and exact production-host restrictions as page views.

## Campaign links

Use non-personal campaign labels. The script reads the landing URL before
search, filters, or comparisons can change the address bar. It keeps permitted
attribution in memory and supplies it to Google only after analytics consent.
It does not persist entry attribution before consent.

Supported labels: `utm_source`, `utm_medium`, `utm_campaign`, `utm_id`,
`utm_term`, and `utm_content`. Values must begin with an ASCII letter, be at
most 100 characters, and otherwise contain only letters, numbers, `.`, `_`,
`~`, or `-`. Use `campaign-123` instead of a numeric-only campaign ID. This
conservative format rejects common sensitive-looking strings; it is not a
general personal-information detector. Never put names, emails, customer IDs,
or business-sensitive information in campaign labels.

Example for an actual authorized LinkedIn publication:

```text
https://sellerinsiderhub.com/playbooks/ai-social-media-agents/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=november-ai-guides&utm_content=social-workflow
```

The configured page URL excludes arbitrary parameters and fragments. Only
syntactically valid `gclid`, `dclid`, `gbraid`, and `wbraid` values are retained
for supported Google attribution. External referrers retain only their origin;
internal referrers retain a path without queries or fragments. Account-level
attribution and event receipt must still be checked in Google Analytics.

## Google stream configuration

This publication uses full-page navigation. Filtering, comparing, and searching
can update the browser's history without navigating to a new page. Keep page-load
measurement enabled and turn off Enhanced Measurement's **Page changes based on
browser history events** to avoid counting these interface updates as new page
loads. Turn off automatic **Site search** so arbitrary search input is not sent
as a `search_term`. Other appropriate enhanced events can remain enabled.

The application configures its tag once per page. Repository tests do not inspect
the Google account and cannot prove that property-controlled automatic events,
filters, or integrations are correctly configured.

## Verification and reporting

Run the required `npm run build && npm run check`. Analytics regressions execute
the production script with a simulated browser boundary; they never execute a
Google tag or send test visits. They cover entry attribution after the actual
directory URL rewrite, consent and revocation, unavailable storage, excluded
preview hosts, sanitization, and duplicate initialization.
Focused form tests also cover response validation, accepted-request measurement,
consent changes during a request, duplicate prevention, and confirmation
navigation when the Google tag is blocked or fails. Feed tests verify the exact
same-origin paths, bounded format labels, consent, and excluded preview hosts.

The redirect validator models Netlify's trailing-slash equivalence. A forced
redirect from `/page` to `/page/` is a loop on Netlify, even when an exact-string
local redirect test would pass. Use the host's ordinary directory-index behavior
and preserve genuine legacy `.html` redirects.

Historical aliases also preserve the former voice-tools category, start-using-AI
guide, AI setup generator, and tools-directory URLs. Each points to the relevant
current resource. An unknown retired URL is not a reason to redirect all 404s
to the homepage or invent an unrelated replacement.

After publication, verify the repaired URL on the live host and compare the
deployed script with the checked source. Confirm provider receipt separately.
Use whole-period user counts; do not sum daily unique users. Keep report dates
and the property timezone explicit. Calculate CTR from clicks/impressions and
never sum daily average positions into a period average. Distinguish owner/test
activity, page views, sessions, users, clicks, and Google impressions.

Actual traffic exports and account screenshots are private operational evidence.
Do not commit them to this public repository.

## Primary references

- [Umami metric definitions and monthly identifier rotation](https://docs.umami.is/docs/metric-definitions)
- [Umami tracker configuration](https://docs.umami.is/docs/tracker-configuration)
- [Umami plans and retention](https://umami.is/pricing)
- [Netlify Web Analytics definitions](https://docs.netlify.com/manage/monitoring/web-analytics/how-web-analytics-works/)
- [Google Analytics configuration fields](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)
- [Google tag event callback and timeout parameters](https://developers.google.com/tag-platform/gtagjs/reference/parameters)
- [Google Enhanced Measurement](https://support.google.com/analytics/answer/9216061)
- [Netlify trailing-slash redirect behavior](https://docs.netlify.com/manage/routing/redirects/redirect-options/#trailing-slash)
- [Requesting Google recrawling](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)
