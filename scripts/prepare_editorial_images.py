#!/usr/bin/env python3
"""Encode approved imagegen originals for responsive delivery, without retouching.

Run manually when artwork changes. Pillow is only needed for asset preparation;
the normal production build continues to use the Python standard library.
"""

import argparse
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/editorial'
WIDTHS = (480, 960, 1440)


def write_verified(image, path, image_format, **options):
    """Decode the encoded result before atomically installing a derivative."""
    output = BytesIO()
    image.save(output, image_format, **options)
    payload = output.getvalue()
    with Image.open(BytesIO(payload)) as decoded:
        decoded.load()
        if decoded.size != image.size:
            raise ValueError(f'Invalid encoded dimensions for {path.name}')
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_bytes(payload)
    temporary.replace(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('originals', type=Path)
    args = parser.parse_args()
    records = {}
    for path in sorted(args.originals.glob('batch-*.json')):
        batch = json.loads(path.read_text())
        for item in batch['assets']:
            if item['slug'] in records:
                raise ValueError('Duplicate original: ' + item['slug'])
            records[item['slug']] = item
    expected = {item['id'] for item in json.loads((ROOT/'data/editorial.json').read_text())['playbooks']}
    if set(records) != expected:
        raise ValueError(f'Cover inventory mismatch. Missing: {sorted(expected-set(records))}; extra: {sorted(set(records)-expected)}')
    DEST.mkdir(exist_ok=True)
    images = {}
    provenance = []
    for slug in sorted(records):
        item = records[slug]
        original = args.originals / (slug+'.png')
        digest = sha256(original.read_bytes()).hexdigest()
        with Image.open(original) as source:
            source = ImageOps.exif_transpose(source).convert('RGB')
            if source.width < 1440 or source.width / source.height < 1.35 or source.width / source.height > 1.65:
                raise ValueError(f'Expected a high-resolution landscape original for {slug}: {source.size}')
            for width in WIDTHS:
                height = round(source.height * width / source.width)
                resized = source.resize((width, height), Image.Resampling.LANCZOS)
                write_verified(resized, DEST/f'{slug}-{width}.webp', 'WEBP', quality=83, method=6)
            social_height = round(source.height * 1200 / source.width)
            write_verified(source.resize((1200, social_height), Image.Resampling.LANCZOS),
                DEST/f'{slug}-social.jpg', 'JPEG', quality=86, optimize=True, progressive=True)
            images[slug] = {
                'slug': slug, 'alt': item['alt'], 'position': item.get('position', item.get('focalPoint', '50% 50%')),
                'width': 1440, 'height': round(source.height * 1440 / source.width),
                'widths': list(WIDTHS), 'socialWidth': 1200, 'socialHeight': social_height,
                'version': digest[:12], 'credit': 'AI-generated editorial illustration · Seller Insider Hub',
            }
        # Keep all generation and correction instructions, without machine-local
        # scratch paths. The content hash identifies the accepted final original.
        local_path_fields = {'source', 'output', 'path', 'sourcePath', 'source_path', 'original_path', 'rejected_source'}
        provenance.append({key: value for key, value in item.items() if key not in local_path_fields})
        provenance[-1]['originalSha256'] = digest
    (ROOT/'data/editorial-images.json').write_text(json.dumps({'images':images}, ensure_ascii=False, indent=2)+'\n')
    (ROOT/'docs/EDITORIAL_IMAGE_PROMPTS.json').write_text(json.dumps({'method':'Built-in image_gen; reviewed editorial illustrations. Responsive derivatives are resized and encoded only.', 'assets':provenance}, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'covers':len(images), 'responsive_files':len(images)*4, 'bytes':sum(path.stat().st_size for path in DEST.iterdir() if path.is_file())}))


if __name__ == '__main__':
    main()
