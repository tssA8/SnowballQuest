# 七關冒險素材

來源為使用者提供的 `SnowballQuest_Art_Pack`。整理腳本只讀取來源，不修改外部素材包。遊戲目前使用 **26 個 texture**；`public/assets/adventure/manifest.json` 記錄來源、尺寸、裁切矩形、圖格資料、透明範圍與 SHA-256。

| Texture key | 規格／用途 |
|---|---|
| `snowball-combat` | 1792 × 64；28 個 64 × 64 戰鬥關鍵姿勢 |
| `enemy-vacuum`, `enemy-mouse`, `enemy-pigeon`, `enemy-slime` | 各 384 × 64；6 個 64 × 64 姿勢 |
| `enemy-beetle`, `enemy-mole`, `enemy-dragon`, `enemy-shadow` | 各 384 × 64；6 個 64 × 64 姿勢 |
| `boss-wrench`, `boss-galeplume`, `boss-bobo`, `boss-volt`, `boss-tato` | 各 1024 × 128；8 個 128 × 128 姿勢 |
| `boss-bubble`, `boss-nightink` | 各 1536 × 192；8 個 192 × 192 姿勢 |
| `fire-fruit`, `fruit-wind`, `fruit-water`, `fruit-lightning`, `fruit-earth` | 各 32 × 32；五元素拾取與 HUD 圖示 |
| `portrait-snowball`, `portrait-ai`, `portrait-wrench` | 各 96 × 96 |
| `badge-wrench`, `ship-icon` | 各 64 × 64 |

敵人與魔王來自素材包的 `runtime/enemies/`、`runtime/bosses/`，保留原有固定圖格。後六位魔王在對話、名冊及結算使用各自圖集中的姿勢，並未聲稱另有六張專用對話頭像。

## 載入與動畫

`src/game/art/AdventureAssets.ts` 的 `preloadAdventureAssets(scene)` 依 manifest 載入，網址帶內容雜湊以更新快取。`finishAdventureAssets(scene)` 驗證尺寸、設定 nearest filter 並註冊動畫。原本的 `snowball` 移動圖集保留。

雪球戰鬥動畫：`snowball-attack-1`、`snowball-attack-2`、`snowball-attack-3`、`snowball-air-attack`、`snowball-ground-pound`、`snowball-perfect-dodge`、`snowball-counter`、`snowball-hurt`、`snowball-combat-ko`、`snowball-fruit-eat`、`snowball-transform`。這些是已註冊的圖格序列；註冊圖格本身不代表每個設計動作都有獨立的操作邏輯。

八種 `enemy-*` texture 均註冊 `idle`、`move`、`attack`、`hurt`、`defeated` 後綴。七種 `boss-*` 均註冊 `idle`、`move`、`telegraph`、`attack-a`、`attack-b`、`special`、`hurt`、`defeated`；實際魔王狀態也可以直接設定圖格。

## 整理方式與限制

- 雪球採人工確認的不等寬來源矩形，排除反向姿勢與相鄰角色碎片；28 格共用 0.32 縮放率，以 nearest-neighbor 規整為 64 × 64、底部錨點 `(32, 64)`。
- 戰鬥是**關鍵姿勢原型動畫**，不是補齊所有過渡的正式逐格動畫。位移、命中時機、光圈與攻擊特效由遊戲程式控制。
- 角色 origin 維持 `(0.5, 1)`，碰撞盒仍為原有 30 × 42、offset `(17, 22)`；不隨攻擊圖片輪廓變化。
- 任務項圈與鈴鐺尚未逐格繪入完整本體。原 idle、側向移動、扭身攻擊與倒立姿勢需要不同頸部錨點與遮擋設定，不能把固定項圈貼在所有格上。
- 進食姿勢手上的紫色示意果實來自原圖；五元素的實際拾取圖與效果另行呈現。元素專用全套角色逐格動畫仍待製作。
- 五果實取自 1983 × 793 的 `ui/fruit_pickups_icons.png` 上排，以測量過的不等寬分隔區裁切，避開下排光圈；上排主要圖像位於 y=360 之前。清除細碎雜點後按 Alpha 邊界規整，留 2 px 透明邊。
- 完全透明像素的 RGB 清零；不把來源圖中隱藏的棋盤預覽帶入遊戲。
- 後六關場景、部分平台裝飾、補血罐頭及攻擊特效使用 Phaser 原生圖形。這些不是另外生成的正式背景圖集。

## 重建

需要 Python 3 與 Pillow：

```sh
python scripts/prepare-adventure-assets.py --source "/path/to/SnowballQuest_Art_Pack"
```

`--source` 必填，腳本未綁定特定電腦路徑。輸出固定在腳本所屬專案的 `public/assets/adventure/`；不論執行時工作目錄為何，都重建上述 26 個 texture 與 manifest。原本 10 張素材在擴充後的 SHA-256 均保持一致，包含 28 姿勢雪球戰鬥圖集。

## QA

預覽寫入以下檔案，不作為遊戲 texture 載入：

- `work/adventure-combat-light.png`、`work/adventure-combat-dark.png`
- `work/adventure-ui-light.png`、`work/adventure-ui-dark.png`
- `work/adventure-actors-light.png`、`work/adventure-actors-dark.png`

整理時檢查 RGBA、透明區、固定格尺寸與雪球來源姿勢範圍。五元素裁切已與原圖核對，明暗背景的圖示與角色預覽已檢查。來源圖集本身仍可能需要正式美術階段逐格清理；透明背景和尺寸合格不等同動畫製作完成。
