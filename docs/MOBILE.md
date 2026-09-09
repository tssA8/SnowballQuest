# Android and iOS apps

Capacitor 8.5.1 packages the existing Home chapter with app ID `io.github.tssa8.snowballquest`, version `0.1.0` (build 1).

## Included

- Bundled game, maps, artwork and synthesized audio: no hosted URL, account or connection is needed to start offline.
- Landscape presentation, hidden system bars and safe-area spacing for cutouts and home gestures.
- Android Back pauses/resumes play, preserves dialogue, closes the chapter panel, returns from results to the title, or minimizes the app from the title.
- Backgrounding releases inputs, pauses and saves. Foregrounding leaves play paused until the player resumes; a fresh touch can restore interrupted audio.
- Preferences loads before the menu, writes in order and retains pending local recovery snapshots until native writes succeed.
- Snowball icons derived from the same editable artwork as the game. Original photos are not packaged.

## Android

The [Android 0.1.0 mobile preview](https://github.com/tssA8/SnowballQuest/releases/tag/v0.1.0-mobile-preview) provides the tested APK as a public download. It is a development preview for direct installation, not a Play Store release. Browser play remains available on GitHub Pages.

Use Node 22+, JDK 21 and Android SDK platform 36. Set `ANDROID_HOME` and `JAVA_HOME`, or configure `android/local.properties`. SDK paths and signing keys are ignored by Git.

```sh
npm ci
npm run android:build
```

This builds the web game, synchronizes native assets and copies the development APK to `releases/snowball-quest-0.1.0-android-debug.apk`. Android 7+ and Android System WebView 89+ are required; keep WebView current. The Windows helper can use a workspace-only JDK in `.mobile-tools/jdk-21*`; this optional tool directory is not committed.

The APK uses a development signing key, not a Play Store release key. Fresh CI runners or different computers may use different development keys. Production updates need a stable private signing key. Do not uninstall an existing app merely to change signatures without preserving its progress first.

## iOS

The project uses Swift Package Manager, targets iOS 15+, and includes the Preferences privacy manifest in the app's resources. On a Mac with Xcode 26+:

```sh
npm ci
npm run build
npx cap sync ios
npm run ios:open
```

Open `ios/App/App.xcodeproj`, select the App target and choose your Apple development team and iPhone. Run sync on the Mac before building so dependency paths match that environment.

The GitHub build produces an unsigned simulator `.app`, **not an iPhone-installable IPA**. TestFlight/App Store distribution needs the owner's Apple Developer account, signing configuration and submission. Physical iPhone touch, safe-area, audio interruption and performance tests remain necessary.

## Updates and GitHub

`npm run mobile:sync` rebuilds and updates both native projects. `npm run assets:mobile` regenerates native icons and splash backgrounds from the code-drawn art. `npm run android:open` opens Android Studio.

The **Build mobile apps** workflow runs on pushes to `main` or manual dispatch. It uploads an Android development APK and an unsigned iOS simulator archive after successful builds. Download artifacts from that workflow run. GitHub Pages continues to deploy the browser game independently; website updates do not replace assets in an installed app.

The public preview APK comes from successful mobile build `34322675991`, game revision `cbd7783`, with SHA-256 `d5c6b3e3f2c0202c05b6c37d0a8772696388ec9ae2883418ac9526ecc71d511c`. Later documentation/test commits do not change the game bundled in that preview.

App progress and website progress are separate and device-local. Native saves survive ordinary restarts and compatible updates; uninstalling the app removes them. There is no account, telemetry or cloud sync.

## Verification

The 26 unit checks include native read ordering, queued writes, write failures and recovery after restart. Browser checks include dialogue pause/resume and protecting the completed-stage state. Native build and device results are recorded in `VERIFICATION.md`; browser touch emulation alone does not certify iOS.

With the development APK installed on a dedicated Android test device and `adb` available, run `npm run test:android`. Set `SNOWBALL_ANDROID_DEVICE` if multiple devices are connected. This starts a fresh game run, exercises the bundled production WebView offline, tests touch and Back/Home behavior, and removes the test run's WebView recovery copies to verify that a cold restart restores native Preferences. It writes screenshots and a JSON report to ignored `test-results/`. Use a test installation whose progress can be replaced.
