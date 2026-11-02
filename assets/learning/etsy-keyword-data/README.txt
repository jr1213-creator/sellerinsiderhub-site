ETSY KEYWORD DATA TEMPLATE KIT

These UTF-8 CSV files contain headers only. Add your own observed keyword data.

1. Collect Etsy data manually
Open Shop Manager > Stats > How shoppers found you > Etsy search. Copy the
reported keywords and available metrics into etsy-stats-template.csv. Use one
metric per row and preserve the metric label exactly as displayed.

Open Shop Manager > Stats > Marketplace Insights. Copy each researched term,
its displayed search total into searches_in_period, and its listing count into
listings_count in etsy-marketplace-template.csv. Set period to the exact
displayed reporting window and record captured_on separately. Etsy's standard
view covers 30 days; some accounts are testing 90-day or 12-month views. Do not
label those longer-period totals as 30-day searches. These templates do not
depend on a native Etsy search-data CSV export button.

2. Preserve meaning and provenance
- Etsy Stats describes traffic to your own shop or listings. Marketplace
  Insights describes Etsy-wide keyword demand and supply. eRank estimates
  remain estimates. Do not add, average or relabel unlike metrics as one total.
- Keep values such as <20, Unknown and blank exactly as reported. Blank does
  not mean zero. Enter 0 only when the source reports zero. Do not fabricate
  metrics that the report does not provide.
- Give every row a unique record_id. Keep IDs unique across files and stable
  when sorting. The same keyword may have several records for distinct metrics.
- Enter date_start and date_end as the exact selected Stats dates, preferably
  YYYY-MM-DD. In Marketplace and combined evidence rows, captured_on is the
  date the source observation was collected. Keep it separate from the period
  the metric describes. Copy the displayed period label and any supplied start
  and end dates into period; do not infer a range the source does not show.
  Use blank or Unknown when capture is unknown; never
  invent it or assume it from today or the file modification date. Do not turn
  a rolling 30-day window into a calendar month.
- For Stats, set scope to shop or listing as the report actually shows. Fill
  listing_id only when a specific listing is identified. Do not assign a
  shop-level keyword to one listing without evidence.
- Copy the stated market. If Etsy does not show a country/market filter,
  leave market blank or use Unknown. Never assume US from your shop location.
- Keep source_file as the original export or screenshot filename. In the
  combined file, source_row locates the original row or screenshot entry.
  Use notes for omissions, approximate values and report limitations.

3. Combine with the tutorial prompt
Keep your original eRank CSV unchanged. Upload it with your completed Etsy
templates and follow the tutorial's combination prompt. Use
keyword-evidence-template.csv for the resulting evidence table: one source,
keyword, period and metric per row. A Marketplace term with both searches and
listings becomes two evidence rows with separate IDs and metric labels. Keep
the original captured_on value on both rows. Do not collapse rolling-window
observations collected on different dates.
Retain source names, markets, periods, scopes and row references. Review the
combined output against the originals before drafting listing copy.

Use only relevant keyword data. Remove customer/order details from screenshots
or files before sharing. Save edited files as CSV UTF-8; a spreadsheet CSV
export handles commas and quotation marks within fields.

Official Etsy references
Stats: https://help.etsy.com/hc/en-us/articles/115015774268-How-to-Use-Etsy-Stats-for-Your-Shop
Marketplace Insights: https://help.etsy.com/hc/en-us/articles/35122361353239-How-Do-I-Use-Etsy-s-Marketplace-Insights-Tool
Marketplace Insights updates: https://help.etsy.com/hc/en-us/articles/10603291042967-Newly-Crafted-Etsy-Updates-for-Your-Shop
