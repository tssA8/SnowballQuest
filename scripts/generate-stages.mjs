import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Every stage has a safe lower route and three independently reachable optional branches.
// Coordinates are tile aligned. Individual steps rise at most 96px and gaps are at most 96px.
export const ROUTES = [
  { id: 'rooftop', title: '天台風暴', next: 'basement',
    platforms: [[448,576,192],[640,512,160],[800,448,192],[1024,384,224],
      [1440,576,128],[1600,480,192],[1792,416,256],
      [2400,576,192],[2624,512,128],[2752,448,224],[2944,384,256],[3232,480,160]],
    stars: [[1136,342],[1920,374],[3072,342]],
    feature: '風流', instructions: '淡青色氣流會把你送上屋頂；地面也能直達右側。',
    features: [[880,640,'wind-lift'],[2560,640,'wind-lift']],
  },
  { id: 'basement', title: '地下水世界', next: 'parking',
    platforms: [[384,576,160],[576,512,224],[832,448,288],
      [1344,576,224],[1568,512,128],[1760,448,160],[1952,384,224],
      [2464,576,160],[2656,480,192],[2880,416,320],[3296,544,160]],
    stars: [[992,406],[2080,342],[3072,374]],
    feature: '浮力水池', instructions: '水池會托住落下的雪球，水果實能讓上浮更容易。',
    features: [[832,640,'water-pool'],[2528,640,'water-pool']],
  },
  { id: 'parking', title: '停電停車場', next: 'foundations',
    platforms: [[416,576,224],[672,512,160],[896,448,224],[1152,448,192],
      [1600,576,192],[1824,512,224],[2080,448,128],
      [2400,576,160],[2560,512,192],[2816,448,224],[3072,384,256]],
    stars: [[1248,406],[2144,406],[3200,342]],
    feature: '充電電纜', instructions: '電纜黃燈是預警，藍燈才會放電。跳過或用雷電／大地形態通過。',
    features: [[1088,640,'electric-cable'],[2592,640,'electric-cable']],
  },
  { id: 'foundations', title: '地基大震動', next: 'floor13',
    platforms: [[448,576,128],[576,512,160],[768,416,192],[992,352,256],
      [1472,576,224],[1728,480,224],[2016,416,160],
      [2400,576,224],[2624,512,128],[2752,448,160],[2944,384,288]],
    stars: [[1120,310],[2096,374],[3120,342]],
    feature: '根脈礦道', instructions: '地面的路通往土豆。切換大地形態、靠近高處裂紋岩牆可打開捷徑。',
    features: [[3016,384,'earth-wall']],
  },
  { id: 'floor13', title: '十三樓泡泡龍之家', next: 'nightark',
    platforms: [[384,576,192],[608,512,224],[832,448,128],[1024,384,256],
      [1440,576,160],[1632,512,192],[1888,448,256],[2144,384,128],
      [2464,576,192],[2720,480,160],[2944,416,288],[3296,512,160]],
    stars: [[1152,342],[2208,342],[3088,374]],
    feature: '上升泡泡', instructions: '踩上透明泡泡會彈到高处；前往右側，幫龍媽媽找到龍蛋。',
    features: [[1360,580,'bubble-lift'],[2320,580,'bubble-lift']],
  },
  { id: 'nightark', title: '夜空中的回家路', next: 'home',
    platforms: [[416,576,160],[640,480,192],[896,384,224],[1184,448,128],
      [1504,576,128],[1696,480,160],[1920,384,256],[2240,448,128],
      [2496,576,160],[2720,480,224],[3008,384,256],[3328,512,128]],
    stars: [[1008,342],[2048,342],[3136,342]],
    feature: '低重力星橋', instructions: '發光星橋會減緩下墜。沿著星光向右，大家正在等你一起回家。',
    features: [[704,640,'gravity-field'],[1824,640,'gravity-field'],[2880,640,'gravity-field']],
  },
];

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const columns = 152, rows = 24, tileSize = 32;
const properties = values => Object.entries(values).map(([name, value]) => ({
  name, type: typeof value === 'number' ? 'int' : typeof value === 'boolean' ? 'bool' : 'string', value,
}));

export function generateStage(route) {
  let objectId = 1, layerId = 1;
  const point = (name, type, x, y, props = {}) => ({
    id: objectId++, name, type, x, y, width: 0, height: 0, point: true, rotation: 0, visible: true,
    properties: properties(props),
  });
  const rect = (name, kind, x, y, width, height) => ({
    id: objectId++, name, type: 'solid', x, y, width, height, rotation: 0, visible: true,
    properties: properties({ kind, oneWay: kind === 'platform' }),
  });
  const solids = [rect(`${route.id}-floor`, 'ground', 0, 640, 4864, 128),
    ...route.platforms.map(([x,y,width], i) => rect(`${route.id}-ledge-${i + 1}`, 'platform', x, y, width, 32))];
  const objectLayer = (name, objects, visible = true) => ({
    id: layerId++, name, type: 'objectgroup', draworder: 'topdown', opacity: 1, visible, x: 0, y: 0, objects,
  });
  const tileLayer = (name, kind, tile) => {
    const data = Array(columns * rows).fill(0);
    for (const solid of solids.filter(s => s.properties.some(p => p.name === 'kind' && p.value === kind))) {
      for (let y = solid.y / tileSize; y < (solid.y + solid.height) / tileSize; y++) {
        for (let x = solid.x / tileSize; x < (solid.x + solid.width) / tileSize; x++) data[y * columns + x] = tile;
      }
    }
    return { id: layerId++, name, type: 'tilelayer', x: 0, y: 0, width: columns, height: rows, opacity: 1, visible: true, data };
  };
  const groundFish = [288, 368, 752, 1200, 1328, 1536, 2240, 2336, 2816, 3392, 3472, 3616];
  const highFish = Array.from({ length: 12 }, (_, i) => {
    const [x, y, width] = route.platforms[i % route.platforms.length];
    return [x + Math.round(width * (i < route.platforms.length ? .5 : .25)), y - 36];
  });
  const fish = [...groundFish.map(x => [x, 600]), ...highFish];
  const collectibles = [
    ...fish.map(([x,y], i) => point(`fish-${route.id}-${String(i + 1).padStart(2, '0')}`, 'fish', x, y, { amount: 1 })),
    ...route.stars.map(([x,y], i) => point(`star-${route.id}-${i + 1}`, 'star', x, y)),
  ];
  const triggers = [
    point(`${route.id}-welcome`, 'sign', 220, 476, { label: route.title, text: '向右前進 →　星星與高處路線皆可自由探索' }),
    point(`${route.id}-feature-hint`, 'sign', 730, 296, { label: route.feature, text: route.instructions }),
    point(`${route.id}-boss-hint`, 'sign', 3330, 420, { label: '魔王就在前面', text: '補血罐頭碰到就會吃，按住 K 或手機集氣鍵！' }),
    ...route.features.map(([x,y,type], i) => point(`${route.id}-feature-${i + 1}`, type, x, y)),
  ];
  const layers = [
    tileLayer('Ground', 'ground', 1), tileLayer('Platforms', 'platform', 2),
    objectLayer('DecorBack', []), objectLayer('DecorFront', []), objectLayer('Collision', solids, false),
    objectLayer('Objects', []), objectLayer('Spawn', [point(`${route.id}-spawn`, 'player', 160, 640)]),
    objectLayer('Collectibles', collectibles), objectLayer('NPC', []), objectLayer('Triggers', triggers),
    objectLayer('Checkpoints', [
      point('checkpoint-paw', 'checkpoint', 2176, 640, { label: '休息一下，再出發。' }),
      point('checkpoint-boss', 'checkpoint', 3590, 640, { label: '魔王重試點' }),
    ]),
    objectLayer('Exit', [point(`${route.id}-exit`, 'stageExit', 4768, 640, {
      nextStage: route.next, requires: 'boss-defeated', width: 96, height: 128,
    })]),
  ];
  return {
    compressionlevel: -1, height: rows, width: columns, infinite: false, tileheight: tileSize, tilewidth: tileSize,
    orientation: 'orthogonal', renderorder: 'right-down', tiledversion: '1.11.2', type: 'map', version: '1.10',
    nextlayerid: layerId, nextobjectid: objectId,
    properties: properties({ stageId: route.id, title: route.title, fishTotal: fish.length, starTotal: 3,
      featherTotal: 0, secretTotal: 0, objectAnchor: 'bottom-center', environment: route.feature }),
    tilesets: [{ firstgid: 1, name: 'world', tilewidth: 32, tileheight: 32, tilecount: 2, columns: 2,
      image: '../tiles/world.png', imagewidth: 64, imageheight: 32, margin: 0, spacing: 0 }],
    layers,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(resolve(root, 'public/assets/maps'), { recursive: true });
  for (const route of ROUTES) {
    writeFileSync(resolve(root, `public/assets/maps/${route.id}.json`), `${JSON.stringify(generateStage(route), null, 2)}\n`);
    console.log(`${route.id}: 4864×768, 24 fish, 3 optional stars, ${route.platforms.length} distinct ledges`);
  }
}
