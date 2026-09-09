# Home map format

`public/assets/maps/home.json` is a finite orthogonal Tiled JSON map, 128 × 24 tiles at 32 px, for a 4096 × 768 world. The camera uses a 1280 × 720 logical viewport. `scripts/generate-map.mjs` is the editable source for the initial map; run `node scripts/generate-map.mjs` after changing it. The JSON can also be opened in Tiled. Regeneration replaces hand edits to the JSON.

The map uses the required layers in this order:

| Layer | Tiled type | Purpose |
|---|---|---|
| Ground | tilelayer | Floor, first global tile ID 1 |
| Platforms | tilelayer | One-way shelves, global tile ID 2 |
| DecorBack | objectgroup | Furniture behind characters |
| DecorFront | objectgroup | Rugs and foreground details |
| Collision | objectgroup, hidden | Explicit physics rectangles |
| Objects | objectgroup | Toys, tunnel entrances, treat box, door |
| Spawn | objectgroup | Player spawn |
| Collectibles | objectgroup | Fish, feathers, key, two placed stars, heart |
| NPC | objectgroup | Mouse courier, robot vacuum, sleepy cat |
| Triggers | objectgroup | Signs and secret zone |
| Checkpoints | objectgroup | Paw checkpoint |
| Exit | objectgroup | Stage flag and next-stage metadata |

The tileset is `../tiles/world.png`. Only its first two 32 × 32 cells are needed here. Runtime art can replace it without changing collision dimensions.

## Coordinates and stable IDs

Gameplay and decoration objects are Tiled **points**. Their `x, y` represent the bottom-center anchor, matching `sprite.setOrigin(0.5, 1)`. Custom `width` and `height` properties optionally describe an interaction zone. Collision objects are ordinary Tiled rectangles and use **top-left** `x, y` plus native width and height.

Every object's `name` is its stable string ID, used for collected items, interactions and saved checkpoint state. Tiled numeric IDs are preserved as `tiledId` but must not be used as persistent progress keys. Do not rename an object after shipping unless save migration also updates its key.

Custom Tiled properties are flattened into `object.properties`, a `Record<string, string | number | boolean>`. A toy box lists its prerequisites as the comma-separated property `requires`; tunnel entrances specify `targetX`, `targetY` and the linked `targetId`. Vacuum patrol limits are `patrolMin` and `patrolMax`. The map's top-level properties declare totals and stage title. The third star has the stable reward ID `star-box` and is created by the treat-box interaction, so there are exactly two star objects in the map plus that reward.

## Loader API

Preload with `scene.load.json('home-map', 'assets/maps/home.json')`, then call `loadLevel(scene)` from `src/game/data/level.ts`. It returns world dimensions in pixels, `spawn`, `platforms`, and arrays `objects`, `collectibles`, `npcs`, `triggers`, `checkpoints`, `exits`, `decorBack`, and `decorFront`. `parseTiledMap(raw)` also works without Phaser for validation or tooling. Invalid required layers and malformed numeric coordinates throw clear errors.

Every platform includes `kind: 'ground' | 'platform'` and `oneWay`; use its authored physics rectangle independently of the decorative texture. The one-way shelves are entered from below and landed on from above.

## Playable route

Snowball starts on the cushion at `(160, 640)`. Ground height is 640. Nearby fish lead to the 576-high jump lesson shelf and its pink feather. A second shelf at 512 encourages exploration, while the yarn balls and mouse courier remain on the safe ground route. The plush toy at x1220 can be brought back to the mouse at x1120. The robot vacuum patrols only x1296–1472; its slow speed and clear run-up allow a forgiving jump. The scratching board at x1520 sits beyond it.

The key route rises in four short 64 px steps at x1568, 1664, 1760 and 1856, with respective top heights 576, 512, 448 and 384. The key floats above the broad final landing. With initial upward speed 420 and gravity 900, maximum rise is 98 px; each ledge is reachable with a held jump and the horizontal overlap accommodates modest movement speed. Short-tapping is deliberately not enough for every elevated collectible.

After the tower, the checkpoint at x2176 restores a safe ground start. The treat box at x2352 rewards the completed mouse delivery and scratching interaction with `star-box`. A 96 px floor gap at x2496–2592 introduces one forgiving jump after that checkpoint. The second star waits on an optional 576 → 512 → 448 shelf route at x2592–3040. A flower stand adds one final optional jump before the balcony. The locked balcony door is at x3500, the last star at x3720, and the flag at x3904. The door requires flags `key-found`, `box-open` and `mouse-helped`; the exit requires `balcony-open`.

The cat tunnel at `(664, 640)` reaches the hidden napping club at `(760, 384)`, a broad safe shelf with two fish, the purple feather and a sleepy cat. Its matching return tunnel brings Snowball back to `(704, 640)`. The nook can also be left by jumping down. Secret IDs are `secret-nook`, `secret-feather`, and `high-shelf`.

Totals are 30 fish, 3 feathers, 3 stars (including the box reward), 3 secrets, 2 yarn balls, 1 plush mouse, 1 bell ball, 1 feather wand, 1 scratching board, 1 toy box and a two-entrance tunnel. All mandatory objectives are reachable without finding the secret nook or collecting every fish.

## Adding content

Add a point object in the appropriate layer, give it a stable name and supported `type`, and set its bottom-center world position. Dialogue uses a `dialogueId` property instead of text embedded in NPC code. Add a tile platform and a matching Collision rectangle when extending the route. Keep mandatory vertical rises at or below 64–80 px unless the movement tuning changes. Update totals when adding collectibles, and keep the stage flag beyond the authored door. Future maps can reuse the same loader and entity systems.
