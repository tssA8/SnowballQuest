# SNOWBALL QUEST — Web Game Handoff Plan

> Purpose: This document is the implementation handoff for GPT-6 / Codex / another engineering agent to build a complete browser-based 2D side-scrolling pixel game from the existing visual concept.
>
> Target: A polished, lightweight, mobile-friendly web game that runs directly in modern browsers.
>
> Working title: **SNOWBALL QUEST — Fluffy Cat, Big Adventure**

---

## 1. Product Vision

Build a short, charming, story-driven 2D side-scrolling pixel game starring **Snowball**, a Siamese cat inspired by the reference photo.

The game should feel like a compact 16-bit platform adventure rather than a combat game.

Core tone:

- Cozy
- Funny
- Lighthearted
- Non-violent
- Rewarding
- Easy to learn
- Suitable for desktop and mobile
- Designed around exploration, collecting, jumping, simple environmental interaction, and reaching a happy ending

The main fantasy is:

> A slightly grumpy-looking house cat secretly believes she deserves a better day. She escapes her sleepy home, explores a tiny dream-like city, collects happiness, helps neighborhood animals, and returns home as the undisputed Queen of Good Days.

---

# 2. Main Character

## Snowball

Visual identity:

- Siamese cat with a pale cream body (owner clarification, 2026-09-09)
- Solid darker ears, a continuous face mask, paws, and tail; no tabby forehead stripes or tail rings
- Round, compact body
- Slightly unimpressed / sleepy facial expression
- Pink inner ears
- Large expressive blue eyes
- Soft retro pixel-art shading
- Clear silhouette at small sizes

Personality:

- Calm
- Slightly lazy
- Food-motivated
- Curious
- Quietly heroic
- Has a deadpan expression even when doing impressive things

The joke is that Snowball looks like she does not care, but keeps accidentally completing heroic missions.

### Character animation states

Required:

- Idle
- Idle blink
- Walk
- Run
- Jump start
- Jump rise
- Jump apex
- Fall
- Land
- Sit
- Sleep
- Interact
- Pick up item
- Celebrate
- Victory crown
- Hurt / stumble without violence
- Enter door
- Exit door

Optional later:

- Look up
- Look down
- Stretch
- Groom
- Tail flick
- Meow
- Push object
- Carry item

---

# 3. Story

## Premise

Snowball begins at home during sunset.

She discovers that her favorite treat box is empty.

A small glowing fish-shaped spirit appears and tells her:

> “A brighter tomorrow has gone missing.”

Snowball reluctantly leaves home to collect fragments of happiness scattered across the neighborhood.

Each level represents a small everyday source of happiness.

### Narrative arc

### Stage 1 — Home: "The Empty Treat Box"

Goal:

- Learn movement
- Find the missing key
- Open the balcony door
- Collect first golden fish

Theme:

- Cozy apartment
- Plants
- Cat furniture
- Evening light
- Boxes
- Cushions
- Shelves

Story beat:

Snowball realizes the last snack is gone.

---

### Stage 2 — Rooftops: "The Long Way to Dinner"

Goal:

- Cross rooftops
- Follow golden fish
- Help a mouse reach its tiny flag
- Find three happiness stars

Theme:

- Sunset rooftops
- Water tanks
- Laundry lines
- Potted plants
- Neon city skyline

Story beat:

Snowball discovers that helping someone else gives more happiness than stealing their snack.

---

### Stage 3 — Snowball Café: "Coffee, Fish, Treats, Happiness"

Goal:

- Find ingredients
- Deliver items to NPCs
- Activate café sign
- Unlock secret treat room

Theme:

- Cozy pixel café
- Wooden counters
- Chalkboards
- Hanging plants
- Dessert cabinets

Story beat:

The café reopens because Snowball gathers everything it needs.

---

### Stage 4 — Moonlight Garden: "Good Cat, Better Days"

Goal:

- Explore peaceful night garden
- Light three lanterns
- Find sleeping cat
- Collect the final happiness fragment

Theme:

- Moonlit plants
- Small pond
- Fireflies
- Lanterns
- Flowers

Story beat:

Snowball realizes "a better day" was built from small things she did along the way.

---

### Final Stage — Home Again

Snowball returns to the original home.

The empty treat box is now magically full.

A crown appears.

Final screen:

> **STAGE CLEAR**
>
> **GOOD CAT. BETTER DAYS.**

Snowball sits beside a small flag and fish bowl while the sunset turns into night.

---

# 4. How the Game Plays

The game should be easy enough for non-gamers.

## Desktop controls

- Left / Right: `A / D` or Arrow Keys
- Jump: `Space`
- Interact: `E`
- Dash: `Shift`
- Pause: `Esc`

## Mobile controls

Use transparent touch controls:

Left side:

- Left
- Right

Right side:

- Jump
- Interact
- Dash

Controls should only appear when touch input is detected.

---

# 5. Core Gameplay Loop

Player repeatedly does:

1. Explore
2. Jump between platforms
3. Collect fish and happiness stars
4. Find small secrets
5. Help harmless NPCs
6. Activate environmental objects
7. Reach checkpoint
8. Finish level
9. Unlock next area

No combat is needed.

---

# 6. Player Mechanics

## Movement

Recommended values should be tuned during implementation.

Initial target:

```ts
moveSpeed = 150
runSpeed = 220
jumpVelocity = -350
gravity = 900
dashVelocity = 340
```

Movement should feel:

- Responsive
- Slightly floaty
- Forgiving
- Friendly to mobile

Include:

- Coyote time: ~100 ms
- Jump buffer: ~120 ms
- Variable jump height
- Gentle landing squash
- Short acceleration/deceleration

---

# 7. Health / Failure Design

Avoid traditional death.

Use a five-heart HUD.

If Snowball:

- falls
- hits a harmless obstacle
- misses a moving platform
- runs into a silly hazard

She loses one heart and respawns at the last checkpoint.

At zero hearts:

Show:

> "Snowball needs a tiny nap."

Then restart from the current stage checkpoint.

No Game Over screen.

---

# 7.1 Toy Interaction System

Cat toys should be a major part of Snowball's world rather than background decoration only.

Required interactive toys for the first production asset set:

- Feather: floats slightly when approached; can be collected or blown by fans
- Feather wand: swings when Snowball touches or interacts with it
- Yarn ball: rolls using simple Arcade Physics and can trigger switches
- Plush mouse: can be carried to an NPC or toy basket
- Bell ball: rolls and plays a tiny bell sound
- Spring toy: launches Snowball slightly upward
- Cat tunnel: acts as a short hidden passage
- Scratching board: interaction triggers a short scratching animation
- Toy box: opens after a small objective and releases collectibles
- Hanging toy: swings as a decorative physics object
- Ribbon: lightweight moving environmental decoration

Toy interactions should be playful and non-violent. Several should serve gameplay purposes such as opening routes, revealing secrets, reaching collectibles, or completing tiny NPC quests.

For the Home vertical slice, include at minimum:

```text
3 feather props
1 interactive feather wand
2 yarn balls
1 plush mouse
1 bell ball
1 scratching board
1 cat tunnel
1 toy box
```

---

# 8. Collectibles

## Golden Fish

Primary collectible.

Uses:

- Score
- Unlock decorative rewards
- Optional completion tracking

Example:

`Fish x 128`

---

## Happiness Stars

Rare stage objectives.

Each stage contains:

- 3 stars

Unlocking all stars gives:

- Crown icon
- Perfect Stage badge

---

## Feathers

A secondary playful collectible. Feathers can appear in hidden or elevated locations and may gently drift or rotate before collection.

Collecting a complete feather set in a stage can unlock a small cosmetic crown sparkle or bonus fish cache.

---

## Yarn Balls

Optional secret collectible.

Used for:

- Bonus room
- Cosmetic unlock
- Secret ending gag

---

# 9. NPCs

No enemies should attack Snowball.

NPC interaction should create humor or small tasks.

Suggested NPCs:

### Mouse Courier

Carries a tiny white flag.

Task:

Help the mouse cross an obstacle.

---

### Sleepy Cat

Always asleep.

Interaction text:

> "Still sleeping."

Repeated interaction:

> "Very committed."

---

### Café Cat

Runs Snowball Café.

Gives fetch quests.

---

### Pigeon

Blocks a route until Snowball rings a bell.

---

### Hamster

Pushes a tiny cart.

Can reveal hidden areas.

---

# 10. Harmless Obstacles

Examples:

- Rolling yarn balls
- Roomba
- Closing cupboard doors
- Moving boxes
- Water dripping from pipe
- Sliding cushions
- Pigeons landing suddenly
- Toy spring
- Fan wind
- Moving café trolley

Obstacles should be funny rather than threatening.

---

# 11. Level Structure

Use horizontal side-scrolling maps.

Recommended stage size:

```text
Viewport:
1280 x 720 logical resolution

Tile:
32 x 32

Typical level:
120–220 tiles wide
22–30 tiles tall
```

Camera:

- Follow player horizontally
- Light vertical follow
- Camera dead zone
- Smooth lerp
- Clamp to map bounds

---

# 12. Art Direction

Style:

- Detailed 16-bit pixel art
- Warm pastel palette
- Crisp nearest-neighbor rendering
- No smoothing
- Consistent pixel density
- Cozy sunset / nighttime lighting

Primary palette:

- Cream
- Warm beige
- Dusty pink
- Muted coral
- Dark navy
- Soft lavender
- Moss green
- Golden yellow

Avoid:

- Highly saturated neon
- Photorealism
- Strong gradients that break pixel-art style

---

# 13. Required Asset Pack

The existing concept sheet is not yet production-ready.

GPT-6 should assume the final game needs these assets exported separately.

## A. Player Sprite Sheet

File:

```text
assets/sprites/snowball.png
```

Metadata:

```text
assets/sprites/snowball.json
```

Recommended sprite cell:

```text
64 x 64
```

Every frame must:

- use identical canvas size
- use identical foot baseline
- use identical pivot point
- avoid labels
- use transparent background

Animations:

```text
idle
idle-blink
walk
run
jump-start
jump-rise
jump-apex
fall
land
sit
sleep
interact
pickup
dash
celebrate
victory
stumble
```

---

## B. NPC Sprite Sheet

```text
assets/sprites/npcs.png
```

NPCs:

- Mouse
- Café cat
- Orange cat
- Glasses cat
- Pigeon
- Hamster
- Sleeping cat

Each should have:

- Idle
- Walk if required
- Interaction animation

---

## C. Tile Set

```text
assets/tiles/world.png
```

Recommended:

```text
32 x 32 tiles
```

Must include:

- Solid floor
- Grass floor
- Brick
- Wood
- Interior platform
- Rooftop platform
- Edge tiles
- Corners
- Inner corners
- Outer corners
- Floating platform
- Wall
- Ceiling
- Stairs
- Ladder
- One-way platform
- Decorative variants

---

## D. Props

```text
assets/props/props.png
```

Examples:

- Plant pots
- Lamps
- Bench
- Crates
- Barrels
- Doors
- Windows
- Ladder
- Cat tree
- Cushions
- Boxes
- Café furniture
- Flags
- Signs
- Lanterns
- Shelves
- Loose feathers in several shapes/colors
- Feather teaser / feather wand
- Hanging feather toy
- Feather bundle collectible prop
- Cat fishing-rod toy
- Plush mouse toy
- Small fish plush
- Yarn balls in multiple sizes
- Bell ball
- Jingle ball
- Crinkle ball
- Spring toy
- Cat tunnel
- Cardboard scratching board
- Cat kicker toy
- Wand toy
- Ribbon toy
- Laser-dot visual prop (non-harmful chase interaction)
- Small toy basket
- Toy box with open/closed states
- Rolling toy ball
- Dangling string toy
- Paw-shaped cushion

---

## E. Collectibles

```text
assets/items/items.png
```

Include:

- Golden fish
- Happiness star
- Yarn ball
- Heart
- Key
- Treasure chest
- Food bowl
- Milk
- Bell
- Diamond bonus

---

## F. Visual Effects

```text
assets/fx/fx.png
```

Animations:

- Jump dust
- Dash trail
- Sparkle
- Heart pop
- Collect glow
- Level-up glow
- Crown glow
- Checkpoint activation
- Stage clear burst

---

## G. UI

```text
assets/ui/ui.png
```

Required:

- Hearts
- Empty heart
- Fish icon
- Star icon
- Yarn icon
- Crown
- Buttons
- Pause panel
- Dialogue frame
- Mission panel
- Stage clear frame

Buttons need:

- Default
- Hover
- Pressed
- Disabled
- Selected

---

# 14. Background Layers

Backgrounds must be separate seamless layers.

Never render the entire scene into one giant background.

For each stage:

```text
sky.png
far.png
mid.png
near.png
foreground.png
```

Example:

```text
assets/backgrounds/home/
assets/backgrounds/rooftop/
assets/backgrounds/cafe/
assets/backgrounds/garden/
```

---

# 15. Parallax System

Example speed ratios:

```ts
sky: 0.05
far: 0.15
mid: 0.35
near: 0.60
foreground: 1.10
```

Use seamless horizontal repetition.

Example:

```ts
layer.tilePositionX = camera.scrollX * ratio
```

Foreground may move slightly faster than player camera for depth.

---

# 16. Web Technology Recommendation

Use:

## Phaser 3 + TypeScript + Vite

Recommended stack:

```text
Vite
TypeScript
Phaser 3
Tiled Map Editor
JSON
WebAudio
LocalStorage
```

Do not use React for gameplay rendering.

React can be added only if a surrounding website or account interface is needed.

Phaser should own:

- Canvas
- Input
- Physics
- Animation
- Scene system
- Camera
- Audio
- Tilemaps

---

# 17. Project Structure

```text
snowball-quest/
│
├─ public/
│  └─ assets/
│     ├─ sprites/
│     ├─ tiles/
│     ├─ props/
│     ├─ items/
│     ├─ fx/
│     ├─ ui/
│     ├─ audio/
│     ├─ backgrounds/
│     └─ maps/
│
├─ src/
│  ├─ main.ts
│  │
│  ├─ game/
│  │  ├─ config.ts
│  │  │
│  │  ├─ scenes/
│  │  │  ├─ BootScene.ts
│  │  │  ├─ PreloadScene.ts
│  │  │  ├─ MenuScene.ts
│  │  │  ├─ HomeScene.ts
│  │  │  ├─ RooftopScene.ts
│  │  │  ├─ CafeScene.ts
│  │  │  ├─ GardenScene.ts
│  │  │  └─ EndingScene.ts
│  │  │
│  │  ├─ entities/
│  │  │  ├─ Player.ts
│  │  │  ├─ NPC.ts
│  │  │  ├─ Collectible.ts
│  │  │  └─ Checkpoint.ts
│  │  │
│  │  ├─ systems/
│  │  │  ├─ InputSystem.ts
│  │  │  ├─ DialogueSystem.ts
│  │  │  ├─ MissionSystem.ts
│  │  │  ├─ SaveSystem.ts
│  │  │  ├─ AudioSystem.ts
│  │  │  └─ ParallaxSystem.ts
│  │  │
│  │  ├─ ui/
│  │  │  ├─ HUD.ts
│  │  │  ├─ PauseMenu.ts
│  │  │  ├─ DialogueBox.ts
│  │  │  └─ MobileControls.ts
│  │  │
│  │  └─ data/
│  │     ├─ stages.ts
│  │     ├─ dialogue.ts
│  │     └─ missions.ts
│  │
│  └─ styles.css
│
├─ index.html
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

---

# 18. Phaser Configuration

Suggested baseline:

```ts
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,

  pixelArt: true,
  roundPixels: true,

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },

  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 900 },
      debug: false
    }
  }
}
```

CSS:

```css
canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
```

---

# 19. Player Architecture

Create a dedicated `Player` class.

Example responsibility:

```text
Player
 ├ movement
 ├ animation
 ├ health
 ├ interactions
 ├ checkpoint
 ├ collectibles
 └ state machine
```

Avoid scattering player logic across scenes.

---

# 20. Player State Machine

Use states:

```ts
enum PlayerState {
  Idle,
  Walk,
  Run,
  Jump,
  Fall,
  Land,
  Dash,
  Interact,
  Sleep,
  Stumble
}
```

State transitions should control animation and motion.

---

# 21. Tile Maps

Use **Tiled Map Editor**.

Each stage should use:

```text
Ground
Platforms
DecorBack
DecorFront
Collision
Objects
Spawn
Collectibles
NPC
Triggers
Checkpoints
Exit
```

Collision layer should be hidden during runtime.

Map format:

```text
JSON
```

---

# 22. Object Layer Convention

Example custom properties:

```json
{
  "type": "npc",
  "name": "mouse_01",
  "dialogueId": "mouse_intro"
}
```

Checkpoint:

```json
{
  "type": "checkpoint",
  "id": "cp_02"
}
```

Exit:

```json
{
  "type": "stageExit",
  "nextStage": "cafe"
}
```

---

# 23. Mission System

Data-driven.

Example:

```ts
{
  id: 'collect_fish',
  label: 'Collect 10 golden fish',
  target: 10,
  type: 'collect'
}
```

HUD:

```text
MISSION

✓ Find the key
✓ Help the mouse
□ Collect 10 fish
```

Mission system should emit events.

Do not hardcode mission UI into level scenes.

---

# 24. Dialogue System

Dialogue should be short and humorous.

Example:

Mouse:

> "I have a flag."

Snowball:

> "..."

Mouse:

> "That means I have a mission."

Snowball:

> "..."

Mouse:

> "Please stop judging me."

Dialogue data:

```ts
dialogue['mouse_intro']
```

rather than inline strings.

---

# 25. Stage Clear System

Condition:

- Main objective complete
- Player reaches exit

Sequence:

1. Disable movement
2. Camera centers
3. Snowball victory animation
4. Crown drops
5. Sparkles
6. `STAGE CLEAR!`
7. Show results

Results:

```text
Fish: 28 / 30
Stars: ★ ★ ★
Secrets: 2 / 3
Time: 04:18
```

Buttons:

```text
NEXT STAGE
REPLAY
MAP
```

---

# 26. Save System

Use `localStorage`.

Suggested schema:

```ts
interface SaveData {
  version: number
  currentStage: string
  unlockedStages: string[]

  stages: {
    [id: string]: {
      completed: boolean
      fish: number
      stars: number
      secrets: number
      bestTime?: number
    }
  }

  settings: {
    music: number
    sfx: number
  }
}
```

Key:

```text
snowball-quest-save-v1
```

---

# 27. Level Select Map

Use five stage icons:

```text
HOME
ROOFTOP
CITY
CAFE
GARDEN
```

Optional secret stage:

```text
SECRET
```

Locked stages appear gray.

Completed stages show crown or paw icon.

---

# 28. HUD

Top-left:

```text
Snowball portrait
Lv. X
♥ ♥ ♥ ♥ ♥
```

Top-right:

```text
🐟 x 028
★ x 2
🧶 x 1
```

Do not cover too much of the screen.

On mobile, slightly reduce HUD scale.

---

# 29. Audio Direction

Music:

- Chiptune
- Lo-fi
- Cozy
- 16-bit-inspired
- Not overly energetic

Stages:

```text
Home → warm sleepy synth
Rooftop → upbeat sunset melody
Cafe → jazzy chiptune
Garden → slow nighttime theme
Ending → emotional reprise
```

SFX:

- Jump
- Land
- Fish collect
- Star collect
- UI click
- Bell
- Door
- Checkpoint
- Victory
- Cat meow

---

# 30. Responsive Web Requirements

Must work on:

- Desktop Chrome
- Desktop Safari
- Desktop Edge
- iPhone Safari
- Android Chrome

Use:

```text
landscape preferred
```

If portrait:

Show:

> Rotate your device for the best Snowball experience.

Do not prevent portrait entirely.

---

# 31. Fullscreen

Provide an optional fullscreen button.

Do not automatically enter fullscreen.

---

# 32. Performance Budget

Goal:

```text
60 FPS
```

Target bundle:

```text
< 5 MB JS before assets
```

Avoid:

- enormous PNGs
- unnecessary particle counts
- excessive physics bodies
- dozens of simultaneous audio sources

Use texture atlases where possible.

---

# 33. Texture Atlas

Production asset format should preferably use:

```text
TexturePacker
```

Output:

```text
snowball.png
snowball.json
```

Phaser:

```ts
this.load.atlas(
  'snowball',
  'assets/sprites/snowball.png',
  'assets/sprites/snowball.json'
)
```

---

# 34. Collision Guidelines

Player collision body should be smaller than visible sprite.

Example:

```text
Sprite 64 x 64

Collision:
width ~32
height ~46
```

This makes movement feel more forgiving.

---

# 35. Checkpoints

Visual:

- Tiny paw flag
- Lamp
- Sparkling cat sign

On activation:

- save checkpoint
- restore hearts
- play sparkle
- tiny bell sound

---

# 36. Secrets

Every level should contain at least:

```text
2 obvious collectibles
1 hidden path
1 secret room
```

Secret room ideas:

- Giant treat room
- Cat shrine
- Mouse office
- Sleeping cat club
- "Absolutely Nothing Here" room

---

# 37. Easter Eggs

Examples:

Repeatedly interact with sleeping cat:

```text
1: Still sleeping.
2: Still sleeping.
3: Extremely sleeping.
4: Achievement unlocked:
   PROFESSIONAL NAPPER
```

Standing still for 15 seconds:

Snowball sits.

30 seconds:

Snowball sleeps.

---

# 38. Accessibility

Provide:

- Adjustable music volume
- Adjustable SFX volume
- Reduced screen shake
- Reduced flashing
- Keyboard remapping later
- Touch controls
- High-contrast interact indicator

Avoid essential gameplay relying only on color.

---

# 39. Game Flow

```text
Boot
 ↓
Preload
 ↓
Title Screen
 ↓
New Game / Continue
 ↓
Stage Map
 ↓
Stage
 ↓
Stage Clear
 ↓
Stage Map
 ↓
Final Stage
 ↓
Ending
```

---

# 40. Title Screen

Logo:

```text
SNOWBALL QUEST
Small Cat, Big Happiness
```

Buttons:

```text
PLAY
CONTINUE
STAGE SELECT
OPTIONS
```

Visual:

Snowball sleeping.

After a few seconds:

One eye opens.

---

# 41. First-Time Tutorial

No modal tutorial wall.

Teach through level design.

Example:

Movement:

Sign:

```text
← → MOVE
```

Jump:

Golden fish floating over small ledge.

Interact:

Bell with flashing `E`.

---

# 42. MVP Scope

GPT-6 should build the MVP first.

MVP should contain:

- Title screen
- One complete Home stage
- Snowball movement
- Jumping
- Collision
- Fish collection
- Three stars
- One NPC
- Dialogue
- One checkpoint
- One simple mission
- Stage clear
- Sound
- Desktop controls
- Mobile controls
- Save system

Do not implement all five stages before the base game feels good.

---

# 43. MVP Acceptance Criteria

The MVP is complete when:

- The website loads without console errors
- Player can move / jump smoothly
- Pixel art renders without blur
- Camera follows smoothly
- Tile collisions work
- Player can collect fish
- HUD updates
- NPC interaction works
- Mission state updates
- Checkpoint works
- Falling restores the player
- Stage clear triggers correctly
- Game can restart
- Progress persists after browser refresh
- Mobile controls work on iPhone Safari
- Desktop keyboard works

---

# 44. Implementation Order

Use this exact order.

## Phase 1 — Project Bootstrap

Create:

```text
Vite + TypeScript + Phaser
```

Set logical resolution.

Verify pixel-perfect rendering.

---

## Phase 2 — Player Prototype

Use placeholder rectangles if necessary.

Build:

- Move
- Jump
- Gravity
- Collision
- Camera
- Coyote time
- Jump buffering

Do not wait for final art.

---

## Phase 3 — Tilemap

Build Home stage in Tiled.

Add:

- Collision
- spawn point
- exit
- checkpoint

---

## Phase 4 — Sprite Animation

Replace placeholder player.

Implement animation state machine.

---

## Phase 5 — Collectibles + HUD

Add:

- fish
- stars
- heart HUD
- counters

---

## Phase 6 — Interaction

Add:

- NPC
- dialogue
- sign
- door
- bell

---

## Phase 7 — Mission System

Implement data-driven objectives.

---

## Phase 8 — Stage Completion

Create stage-clear sequence.

---

## Phase 9 — Save

Persist progress.

---

## Phase 10 — Mobile

Add touch controls.

Test Safari.

---

## Phase 11 — Polish

Add:

- particles
- audio
- screen transitions
- parallax
- secrets
- idle animation
- UI animations

---

# 45. Art Production Plan

The current asset concept should be converted into production assets one category at a time.

Priority:

```text
1. Snowball sprite sheet
2. Home tiles
3. Home background layers
4. Basic UI
5. Collectibles
6. Cat toys + feather props
7. NPCs
8. Props / furniture
9. FX
10. Remaining stages
```

Do NOT regenerate a giant "all assets" concept sheet and try to slice it.

Each asset family must be generated independently with strict dimensions.

---

# 46. Asset Naming Convention

Use lowercase kebab-case.

Examples:

```text
snowball-idle.png
snowball-walk.png
golden-fish.png
happiness-star.png
home-sky.png
home-far-city.png
cafe-counter.png
checkpoint-paw.png
feather-white.png
feather-wand.png
toy-yarn-ball.png
toy-plush-mouse.png
toy-bell-ball.png
toy-spring.png
toy-box.png
cat-tunnel.png
scratching-board.png
```

Atlas animation names:

```text
snowball-idle-00
snowball-idle-01

snowball-walk-00
snowball-walk-01
```

---

# 47. Production Pixel Rules

All character frames must:

```text
integer pixel positions only
nearest-neighbor scaling
no anti-aliasing
transparent background
same frame dimensions
same origin
same scale
```

Never resize a sprite using a non-integer scaling factor.

Recommended display scales:

```text
1x
2x
3x
4x
```

---

# 48. Character Origin

Recommended Phaser origin:

```ts
sprite.setOrigin(0.5, 1)
```

All character sprite sheets must align feet to the same bottom center anchor.

This is critical to prevent sprite animation jitter.

---

# 49. Level Background Example

Home stage layer order:

```text
Sky
Far skyline
Mid buildings
Window / balcony
Room back wall
Gameplay tiles
Furniture back
Player / NPC
Furniture front
Foreground plants
Lighting overlay
UI
```

---

# 50. Lighting

Do not use expensive real-time lighting.

Use:

- semi-transparent overlays
- animated light sprites
- additive sparkles
- simple glow textures

Example:

Sunset:

```text
rgba(255, 180, 120, 0.08)
```

Night:

```text
rgba(35, 44, 85, 0.20)
```

---

# 51. Web Deployment

Recommended:

- Cloudflare Pages
- Vercel
- Netlify
- GitHub Pages

Simplest:

```text
npm run build
```

Deploy `/dist`.

---

# 52. PWA — Optional Phase 2

Later add:

- Service worker
- manifest.json
- Offline cache
- Install icon
- Home-screen support

Do not let PWA work block the core game MVP.

---

# 53. Analytics — Optional

If needed later:

Track only high-level gameplay events:

```text
game_start
stage_start
stage_complete
game_complete
secret_found
```

Avoid invasive tracking.

---

# 54. Suggested First Playable Vertical Slice

Create only:

```text
HOME — THE EMPTY TREAT BOX
```

Duration:

```text
3–5 minutes
```

Flow:

```text
Start on cushion
↓
Walk across apartment
↓
Collect first fish
↓
Jump onto cat tree
↓
Find key
↓
Talk to mouse
↓
Activate checkpoint
↓
Open balcony
↓
Collect final star
↓
Reach flag
↓
STAGE CLEAR
```

This single stage should prove the entire architecture.

---

# 55. Definition of "Fun Enough"

Before creating Stage 2, verify:

- Moving Snowball feels satisfying
- Jump timing feels forgiving
- Collecting fish feels good
- The character is charming even while idle
- Stage can be completed without instructions
- User naturally notices optional paths
- Mobile controls are not frustrating

If these are not true, fix Stage 1 first.

---

# 56. Deliverables Expected From GPT-6

GPT-6 should produce:

```text
1. Working repository
2. package.json
3. Phaser/Vite setup
4. Fully playable MVP
5. README
6. asset manifest
7. level-map format
8. save format
9. production build
10. clear TODO list for later stages
```

Do not only create architecture documentation.

The expected outcome is a playable browser game.

---

# 57. README Requirements

README should contain:

```text
npm install
npm run dev
npm run build
npm run preview
```

Also document:

- Controls
- Folder structure
- How to add a level
- How to add an NPC
- How to add a collectible
- How to add an animation
- How save data works

---

# 58. Coding Guidelines

Use:

- Strict TypeScript
- Small systems/classes
- Data-driven configuration
- Clear event names
- No `any` unless unavoidable
- No scene-specific duplicated movement code

Prefer:

```ts
events.emit('fish-collected', amount)
```

rather than directly manipulating HUD elements from player logic.

---

# 59. Event Bus

Recommended gameplay events:

```text
player-health-changed
fish-collected
star-collected
checkpoint-activated
mission-updated
mission-completed
dialogue-open
dialogue-close
stage-complete
```

---

# 60. Important Constraints

GPT-6 must NOT:

- turn this into a combat platformer
- add weapons
- add violent enemies
- use blurry scaling
- build the full UI in React on top of Phaser
- hardcode every stage in TypeScript
- create all art as a single image
- attach collision logic directly to visual sprite dimensions
- create giant monolithic scene classes

---

# 61. Final Experience Target

The user should be able to open a URL and immediately experience:

> A tiny Siamese cat wakes up in a cozy room, walks into a glowing pixel city, gathers golden fish, helps strange little animals, discovers hidden rooms, and eventually returns home wearing a crown.

The final emotional tone should be:

**cute + cozy + funny + satisfying**

—not difficult, stressful, or competitive.

---

# 62. GPT-6 Starting Prompt

Use the following prompt when handing this project to GPT-6 / Codex:

```text
You are taking over implementation of SNOWBALL QUEST, a browser-based 2D
side-scrolling pixel game.

Read HANDOFF.md completely before coding.

The required stack is Phaser 3 + TypeScript + Vite.

Your first milestone is NOT the whole game. Build the playable vertical slice
defined in the document:

HOME — THE EMPTY TREAT BOX.

Implement production-quality architecture but keep scope small.

Prioritize:
1. player feel
2. pixel-perfect rendering
3. level architecture
4. data-driven systems
5. mobile support

Use temporary placeholder art only where production assets do not exist yet,
but create the correct asset interfaces and paths so final sprites can be
dropped in without refactoring.

Do not add combat.

Do not build multiple stages until the Home vertical slice satisfies all MVP
acceptance criteria.

At each implementation milestone:
- run the game
- fix runtime/TypeScript errors
- verify desktop controls
- preserve mobile architecture
- keep README updated

The expected outcome is a runnable web project, not merely a design document.
```

---

# 63. Final Priority Summary

If there is uncertainty about what to work on next, use this priority:

```text
PLAYER FEEL
    ↓
HOME LEVEL
    ↓
COLLECTING
    ↓
INTERACTION
    ↓
MISSION
    ↓
STAGE CLEAR
    ↓
SAVE
    ↓
MOBILE
    ↓
POLISH
    ↓
MORE LEVELS
```

**The project is successful when playing Snowball for five minutes already feels delightful even before the rest of the game exists.**


---

# 64. Asset Production Status — 2026-09-09

The visual asset design pass is now complete for all 12 planned groups.

| # | Asset Group | Status |
|---|---|---|
| 01 | Snowball Player Sprite Sheet | Complete — concept/asset sheet |
| 02 | Feathers / Cat Toys | Complete — concept/asset sheet |
| 03 | NPC Sprite Sheet | Complete — concept/asset sheet |
| 04 | Tileset | Complete — concept/asset sheet |
| 05 | Home Props / Furniture | Complete — concept/asset sheet |
| 06 | Parallax Background Layers | Complete — 5-layer concept/asset sheet |
| 07 | Collectibles / Items | Complete — animated-state concept sheet |
| 08 | VFX / Effects | Complete — animation concept sheet |
| 09 | UI Pack | Complete |
| 10 | Title Screen / Stage Select / World Map | Complete |
| 11 | Mobile Controls | Complete |
| 12 | Ending / Final Victory | Complete |

## Critical note for GPT-6

These images define the approved visual direction and required assets, but many are still **presentation-style asset sheets**, not guaranteed pixel-perfect production atlases.

Do NOT blindly assume labels such as `32x32`, `48x48`, or `1920x410` correspond to exact source-image pixel boundaries.

Before using any sheet directly:

1. Inspect the actual image dimensions.
2. Detect whether sprites have consistent cell sizes and spacing.
3. Remove headers, labels, preview panels, decorative borders, and backgrounds.
4. Verify transparent backgrounds where required.
5. Verify every animation frame has a stable bottom-center anchor.
6. Verify tiles align to the selected tile grid.
7. Verify parallax layers tile seamlessly.
8. If a sheet cannot be safely sliced, do not fake coordinates. Use it as the visual reference and create a production-ready replacement/placeholder interface.

The game code must not depend on irregular coordinates from a presentation sheet.

---

# 65. Approved Asset Manifest

The implementation should expose these logical asset groups:

```text
public/assets/
├── player/
│   ├── snowball.png
│   └── snowball.json
├── toys/
│   ├── feathers.png
│   └── cat-toys.png
├── npcs/
│   ├── npcs.png
│   └── npcs.json
├── tiles/
│   └── world.png
├── props/
│   └── home-props.png
├── backgrounds/
│   └── home/
│       ├── sky.png
│       ├── far-city.png
│       ├── mid-buildings.png
│       ├── near-houses.png
│       └── foreground.png
├── items/
│   ├── collectibles.png
│   └── collectibles.json
├── fx/
│   ├── effects.png
│   └── effects.json
├── ui/
│   └── ui.png
├── title/
│   ├── title-screen.png
│   └── world-map.png
├── mobile/
│   └── controls.png
└── ending/
    └── ending.png
```

The filenames above are the **target production filenames**. Rename/crop/re-export supplied artwork as necessary.

---

# 66. Final Approved Toy Set

Snowball's world should contain substantially more cat toys than the original plan.

Required toy vocabulary:

```text
loose feather
pink feather
blue feather
purple feather
feather bundle
feather wand
hanging feather
fishing-rod toy
yarn ball
rolling ball
bell ball
jingle ball
crinkle ball
plush mouse
fish plush
spring toy
cat tunnel
scratching board
kicker toy
wand toy
ribbon
dangling string
toy basket
toy box
paw cushion
```

At least some toys must be interactive rather than decorative.

---

# 67. Approved NPC Roster

The current NPC visual sheet establishes these characters:

```text
Shop Cat
Cafe Cat
Book Cat
Plant Cat
Chef Cat
Guard Cat
Mouse
Bird
Chubby Bird
Dog
Ghost Cat
Robot Vacuum
```

Not every NPC needs to appear in the MVP.

For the Home vertical slice, prioritize:

```text
Mouse
Robot Vacuum
one friendly cat NPC
```

NPC behavior should remain harmless, humorous, and story-oriented.

---

# 68. Approved Collectibles

Current collectible vocabulary:

```text
Fish              primary currency
Star              rare stage objective
Feather           exploration collectible
Yarn Ball         secret / toy collectible
Heart             health
Key               unlock item
Cat Treat         score / reward
Bell              interaction / quest item
Gem               special collectible
Milk Bottle       quest / bonus item
Food Can          reward item
Treasure Chest    reward container
Letter / Note     story item
Flower            optional collectible
Star Fragment     special objective
Crown             achievement / ending item
```

Do not force every collectible into the first level.

MVP priorities:

```text
Fish
Star
Feather
Key
Heart
```

---

# 69. Approved VFX Vocabulary

The VFX sheet establishes:

```text
jump dust
landing dust
run dust
dash trail
double-jump sparkle
item pickup
heart heal
stumble / hurt
harmless obstacle clear
star spawn
key spawn
treasure chest open
checkpoint activation
stage clear
level up
crown / achievement
teleport / warp
magical sparkle
bubble / water
leaf / wind
UI click feedback
text pop
sleep / idle ZZZ
```

Use VFX sparingly. Readability is more important than particle density.

---

# 70. UI / Mobile Direction

The UI artwork now defines the visual language for:

```text
HUD
quick slots
stage information
buttons
dialogue
NPC dialogue
choices
pause
stage clear
retry
world map
missions
settings
notifications
system icons
```

Mobile artwork defines:

```text
Left
Right
Jump
Interact
Dash
Pause
Virtual joystick (optional)
```

### Mobile implementation rule

Prefer discrete Left/Right buttons for the MVP because platform movement is easier to tune consistently.

The virtual joystick is optional.

Touch controls must:

- support multi-touch
- allow moving + jumping simultaneously
- allow moving + interacting
- have large hit targets
- use reduced opacity during gameplay
- never block important platforms or collectibles
- respect iPhone safe areas

---

# 71. World / Stage Direction

The world-map visual concept contains several environments. Treat it as inspiration, while the canonical story flow remains:

```text
HOME
  ↓
ROOFTOPS / SUNNY TOWN
  ↓
CITY / CAFE
  ↓
MOONLIGHT GARDEN
  ↓
RETURN HOME
  ↓
ENDING
```

Additional map areas such as forest, mountain, ocean, or special stages are **post-MVP expansion content**, not requirements for initial release.

---

# 72. Ending Direction

The final asset pack establishes the ending sequence:

1. Snowball returns home at sunset/night.
2. Home is warm and safe.
3. The reward/treat box is full.
4. Snowball receives the crown.
5. Friends may appear for a short celebration.
6. Snowball eventually lies down and sleeps.
7. Credits / final illustration appears.

Primary final message:

```text
GOOD CATS.
BETTER DAYS.
```

Supporting theme:

```text
A BRIGHTER TOMORROW.
```

Do not make the ending excessively long. The player should regain control or reach credits quickly.

---

# 73. Updated MVP Home Stage

The first playable level should now explicitly demonstrate the new asset set.

Suggested sequence:

```text
Snowball wakes on cushion
        ↓
Player learns Left / Right
        ↓
Collect first Fish
        ↓
Feather teaches Jump
        ↓
Push / roll Yarn Ball
        ↓
Meet Mouse
        ↓
Find Plush Mouse toy
        ↓
Avoid / ride around Robot Vacuum
        ↓
Use Scratching Board
        ↓
Find Key near Cat Tower
        ↓
Activate Paw Checkpoint
        ↓
Open Toy Box
        ↓
Collect Star
        ↓
Open Balcony Door
        ↓
Reach stage flag
        ↓
STAGE CLEAR
```

Target first-play duration:

```text
3–5 minutes
```

The level should include at least one optional secret feather route.

---

# 74. GPT-6 Asset Intake Procedure

When receiving this HANDOFF plus the generated artwork, GPT-6 should perform this sequence before building levels:

```text
STEP 1  Inventory every supplied image
STEP 2  Match each image to Asset Group 01–12
STEP 3  Record actual width/height
STEP 4  Determine: production-ready OR reference-only
STEP 5  Crop/extract only assets that can be extracted reliably
STEP 6  Build atlas metadata for reliable assets
STEP 7  Create placeholders for anything unreliable
STEP 8  Build the Home vertical slice
STEP 9  Replace placeholders incrementally
STEP 10 Verify in browser and on mobile
```

Create an internal asset report such as:

```text
docs/ASSET_STATUS.md
```

Example:

```md
| Asset | Source | Ready | Action |
|---|---|---:|---|
| Snowball idle | player sheet | no | normalize frames |
| Fish | collectibles | yes | crop + atlas |
| Home sofa | props | yes | crop |
| Sky | background sheet | no | export seamless layer |
```

Never silently use a broken sprite crop.

---

# 75. Updated GPT-6 / Codex Handoff Prompt

```text
You are implementing SNOWBALL QUEST, a cozy browser-based 2D pixel-art
side-scrolling game.

Read SNOWBALL_QUEST_HANDOFF.md completely before changing code.

You have also received a set of 12 approved visual asset sheets:

01 Player
02 Toys / Feathers
03 NPCs
04 Tileset
05 Home Props
06 Parallax Background
07 Collectibles
08 VFX
09 UI
10 Title / World Map
11 Mobile Controls
12 Ending

IMPORTANT:
These images are the approved visual reference, but presentation sheets are
not automatically production-ready sprite atlases.

First inventory the images and create docs/ASSET_STATUS.md.
Measure real image dimensions and inspect frame consistency.
Do not trust dimensions printed inside the artwork.
Do not invent sprite-frame coordinates.

When an asset can be safely extracted, crop/re-export it into the production
asset structure described in this HANDOFF.
When it cannot, preserve the visual reference and use a correctly sized
placeholder until a production-ready asset is available.

Stack:
- Phaser 3
- TypeScript
- Vite
- Tiled JSON maps
- Arcade Physics
- localStorage

FIRST MILESTONE:
Build HOME — THE EMPTY TREAT BOX as a polished 3–5 minute vertical slice.

It must demonstrate:
- Snowball movement
- responsive jump
- pixel-perfect rendering
- Fish collection
- Feather collection
- one Yarn Ball interaction
- Mouse NPC
- Robot Vacuum obstacle
- Key
- Toy Box
- Checkpoint
- Star objective
- Balcony exit
- Stage Clear
- desktop controls
- mobile controls
- local save

Do not add combat.

Do not build all stages before Home feels good.

Do not spend the first implementation pass trying to perfectly recover every
sprite from the presentation artwork. Architecture and player feel come first.

Run and test the project after every meaningful milestone.
Keep README and docs/ASSET_STATUS.md current.

The final deliverable must be a runnable browser game, not another design
document.
```

---

# 76. Current Project Handoff State

At this point, design planning and visual-direction generation are sufficiently complete to begin implementation.

The next agent should **stop expanding the design spec** unless an implementation blocker is discovered.

Next action:

```text
HANDOFF + 12 ASSET GROUPS
          ↓
GPT-6 / CODEX
          ↓
ASSET INVENTORY
          ↓
HOME VERTICAL SLICE
          ↓
PLAYTEST
          ↓
POLISH
          ↓
REMAINING STAGES
```

**Implementation is now the priority.**
