# Swift 原生 iOS

`feature/native-swift-ios` 將 iPhone app 改為 Swift、SpriteKit 和 UIKit。七關地圖與 PNG 美術由原專案匯入；角色移動、碰撞、集氣、補血、小怪、魔王、UI、音效和存檔由 Swift 執行。App target 不連結 Capacitor，也不打包 HTML 或 JavaScript。

Bundle ID 維持 `io.github.tssa8.snowballquest`，可以透過 TestFlight 更新原本的安裝。此分支使用版本 0.3.0，首次原生上傳使用 build 4。是否已通過測試及 Apple 處理，以 [驗證記錄](VERIFICATION.md) 和工作流程結果為準。

## iPhone 操作

- 左右按鈕移動；跳躍可以和移動、攻擊同時按住。
- 肉球按鈕發動三段連擊；空中按下可攻擊。
- 按住「集氣」約 1.2 秒，放開發射；手指拖出按鈕會取消且不消耗能量。
- 閃避提供短暫保護；上方元素按鈕循環切換目前取得的形態。
- 粉紅罐頭自動補 2 心與 20 能量；魔王場補給會再生，低生命會出現救援補給。
- 返回主畫面或音訊中斷時暫停、放開所有輸入並保存。回到遊戲後按「繼續冒險」。

介面使用 iOS safe area，觸控區至少 48 pt，支援橫向左右旋轉。設定可控制音樂、音效、震動和減少動態效果。外接鍵盤支援方向鍵／A、D、Space、J、K、Q、Shift 和 Esc。VoiceOver 也可對集氣按鈕執行「滿蓄力攻擊」操作。

七關保留循序解鎖、五種元素、和解對話、永久獎勵、飛船名冊、重玩和最終回家結局。素材仍採用整理過的角色關鍵姿勢和圖形場景，原生版沒有額外重繪正式動畫。主線不要求收齊星星。

第一關的選擇性探索配合觸控簡化：寶箱星星可直接收集，原隧道入口改成可跳躍階梯。網頁版的物件遞送對話未搬進這個介面；七關主線與每關三顆星仍可完成。

## 程式結構

| 路徑 | 責任 |
| --- | --- |
| `ios/NativeCore` | 獨立 Swift package：關卡、獎勵、連擊、集氣、魔王規則、存檔與遷移 |
| `ios/App/App/NativeGame` | SpriteKit 角色、地圖、原生碰撞與戰鬥、音效 |
| `ios/App/App/NativeUI` | UIKit 選單、HUD、多點觸控、對話、暫停與生命週期 |
| `ios/App/App/GameAssets` | 隨 app 打包的 PNG／JSON 和素材 SHA-256 清單 |
| `ios/App/NativeUITests` | iPhone 模擬器操作與畫面測試 |
| `.github/workflows/ios-native.yml` | Swift 規則、iPhone 測試及 unsigned arm64 archive |
| `.github/workflows/ios-release.yml` | 重跑測試、簽名、上傳與 TestFlight 可用性驗證 |

Xcode 的同步目錄會自動納入 NativeGame 與 NativeUI 裡的新 Swift 檔案。`CapApp-SPM` 和舊的 iOS 網頁檔案僅保留為歷史資料，已從 app target 移除。

## 在 Mac 建置

需要 Xcode 26.3；支援 iOS 15 以上。Windows 可編輯程式與執行 Python helper 測試，iPhone 編譯及模擬器測試由 GitHub macOS runner 執行。

```sh
swift test --package-path ios/NativeCore
open ios/App/App.xcodeproj
```

選擇 `App` scheme 與可用的 iPhone simulator，執行 Product → Test。所有測試資料使用獨立 UserDefaults suite，測試啟動參數只存在 Debug build。正式 Release 不包含測試用解鎖入口。

遊戲素材已放入版本控制。只有原始 PNG／JSON 改變時才需要重新匯入：

```sh
python3 scripts/prepare-native-assets.py
```

本分支不對 iOS 執行 `cap sync`，以免舊的 WebView 產生流程覆蓋原生專案。`npm run mobile:sync` 只同步 Android。網頁開發仍可使用 `npm run dev`。

## 存檔與升級

原生存檔使用 UserDefaults 的 `snowball-quest-native-save-v1`。首次啟動會檢查舊 Capacitor Preferences 的 `CapacitorStorage.snowball-quest-save-v1`，保留已取得的徽章、果實、當次 checkpoint、收集品、設定及成績；舊毫秒時間轉為原生秒數。遷移不刪除舊值。

試用果實只屬於目前關卡。徽章才提供永久獎勵，重玩不重複增加上限。存檔在 checkpoint、過關、離開和背景暫停時保存；資料留在目前裝置，沒有雲端同步。瀏覽器的進度不會自動出現在 app 裡。

## TestFlight

原生分支的推送只觸發測試。簽名／上傳由既有 **Prepare or upload iOS release** 手動工作流程執行，選擇分支 `feature/native-swift-ios`、模式 `testflight` 和未上傳過的 build number。

工作流程先通過原生測試，再驗證 arm64 archive 確實使用 SpriteKit、包含七張地圖而未打包網頁。簽名及 API 金鑰沿用既有 GitHub Secrets。上傳後等待 Apple `VALID`，只將 build 加入既有 `Snowball Quest Internal` 內部群組，並確認 `IN_BETA_TESTING`；不新增測試者或提交外部測試審查。

模擬器自動測試不能代表實際手機的長時間幀率、溫度、音訊和手感。這些需要安裝 TestFlight 後在實機確認。每次驗證的實際範圍記錄在 [VERIFICATION.md](VERIFICATION.md)。
