# Snowball Element Source Sheets

## 共通生成規格

- 使用類型：`stylized-concept`
- 用途：SnowballQuest 2D 像素角色、攻擊與 VFX 製作來源圖
- 身分參考：使用者提供的五張雪球照片
- 風格參考：現有遊戲柔和像素美術；角色原始圖已收錄於 `../../runtime/snowball/snowball_existing_44f.png`，角色定稿見 `snowball_turnaround_expressions.png`
- 不變條件：同一隻母貓、奶油灰短毛、額頭灰紋、淡藍眼睛、圓潤身形、冷靜厭世表情、深色任務項圈與金色任務鈴鐺
- 輸出條件：1536×1024、透明背景、清楚分離的角色姿勢與獨立 VFX、無文字、無格線、無浮水印

## Prompt 摘要

共通主提示：

> Generate a production-oriented true pixel-art source sheet for the same recognizable female cat Snowball. Preserve her cream-gray coat, forehead markings, pale blue eyes, compact body and calm unimpressed expression. Include fruit transformation, idle aura, elemental basic attack sequence, charged special, environmental-use pose, impact and standalone VFX. Keep every pose separated, facing right, with consistent scale and a genuinely transparent background. No text, grid, logo or watermark.

各元素追加要求：

- `snowball_fire_sheet.png`：橘紅火焰集中於腳掌與尾尖；火焰爪、火球、烈焰衝刺、點燃藤蔓／火盆。
- `snowball_wind_sheet.png`：薄荷綠氣流與葉片；風刃、龍捲、滑翔、吹動風車與平台。
- `snowball_water_sheet.png`：亮藍水滴與開放式浪花；水刃、氣泡防禦、浪潮推進、滅火與水輪互動。
- `snowball_lightning_sheet.png`：藍金電弧與微微豎起的毛尖；連鎖電爪、閃電突進、落雷、啟動電源。
- `snowball_earth_sheet.png`：只在前腳、肩與尾部增加石塊／苔蘚護甲；石爪、震地、岩壁、重型開關。

## QA

| 檔案 | 尺寸 | Alpha 透明區 |
|---|---:|---:|
| snowball_fire_sheet.png | 1536×1024 | 66.4% |
| snowball_wind_sheet.png | 1536×1024 | 64.1% |
| snowball_water_sheet.png | 1536×1024 | 66.4% |
| snowball_lightning_sheet.png | 1536×1024 | 64.6% |
| snowball_earth_sheet.png | 1536×1024 | 63.6% |

五張皆為 sRGBA PNG，已移除產生過程中的漸層、洋紅或棋盤背景，並以淺色與深色底合成檢查。

這些檔案是角色設計與動畫關鍵姿勢來源圖。正式匯入遊戲前需在 Aseprite 中整理成固定 64×64 格、統一 bottom-center 錨點並補足逐格過渡；深色任務項圈與金色任務鈴鐺必須在所有出勤 frame 中保持一致，不隨元素切換。
