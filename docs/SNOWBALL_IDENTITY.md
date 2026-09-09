# Snowball's photo reference

Seven owner-provided photographs (`1.jpg` through `7.jpg`) were inspected locally on 2026-09-09. The owner identifies Snowball as a Siamese cat. Her individual markings in these photos take precedence over generic breed descriptions and earlier concept sheets.

## Features to preserve

- An ivory/cream body with soft gray-beige shading along the back; a rounded, plush silhouette.
- A pale face, white muzzle and chin, and a localized gray nose bridge. The face is not a solid dark brown mask.
- Narrow gray forehead markings forming a loose M, with subtle short marks beside the eyes and cheeks. These are visible features of Snowball herself.
- Large, round, pale ice-blue eyes, dark gray-brown eye rims, and a small dark triangular nose.
- Upright ears with pink interiors and light gray edges, plus pale round paws with restrained gray shading.
- A calm, sometimes unimpressed expression and relaxed forepaws when resting on an edge.

## Reference roles

| Photo | Main use | Limits |
|---|---|---|
| 1 | Unimpressed expression, hanging forepaws | Warm indoor lighting |
| 2 | Three-quarter face, rounded muzzle and forepaws | Warm indoor lighting |
| 3 | Standing/walking body proportions | Foreshortening; tail partly obscured |
| 4 | Primary face, coat and eye-size reference | Best overall reference in this set |
| 5 | Sitting silhouette and back | Backlighting darkens the face |
| 6 | Relaxed resting posture and forehead marks | Dim lighting |
| 7 | Eye color, nose bridge and fine face markings | Close-up perspective |

The complete tail pattern is not clear in this set. Keep a simple muted gray tail; do not invent strong rings or a black tip. Changes in lighting across photos are not different coat patterns.

## Game-art contract

`src/game/art/Textures.ts` defines `SNOWBALL_COAT` and the editable pixel drawing. Preserve 44 frames of 64 × 64 pixels, animation indices, and the bottom-center anchor. Round paws keep the grounded baseline at the bottom of each cell. Player collision dimensions are independent of the artwork.

The player, menu, HUD and Snowball's dialogue/result portraits use the same exported sheet. The sleeping neighbor remains a separate character. Run `npm run assets:export` after edits and advance the manifest version when replacing publicly cached images.

The source photographs remain local references. Only the recreated pixel art and these descriptive notes are included in the repository and published game.
