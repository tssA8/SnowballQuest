# Home verification — 2026-09-09

The first Home vertical slice is playable. Later chapters and final production artwork remain separate work.

## Passed

- Strict TypeScript and Vite production build; approximately 1.26 MB JavaScript before compression.
- 15 map, player-controller and save tests, including jump buffering, coyote time, safe map geometry, corrupted storage and replay records.
- Edge browser integration: movement, jump, dash, one-way landing, fish, dialogue, locked door, plush delivery, scratch, key, box reward deduplication, secret tunnel, three stars, checkpoint/fall, refresh persistence, stage clear and replay. No runtime or console errors.
- Actual keyboard jumps through the four tower shelves, balcony key, floor gap and optional star route. No heart loss or runtime errors.
- Edge mobile emulation: simultaneous move+jump, independent release/cancel, pause/dialogue visibility and portrait rotation. No console errors; the whole canvas fits inside the portrait frame.
- Production preview: independent PNG/map loading, keyboard fish collection, no missing assets or console errors, and development test access excluded.
- All 14 supplied references inspected and measured. Generated placeholder PNGs and atlases have separate documented replacement paths.

The interaction test uses deterministic player placement to isolate quests; it is not a human all-collectible playthrough. The keyboard route test places the player at route entrances and then uses actual keyboard jumps between ledges. Mobile emulation is not physical iPhone/Safari certification.

## Remaining

- Physical iPhone Safari, Android Chrome, audio interruptions, safe areas and device performance.
- Ordinary first-play timing against the 3–5 minute target, all-collectible exploration and subjective jump feel.
- Final normalized artwork replacing the explicitly documented placeholders.

## Capacitor integration

- Android and iOS SPM projects generated with Capacitor 8.5.1, with offline web assets, landscape layout and Snowball icons.
- 26 unit tests pass, including 11 native-storage checks covering initialization ordering, sequential writes, failures and restart recovery.
- Browser integration passes with dialogue pause/resume retaining and redrawing the same line, and Escape unable to resume a completed stage.
- Edge touch/rotation emulation passes after integration: simultaneous movement/jump, independent release/cancel, pause and portrait layout.
- Native builds and device tests are separate from the browser checks. See `MOBILE.md` for build commands, signing requirements and device coverage limits.

Run `npm test` and `npm run build`. Browser scripts use Playwright and installed Edge by default; set `SNOWBALL_BROWSER` for another installed channel. Set `SNOWBALL_URL` to the running server. `npm run dev -- --mode test --port 5174` disables hot reload for stable tests. Run `npm run test:browser`, `npm run test:route`, and `npm run test:mobile` in another terminal. `node scripts/production-check.mjs` defaults to the production preview on port 4173.

Screenshots and JSON results are saved in ignored `test-results/`.

## Public release and Snowball photo update

- The source is committed to `tssA8/SnowballQuest` on GitHub. The `main` workflow runs the tests, builds the game and publishes to [GitHub Pages](https://tssa8.github.io/SnowballQuest/); no visitor account is required.
- Photo revision `c35c6f0` was deployed successfully. The live player PNG's SHA-256 matches the local export, and the public manifest is version 3.
- All 44 Snowball frames use the owner's photo references and retain their 64 × 64 cells, animation indices and bottom-center anchor. The original photographs remain outside the repository.
- The production smoke test also passed against the public GitHub Pages URL: no sign-in, successful PNG/map loading and keyboard fish collection, no runtime/resource errors, and no development test access.
- Release review found a static Snowball portrait behind the victory animation on the result panel. The duplicate image was removed; the result screenshot now shows a single crowned Snowball. The production build and existing browser integration passed again, including stage clear and replay.
