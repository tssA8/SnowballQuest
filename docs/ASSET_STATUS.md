# Asset inventory and production status

Intake date: 2026-09-09. Read against the complete `SNOWBALL_QUEST_HANDOFF.md`, including sections 64–76.

**All 14 supplied PNGs were measured and visually inspected.** They cover the 12 approved groups, an overview, and an alternate background sheet. Every source is **1536 × 1024 actual pixels**. None is being loaded as a production atlas or flattened gameplay background.

The source folder is `D:\project\sideproject\snowballquest`. Originals were copied without modification into `references/`. `references/inventory.json` records the original filenames, normalized filenames, dimensions, and SHA-256 hashes.

## Supplied artwork

All original names below have the prefix `ChatGPT Image 2026年9月9日 上午` and suffix `.png`.

| Group | Original time | Preserved reference | Actual size | Status and reason |
|---|---|---|---|---|
| Overview | 11_13_14 | `00-overview.png` | 1536 × 1024 | Reference only. Mixed categories, headings, checkerboard pattern, previews and variable scale. |
| 01 Player | 11_13_21 | `01-player.png` | 1536 × 1024 | Reference only. Irregular rows, variable visible character size, nontransparent backdrop, printed frame counts inconsistent with visible layouts. No trustworthy 48/64 px grid or shared baseline. |
| 02 Toys | 11_13_27 | `02-toys.png` | 1536 × 1024 | Reference only. Different prop sizes, large heading, labels, blended backdrop. |
| 03 NPCs | 11_13_44 | `03-npcs.png` | 1536 × 1024 | Reference only. Card layout mixes portraits and sprites; colored card backgrounds remain behind figures. |
| 04 Tileset | 11_13_32 | `04-tileset.png` | 1536 × 1024 | Reference only. Tiles separated by display spacing and category cards; claimed 32 px grid does not describe the actual sheet. |
| 05 Home props | 11_13_50 | `05-home-props.png` | 1536 × 1024 | Reference only. Furniture has variable size, tan presentation backdrop and a combined room preview. |
| 06 Background | 11_13_55 | `06-background.png` | 1536 × 1024 | Reference only. Five compressed strips include labels, frame borders and right-side seam previews. Printed 1920 × 410 sizes exceed the actual sheet width. Each strip also contains other depth layers. |
| 06 Background alternate | 11_13_38 | `06-background-alternate.png` | 1536 × 1024 | Reference only. Printed 1920 × 1080 labels, composited depth planes, in-art seam markers and borders; not five independent transparent layers. |
| 07 Collectibles | 11_14_00 | `07-collectibles.png` | 1536 × 1024 | Reference only. Item/animation cells have irregular spacing and colored backgrounds; no safe common atlas grid. |
| 08 VFX | 11_14_05 | `08-vfx.png` | 1536 × 1024 | Reference only. Glow/background pixels, captions, uneven effect footprints, numbered previews. |
| 09 UI | 11_14_10 | `09-ui.png` | 1536 × 1024 | Reference only. Full example panels with baked text; build responsive UI components separately. The reference Game Over panel is excluded by the handoff's no-death requirement. |
| 10 Title / map | 11_14_16 | `10-title-map.png` | 1536 × 1024 | Reference only. Multiple composed screen previews, not separate title/map assets. Expansion locations are not MVP scope. |
| 11 Mobile | 11_14_21 | `11-mobile-controls.png` | 1536 × 1024 | Reference only. Labeled state cards and composite mobile screenshots; real controls need distinct large multitouch hit areas. |
| 12 Ending | 11_14_27 | `12-ending.png` | 1536 × 1024 | Reference only. Scene cards, captions and miniature animation rows. Full campaign ending remains later scope. |

No crop coordinates were invented. A PNG's alpha-capable format alone does not establish that a displayed backdrop is transparent. Visually, all sheets include presentation backgrounds in the asset regions. Recovery of the final approved production artwork requires isolated exports or careful normalization in a later art pass.

## Playable placeholder artwork

`src/game/art/Textures.ts` creates **original code-drawn pixel textures**, using the references for the cream/gray cat, coral furnishings, moss plants, outlined collectibles, and warm city palette. These are deliberate, correctly sized placeholders; they are not claimed to be extracted approved production sprites.

The drawing layer uses integer rectangle fills, scanline ellipses/polygons and pixel lines. No image smoothing, source-image slicing, external font raster dependency, or generated all-in-one background is used. The exporter creates PNG files; the game loads those files through `src/game/art/AssetLoader.ts`. `registerAnimations` registers shared Snowball animations once.

| Runtime key / group | Dimensions | Ready | Replacement interface |
|---|---|---|---|
| `snowball` | 44 frames, each 64 × 64; sheet 2816 × 64 | Placeholder | `player/snowball.png` + `player/snowball.json`; bottom-center origin and fixed foot baseline |
| `world` | 64 × 32; two 32 × 32 tiles | Placeholder | `tiles/world.png`; first cell floor, second cell interior platform; Tiled IDs 1 and 2 |
| `fish`, `star`, `key`, `heart`, `crown` | 32 × 32 each | Placeholder | Individual item PNGs and `items/collectibles.png` + `.json` |
| `feather`, `yarn`, `bell-ball`, `plush` | 32 × 32 each | Placeholder | Individual toy PNGs and `toys/cat-toys.png` + `.json` |
| `wand` | 64 × 128 | Placeholder | `toys/wand.png` |
| `spring` | 48 × 48 | Placeholder | `toys/spring.png` |
| `toy-box`, `scratch`, `tunnel` | 96 × 64 each | Placeholder | Individual toy PNGs and toy atlas |
| `mouse`, `sleepy-cat`, `vacuum` | 48 × 48, 64 × 64, 64 × 32 | Placeholder | `npcs/npcs.png` + `.json`; individual PNGs also available |
| `sofa`, `window` | 288 × 160, 320 × 288 | Placeholder | `props/home-props.png` + `.json`; individual PNGs |
| `cat-tree`, `shelf`, `lamp` | 160 × 288, 128 × 224, 96 × 224 | Placeholder | Props atlas and individual PNGs |
| `plant`, `cushion`, `rug`, `books` | 96 × 128, 128 × 48, 256 × 64, 80 × 64 | Placeholder | Props atlas and individual PNGs |
| `door`, `checkpoint`, `flag`, `treat-box` | 128 × 224, 64 × 128, 64 × 128, 96 × 64 | Placeholder | Props atlas and individual PNGs |
| `sky`, `far-city`, `mid-buildings`, `near-houses` | 1024 × 720 each | Placeholder | Independent `backgrounds/home/*.png` layers; horizontal pixel wrapping |
| `foreground` | 1024 × 128 | Placeholder | Independent `backgrounds/home/foreground.png`; horizontal pixel wrapping |
| `sparkle`, `paw` | 16 × 16, 32 × 32 | Placeholder | `fx/effects.png` + `.json` and individual PNGs |
| UI, title, mobile buttons | Scene / UI code | Code interface | Separate responsive drawing and hit targets, preserving approved palette |
| Full ending and later-stage assets | — | Deferred | Preserve references; do not expand beyond Home before acceptance |

Runtime texture names and sizes are exported as `TEXTURE_SIZES`. Animation metadata is exported as `SNOWBALL_ANIMATIONS` and mirrored in `player/snowball.json`.

Animation keys: `snowball-idle`, `snowball-idle-blink`, `snowball-walk`, `snowball-run`, `snowball-jump`, `snowball-jump-start`, `snowball-jump-rise`, `snowball-jump-apex`, `snowball-fall`, `snowball-land`, `snowball-sit`, `snowball-sleep`, `snowball-interact`, `snowball-pickup`, `snowball-dash`, `snowball-celebrate`, `snowball-victory`, `snowball-stumble`, `snowball-enter-door`, `snowball-exit-door`.

The placeholder walk/run frames currently use a compact three-quarter face with moving paws and tail/body bob. They establish timing and alignment; final side-view gait and extra animation detail remain a production art task.

## Reproducible export

```sh
node scripts/export-assets.mjs
```

This exports the fill-rectangle drawing program as PNGs, six packed atlases, player frame metadata and `public/assets/manifest.json`. It uses TypeScript plus Node's standard PNG/zlib routines; it does not edit supplied imagery. Rerun the exporter after changing the drawing source to update public PNGs.

The boot pipeline calls `preloadAssets(scene)` and `finishAssets(scene)`. It loads each texture from its manifest path, loads Snowball as a 64 × 64 spritesheet with numeric frames, verifies actual image dimensions, applies nearest filtering, and registers shared animation metadata. Replacing a compatible PNG at its existing public path immediately changes the game after refresh. The runtime does not recreate procedural art over loaded PNGs or silently replace broken exports. Update the manifest alongside a deliberate size change, and preserve the independent physics-body contracts. Packed atlases are available for a future consolidated-loader optimization; the current runtime loads the individual files listed in the manifest.

Verified: all 14 source images were opened; generated player sheet, furniture atlas, NPC atlas, item atlas and sky layer were visually inspected. Generated sheets have known coordinates because the drawing/export program defines those coordinates. Their coordinates are unrelated to the presentation sheets. Production replacements should preserve runtime keys, use transparent backgrounds and integer display scale, and keep collision bodies independent of visible image dimensions.
