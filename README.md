# Snowball Quest

此分支 `feature/native-swift-ios` 的 iPhone 版本已改用 **Swift、SpriteKit 與 UIKit**。原生遊戲、測試及建置方式見 [Swift iOS 說明](docs/NATIVE_IOS.md)。網頁與 Android 保留 Phaser；本分支不會自動更新 GitHub Pages。TestFlight 的實際驗證狀態見 [VERIFICATION.md](docs/VERIFICATION.md)。

原生 0.3.1 接入新版待機插圖與五種元素特效，普攻及其他動作共用同一套雪球本體；任務項圈與鈴鐺固定不變。新版大綱、來源素材及匯入方式見 [素材包接入記錄](docs/ART_PACK_INTAKE.md)，外觀與動畫說明見 [ELEMENTAL_ART.md](docs/ELEMENTAL_ART.md)。

《雪球的祕密出勤》是一款 Phaser 橫向動作冒險遊戲。奶油灰、藍眼睛、表情有點厭世的雪球，從沙發底下的警報一路前往永夜方舟，與七位魔王和解，再邀請大家一起回家。

目前提供**七關可遊玩的完整出勤流程、五種元素、補血罐頭、集氣攻擊、循序解鎖與自由巡邏**。角色戰鬥仍使用整理過的關鍵姿勢；後六關場景以 Phaser 圖形組成，尚未替換成完整的正式背景美術。完整設計目標與目前實作的差異見 [七關實作說明](docs/CAMPAIGN.md)；[PHASE1.md](docs/PHASE1.md) 保留第一關原型的歷史紀錄。

## 遊玩與安裝

[GitHub Pages 遊戲網址](https://tssa8.github.io/SnowballQuest/) — 發布版本以最近一次成功的 Pages 工作流程為準。

[舊版 Android 0.1.1 預覽 APK](https://github.com/tssA8/SnowballQuest/releases/tag/v0.1.1-mobile-preview) 是先前的行動版發行包，**不包含這次七關更新**。Android 使用 Capacitor，iOS 在此分支改用原生 Swift；重新打包方式見 [MOBILE.md](docs/MOBILE.md)。iPhone 安裝需 Apple 簽章，[iOS 發布流程](docs/IOS_RELEASE.md) 支援建立 IPA、上傳 TestFlight 及確認 Apple 處理狀態。

## 本機啟動

使用 Node.js 22.18 以上版本，以便測試直接載入 TypeScript 規則模組。

```sh
npm install
npm run dev
```

開啟 Vite 顯示的網址，通常是 `http://localhost:5173`。同一區域網路的手機可透過電腦的 LAN 位址連線；防火牆需允許該連線。

```sh
npm test
npm run build
npm run preview
npm run assets:map
node scripts/generate-stages.mjs
```

`build` 先檢查 TypeScript，再產生 `dist/`；`preview` 預覽正式建置。`assets:map` 重建第一關的 Tiled 地圖；`generate-stages.mjs` 重建後六關 JSON 地圖。七關故事與獎勵定義在 `src/game/data/stages.ts`，後六關場景與環境互動由 `src/game/world/StageWorld.ts` 呈現。

遊戲以 1280 × 720 顯示，使用 nearest-neighbor 像素美術、Arcade Physics、Web Audio 與本機存檔。

## 操作

| 動作 | 鍵盤 | 手機 |
|---|---|---|
| 移動 | A／D 或 ←／→ | 左／右 |
| 跳躍；按久一點跳高 | Space | 跳躍 |
| 肉球連擊／附近物件互動 | J／E | 肉球／互動 |
| 快速特殊攻擊 | 輕按 K 後放開 | 輕按「集氣」後放開 |
| 集氣攻擊 | 按住 K，蓄滿後放開 | 按住「集氣」，亮起後放開 |
| 循環切換已取得的元素與原生形態 | Q | 點左下果實卡 |
| 衝刺閃避 | Shift | 衝刺 |
| 暫停 | Esc | 暫停按鈕 |
| 對話繼續 | E／Space | 點一下對話 |

集滿需要 **1.2 秒**。快速特殊攻擊消耗 **16** 呼嚕能量，一般滿蓄力攻擊消耗 **30**；中途放開會依蓄力程度調整威力與耗能。沒有果實也能發射肉球能量波。第七關啟用的星貓爆發是另計 100 能量的強化招式，詳見 [CAMPAIGN.md](docs/CAMPAIGN.md)。

碰到粉紅**愛心罐頭**會自動回復 **2 顆心＋20 能量**；生命與能量都滿時保留罐頭。沿途有補給，魔王場內罐頭會再生，低血量還會出現救援罐頭。魔王戰失敗可從入口立即重試，回滿生命與能量，並保留本關試用元素。

## 七次出勤

| 關卡 | 目的地 | 魔王 | 主要解鎖 |
|---|---|---|---|
| 1 | 沙發底下的警報 | 扳手 | 火焰、攻擊力 +10% |
| 2 | 天台風暴 | 風翎 | 風、二段跳與滑翔 |
| 3 | 地下水世界 | 波波 | 水、生命上限 6 心 |
| 4 | 停電停車場 | 伏特 | 雷電、能量上限 120 與較快回復 |
| 5 | 地基大震動 | 土豆 | 大地、第三段連擊強化 |
| 6 | 十三樓泡泡龍之家 | 泡泡龍媽媽 | 元素連攜、同伴救援 |
| 7 | 夜空中的回家路 | 夜墨 | 星貓爆發、自由巡邏 |

打贏魔王即可完成出勤；**星星、鑰匙與支線不阻擋主線**。前五關的祭壇先提供本關試用，和解後才永久保留果實。星圖可重玩所有已解鎖關卡，飛船名冊顯示實際取得的同伴、徽章與元素。

## 存檔

存檔內容已升級為 **schema v2**，儲存鍵仍是 `snowball-quest-save-v1`，讓舊瀏覽器與 Capacitor 原生存檔能在原位置遷移。

```ts
{
  version: 2,
  currentStage, unlockedStages, stages,
  unlockedFruits, unlockedSupport, bossBadges,
  maxHearts, maxPurrEnergy,
  settings: { music, sfx, reducedMotion },
  run: { checkpoint, collected, flags, hearts, elapsed },
  adventure: { fireUnlocked, wrenchJoined, attackBonus },
  legacyStages
}
```

v1 設定、有效的當次探索進度與成績會被保留；已取得的扳手獎勵遷移為第一關徽章與火焰解鎖。舊探索通關成績不會憑空轉換成魔王獎勵。舊咖啡廳／花園／結局成績移到 `legacyStages`。下一關由前一關徽章解鎖；重玩只重設當次出勤，不疊加永久獎勵。

所有時間為毫秒。存檔驗證會去除重複 ID、限制不合法數值；不支援的版本回到安全預設。儲存無法使用時仍可用記憶體存檔遊玩。不同瀏覽器與網址來源的進度分開保存。

## 素材與專案結構

[冒險素材說明](docs/ADVENTURE_ASSETS.md) 列出 26 個遊戲 texture、透明度檢查與可重建腳本：8 種小怪、7 位魔王、5 種果實、3 張頭像、徽章、飛船圖示與 28 姿勢雪球戰鬥圖集。原本的雪球移動圖集保留；角色辨識見 [SNOWBALL_IDENTITY.md](docs/SNOWBALL_IDENTITY.md)。外部素材包只讀，不由建置程序修改。

```text
public/assets/          遊戲圖集、UI、Tiled 地圖
scripts/                素材整理、建置與瀏覽器檢查
src/game/data/          七關定義、關卡資料與舊探索任務
src/game/combat/        連擊、集氣、五元素與補血
src/game/entities/      雪球、八種小怪與魔王
src/game/scenes/        選單、出勤、HUD、星圖與結算
src/game/systems/       輸入、存檔、對話與音效
src/game/world/         場景、碰撞與關卡特殊環境
src/game/ui/            手機操作與 UI 元件
tests/                  規則、存檔、地圖與戰鬥檢查
```

新增關卡時同步維護 `stages.ts`、存檔合法關卡 ID、場景資料與魔王；第一關 Tiled 格式見 [LEVEL_FORMAT.md](docs/LEVEL_FORMAT.md)。素材的可見輪廓與碰撞盒分開維護，不因攻擊圖格改變碰撞大小。

## 發布與驗證

GitHub Actions 在 `main` 更新時執行測試、建置並發布 `dist/` 至 GitHub Pages；Pages 來源需設為 **GitHub Actions**。相對素材路徑同時支援 `/SnowballQuest/` 與網域根目錄。

本輪 88 項自動測試與 TypeScript 檢查通過。七關瀏覽器 fixture 已檢查實際集氣命中、水盾、罐頭補血、風二段跳、七關結算與永久獎勵保存，未出現 runtime error。本機瀏覽器檢查使用原生 esbuild 預覽；標準 Vite 正式建置與發布結果由 [GitHub Pages workflow](https://github.com/tssA8/SnowballQuest/actions/workflows/pages.yml) 記錄。

最新執行結果見 [VERIFICATION.md](docs/VERIFICATION.md)。規則測試與瀏覽器功能檢查涵蓋不同層次；以測試定位或直接調整狀態檢查通關，不等同首次玩家無輔助全程遊玩。七關流程已實作，正式動畫、實機效能、觸控手感與難度仍需持續驗收，列於 [TODO.md](docs/TODO.md)。
