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
- [GitHub mobile build 34322675991](https://github.com/tssA8/SnowballQuest/actions/runs/34322675991) passes for both the Android development APK and the unsigned iOS simulator app, from game revision `cbd7783`.
- The APK was installed and exercised on an Android 9 / API 28 emulator using Android System WebView 92.0.4515.131. An actual device test caught unsupported `dvh` invalidating the native canvas width; `@supports` now guards the dynamic-height declaration and retains the `vh` fallback. Title, gameplay, pause and continue screenshots were inspected at 1920 × 1080.
- `npm run test:android` passes: uncached offline reload of bundled assets, 16:9 layout, touch movement and fish collection, Back pause/resume, and Home/background with a held pointer. Pause checks retain the full run and elapsed time beyond the autosave interval; resume advances time again.
- Native Preferences matches the complete run. After removing the WebView's save and pending-recovery copies, force-stop/relaunch restores the native run and Continue resumes play without losing collected fish.
- Capacitor 8.5.1 can log a caught safe-area CSS injection error before the document exists. The device report retains two such startup diagnostics, verifies that all four native inset values are injected after loading, and rejects other errors or the same error after loading. No gameplay or resource errors were reported.
- The public GitHub Pages production smoke test passes after Capacitor integration: no sign-in, successful runtime assets, keyboard fish collection and no console/resource errors or development test access.
- iOS simulator compilation and signed iPhone archive/export are verified; the iPhone release section below records the successful TestFlight upload. Physical iPhone installation, safe areas, audio interruptions and performance remain unverified. The Android run above is emulator coverage, not a physical-device matrix. See `MOBILE.md` for commands and distribution requirements.

Run `npm test` and `npm run build`. Browser scripts use Playwright and installed Edge by default; set `SNOWBALL_BROWSER` for another installed channel. Set `SNOWBALL_URL` to the running server. `npm run dev -- --mode test --port 5174` disables hot reload for stable tests. Run `npm run test:browser`, `npm run test:route`, and `npm run test:mobile` in another terminal. `node scripts/production-check.mjs` defaults to the production preview on port 4173.

Screenshots and JSON results are saved in ignored `test-results/`.

## Original-shape coat update, 0.1.1

- All 44 runtime frames are normalized from measured original-concept silhouettes with an ImageGen color edit. The import checks source size, pose-mask overlap, nonempty frames and no clipping. All frames use the same scale and bottom anchor.
- The enlarged contact sheet, in-game player/HUD, title sleeping pose and native icon were visually inspected. The original rounded body, small face features and side-facing gait replace the earlier procedural cat.
- TypeScript/Vite build, full browser quest integration and mobile touch/rotation checks pass with the new sprites. Scenery, quests, physics and controls remain unchanged.
- Re-exporting assets imports the curated master and updates native icons, preserving the corrected artwork. Manifest version 4 requests fresh images after deployment. See `SNOWBALL_COAT_EDIT.md` for the prompt and saved source assets.

## iPhone release preparation

- Source revision `584b4a9` passes [the iPhone Release archive check](https://github.com/tssA8/SnowballQuest/actions/runs/34329653150) on macOS with Xcode 26.3. This builds for `iphoneos` and validates the archive's bundle/version, arm64 architecture, bundled game, privacy manifest and uploader CLI. The archive is unsigned and is not an installable IPA.
- The same revision passes [Android and iOS simulator builds](https://github.com/tssA8/SnowballQuest/actions/runs/34329523658) and [GitHub Pages deployment](https://github.com/tssA8/SnowballQuest/actions/runs/34329523540).
- All 26 game/storage tests and eight signing-helper tests pass. The 1024-pixel iOS icon is exported as RGB without an alpha channel; decoded pixels match the source icon, and Android exports retain their existing formats.
- The Apple bundle ID and App Store Connect app record have been created, and team API access is approved. On 2026-09-10, an Apple Distribution certificate and App Store provisioning profile were created for this bundle ID. Their Team ID, distribution entitlements, matching private key and encrypted P12 were validated locally; the certificate and profile expire on 2027-09-10.
- [Signed release run 34430046017](https://github.com/tssA8/SnowballQuest/actions/runs/34430046017), from `cb49937`, passed all 14 release-helper tests, 26 game/storage tests, the web build, signed iPhone archive/export and TestFlight upload for **0.1.1 (3)**. The successful run uses a dedicated Developer API key in GitHub Secrets; the bootstrap Admin key stays local.
- Apple processing returned `VALID`. After the owner explicitly approved the no-non-exempt-encryption declaration on 2026-09-10, the build became `READY_FOR_BETA_TESTING` internally and `READY_FOR_BETA_SUBMISSION` externally. `ITSAppUsesNonExemptEncryption=false` records the same declaration for future builds of the current app; reassess it if app encryption changes.
- The signed IPA was downloaded to ignored `releases/ios/snowball-quest-0.1.1-build-3.ipa` (1,414,299 bytes). Its SHA-256 is `3f0618df1ad5f550dbfc9c8e646fe39ebc9330775c8c3a773c1b50d52db5b6d2`, matching the CI checksum. The downloaded artifact ZIP also matched GitHub's artifact digest. TestFlight expires this build on 2026-12-09 UTC.
- Physical iPhone installation and play, tester invitations and external beta review have not yet been verified. See `IOS_RELEASE.md` for the release modes and required credentials. Signing files remain in ignored private local storage.

## Public release and Snowball photo update

- The source is committed to `tssA8/SnowballQuest` on GitHub. The `main` workflow runs the tests, builds the game and publishes to [GitHub Pages](https://tssa8.github.io/SnowballQuest/); no visitor account is required.
- Photo revision `c35c6f0` was deployed successfully. The live player PNG's SHA-256 matches the local export, and the public manifest is version 3.
- All 44 Snowball frames use the owner's photo references and retain their 64 × 64 cells, animation indices and bottom-center anchor. The original photographs remain outside the repository.
- The production smoke test also passed against the public GitHub Pages URL: no sign-in, successful PNG/map loading and keyboard fish collection, no runtime/resource errors, and no development test access.
- Release review found a static Snowball portrait behind the victory animation on the result panel. The duplicate image was removed; the result screenshot now shows a single crowned Snowball. The production build and existing browser integration passed again, including stage clear and replay.
