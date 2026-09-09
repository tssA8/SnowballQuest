# Remaining work

The current scope is Home. Keep later stages locked until the first slice feels responsive, reads clearly on a phone and meets the handoff acceptance criteria.

## Home validation

- [ ] Complete and record an ordinary desktop playthrough, including movement, jump buffering, coyote time, both tunnel entrances, mouse delivery, scratch, key, box, checkpoint, balcony and stage clear.
- [ ] Complete an all-collectibles run: 30 fish, 3 feathers and all 3 stars, including the box reward. Confirm secret counters cannot increment twice.
- [ ] Confirm fall and vacuum recovery, zero-heart nap, checkpoint respawn and replay behavior without softlocks.
- [ ] Refresh during a partially completed run and after stage clear. Check item state, objective flags, checkpoint position, settings and best results.
- [ ] Verify pause and resume, tab blur, browser resizing, optional fullscreen and Web Audio unlock through a user gesture.
- [ ] Inspect the production preview for console errors, missing assets, blurred pixels and unintended geometry gaps.
- [ ] Time several first-play sessions against the 3–5 minute target; adjust route clarity and optional rewards from observed play.

These entries are a verification checklist, not a claim that a defect exists. Update them with actual evidence as checks finish.

## Real browser and mobile coverage

- [ ] Desktop Chrome / Edge keyboard playthrough.
- [ ] Desktop Safari playthrough and audio resume after interruption.
- [ ] Physical iPhone Safari: safe areas, portrait/landscape rotation, multi-touch move+jump, move+interact, pointer release outside a button, sound gesture and local save.
- [ ] Physical Android Chrome: multi-touch, viewport resizing, background/foreground recovery, performance and local save.
- [ ] Verify HUD, missions and dialogue readability on the smallest supported landscape screen.
- [ ] Measure practical frame rate and memory on a mid-range phone; keep particles and audio voices bounded.

## Production artwork

- [ ] Replace generated placeholders with normalized production assets from the approved twelve reference groups.
- [x] Re-export the full Snowball state set with consistent 64 × 64 cells, transparent background and a stable bottom-center anchor. All 44 placeholder frames now follow the owner's seven photo references; see `SNOWBALL_IDENTITY.md`.
- [ ] Export repeatable, separate parallax layers and inspect their horizontal seams.
- [ ] Complete furniture and toy variants, all UI button states, collectible animation and restrained VFX.
- [ ] Audit every replacement visually at integer display scales and update `ASSET_STATUS.md` with dimensions and readiness.

## Later stages and features

- [ ] Rooftops / Sunny Town: introduce the next route and a small helping objective.
- [ ] City / Café: ingredient delivery and the reopened café.
- [ ] Moonlight Garden: lanterns, sleeping cat and final fragment.
- [ ] Return Home and a short crown / full treat box ending.
- [ ] Add stage transitions, unlock progression and map data for completed future stages.
- [ ] Revisit remappable keyboard controls after Home input is proven.
- [ ] Consider PWA offline installation only after core gameplay and deployment are stable.
- [x] Publish to the user's preferred public host: [GitHub Pages](https://tssa8.github.io/SnowballQuest/). Pushes to `main` run tests and deploy automatically; visitors do not need an account.
