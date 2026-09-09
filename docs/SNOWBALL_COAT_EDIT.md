# Original design, Snowball's coat

The owner asked to use the original player concept's body, face, proportions, expressions and poses, changing only its coat to the previous Snowball colors. Built-in **ImageGen** was used for the color edit; no API/CLI fallback was used.

## Saved assets

- `resources/art/snowball-coat-sheet.png`: the ImageGen RGB edit, 1536 × 1024.
- `resources/art/snowball-runtime.png`: the 44-frame transparent game master, 2816 × 64.
- `resources/art/snowball-contact-sheet.png`: enlarged frame review.
- `resources/art/snowball-frames.json`: measured pose selections and normalization parameters.
- `resources/art/snowball-normalization.json`: actual source bounds and final frame placement.

ImageGen preserved the presentation layout but slightly smoothed some outlines, so its RGB output alone is not a pixel-identical recolor. The runtime packing reuses the **original reference's alpha silhouettes**, separates touching poses with alpha-160 seeds and alpha-96 growth, then samples at one uniform scale of 0.48. Transparent pixels contain no presentation background, labels or neighboring sprites. No character anatomy is drawn by the packer. Existing numeric animation frames, foot anchors and collision bodies remain intact.

## Exact ImageGen prompt

Image 1 was `references/01-player.png`. Image 2 was the previous procedural `public/assets/player/snowball.png` at revision `372ea8a`, used for colors only.

```text
Use case: precise-object-edit.
Asset type: Snowball Quest player sprite-sheet presentation; a strict fur recolor of an existing image, not a redesign.
Input image 1 (references/01-player.png) is the EDIT TARGET and sole authority for every shape, size, pose, composition, layout, text and style. Input image 2 (public/assets/player/snowball.png) is ONLY supporting input for the previous Snowball COAT COLORS and localized markings; absolutely do NOT copy its body, silhouette, eyes or drawing style.
Primary request: keep the original cute, plump, short-legged kitten and EVERY existing sprite and expression exactly as they are in image 1. Change ONLY fur colors and localized facial fur markings across every cat pose and face icon to Snowball's established coat.
Specific color edits: ivory cream body #ebe5d8 with soft gray-beige back shading #cec6b9; pale face with white muzzle and chin #faf5e9; light gray-beige ear edges and points #b2a79b. Replace broad brown face coloring with a pale face and a LOCALIZED soft gray nose bridge. Add only subtle narrow muted gray forehead marks forming a loose M and a few short delicate cheek marks #988d83. Keep the tail muted light gray-beige and simple, without strong rings or a black tip. Keep the original pink inner ears. Existing open eyes become pale ice blue #a8cbd9 with #d5e7eb highlights, without changing their original small size, shapes, pupil shapes, position or expressions. Keep closed/sleeping/squinting eyes exactly closed/sleeping/squinting. Preserve tiny nose and mouth geometry.
Invariants: exact same large round head, round cheek fluff, short muzzle, plump belly, small round paws, short legs, original body proportions and outer contour pixel placement; every pose remains exactly the same; exact original animation layout, spacing, sprite counts and framing; retain every original logo, all text, labels, numbers and typography verbatim in their current positions; retain every cape, crown, toy, yarn ball, shadow, paw print, music note, sparkle, heart, sleep Z and motion effect unchanged; retain original pixel-art rendering, outlines and pixel detail. Retain the existing background and alpha exactly as provided; do not add any new background or checkerboard.
Avoid: NO restyling, no anatomy changes, no enlargement of eyes, no long muzzle or legs, no angular head, no broad dark facial mask, no black tabby stripes, no large body patches, no new accessories or extra sprites, no removed sprites, no rearranged rows.
The result must be immediately recognizable as the EXACT original design with only Snowball's lighter cream and gray markings replacing its coat, consistently on all poses.
```
