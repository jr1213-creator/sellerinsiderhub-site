"""Render approved vendor actions from the publication's canonical catalog."""
from html import escape


def is_approved_affiliate(tool):
    url = tool.get('affiliateUrl')
    return tool.get('affiliateStatus') == 'approved' and isinstance(url, str) and url.startswith('https://')


def outbound(tool):
    if is_approved_affiliate(tool):
        return tool['affiliateUrl'], 'sponsored nofollow noopener'
    return tool['website'], 'noopener'


def approved_tool_actions(tool_ids, catalog, placement):
    """Offer direct actions only for approved tools already used by this guide."""
    tools = [catalog[identifier] for identifier in dict.fromkeys(tool_ids)
             if identifier in catalog and is_approved_affiliate(catalog[identifier])]
    if not tools:
        return ''
    placement = placement if placement in {'tutorial_tools', 'comparison_tools'} else 'other'
    heading = 'Use this tool' if len(tools) == 1 else 'Use these tools'
    links = []
    for tool in tools:
        url, relationship = outbound(tool)
        links.append(
            f'<a class="button" href="{escape(url, quote=True)}" target="_blank" '
            f'rel="{relationship}" data-outbound="{escape(tool["id"], quote=True)}" '
            f'data-outbound-placement="{placement}">Visit {escape(tool["name"])} ↗</a>'
        )
    return (
        f'<div class="card affiliate-actions"><h3>{heading}</h3>'
        '<p class="small">We may earn a commission if you purchase through these links. '
        '<a class="link" href="/legal/affiliate-disclosure/">How we’re funded</a>.</p>'
        + ''.join(links) + '</div>'
    )
