# Swift iOS TestFlight 發行與元素美術驗證 — 2026-09-15 / 0.3.1 (5)

新版待機圖、五種元素特效、同一套雪球本體的普通攻擊，已在 `feature/native-swift-ios` 實作。主要素材提交為 `73fc5c696b7bf5e6c30a2369ff3031ba9a3f4427`；實際截圖檢查發現左上角工具按鈕文字換行，再由 `a975be74211063e17d320a409d1278c9518c5fe8` 修正圖示、字級與內距。

## 素材與模擬器證據

- [原生驗證 34947383898](https://github.com/tssA8/SnowballQuest/actions/runs/34947383898) 成功：17 項 NativeCore、28 項 SpriteKit／美術、9 項 XCUITest、36 項 Python 發行工具測試通過，並完成 unsigned arm64 iPhone archive 驗證。
- 五種果實實際拾取後，外觀立刻改變；六種形態的圖片互異，中央臉部像素完全一致，深色項圈／金色鈴鐺也維持一致。普攻、衝刺、集氣與受傷持續引用同一套 44 格雪球 atlas。向左發射、暫停凍結及效果清理測試通過。
- 新素材包 90 個來源 SHA-256、32 個特效片段與 95 個原生 bundle 資源皆通過檢查。使用者指定的完整待機圖保持原檔；UI 測試確認 START／CONTINUE 操作及至少 48pt 的畫面內觸控區。
- 已實際檢視模擬器輸出的元素動畫影格 04、08、44 姿勢定位圖、風果實拾取畫面與待機畫面。12 個實際 SpriteKit 影格另以 16fps 重複編碼為六秒 MP4；沒有使用另一套網頁程式模擬效果。風果實拾取截圖包含短暫提示，部分身體被提示遮住，完整外觀另由 44 姿勢圖與像素測試核對。
- 完整測試 artifact `10388486560` 已下載並通過 GitHub digest 比對，ZIP SHA-256 為 `2645dbbb8a40e5bb5af893c9c8c06f92c32856de60f2c33890a1726830fee39a`。檔案位於本機 ignored 的 `releases/ios/native-34947383898-10388486560.zip`；解出的截圖在 `test-results/native-ios-artifact-10388486560`，影片在 `test-results/elemental-preview-0.3.1/elemental-animation.mp4`。

## 發行狀態

**已上傳並可進行內部測試。** [TestFlight 發行 34949159347](https://github.com/tssA8/SnowballQuest/actions/runs/34949159347) 以 `a975be74211063e17d320a409d1278c9518c5fe8` 再次通過 54 項原生測試與 36 項 Python 工具測試，完成簽署、上傳與 Apple 可用性驗證。同提交的重複 push CI `34949126633` 已取消，由發行流程執行完整相同測試。

- Apple build ID：`e1b56455-9ec5-4778-8c97-b972779e8e4c`；`VALID`、`IN_BETA_TESTING`，與既有 **Snowball Quest Internal** 群組的關聯已確認。iPhone 開啟 TestFlight → Snowball Quest → 更新，即可安裝 **0.3.1（5）**。
- 下載後獨立核對 IPA：Bundle ID `io.github.tssa8.snowballquest`、版本 `0.3.1`、build `5`、SpriteKit 引擎及全部 95 個資源 SHA-256 與來源一致，沒有 Capacitor 或打包的網頁程式。沿用已授權的加密宣告，未新增測試者。
- `releases/ios/snowball-quest-0.3.1-build-5.ipa`：5,210,003 bytes，SHA-256 `6aee5b5a851168f9228a7c18ac8d7226ce13e39132029a5511f80d7a4ac6a232`。IPA artifact `10389311279` 的 ZIP digest 為 `96082f85bf28b31ef522da9dcef2a13b8c0495667b14e4908ac129e03c255015`，下載比對通過。
- Apple 回報與本機檔案驗證分別存於 `releases/ios/testflight-status-0.3.1-build-5.json`、`releases/ios/verification-0.3.1-build-5.json`。本機發行檔案均位於 ignored 目錄，GitHub artifacts 保留七天。
- 發行測試 artifact `10389028558` 完整 ZIP 已通過 digest 比對：`6070a171b55f5bfdd0816605305cb01fcf69aea81a91d6e63dce6f6310272584`。已實際開啟最終待機截圖，確認「同伴／設定」均為單行，插圖與 START／CONTINUE 完整顯示。最終截圖在 `test-results/native-ios-artifact-10389028558`；同一預覽目錄的 MP4 及 `source.json` 已更新為此發行測試的 12 個實際影格。UI 截圖的 EXIF 橫向資訊只在檢視副本中正規化，原始截圖保留。

尚未驗證實體 iPhone 的長時間效能、音效、溫度及操作手感。此更新僅接入原生 iOS 分支；網頁／Android 的執行流程保留。新來源圖是 key pose／VFX 設計稿，32 個片段以程式產生運動，不是新手繪的完整逐格動畫。下方保留前版發行歷史。

# Swift iOS TestFlight 發行 — 2026-09-15 / 0.3.0 (4)

**已上傳並可進行內部測試。** [發行工作流程 34935674826](https://github.com/tssA8/SnowballQuest/actions/runs/34935674826) 全部成功；簽名並上傳的來源為 `feature/native-swift-ios` 的 `a41b00265b6382f61e708c1e030d47871d8a97c8`。iPhone 開啟 TestFlight → Snowball Quest → 更新，即可安裝原生 Swift 版。

## 發行驗證

- Xcode 26.3 / macOS runner：17 項 NativeCore 測試、22 項 SpriteKit／遊戲測試、7 項 XCUITest 及 36 項 Python 發行工具測試通過。iPhone 17 Pro 模擬器使用 iOS 26.2。
- 原生 UI 測試覆蓋七關啟動、至少 48 pt 且位於畫面內的操作按鈕、初始關卡鎖定、集氣消耗／取消、暫停、背景恢復與設定持久化。
- arm64 iPhone archive、Apple Distribution 簽名、IPA 匯出及上傳成功。下載後另行驗證 IPA 的 Bundle ID `io.github.tssa8.snowballquest`、版本 `0.3.0`、build `4`、SpriteKit 引擎及 87 個隨包資源的 SHA-256；未打包 Capacitor 或 `public/index.html`。
- Apple build ID：`ef6ee312-82d1-4be0-b435-2deda7ef9b3f`。處理狀態 `VALID`、內部測試狀態 `IN_BETA_TESTING`；已確認與既有 **Snowball Quest Internal** 群組的關聯。沿用既有簽署資料及使用者已授權的 `ITSAppUsesNonExemptEncryption=false`，未新增測試者。
- 本機封存檔案：`releases/ios/snowball-quest-0.3.0-build-4.ipa`，2,590,539 bytes，SHA-256 `a39dbc800b28b9010da25b7eb2d20dede59d7a8004aa18e2e99e24bc1f02bb8d`。與 CI checksum 相同；下載的 artifact ZIP 也通過 GitHub artifact digest 比對。
- Apple 狀態封存於 `releases/ios/testflight-status-0.3.0-build-4.json`。上述發行檔案只保存在本機 ignored 目錄；GitHub Actions artifact 保留七天。

## 畫面檢查

發行測試的應用程式元素截圖在橫向時被 XCTest 錯誤裁切，因此補充測試改用完整 `XCUIScreen` 截圖，遊戲程式沒有變更。已實際檢視 home、rooftop、basement、parking、foundations、floor13、nightark 七關完整橫向畫面：場景、美術、HUD 和左右操作區正常顯示，沒有前一種截圖的黑色裁切區。此為起始場景檢視，不代表無輔助全程通關。

第一次補充測試 `34936158368` 在第七關前超過單項測試的 120 秒限制；修正只將這個七次啟動的測試上限設為 300 秒。[補充驗證工作流程 34937614715](https://github.com/tssA8/SnowballQuest/actions/runs/34937614715) 已全部成功，包含完整原生測試與 unsigned iPhone archive。測試来源 `601f4e0` 與已上傳版本的遊戲程式一致，僅有測試修改，不需重新上傳 IPA。

完整七關截圖與 manifest 保存在 `test-results/native-ios-artifact-10384397843`；已下載的原始結果 ZIP 為 `releases/ios/native-34937614715-10384397843.zip`，SHA-256 `e8641bc3c3049dc299a76cb0502f73a0bd5d5fcf127d83f10a3a746161ac4220`，通過 GitHub artifact digest 比對。

## 本次修正與驗證範圍

本次修正跨平台 JSON 換行造成的資源 hash 不一致、Xcode 對動畫時間複合運算式的型別檢查逾時，以及模擬器版本選擇、啟動與 ad hoc 測試簽署。測試 teardown 現在只在真正失敗時記錄畫面，避免測試已關閉 app 後被誤判失敗。

目前驗證涵蓋 CI、模擬器、下載後的 IPA 完整性及 Apple 內部測試狀態；**尚未在實體 iPhone 驗證長時間幀率、溫度、音訊、操作手感及實際舊版安裝升級**。沒有提交公開 App Store 或外部 TestFlight 審查。下方保留較早版本的歷史記錄。

# Swift iOS 驗證 — 2026-09-13 / 0.3.0（首次上傳前的歷史紀錄）

分支：`feature/native-swift-ios`。原生 Swift 程式、Xcode 專案、七關資源和自動測試已建立；此段在首次上傳前記錄，目前 macOS 編譯、iPhone 模擬器與 TestFlight 驗證仍待執行，不能視為已發行。

- 本機 88 項網頁回歸測試通過，網頁與 Android 的 Phaser 程式保留。
- 87 個 PNG／JSON 資源已匯入原生 bundle，65 個 manifest 項目及 17 張水平圖集的尺寸／影格數驗證一致。
- 原生測試覆蓋規則與存檔遷移、關卡載入、觸控區域、集氣釋放／取消、暫停與背景恢復。模擬器會保留七關截圖供檢視。
- 角色移動與碰撞直接在 Swift 運算；場景使用 SpriteKit，介面使用 UIKit。Release 驗證會拒絕包含 Capacitor 或 `public/index.html` 的 native archive。
- 舊版 TestFlight 0.1.1 (3) 與下方網頁測試結果不代表新版 Swift app 已通過。實體 iPhone 的持續幀率、溫度與手感仍需安裝後驗收。

# 七關冒險驗證 — 2026-09-13 / 0.2.0

- 88 項自動測試通過：七關地圖、三階段魔王、集氣取消、補血、元素能力、原生儲存與 v1 → v2 遷移。
- TypeScript 檢查通過。獨立本機預覽使用原生 esbuild；此 Windows 執行環境的 Node 子程序會被 `EPERM` 阻擋，標準 Vite 建置交由既有 GitHub Actions 執行。
- `campaign-browser-fixture.js` 在獨立測試來源完成七關：短按／長按 K、穿甲命中每位魔王、暫停取消、水盾、風二段跳、大地護甲、罐頭補血、連續換關、各關和解與完整永久獎勵。未出現瀏覽器執行錯誤。
- 瀏覽器測試發現並修正第二關離場時重複清理 Phaser 碰撞群組的問題；另有回歸測試覆蓋場景提前銷毀的情況。
- 已檢視天台魔王戰、最終結局與 844 × 390 模擬觸控版面。實體手機驗收與自然遊玩難度測試仍需持續。
- 正式建置及網站發布可查閱 [Pages workflow](https://github.com/tssA8/SnowballQuest/actions/workflows/pages.yml)。

這些是功能驗證；fixture 會定位角色並直接調整部分魔王血量以隔離換關流程，不代表無輔助全程遊玩。下方保留舊版本驗證歷史，不能作為 0.2.0 實機安裝或 TestFlight 發布的證據。

# Home verification — 2026-09-09（歷史紀錄）

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
- On 2026-09-10, the account owner explicitly approved and was invited to `Snowball Quest Internal`. App Store Connect confirms one internal tester with status `Invited` and one build, **0.1.1 (3)**, in the group.
- Physical iPhone installation and play and external beta review have not yet been verified. See `IOS_RELEASE.md` for the release modes and required credentials. Signing files remain in ignored private local storage.

## Public release and Snowball photo update

- The source is committed to `tssA8/SnowballQuest` on GitHub. The `main` workflow runs the tests, builds the game and publishes to [GitHub Pages](https://tssa8.github.io/SnowballQuest/); no visitor account is required.
- Photo revision `c35c6f0` was deployed successfully. The live player PNG's SHA-256 matches the local export, and the public manifest is version 3.
- All 44 Snowball frames use the owner's photo references and retain their 64 × 64 cells, animation indices and bottom-center anchor. The original photographs remain outside the repository.
- The production smoke test also passed against the public GitHub Pages URL: no sign-in, successful PNG/map loading and keyboard fish collection, no runtime/resource errors, and no development test access.
- Release review found a static Snowball portrait behind the victory animation on the result panel. The duplicate image was removed; the result screenshot now shows a single crowned Snowball. The production build and existing browser integration passed again, including stage clear and replay.
