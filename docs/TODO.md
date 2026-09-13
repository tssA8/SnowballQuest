# Remaining work

The seven-stage campaign is now implemented: opening dialogue, routes, enemy encounters, three-phase bosses, reconciliation, permanent rewards, sequential unlocks, replay and the Nightink ending. This checklist tracks refinement and acceptance; it does not mark the later stages as unavailable. See [CAMPAIGN.md](CAMPAIGN.md) for current behavior and [GAME_DESIGN.md](GAME_DESIGN.md) for the broader production target.

## Implemented campaign scope

- [x] Seven destinations with distinct environment themes and stage-specific bosses.
- [x] Eight enemy types and seven boss runtime sheets from the approved pack.
- [x] Five fruit forms, sequential trials and permanent unlocks.
- [x] Healing cans, low-health supplies, hold-and-release charge attacks and boss-entry retries.
- [x] Star map, crew/badge/fruit collection menu, next-stage flow and unlocked-stage replay.
- [x] Nightink reconciliation, ending and free patrol through the unlocked star map.
- [x] Schema v2 with migration under the existing browser/native storage key.

## Campaign acceptance

- [ ] Record an ordinary, unassisted new-save playthrough across all seven stages, including healing, retries, stage transitions and the final ending.
- [ ] Repeat with existing phase-one saves and partially completed v2 saves; verify reload at checkpoints, after reconciliation and after selecting the next destination.
- [ ] Validate optional Home delivery/toy-box discoveries and all collectible routes in later stages without duplicate rewards.
- [ ] Time first-player sessions and tune boss difficulty, reaction windows, recovery supplies and navigation from observed play.
- [ ] Check clarity of wind jumps, water shields, electric cables, earth walls, moving bubbles, element chains and starburst for a player who has not read the design document.
- [ ] Audit production console output, asset requests, layout bounds and static-host subpath behavior after each release.

Automated test counts and completed browser checks belong in [VERIFICATION.md](VERIFICATION.md). State-isolating fixtures are useful but do not replace natural playthroughs or difficulty testing.

## Physical devices and distribution

- [x] Capacitor Android/iOS projects, offline assets, safe-area layout, lifecycle handling and native save recovery are present.
- [ ] Build and publish a new seven-stage Android package; the existing 0.1.1 APK is an older preview.
- [ ] Complete signed iPhone/TestFlight distribution with the owner's Apple Developer account.
- [ ] Physical iPhone Safari: safe areas, rotation, simultaneous movement/jump/charge, release outside a button, audio gesture and save recovery.
- [ ] Physical Android Chrome: multi-touch, viewport resizing, background/foreground recovery, performance and saves.
- [ ] Safari desktop: keyboard play, audio interruptions and restored sessions.
- [ ] Verify readable HUD/dialogue text on the smallest supported landscape screen and measure frame rate/memory on a mid-range phone.

## Production art and design detail

- [x] Preserve normalized Snowball movement cells and the owner's approved identity; see [SNOWBALL_IDENTITY.md](SNOWBALL_IDENTITY.md).
- [x] Integrate 26 adventure textures including all eight enemies, seven bosses, five fruit icons and 28 combat poses.
- [ ] Add consistent intermediate combat frames, per-pose collar/bell placement and complete element-specific character animation.
- [ ] Replace or refine Phaser geometry scenery with approved layered environment art, repeatable parallax backgrounds and seamless tiles.
- [ ] Audit every source atlas frame for stray fragments, cropping, scale and consistent ground anchors.
- [ ] Complete production collectible animation, button states, furniture/toy variants, sound and restrained effects.
- [ ] Expand the shared element-chain bonus into the distinct combination states/effects specified by the design, with meaningful feedback for each combination.
- [ ] Add remaining design-specific boss staging such as destructible platforms, detailed gravity changes and individual companion interventions where appropriate.
- [ ] Expand optional later-stage stories, memory discoveries and the ship menu into richer companion interactions.

## Follow-up improvements

- [ ] Revisit remappable controls and optional difficulty settings after first-player feedback.
- [ ] Consider PWA installation after the core browser and mobile release behavior is stable.
- [ ] Update asset and verification reports when production art or acceptance evidence changes; retain historical reports with clear scope labels.
