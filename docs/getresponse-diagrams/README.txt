GETRESPONSE EDITORIAL COVERS

Three original, code-native SVG diagrams. They are not software screenshots or
vendor logos. No private account data or generated raster art is used.

Rebuild:
  python build_covers.py

Dependencies: Pillow and CairoSVG, or Pillow and the Inkscape CLI fallback.
Fonts: DejaVu Sans and DejaVu Serif. In this environment, the initial render used
Inkscape because CairoSVG was unavailable. SVG sources remain editable.

For each slug:
  SLUG.svg             authoritative source, 1440 x 960
  SLUG-original.png    rendered original, 1440 x 960
  SLUG-480.webp        responsive image, 480 x 320
  SLUG-960.webp        responsive image, 960 x 640
  SLUG-1440.webp       responsive image, 1440 x 960
  SLUG-social.jpg      social image, 1200 x 800

editorial-images.json contains merge-ready records in the site's existing
{"images": {...}} format. version is the first 12 characters of the SHA-256 of
the corresponding authoritative SVG. provenance.json contains full source and
derivative hashes, dimensions, encoder output sizes, and renderer details.

WebP quality 83/method 6; JPEG quality 86/optimized/progressive. These match the
existing site image-preparation settings. All images have opaque backgrounds.

Credit: Original editorial diagram · Seller Insider Hub

Visual review: the actual 480-pixel WebP files were viewed together in
review-contact-sheet.png on 2026-11-02. All three showed complete titles and
labels, readable hierarchy, generous margins, and no clipped/overlapping text.
The Starter panel shows exactly six numbered elements. The welcome timeline is
labeled an example schedule. The cart checklist explicitly says it is not a
workflow diagram and does not depict purchase exit/stop logic.

Integration: copy only the required responsive/social files into the site's
assets/editorial folder and merge the three metadata records. Preserve SVG,
script, and provenance according to the repository's editorial-source policy.
This drafting task did not modify the site repository.
