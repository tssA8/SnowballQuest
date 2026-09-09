# Snowball's appearance and reference roles

The owner's latest instruction sets two separate sources of truth: **`references/01-player.png` defines Snowball's shape, proportions, face, expressions and poses; the previous photo-derived palette defines only her coat and markings.** Preserve the concept sheet's round chibi body, short legs, face and outlined pixel-art style. Do not reshape the character to match photographic anatomy or the earlier procedural placeholder.

Seven owner-provided photographs (`1.jpg` through `7.jpg`) were inspected locally on 2026-09-09. The owner identifies Snowball as a Siamese cat. Her individual markings take precedence over generic breed color descriptions, including the earlier dark-mask correction.

## Coat features to preserve

- Ivory/cream fur with soft gray-beige shading along the back.
- A pale face, white muzzle and chin, and a localized gray nose bridge. The face is not a solid dark brown mask.
- Narrow gray forehead markings forming a loose M, with subtle short marks beside the eyes and cheeks. These are visible features of Snowball herself.
- Pale ice-blue eye color, dark gray-brown eye rims and a dark nose, retaining the concept's facial shapes and placement.
- Pink inner ears, light gray ear edges and pale paws with restrained gray shading.

## Reference roles

| Photo | Main use | Limits |
|---|---|---|
| 1 | Face and forepaw coloring | Warm indoor lighting |
| 2 | Muzzle and forepaw coloring | Warm indoor lighting |
| 3 | Body coat transitions | Foreshortening; tail partly obscured; not a proportion reference |
| 4 | Primary coat and facial-marking reference | Best overall reference in this set |
| 5 | Back coloring | Backlighting darkens the face; not a silhouette reference |
| 6 | Forehead marks | Dim lighting |
| 7 | Eye color, nose bridge and fine face markings | Close-up perspective |

The complete tail pattern is not clear in this set. Keep a simple muted gray tail; do not invent strong rings or a black tip. Changes in lighting across photos are not different coat patterns.

## Game-art contract

The built-in ImageGen edit is stored at `resources/art/snowball-coat-sheet.png`. It supplies RGB coat colors at the original sheet's 1536 × 1024 positions. `scripts/normalize-snowball.mjs` takes silhouettes and alpha from the unmodified `references/01-player.png`, identifies components with alpha-160 seeds grown into alpha-96 edges, and uses measured pose selections in `resources/art/snowball-frames.json`. This separates neighboring poses whose presentation rectangles overlap.

All selected poses use the same 0.48 source-to-runtime scale and are packed into `resources/art/snowball-runtime.png`: 44 frames of 64 × 64 pixels, preserving the animation indices and bottom-center anchor. The final sheet is 2816 × 64. Grounded poses share the foot baseline at the bottom of each cell; player collision dimensions remain independent of the artwork. `resources/art/snowball-contact-sheet.png` provides a readable frame review.

`scripts/export-assets.mjs` imports this curated runtime master. Re-exporting world assets or native icons therefore preserves the selected character instead of restoring the legacy drawing from `Textures.ts`.

The player, menu, HUD, Snowball's dialogue/result portraits and native app icons use the same normalized artwork. The sleeping neighbor remains a separate character. Run `npm run assets:player` after changing the color source or measured frame configuration; it normalizes the player and refreshes the public assets and native icons. `npm run assets:export` imports the current curated master when exporting the remaining art. Manifest version 4 identifies this replacement in publicly cached image URLs.

The source photographs remain local references outside the repository. The preserved concept reference, its coat edit, measured normalization configuration and resulting game artwork are the reproducible art sources in the project.
