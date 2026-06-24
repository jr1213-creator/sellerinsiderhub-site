Seller Insider Hub production-ready expanded build

Added in this revision:
- Full handwritten page map implemented: business hubs, problem hubs, decision funnels, implementation paths, ranking pages, ROI framing, and central systems loop.
- Tool names are the tool-ready links. They currently point to official tool websites.
- Update the central tool-link data file: set affiliate_url for each tool after approval. The JavaScript prefers affiliate_url over website_url.
- Google Analytics measurement ID included: G-164NDV6713.

Important files:
- the central tool-link data file = central link properties file
- /assets/js/app.js = reads affiliate-links.json and applies tool-name links
- /business-types/ = business type hubs
- /problems/ = long-tail problem hubs
- /decision-funnels/ = high-intent decision pages
- /implementation/ = setup paths
- /tools/*-tools.html = tool ranking pages
