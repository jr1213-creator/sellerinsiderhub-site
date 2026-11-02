"""Validated routes for the publication's explicitly curated comparison articles.

Sorting identifies a pair; it never changes an existing article slug or the
editorial first/second tool order. This registry does not create new articles.
"""
from dataclasses import dataclass
import re


SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*\Z")


def pair_key(tool_ids):
    """Return an unordered two-tool identity, or None for an invalid selection."""
    if not isinstance(tool_ids, (list, tuple)) or len(tool_ids) != 2:
        return None
    if any(not isinstance(value, str) or not SLUG.fullmatch(value) for value in tool_ids):
        return None
    if tool_ids[0] == tool_ids[1]:
        return None
    return tuple(sorted(tool_ids))


@dataclass(frozen=True)
class ComparisonRoute:
    slug: str
    title: str
    tool_ids: tuple[str, str]

    @property
    def url(self):
        return f'/comparisons/{self.slug}/'

    @property
    def reverse_slug(self):
        return f'{self.tool_ids[1]}-vs-{self.tool_ids[0]}'


@dataclass(frozen=True)
class ComparisonRegistry:
    routes: tuple[ComparisonRoute, ...]

    def resolve_pair(self, tool_ids):
        key = pair_key(tool_ids)
        if key is None:
            return None
        return next((route for route in self.routes if pair_key(route.tool_ids) == key), None)

    def public_entries(self):
        return [dict(title=route.title, url=route.url, toolIds=list(route.tool_ids)) for route in self.routes]

    def redirects(self):
        """One-hop aliases only for reviewed pairs, never duplicate HTML pages."""
        result = []
        for route in self.routes:
            if route.reverse_slug == route.slug:
                continue
            base = f'/comparisons/{route.reverse_slug}'
            result.extend((source, route.url) for source in (
                base, base + '/', base + '.html', base + '/index.html',
            ))
        return result


def build_comparison_registry(comparisons, tools):
    """Fail the build for ambiguous routes, missing tools, or duplicate pairs."""
    known = set()
    for tool in tools:
        tool_id = tool.get('id')
        if not isinstance(tool_id, str) or not SLUG.fullmatch(tool_id) or tool_id in known:
            raise ValueError(f'Invalid or duplicate tool ID in comparison registry: {tool_id!r}')
        known.add(tool_id)

    routes, slugs, pairs = [], set(), set()
    for comparison in comparisons:
        slug = comparison.get('id')
        title = comparison.get('title')
        ids = comparison.get('toolIds')
        if not isinstance(slug, str) or not SLUG.fullmatch(slug) or slug in slugs:
            raise ValueError(f'Invalid or duplicate comparison slug: {slug!r}')
        if not isinstance(title, str) or not title.strip():
            raise ValueError(f'Comparison {slug!r} needs a title')
        key = pair_key(ids)
        if key is None or any(tool_id not in known for tool_id in ids):
            raise ValueError(f'Comparison {slug!r} needs exactly two distinct known tool IDs')
        if key in pairs:
            raise ValueError(f'Duplicate unordered comparison pair: {key!r}')
        routes.append(ComparisonRoute(slug, title, tuple(ids)))
        slugs.add(slug)
        pairs.add(key)

    aliases = set()
    for route in routes:
        alias = route.reverse_slug
        if alias == route.slug:
            continue
        if alias in slugs or alias in aliases:
            raise ValueError(f'Comparison reverse alias collides with another route: {alias!r}')
        aliases.add(alias)
    return ComparisonRegistry(tuple(routes))
