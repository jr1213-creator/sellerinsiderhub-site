"""Contextual links to the publication's related service business."""
from html import escape
from urllib.parse import urlencode


REPORT_URL = 'https://thelocalupgrade.com/ai-readiness-report'
REPORT_REVIEWED_AT = '2026-11-02'
REPORT_PLACEMENTS = {
    'local_business_guide': 'Want a reviewed plan for your website and local visibility?',
    'contractor_guide': 'Need help finding gaps in your website’s inquiry path?',
    'resources': 'Want a professional review of your business website?',
}


def report_cta(placement):
    """Render one fixed offer; never forward visitor inputs or entry parameters."""
    if placement not in REPORT_PLACEMENTS:
        raise ValueError('Unknown AI Readiness Report placement: ' + str(placement))
    url = REPORT_URL + '?' + urlencode({
        'utm_source': 'sellerinsiderhub',
        'utm_medium': 'referral',
        'utm_campaign': 'ai-readiness-report',
        'utm_content': placement,
    })
    return (
        '<aside class="card" aria-label="Optional professional help">'
        '<span class="eyebrow">Optional professional help</span>'
        '<h3>' + escape(REPORT_PLACEMENTS[placement]) + '</h3>'
        '<p>Our related service business, The Local Upgrade, offers the '
        '<strong>$149 AI Readiness &amp; Visibility Report</strong>, with a review of '
        'website clarity, visibility, lead capture, and measurement readiness.</p>'
        '<p>Currently offered via waitlist while payment setup completes.</p>'
        '<div class="actions"><a class="button light" href="' + escape(url, quote=True) + '" '
        'target="_blank" rel="noopener" data-service-cta="ai_readiness_report" '
        'data-service-placement="' + escape(placement, quote=True) + '">'
        'Explore the report ↗</a></div></aside>'
    )
