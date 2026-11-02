# Seller Insider Hub editorial image standards

## Scope and purpose

This release replaces all 14 CSS tutorial-cover designs. The previous system appeared six times on the homepage and 14 times on the tutorial collection. The replacement assets also introduce each corresponding tutorial and provide its article-specific sharing image. The approved boxed-S identity remains the publication's logo.

The covers are AI-generated editorial illustrations, styled as restrained photographic still lifes. They introduce the work described in a tutorial. They do not document a product test, a real customer's activity, a vendor interface, or a seller's actual product photograph. Visible collection credits and article captions identify their origin.

## Research and decisions

1. **Choose imagery that identifies the work.** Nielsen Norman Group's eye-tracking research distinguishes useful, information-carrying images from decorative filler. Each cover therefore begins with a concrete subject in the actual article: a cotton drawstring pouch, a printable planning sheet, a painting inquiry, or a stationery packing station. A polished but unrelated picture does not pass review.
   Source: https://www.nngroup.com/articles/photos-as-web-content/

2. **Keep copy readable and separate from the picture.** W3C explains the advantages of actual text over text embedded in images. Article titles remain in HTML, and the new covers contain no miniature headlines, promotional stamps, paragraphs, or fictional software labels.
   Source: https://www.w3.org/WAI/tutorials/images/textual/

3. **Make the article's own image discoverable.** Google recommends standard image elements, representative high-resolution artwork, useful context, and descriptive metadata. The implementation uses `picture`/`img`, descriptive filenames, a JPEG fallback, and a unique image in each covered article's Open Graph, Twitter, WebPage and Article metadata. A cover's presence does not guarantee indexing, rich results, or traffic.
   Source: https://developers.google.com/search/docs/appearance/google-images

4. **Design the crop and loading behavior.** Responsive image candidates, intrinsic dimensions, proportional layout and explicit focal positions support different screens. The lead cover loads eagerly; lower cards load lazily. Side images use landscape or square frames rather than narrow portrait strips.
   Source: https://web.dev/learn/design/responsive-images

5. **Separate illustration from instructional evidence.** WIRED's ChatGPT Agent article credits its conceptual cover as a photo-illustration. The Verge's Gemini guide separately identifies screenshots used for steps. Seller Insider Hub retains its credited vendor screenshots and deterministic sales chart for teaching; image generation supplies no replacement software screens or numerical evidence.
   Sources: https://www.wired.com/story/openai-chatgpt-agent-launch/ and https://www.theverge.com/24305656/gemini-google-assistant-android-how-to

6. **Match accessibility text to the role.** A cover beside a linked article title is decorative and uses empty alt text. The article's introductory figure has a concise description of the actual subject and an explicit image credit.
   Source: https://www.w3.org/WAI/tutorials/images/

CNET was a user-specified quality benchmark, but its primary pages were blocked by robots in the research tool. No claim of a complete current CNET visual audit is made. Disney is a quality benchmark, not an artwork source, affiliation, or design template.

## Art direction

- Photograph-like material detail, controlled directional light, credible shadows and a clear focal subject.
- Forest-green, ivory and charcoal accents that work with the approved brand; natural material colors remain visible.
- Distinct scenes across topics rather than a repeated laptop-and-coffee arrangement.
- No robot mascots, glowing circuitry, floating dashboards, cartoon clay objects, confetti, fabricated ratings, or invented vendor interfaces.
- Preserve article-specific details. The Etsy example is a cotton drawstring pouch; the launch example is a downloadable project checklist, not a retail product launch.
- Inspect each result for malformed equipment, implausible object geometry, false measurements, and accidental pseudo-text. Correct or reject problematic drafts before integration.

## Asset and code contract

- Approved originals are generated with the built-in image tool. Full prompts, correction notes, review notes and original-file hashes are recorded in `EDITORIAL_IMAGE_PROMPTS.json`.
- `scripts/prepare_editorial_images.py` only resizes and encodes accepted originals. It performs no creative retouching or compositing.
- Production assets live in `assets/editorial/`: 480px, 960px and 1440px WebP candidates plus a 1200px JPEG for sharing/fallback.
- `data/editorial-images.json` maps every tutorial ID to its image, dimensions, alt description, focal position and content version.
- `scripts/editorial_images.py` renders covers, credits, article figures and contextual metadata. Missing cover mappings fail the build instead of silently creating a generic placeholder.
- The regular site build has no new runtime dependency. Pillow is needed only when preparing replacement artwork.

## Review before publication

Check all 14 subjects at useful size; inspect the desktop homepage, tutorial collection, a tutorial detail page, and phone/tablet layouts. Confirm no horizontal overflow, no hidden tutorial cards, correct image loading, and sensible crops. Run the existing site validation suite. Publish the complete asset set and verify the live pages and representative image bytes.
