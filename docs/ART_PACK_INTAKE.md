# 更新素材包 — 2026-09-15

來源為使用者指定的 `D:\project\sideproject\SnowballQuest_2D_Art_Pack\SnowballQuest_Art_Pack`。已完整閱讀遊戲設計文件、雪球製作筆記和 runtime 說明，檢視角色總覽、五種元素來源圖、深淺背景 QA 與指定的新標題畫面。

## 檢查結果

- 原包 manifest 的 90 個檔案 SHA-256 全部吻合；53 張 PNG 可讀，29 張必要來源圖均有 Alpha。原包未被修改。
- 44 格雪球 atlas 與目前版本 SHA-256 相同；七位魔王、八種敵人 atlas 的解碼像素也完全相同，已在遊戲中使用。
- 五張元素來源圖是 key pose／VFX 設計稿。保留現有雪球本體，從底部量測、裁切 32 個獨立特效，整理成五張 128px 透明圖集。
- 裁切使用 nearest-neighbor，清掉鄰格碎片與極小殘點，保留有效像素的原始顏色和 Alpha。來源矩形、尺寸及每格清理數量記在 `public/assets/elements/manifest.json`。
- 依新版設定，所有出勤形態共用深色項圈及金色任務鈴鐺。元素表現在腳掌、尾巴及局部耳緣。
- 普攻、衝刺、施法及受傷保留同一套雪球本體。設計稿建議的 67 格新戰鬥動畫仍未補齊，沒有當成完整逐格動畫交付。
- 額外指定的 `snowballquest_title_screen_v3_cutecat.png` 原樣匯入 `public/assets/presentation/title-screen.png`，SHA-256 為 `94cef815f5b383f4c00e8198b628fd9e87305b62e040fbfabc87be7d43e87670`。主選單完整等比顯示，START 開啟關卡選擇、CONTINUE 恢復出勤；同伴與設定保留原生入口，觸控區至少 48pt。

## 可重建來源

- 新大綱：`docs/SnowballQuest_Game_Design.md` 保留原文；Phaser 建議是跨平台設計參考，iOS 繼續使用 Swift/SpriteKit。
- 原包索引：`resources/art/pack-manifest.json`。
- 使用中的高解析特效來源及筆記：`resources/art/element-sources/`。
- `python scripts/prepare-element-art.py` 由保留來源重新產生圖集；`--source <原包路徑>` 會先驗證原包再匯入。需要 Pillow。
- `python scripts/prepare-native-assets.py` 將 95 個 PNG／JSON 同步進原生 bundle 並建立 SHA-256 清單。

這次保留既有七關玩法與存檔。大綱中的完整中間格、部分選擇性支線及首次玩家實驗仍是後續工作，不以設計文件代替實作完成證據。畫面與實際測試結果見 `ELEMENTAL_ART.md`、`VERIFICATION.md`。
