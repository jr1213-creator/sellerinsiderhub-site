# Traffic and measurement

## Production collection

The existing GA4 measurement ID is `G-164NDV6713`. The website loads its Google
tag only after a visitor explicitly allows analytics. Only the exact production
hosts `sellerinsiderhub.com` and `www.sellerinsiderhub.com` may collect events;
local previews and Netlify aliases do not send traffic to this property.

Visitors who decline, ignore the choice, or block the Google tag are absent from
the browser-based report. Search Console clicks and impressions are a separate
measurement and do not depend on a visitor accepting this site's analytics.
Do not describe Analytics users as every person who visited the website.

Consent is effective immediately on the current page even when browser storage
cannot save it. Revocation disables collection and clears GA cookies; storage
events propagate a changed or cleared choice to other open tabs. A failed save
displays an explanation instead of claiming the preference was persisted.

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

- [Google Analytics configuration fields](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)
- [Google Enhanced Measurement](https://support.google.com/analytics/answer/9216061)
- [Netlify trailing-slash redirect behavior](https://docs.netlify.com/manage/routing/redirects/redirect-options/#trailing-slash)
- [Requesting Google recrawling](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)
