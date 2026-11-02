"""Small, evidence-backed schema nodes shared by the static publication.

These describe visible entities; they do not assert eligibility for a Google
software rich result or promise inclusion in an AI answer. Prices, ratings,
reviews, licenses, and publication dates are intentionally not synthesized.
"""
import csv
from datetime import date
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit


ORIGIN = 'https://sellerinsiderhub.com'


def _text(value, label):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f'{label} must be nonempty text.')
    return value


def _origin(value):
    value = _text(value, 'Origin').rstrip('/')
    parsed = urlsplit(value)
    if (parsed.scheme not in ('http', 'https') or not parsed.netloc
            or parsed.username or parsed.password or parsed.path
            or parsed.query or parsed.fragment):
        raise ValueError('Origin must be an HTTP(S) origin without a path.')
    return value


def _web_url(value, label):
    value = _text(value, label)
    parsed = urlsplit(value)
    if (parsed.scheme not in ('http', 'https') or not parsed.netloc
            or parsed.username or parsed.password
            or any(character.isspace() for character in value)):
        raise ValueError(f'{label} must be an absolute HTTP(S) URL.')
    return value


def _local_path(value, label, directory=False):
    value = _text(value, label)
    parsed = urlsplit(value)
    decoded = unquote(parsed.path)
    if (parsed.scheme or parsed.netloc or parsed.query or parsed.fragment
            or not value.startswith('/') or value.startswith('//')
            or decoded != value or '\\' in value
            or any(character.isspace() for character in value)
            or any(part in ('.', '..') for part in value.split('/'))
            or '//' in value or (directory and not value.endswith('/'))):
        raise ValueError(f'{label} must be a canonical local path.')
    return value


def _tool(tool_id, by_id):
    if not isinstance(tool_id, str) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', tool_id):
        raise ValueError(f'Invalid catalog tool ID: {tool_id!r}.')
    if tool_id not in by_id or by_id[tool_id].get('id') != tool_id:
        raise ValueError(f'Unknown or mismatched catalog tool ID: {tool_id}.')
    return by_id[tool_id]


def software_entity_id(tool_id, by_id, *, origin=ORIGIN):
    """Return the same ID wherever a known catalog tool is discussed."""
    _tool(tool_id, by_id)
    return _origin(origin) + '/tool/' + tool_id + '/#software'


def software_subject_graph(tool_ids, by_id, categories=None, *, route, origin=ORIGIN):
    """Return ``nodes`` and ``about`` references for Article and WebPage.

    Only the exact /tool/<id>/ route receives that tool's visible profile
    description, feature list, and category label. Other pages receive just its
    stable identity, catalog name, and official website. Unknown IDs fail the
    build rather than silently making up an entity or dropping a subject.
    ``categories`` uses the generator's {category_id: category_record} mapping.
    """
    origin = _origin(origin)
    route = _local_path(route, 'Page route', directory=True)
    if isinstance(tool_ids, (str, bytes)):
        raise ValueError('tool_ids must be a sequence of catalog IDs.')
    nodes = []
    seen = set()
    for tool_id in tool_ids:
        tool = _tool(tool_id, by_id)
        if tool_id in seen:
            continue
        seen.add(tool_id)
        node = {
            '@type': 'SoftwareApplication',
            '@id': software_entity_id(tool_id, by_id, origin=origin),
            'name': _text(tool.get('name'), f'{tool_id} name'),
            'url': _web_url(tool.get('website'), f'{tool_id} official website'),
        }
        if route == '/tool/' + tool_id + '/':
            node['description'] = _text(tool.get('description'), f'{tool_id} description')
            features = tool.get('features')
            if not isinstance(features, list) or not features:
                raise ValueError(f'{tool_id} must have its visible profile features.')
            node['featureList'] = [_text(item, f'{tool_id} feature') for item in features]
            category = (categories or {}).get(tool.get('category'))
            if not isinstance(category, dict):
                raise ValueError(f'{tool_id} needs its visible category record.')
            node['applicationSubCategory'] = _text(category.get('label'), f'{tool_id} category label')
        nodes.append(node)
    return {'nodes': nodes, 'about': [{'@id': node['@id']} for node in nodes]}


def _download(distribution, output_dir, origin):
    path = _local_path(distribution.get('path'), 'Distribution path')
    expected_mime = {'.csv': 'text/csv', '.json': 'application/json'}.get(Path(path).suffix)
    if not expected_mime or distribution.get('encodingFormat') != expected_mime:
        raise ValueError('A distribution must be a CSV or JSON file with its actual MIME type.')
    root = Path(output_dir).resolve()
    file_path = (root / path.lstrip('/')).resolve()
    if not file_path.is_relative_to(root) or not file_path.is_file():
        raise ValueError(f'Distribution is not a real file inside the output directory: {path}.')
    try:
        if expected_mime == 'application/json':
            payload = json.loads(file_path.read_text(encoding='utf-8-sig'))
            if not isinstance(payload, (dict, list)) or not payload:
                raise ValueError('JSON distribution must contain a nonempty object or array.')
        else:
            with file_path.open(encoding='utf-8-sig', newline='') as handle:
                rows = list(csv.reader(handle, strict=True))
            if (len(rows) < 2 or not rows[0] or not all(cell.strip() for cell in rows[0])
                    or any(len(row) != len(rows[0]) for row in rows[1:])):
                raise ValueError('CSV distribution needs a header and consistent data rows.')
    except (OSError, UnicodeError, json.JSONDecodeError, csv.Error, ValueError) as error:
        raise ValueError(f'Invalid downloadable research file {path}: {error}') from error
    return {
        '@type': 'DataDownload',
        'name': _text(distribution.get('name'), 'Distribution name'),
        'contentUrl': origin + path,
        'encodingFormat': expected_mime,
    }


def dataset_node(metadata, output_dir, *, origin=ORIGIN):
    """Describe a real research compilation and validate its local downloads.

    Metadata contract: route, name, description, version, source_dates,
    distributions [{path, encodingFormat, name}], methodology_url,
    measurementTechnique, isBasedOn [official source URLs]. Source dates are
    verification dates, not publication dates or a measured time series. They
    are labeled explicitly in measurementTechnique. Publisher identity is a
    reference to the existing site node; this helper never replaces authors.
    """
    origin = _origin(origin)
    route = _local_path(metadata.get('route'), 'Dataset route', directory=True)
    source_dates = metadata.get('source_dates')
    if not isinstance(source_dates, list) or not source_dates:
        raise ValueError('Dataset needs its original source-check dates.')
    for value in source_dates:
        if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
            raise ValueError('Source-check dates must use YYYY-MM-DD.')
        try:
            date.fromisoformat(value)
        except ValueError as error:
            raise ValueError(f'Invalid source-check date: {value}.') from error
    methodology_url = _web_url(metadata.get('methodology_url'), 'Methodology URL')
    if methodology_url != origin + route + '#methodology':
        raise ValueError('Methodology URL must identify this dataset page\'s #methodology section.')
    sources = metadata.get('isBasedOn')
    if not isinstance(sources, list) or not sources:
        raise ValueError('Dataset needs the actual source URLs used in the compilation.')
    sources = list(dict.fromkeys(_web_url(value, 'Source URL') for value in sources))
    distributions = metadata.get('distributions')
    if not isinstance(distributions, list) or not distributions:
        raise ValueError('Dataset needs at least one real downloadable CSV or JSON file.')
    downloads = [_download(item, output_dir, origin) for item in distributions]
    if len({item['contentUrl'] for item in downloads}) != len(downloads):
        raise ValueError('Dataset distribution URLs must be distinct.')
    method = _text(metadata.get('measurementTechnique'), 'Measurement technique')
    method += ' Source records were checked on: ' + ', '.join(sorted(set(source_dates))) + '.'
    return {
        '@type': 'Dataset',
        '@id': origin + route + '#dataset',
        'url': origin + route,
        'name': _text(metadata.get('name'), 'Dataset name'),
        'description': _text(metadata.get('description'), 'Dataset description'),
        'version': _text(metadata.get('version'), 'Dataset version'),
        'publisher': {'@id': origin + '/#publisher'},
        'mainEntityOfPage': {'@id': origin + route + '#webpage'},
        'measurementTechnique': [method, methodology_url],
        'isBasedOn': sources,
        'distribution': downloads,
    }
