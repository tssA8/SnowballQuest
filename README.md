# Snowball Quest

A cozy browser platformer starring Snowball, a slightly unimpressed Siamese cat with ivory fur, soft gray markings and ice-blue eyes, based on her owner's photos. This repository implements the first vertical slice, **HOME — THE EMPTY TREAT BOX**: explore the apartment, return a tiny toy to its owner, find the balcony key, open the treat box, and follow the sunset to the flag. Later stages remain outside the initial slice.

Built with Phaser 3, TypeScript, Vite, Tiled JSON, Arcade Physics, Web Audio and localStorage. The game renders at 1280 × 720 with nearest-neighbor pixel art; the Home world is 4096 × 768. The target first-play duration is 3–5 minutes, to be confirmed through playtesting.

## Play online

[Play Snowball Quest](https://tssa8.github.io/SnowballQuest/) — no account or installation required.

[Download the Android preview APK](https://github.com/tssA8/SnowballQuest/releases/tag/v0.1.1-mobile-preview) — bundled offline game; Android 7+ with WebView 89+. iOS project and simulator build are included; installation on an iPhone requires Apple signing.

## Run locally

Android and iOS app projects are included using Capacitor, with bundled offline assets, native saves and app lifecycle handling. See [mobile build and installation](docs/MOBILE.md). GitHub builds an Android development APK and an unsigned iOS simulator app; iPhone distribution requires Apple signing.

Use Node.js 22.18 or newer so the test runner can import the small TypeScript data modules directly.

```sh
npm install
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`. The development server listens on the local network so a phone on the same network can use the computer's LAN address. Firewall and network settings must permit access.

```sh
npm test
npm run build
npm run preview
npm run assets:map
```

`build` runs the TypeScript check and creates `dist/`; `preview` serves that production build. `assets:map` regenerates `public/assets/maps/home.json` from `scripts/generate-map.mjs`. Static hosting should publish `dist/`.

## Deployment

GitHub Actions runs the existing tests, builds the game with Node.js 24, and publishes `dist/` to GitHub Pages on every push to `main`. The workflow can also be started manually from the Actions tab. The repository's Settings → Pages source must be **GitHub Actions**. Relative asset URLs support both the `/SnowballQuest/` project path and hosting at a domain root.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | A / D or ← / → | Left / Right |
| Jump | Space, held for a higher jump | Jump, held for height |
| Interact | E | Interact |
| Dash | Shift | Dash |
| Pause | Esc | Pause button |

Holding a direction builds to a gentle run. Jump buffering and coyote time make platform edges forgiving. Independent touch pointers allow movement and jumping together. Touch controls appear on touch devices; landscape is recommended, while portrait remains usable with a rotation hint. Fullscreen is optional.

## Home objectives

Learn movement near the cushion, follow the first feather, and meet the mouse courier. Bring back the plush mouse, try the scratching board, and climb the cat tower for the balcony key. The paw checkpoint provides a safe return point. Helping the mouse and scratching opens the toy box and releases one happiness star. Open the balcony and reach the flag to finish.

Optional discoveries include the cat tunnel's napping club, three feathers, 30 fish, the upper shelf star and the balcony star. The game has no combat: a mishap costs a heart and returns Snowball to the checkpoint; an exhausted cat takes a tiny nap. Later stages should be added after this slice has passed playtesting.

## Project structure

```text
public/assets/             Runtime textures, atlases and Tiled maps
references/                Supplied approved visual references, when available
scripts/                   Reproducible asset and map preparation
src/game/data/             Level parser, mission and dialogue definitions
src/game/entities/         Player motion and animation
src/game/scenes/           Loading, menu, Home and result flow
src/game/systems/          Input, objectives, saving and audio
src/game/ui/               HUD, panels and touch controls
src/game/world/            Room composition and collision construction
tests/                     Data, progress and map checks
docs/ASSET_STATUS.md        Intake measurements and production-readiness report
docs/LEVEL_FORMAT.md        Tiled conventions and the authored route
docs/TODO.md                Remaining art, validation and later stages
```

## Assets

Snowball retains the original player design's round face, compact body and poses. Only the coat and markings use the owner's photo-derived palette. See [the character reference notes](docs/SNOWBALL_IDENTITY.md) and [normalized animation sheet](resources/art/snowball-contact-sheet.png).

The twelve supplied artwork groups define the approved direction. Presentation sheets are treated as **reference-only** unless they can be extracted reliably; printed dimensions are not trusted as atlas coordinates. The first runtime pack uses original generated placeholders with consistent dimensions, transparent sprite backgrounds and stable bottom-center anchors. These interfaces allow production artwork to be replaced without changing game logic. See `docs/ASSET_STATUS.md` for the actual intake inventory and extraction decisions.

Do not slice arbitrary regions from an irregular reference sheet or scale character frames by fractional factors. Keep 64 × 64 player cells, identical foot baselines, integer coordinates and 32 × 32 gameplay tiles. Runtime textures and collision bodies are independent.

## Extending the game

To add a level, create another Tiled JSON map using the required layers and properties documented in `docs/LEVEL_FORMAT.md`, preload it as JSON and a Phaser tilemap, and call `loadLevel(scene, cacheKey)`. The parsed `LevelData` exposes collision rectangles, spawn, objects, collectibles, NPCs, triggers, checkpoints, exit and decoration arrays. Gameplay points are bottom-center anchors; collision rectangles use top-left coordinates. Give every object a stable unique name because it becomes its persistent save ID.

To add an NPC, place a point in the `NPC` layer with a supported `type` and `dialogueId`. Add its short dialogue to the dialogue data and register any new behavior in the interaction system. Keep quest flags in mission data instead of embedding objective labels in the HUD. Home mission definitions live in `src/game/data/missions.ts`; `MissionSystem` emits `mission-updated` and `mission-completed` events.

To add a collectible of an existing type, add a named point to `Collectibles` and update the map totals. Supported Home items are fish, feathers, stars, key and heart. The toy box's `star-box` is a generated reward and must not also appear as a placed star. A new collectible type needs a runtime texture and a collection handler that writes its unique ID once and emits the appropriate game event.

To add an animation, export equally sized frames with a stable foot baseline, register a Phaser animation such as `snowball-walk`, and map the state in `Player`. The player supports idle, walk, run, jump, fall, landing, dash, interaction, sit, sleep, celebration, victory and stumble. Jump can use the `snowball-jump-rise` animation alias. Keep animation changes independent of the player's smaller 30 × 42 physics body.

## Saving

Progress uses the browser's `snowball-quest-save-v1` localStorage entry. It is local to that browser and origin. Version 1 contains:

```ts
{
  version: 1,
  currentStage: 'home',
  unlockedStages: ['home'],
  stages: {
    home: { completed, fish, stars, secrets, bestTime? }
  },
  settings: { music, sfx, reducedMotion },
  run: {
    checkpoint: { x, y, id },
    collected: ['fish-01', 'star-box'],
    flags: { 'key-found': true },
    hearts: 5,
    elapsed: 0
  }
}
```

Time values are milliseconds. Collected IDs are deduplicated; unknown versions reset to safe defaults, and malformed fields are sanitized. If storage is unavailable, the game continues with an in-memory save. Replay clears the current run while preserving settings and best stage results. Stage results retain the largest collectible totals and shortest completed time; later stages remain locked until implemented.

## Verification status

`npm test` passes 26 map, save, native-storage and player-controller checks. The production build, Edge quest integration, actual keyboard platform routes, mobile touch/rotation emulation and production-preview smoke test have passed. See `docs/VERIFICATION.md` for evidence, reproducible browser-test commands and the limits of these checks. Human playtesting remains necessary to tune feel and the 3–5 minute target.

Real iPhone Safari and Android Chrome checks are tracked in `docs/TODO.md`. Desktop touch emulation can exercise pointer logic but does not replace testing on physical devices. Do not mark the complete MVP accepted until the remaining browser and mobile checks have passed.
