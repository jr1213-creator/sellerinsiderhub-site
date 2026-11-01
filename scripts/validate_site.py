#!/usr/bin/env python3
"""Validate built publication artifacts without network calls or writes.

Run after scripts/build_site.py. These checks establish static production
invariants; they do not establish email delivery, vendor approval, external
URL availability, search ranking, or the truth of an editorial claim.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date
from html.parser import HTMLParser
import json
from pathlib import Path
import posixpath
import re
import shlex
import sys
from urllib.parse import unquote, urljoin, urlsplit
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://sellerinsiderhub.com"
LOCAL_HOSTS = {"sellerinsiderhub.com", "www.sellerinsiderhub.com"}
VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
}


def tidy(value: str) -> str:
    return " ".join(value.split())


def types(node: dict) -> set[str]:
    value = node.get("@type", [])
    return set(value if isinstance(value, list) else [value])


def json_nodes(value):
    """Walk graphs and embedded nodes, including a single root object."""
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from json_nodes(child)
    elif isinstance(value, list):
        for child in value:
            yield from json_nodes(child)


class Page(HTMLParser):
    def __init__(self, path: Path, dist: Path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.relative = path.relative_to(dist).as_posix()
        self.route = (
            "/" + self.relative[:-10]
            if self.relative.endswith("index.html")
            else "/" + self.relative
        )
        self.route = self.route or "/"
        self.is_404 = self.relative == "404.html"
        self.titles = []
        self.canonicals = []
        self.h1_count = 0
        self.links = []
        self.ids = set()
        self.scripts = []
        self.ld_blocks = []
        self.forms = []
        self.visible = []
        self.badges = []
        self.noindex = False
        self._stack = []
        self._title = None
        self._ld = None
        self._form = None
        self._badge = None
        self.feed(path.read_text(encoding="utf-8-sig"))
        self.close()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        hidden = "hidden" in attrs or any(x[1] for x in self._stack)
        if "id" in attrs:
            self.ids.add(attrs["id"])
        if tag == "a" and attrs.get("name"):
            self.ids.add(attrs["name"])
        if tag == "h1":
            self.h1_count += 1
        if tag == "title":
            self._title = []
        if tag == "link" and "canonical" in (attrs.get("rel") or "").split():
            self.canonicals.append(attrs.get("href", ""))
        if tag == "meta" and (attrs.get("name") or "").lower() == "robots":
            self.noindex = "noindex" in (attrs.get("content") or "").lower()
        for name in ("href", "src", "poster"):
            if name in attrs:
                self.links.append((tag, name, attrs[name] or "", attrs))
        if tag == "script":
            if attrs.get("src"):
                self.scripts.append(attrs["src"])
            if (attrs.get("type") or "").lower() == "application/ld+json":
                self._ld = []
        if tag == "form":
            self._form = {"attrs": attrs, "controls": []}
            self.forms.append(self._form)
        if self._form is not None and tag in {"input", "textarea", "select", "button"}:
            self._form["controls"].append((tag, attrs, hidden))
        if self._badge is None and "badge" in (attrs.get("class") or "").split():
            self._badge = {"tag": tag, "depth": len(self._stack), "attrs": attrs, "text": []}
        if tag not in VOID_TAGS:
            self._stack.append((tag, hidden))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag == "title" and self._title is not None:
            self.titles.append(tidy("".join(self._title)))
            self._title = None
        if tag == "script" and self._ld is not None:
            self.ld_blocks.append("".join(self._ld))
            self._ld = None
        if tag == "form":
            self._form = None
        if self._badge is not None and tag == self._badge["tag"]:
            if len(self._stack) - 1 <= self._badge["depth"]:
                self.badges.append(self._badge)
                self._badge = None
        for index in range(len(self._stack) - 1, -1, -1):
            if self._stack[index][0] == tag:
                del self._stack[index:]
                break

    def handle_data(self, value):
        if self._title is not None:
            self._title.append(value)
        if self._ld is not None:
            self._ld.append(value)
        if self._badge is not None:
            self._badge["text"].append(value)
        if not any(tag in {"script", "style", "head"} for tag, _ in self._stack):
            self.visible.append(value)


@dataclass
class Redirect:
    source: str
    target: str
    status: str
    pattern: re.Pattern

    def match(self, url: str):
        subject = url if self.source.startswith(("http://", "https://")) else urlsplit(url).path
        match = self.pattern.fullmatch(subject)
        if not match:
            return None
        target = self.target
        for key, value in match.groupdict().items():
            target = target.replace(":" + key, value or "")
        return urljoin(url, target)


class Validator:
    def __init__(self, dist: Path):
        self.dist = dist.resolve()
        self.errors = []
        self.pages = []
        self.by_path = {}
        self.redirects = []
        self.catalog = {}
        self.tools = {}
        self.stats = Counter()
        self._link_cache = {}

    def error(self, code, where, message):
        self.errors.append({"code": code, "where": str(where), "message": message})

    def load_json(self, path, label):
        try:
            return json.loads(path.read_text(encoding="utf-8-sig"))
        except (OSError, ValueError) as exc:
            self.error("json-file", label, str(exc))
            return None

    def load_redirects(self):
        path = self.dist / "_redirects"
        if not path.exists():
            self.error("redirects-missing", "_redirects", "Generated redirect manifest is missing.")
            return
        for number, line in enumerate(path.read_text().splitlines(), 1):
            fields = shlex.split(line, comments=True)
            if not fields:
                continue
            if len(fields) < 2:
                self.error("redirect-invalid", "_redirects:" + str(number), line)
                continue
            source, target = fields[:2]
            status = fields[2] if len(fields) > 2 else "301"
            parts = re.split(r"(\*|:[A-Za-z_]\w*)", source)
            expression = "".join(
                "(?P<splat>.*)" if part == "*" else
                "(?P<" + part[1:] + ">[^/]+)" if part.startswith(":") else
                re.escape(part) for part in parts
            )
            try:
                pattern = re.compile(expression)
            except re.error as exc:
                self.error("redirect-invalid", "_redirects:" + str(number), str(exc))
                continue
            self.redirects.append(Redirect(source, target, status, pattern))

    def direct_file(self, url):
        raw = unquote(urlsplit(url).path or "/")
        if "\x00" in raw or "\\" in raw:
            return None
        normalized = posixpath.normpath("/" + raw.lstrip("/"))
        path = self.dist / normalized.lstrip("/")
        candidates = [path, path / "index.html"]
        if not path.suffix and not raw.endswith("/"):
            candidates.append(path.with_suffix(".html"))
        for candidate in candidates:
            try:
                candidate.resolve().relative_to(self.dist)
            except ValueError:
                continue
            if candidate.is_file():
                return candidate.resolve()
        return None

    def resolve(self, url):
        """Apply known forced redirects and extensionless host serving rules."""
        seen = set()
        for _ in range(20):
            parts = urlsplit(url)
            if parts.scheme not in {"http", "https"}:
                return None, url, "unsupported scheme"
            if parts.hostname not in LOCAL_HOSTS:
                return None, url, "external"
            if parts.path in {"/partners/investors", "/partners/investors/"}:
                # A Netlify function, not a public static page, owns this route.
                gateway = self.dist.parent / "netlify/functions/investor-portal.mjs"
                private_page = self.dist.parent / "private/investor/index.html"
                if gateway.is_file() and private_page.is_file():
                    return private_page, url, None
                return None, url, "investor function bundle missing"
            if url in seen:
                return None, url, "redirect loop"
            seen.add(url)
            direct = self.direct_file(url)
            destination = None
            for rule in self.redirects:
                if direct is not None and not rule.status.endswith("!"):
                    continue
                destination = rule.match(url)
                if destination is not None:
                    break
            if destination is not None:
                url = destination
                continue
            if direct is not None:
                return direct, url, None
            return None, url, "missing destination"
        return None, url, "redirect chain exceeds 20 hops"

    def check_link(self, page, value, label):
        if not value:
            self.error("empty-link", page.relative, label + " is empty.")
            return
        parts = urlsplit(value)
        if parts.scheme in {"mailto", "tel", "data", "blob"}:
            return
        if parts.scheme and parts.scheme not in {"http", "https"}:
            self.error("unsafe-link", page.relative, label + ": " + value)
            return
        absolute = urljoin(ORIGIN + page.route, value)
        if urlsplit(absolute).hostname not in LOCAL_HOSTS:
            return
        self.stats["local_references"] += 1
        if absolute not in self._link_cache:
            self._link_cache[absolute] = self.resolve(absolute)
        path, resolved, problem = self._link_cache[absolute]
        if problem == "external":
            return
        if problem:
            self.error("broken-local-link", page.relative, label + ": " + value + " (" + problem + ")")
            return
        fragment = unquote(urlsplit(resolved).fragment or urlsplit(absolute).fragment)
        target = self.by_path.get(path)
        if fragment and target is not None and fragment not in target.ids:
            self.error("broken-fragment", page.relative, value + " has no matching target ID.")

    def check_catalog(self):
        catalog = self.load_json(self.dist / "data/catalog.json", "data/catalog.json")
        if not isinstance(catalog, dict):
            return
        self.catalog = catalog
        records = catalog.get("tools", [])
        categories = catalog.get("categories", [])
        if not isinstance(records, list) or not records:
            self.error("catalog-empty", "data/catalog.json", "A nonempty tools list is required.")
            return
        if not isinstance(categories, list) or not categories:
            self.error("categories-empty", "data/catalog.json", "A nonempty categories list is required.")
            return
        category_ids = [c.get("id") for c in categories if isinstance(c, dict)]
        for identifier, count in Counter(category_ids).items():
            if count > 1 or not identifier:
                self.error("category-id", "data/catalog.json", "Missing/duplicate category: " + str(identifier))
        required_strings = (
            "id", "name", "category", "website", "tagline", "description",
            "pricingSummary", "pricingUrl", "setup", "checkedAt",
        )
        required_lists = ("bestFor", "features", "limitations", "notFor", "sourceUrls", "audiences")
        names = set()
        for record in records:
            if not isinstance(record, dict):
                self.error("catalog-record", "data/catalog.json", "Tool record must be an object.")
                continue
            identifier = record.get("id", "<missing>")
            where = "catalog:" + str(identifier)
            if identifier in self.tools:
                self.error("tool-id-duplicate", where, "Duplicate canonical tool ID.")
            self.tools[identifier] = record
            normalized_name = tidy(str(record.get("name", ""))).casefold()
            if normalized_name in names:
                self.error("tool-name-duplicate", where, "Duplicate tool name.")
            names.add(normalized_name)
            for field in required_strings:
                if not isinstance(record.get(field), str) or not record[field].strip():
                    self.error("catalog-field", where, field + " must be a nonempty string.")
            if not isinstance(identifier, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", identifier):
                self.error("tool-id", where, "Tool ID must be a stable lowercase slug.")
            if record.get("category") not in category_ids:
                self.error("catalog-category", where, "Unknown category ID.")
            for field in required_lists:
                values = record.get(field)
                if not isinstance(values, list) or not values or any(
                    not isinstance(value, str) or not value.strip() for value in values
                ):
                    self.error("catalog-field", where, field + " must be a nonempty string list.")
            for field in ("website", "pricingUrl"):
                if not self.https_url(record.get(field)):
                    self.error("catalog-url", where, field + " must be an absolute HTTPS URL.")
            for source in record.get("sourceUrls", []) if isinstance(record.get("sourceUrls"), list) else []:
                if not self.https_url(source):
                    self.error("catalog-source", where, "Invalid HTTPS source URL: " + str(source))
            if "freePlan" not in record or record["freePlan"] is not None and type(record["freePlan"]) is not bool:
                self.error("catalog-price-state", where, "freePlan must be true, false, or null.")
            if not isinstance(record.get("affiliateStatus"), str):
                self.error("catalog-affiliate-state", where, "Explicit affiliateStatus is required.")
            if record.get("affiliateStatus") == "approved" and not self.https_url(record.get("affiliateUrl")):
                self.error("approved-link-missing", where, "Approved state needs an actual HTTPS affiliateUrl.")
            if any(field in record for field in ("rating", "ratingValue", "reviewScore", "aggregateRating")):
                if not record.get("ratingEvidence"):
                    self.error("unsupported-rating", where, "Numeric rating lacks an evidence/method record.")
            try:
                date.fromisoformat(str(record.get("checkedAt", ""))[:10])
            except ValueError:
                self.error("catalog-date", where, "checkedAt must be a real ISO date.")
            profile = self.dist / "tool" / str(identifier) / "index.html"
            if not profile.is_file():
                self.error("profile-missing", where, "Published catalog item has no static profile.")
        self.stats["catalog_tools"] = len(records)

    @staticmethod
    def https_url(value):
        if not isinstance(value, str):
            return False
        parsed = urlsplit(value)
        return parsed.scheme == "https" and bool(parsed.hostname) and not parsed.username and not parsed.password

    def check_exposure(self):
        forbidden_names = {"community-config.js", "affiliate-links.json", "research.json", "editorial.json", "app.js"}
        forbidden_dirs = {"docs", "research", "scripts", "supabase", ".git", ".codex", ".agents", "__pycache__"}
        for path in self.dist.rglob("*"):
            if not path.is_file():
                continue
            relative = path.relative_to(self.dist)
            if set(relative.parts[:-1]) & forbidden_dirs or path.name in forbidden_names:
                self.error("internal-file-exposed", relative.as_posix(), "Internal/legacy file is in public output.")
            if path.name.startswith(".env") or path.suffix in {".py", ".pyc", ".sql", ".cjs"}:
                self.error("source-file-exposed", relative.as_posix(), "Source/configuration file is in public output.")

    def expected_articles(self):
        editorial = ROOT / "data/editorial.json"
        if not editorial.exists():
            return set()
        data = self.load_json(editorial, "source:data/editorial.json")
        if not isinstance(data, dict):
            return set()
        return {
            "/" + section + "/" + str(record["id"]) + "/"
            for key, section in (("playbooks", "playbooks"), ("comparisons", "comparisons"))
            for record in data.get(key, [])
            if isinstance(record, dict) and record.get("id")
        }

    def check_page(self, page, expected_articles):
        where = page.relative
        if len(page.titles) != 1 or not page.titles[0]:
            self.error("page-title", where, "Exactly one nonempty title is required.")
        if page.h1_count != 1:
            self.error("h1-count", where, "Expected one h1; found " + str(page.h1_count) + ".")
        if len(page.canonicals) != 1:
            self.error("canonical-count", where, "Exactly one canonical link is required.")
        else:
            canonical = page.canonicals[0]
            parsed = urlsplit(canonical)
            if (
                parsed.scheme != "https" or parsed.netloc != "sellerinsiderhub.com"
                or parsed.query or parsed.fragment
            ):
                self.error("canonical-origin", where, "Canonical must use the clean HTTPS production origin.")
            if not page.is_404:
                target, _, problem = self.resolve(canonical)
                if problem or target != page.path.resolve():
                    self.error("canonical-destination", where, "Canonical does not identify this actual built page.")
                if canonical != ORIGIN + page.route:
                    self.error("canonical-route", where, "Canonical must use the direct generated page route.")
        for tag, attr, value, attrs in page.links:
            self.check_link(page, value, tag + "[" + attr + "]")
            if tag == "a" and "data-outbound" in attrs:
                identifier = attrs["data-outbound"]
                record = self.tools.get(identifier)
                if record is None:
                    self.error("outbound-tool", where, "Unknown outbound tool ID: " + str(identifier))
                    continue
                approved = record.get("affiliateStatus") == "approved"
                expected = record.get("affiliateUrl") if approved else record.get("website")
                if value != expected:
                    self.error("outbound-destination", where, str(identifier) + " CTA bypasses its approved/fallback registry destination.")
                if approved and "sponsored" not in (attrs.get("rel") or "").split():
                    self.error("outbound-rel", where, str(identifier) + " approved affiliate CTA lacks rel=sponsored.")
            if tag == "a" and attr == "href":
                for record in self.tools.values():
                    if record.get("affiliateUrl") == value and value:
                        if record.get("affiliateStatus") != "approved":
                            self.error("unapproved-affiliate-link", where, "An unapproved registry URL is linked.")
                        elif "sponsored" not in (attrs.get("rel") or "").split():
                            self.error("affiliate-rel", where, "Approved affiliate link lacks sponsored relationship.")
        for src in page.scripts:
            if urlsplit(src).path.endswith("/app.js"):
                self.error("legacy-script", where, "Legacy app.js is still loaded.")
        nodes = []
        for index, block in enumerate(page.ld_blocks):
            try:
                nodes.extend(json_nodes(json.loads(block)))
            except ValueError as exc:
                self.error("json-ld", where, "Block " + str(index + 1) + ": " + str(exc))
        by_type = defaultdict(list)
        for node in nodes:
            for kind in types(node):
                by_type[kind].append(node)
            if "AggregateRating" in types(node) or "Review" in types(node):
                self.error("unsupported-review-schema", where, "Review/rating schema requires evidence this publication has not established.")
        if not by_type["Organization"]:
            self.error("publisher-schema", where, "Real Organization publisher metadata is missing.")
        if page.route in expected_articles:
            for kind in ("Article", "BreadcrumbList"):
                if not by_type[kind]:
                    self.error("article-schema", where, kind + " is required for this new editorial guide.")
            for article in by_type["Article"]:
                for field in ("headline", "author", "publisher", "datePublished", "dateModified"):
                    if not article.get(field):
                        self.error("article-field", where, "Article is missing " + field + ".")
                parsed_dates = []
                for field in ("datePublished", "dateModified"):
                    try:
                        parsed_dates.append(date.fromisoformat(str(article.get(field, ""))[:10]))
                    except ValueError:
                        self.error("article-date", where, field + " is not an ISO date.")
                if len(parsed_dates) == 2 and parsed_dates[1] < parsed_dates[0]:
                    self.error("article-date-order", where, "dateModified precedes datePublished.")
        text = tidy(" ".join(page.visible))
        if re.search(r"(?<!\d)[0-5](?:\.\d+)?\s*/\s*5\b|(?:★|⭐){3,}", text):
            self.error("visible-rating", where, "Visible star/numeric rating needs a substantiated methodology.")
        for badge in page.badges:
            label = tidy(" ".join(badge["text"]))
            if re.search(r"(?:verified|official|certified)\s+partner|hands.on\s+tested|tested\s*(?:and|&)\s*approved|trusted\s+by\s+\d", label, re.I):
                if not badge["attrs"].get("data-evidence-url"):
                    self.error("unsupported-badge", where, "Promotional badge has no evidence reference: " + label)
        for form in page.forms:
            self.check_form(page, form)

    def check_form(self, page, form):
        attrs = form["attrs"]
        if "data-netlify" not in attrs and "netlify" not in attrs:
            return
        self.stats["native_forms"] += 1
        name = attrs.get("name", "")
        where = page.relative + " form:" + (name or "<unnamed>")
        if not name or (attrs.get("method") or "").upper() != "POST":
            self.error("form-config", where, "Native form requires a name and POST method.")
        hidden_names = [
            control for _, control, _ in form["controls"]
            if control.get("name") == "form-name"
        ]
        if len(hidden_names) != 1 or hidden_names[0].get("type") != "hidden" or hidden_names[0].get("value") != name:
            self.error("form-name", where, "One hidden form-name must match the form name.")
        honeypot = attrs.get("netlify-honeypot") or attrs.get("data-netlify-honeypot")
        traps = [(control, hidden) for _, control, hidden in form["controls"] if control.get("name") == honeypot]
        if not honeypot or len(traps) != 1 or not traps[0][1]:
            self.error("form-honeypot", where, "Named honeypot must exist inside a hidden element.")
        action = attrs.get("action")
        if not action:
            self.error("form-action", where, "A native form needs a real confirmation destination.")
        else:
            self.check_link(page, action, "form[action]")
        if "newsletter" in name.lower():
            consents = [
                control for _, control, _ in form["controls"]
                if control.get("name") == "consent"
            ]
            if len(consents) != 1 or consents[0].get("type") != "checkbox" or "required" not in consents[0] or "checked" in consents[0]:
                self.error("newsletter-consent", where, "Consent must be required, explicit, and initially unchecked.")

    def check_sitemap(self):
        path = self.dist / "sitemap.xml"
        try:
            root = ET.parse(path).getroot()
        except (OSError, ET.ParseError) as exc:
            self.error("sitemap", "sitemap.xml", str(exc))
            return
        locations = [
            node.text or "" for node in root.findall("{*}url/{*}loc")
        ]
        for location, count in Counter(locations).items():
            if count > 1:
                self.error("sitemap-duplicate", "sitemap.xml", location)
            target, _, problem = self.resolve(location)
            page = self.by_path.get(target)
            if problem or page is None:
                self.error("sitemap-destination", "sitemap.xml", location + " does not resolve to a page.")
            elif page.noindex:
                self.error("sitemap-noindex", page.relative, "Noindex page appears in sitemap.")
            elif location not in page.canonicals:
                self.error("sitemap-canonical", page.relative, "Sitemap URL differs from the canonical.")
        for page in self.pages:
            if not page.noindex and not page.is_404 and page.canonicals:
                if page.canonicals[0] not in locations:
                    self.error("sitemap-omission", page.relative, "Indexable page is missing from sitemap.")
        self.stats["sitemap_urls"] = len(locations)

    def run(self):
        if not self.dist.is_dir() or not (self.dist / "index.html").is_file():
            self.error("build-missing", self.dist, "Build the site before validating dist.")
            return
        self.load_redirects()
        self.check_catalog()
        self.check_exposure()
        for path in sorted(self.dist.rglob("*.html")):
            try:
                page = Page(path, self.dist)
            except (OSError, ValueError) as exc:
                self.error("html-parse", path.relative_to(self.dist), str(exc))
                continue
            self.pages.append(page)
            self.by_path[path.resolve()] = page
        expected_articles = self.expected_articles()
        titles = defaultdict(list)
        canonicals = defaultdict(list)
        for page in self.pages:
            self.check_page(page, expected_articles)
            if not page.is_404:
                if page.titles:
                    titles[page.titles[0].casefold()].append(page.relative)
                if page.canonicals:
                    canonicals[page.canonicals[0]].append(page.relative)
        for label, values in (("title", titles), ("canonical", canonicals)):
            for value, pages in values.items():
                if len(pages) > 1:
                    self.error("duplicate-" + label, ", ".join(pages), value)
        self.check_sitemap()
        self.stats["html_pages"] = len(self.pages)
        self.stats["expected_editorial_guides"] = len(expected_articles)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dist", type=Path, default=ROOT / "dist")
    parser.add_argument("--json", action="store_true", help="Emit the complete machine-readable result.")
    parser.add_argument("--max-errors", type=int, default=30, help="Maximum error details in text output.")
    args = parser.parse_args()
    validator = Validator(args.dist)
    validator.run()
    result = {
        "ok": not validator.errors,
        "stats": dict(validator.stats),
        "error_count": len(validator.errors),
        "errors": validator.errors,
    }
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(("PASS" if result["ok"] else "FAIL") + ": static production validation")
        print(json.dumps({"stats": result["stats"], "error_count": result["error_count"]}, sort_keys=True))
        for error in validator.errors[:max(0, args.max_errors)]:
            print("[" + error["code"] + "] " + error["where"] + ": " + error["message"])
        if len(validator.errors) > args.max_errors:
            print("Additional errors omitted; use --json for the complete result.")
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
