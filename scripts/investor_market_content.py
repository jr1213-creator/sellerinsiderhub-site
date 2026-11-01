"""Market-share and annual profit section for the protected investor room."""

MARKET_SHARE_SECTION = '''
<section id="market-share" class="market-share-section" aria-labelledby="market-share-title">
  <div class="room-wrap">
    <div class="section-heading">
      <div><p class="eyebrow">02 / MARKET SHARE &amp; ANNUAL PROFIT</p><h2 id="market-share-title">A small share.<br>A substantial business.</h2></div>
      <p>Translate the business base into purchasing businesses, several qualifying software referrals, and annual operating profit. The market share is a target you can test; the commission rules come from the selected programs.</p>
    </div>
    <div class="market-opportunity-note"><strong>The opportunity includes businesses already using AI.</strong><p>Owners can add a new vendor, replace a tool, or implement a new workflow. This model does not restrict the audience to AI nonusers. Every counted purchase must still qualify under its vendor’s new-customer and attribution rules.</p></div>
    <div class="share-layout">
      <form id="market-assumptions" class="share-controls" aria-label="Market-share scenario assumptions">
        <div class="panel-heading"><h3>Choose the scale</h3><button type="button" class="text-button" id="reset-market">Reset</button></div>
        <div class="share-inputs">
          <label>Annual capture of the selected business pool (%)<input id="market-capture" type="number" min="0" max="100" step="0.001" value="0.1"><small>New businesses making their first attributed purchase through this publication each year. A business is counted once.</small></label>
          <div class="share-quick" role="group" aria-label="Annual market capture"><button type="button" data-market-share="0.01" aria-pressed="false">0.01%</button><button type="button" data-market-share="0.1" aria-pressed="true">0.1%</button><button type="button" data-market-share="1" aria-pressed="false">1%</button></div>
          <div class="input-pair"><label>Paid tools per business<input id="market-tools" type="number" min="1" max="23" step="0.5" value="3"></label><label>Earnings horizon<select id="market-horizon"><option value="12">12 months</option><option value="24">24 months</option><option value="36" selected>36 months</option><option value="60">60 months</option></select></label></div>
          <p class="field-help">Tool count, horizon, vendor mix, conversion, retention, and commission terms stay linked to the detailed model below. The stack is an assumption, not an observed customer average.</p>
          <details class="share-details"><summary>Define the addressable buyer pool</summary><div>
            <label>Broad U.S. business base<input id="market-business-base" type="number" min="1" max="1000000000" step="1" value="36207130"></label>
            <label>Share fitting our audience (%)<input id="market-addressable" type="number" min="0" max="100" step="1" value="100"></label>
            <label>Share in the annual buying pool (%)<input id="market-annual-buyers" type="number" min="0" max="100" step="1" value="100"></label>
            <p class="field-help">The two 100% defaults use the entire broad business base as a reference denominator. They do not claim every business will buy. Narrow either input to test a smaller addressable market; these filters are estimates, not survey findings.</p>
          </div></details>
          <details class="share-details" open><summary>Budget for reaching that scale</summary><div>
            <div class="share-quick" role="group" aria-label="Market scenario cost basis"><button type="button" data-market-budget="growth" aria-pressed="true">Growth allowance</button><button type="button" data-market-budget="current" aria-pressed="false">Current budget</button></div>
            <label>Acquisition allowance / new business ($)<input id="market-acquisition-cost" type="number" min="0" max="1000000" step="10" value="100"><small>An editable allowance for gaining each first purchasing business, across content, promotion, and distribution. Applied once per business, not once per tool.</small></label>
            <label>Founder compensation ($/year)<input id="market-founder-pay" type="number" min="0" max="1000000000" step="12000" value="120000"></label>
            <label>Additional operating allowance ($/year)<input id="market-other-cost" type="number" min="0" max="1000000000" step="1200" value="24000"><small>For costs you choose to incur, such as accounting, specialist review, insurance, or extra software. No employees are introduced.</small></label>
            <p class="field-help">These are planning allowances, not verified bills or industry benchmarks. Acquisition and other allowances add to costs already entered below. Founder compensation replaces that field for this market-share scenario only. Avoid counting the same spending twice.</p>
          </div></details>
        </div>
      </form>
      <div class="share-output">
        <p class="eyebrow" id="market-output-label">ILLUSTRATIVE ANNUAL SCALE SCENARIO</p>
        <p class="share-equation" id="market-equation"></p>
        <div class="share-result-grid" id="market-results" aria-live="polite"></div>
        <p class="share-period" id="market-period"></p>
        <div class="share-bridge"><div class="card-title"><h3>From commission to operating profit</h3><span>USD · final 12 modeled months</span></div><div id="market-profit-bridge"></div></div>
        <p class="share-cash" id="market-cash"></p>
        <div class="share-pool" id="market-pool"></div>
        <div id="market-error" role="alert" class="error-panel" hidden></div>
        <p class="share-model-note">A scale scenario holds the required acquisition level constant from month one and starts with zero referral cohorts. The horizon shows how commissions mature; it is not a prediction of when the audience can be built. Operating profit is after the selected costs and founder compensation, before tax, financing, and investor distributions.</p>
      </div>
    </div>
    <div class="share-table-heading"><div><p class="eyebrow">THE SHARE LADDER</p><h3>See the high end in actual business counts.</h3></div><button type="button" class="text-button" id="export-market">Download market analysis ↗</button></div>
    <p class="share-table-note" id="market-ladder-note"></p>
    <div class="table-scroll share-table" tabindex="0" role="region" aria-label="Annual market capture, revenue, and profit"><table><thead><tr><th>Annual capture<br><small>of selected buyer pool</small></th><th>New businesses / year</th><th>Required visits / month</th><th>Annual earned commission</th><th>Annual operating profit<br><small>after founder pay · pre-tax</small></th><th>Share of broad base</th></tr></thead><tbody id="market-ladder"></tbody></table></div>
    <div class="share-targets"><div class="section-heading compact"><div><p class="eyebrow">SEVEN, EIGHT &amp; NINE FIGURES</p><h3>What does each revenue level require?</h3></div><p>These targets use the same stack, program terms, retention, and cost assumptions. Profit is calculated alongside revenue; neither is a valuation or investor return.</p></div><div class="table-scroll share-table" tabindex="0" role="region" aria-label="Market share needed for annual revenue targets"><table><thead><tr><th>Annual revenue target</th><th>New businesses / year</th><th>Broad-base annual share</th><th>Selected buyer-pool share</th><th>Required visits / month</th><th>Annual operating profit</th></tr></thead><tbody id="market-targets"></tbody></table></div></div>
    <div class="share-robustness"><div><p class="eyebrow">TEST THE EARNING POWER</p><h3>Keep the share. Change the customer economics.</h3><p>Compare fewer paid tools and lower recurring customer spend. Published one-time bounties stay unchanged. These are alternative assumptions, not probabilities.</p></div><div class="table-scroll" tabindex="0" role="region" aria-label="Alternative tool adoption and spending scenarios"><table><thead><tr><th>Customer scenario</th><th>Annual earned commission</th><th>Annual operating profit</th></tr></thead><tbody id="market-yield-sensitivity"></tbody></table></div></div>
    <details class="share-method"><summary>How the market-share calculation works</summary><div>
      <ol><li>Selected annual buyer pool = business base × audience-fit percentage × annual-buyer percentage.</li><li>New purchasing businesses per year = selected buyer pool × annual capture percentage. Dividing by 12 gives a steady monthly acquisition level.</li><li>Required monthly visits = monthly new purchasing businesses ÷ vendor-click rate ÷ first-purchase conversion rate. This holds the existing funnel assumptions constant; it does not predict traffic.</li><li>Each business can make the selected number of distinct vendor purchases. Later purchases follow the configured delay. The portfolio represents an aggregate mix across customers; complementary combinations still need validation.</li><li>The cohort engine applies each program’s commission, retention, duration, approval, reversal, cap, and payout assumptions. Annual revenue and profit sum the final 12 months; the exit-month run rate is a different measure.</li><li>Businesses are not recycled as newly acquired customers in later years. Scenarios exceeding the addressable business stock across the horizon are marked infeasible. New business formation, international customers, and post-stack expansion are not added automatically.</li></ol>
      <p id="market-source-note"></p><p id="market-commercial-note">The selected share is an acquisition target, not measured market share. Business-count penetration is not share of total software spending. Affiliate approval, traffic, conversion, and attributed stack purchases have not been validated by this calculator.</p>
    </div></details>
    <div class="share-evidence" id="market-share-evidence"></div>
  </div>
</section>
'''
