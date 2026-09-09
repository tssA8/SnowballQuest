import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Tiled-compatible source generator. Edit coordinates here, then node scripts/generate-map.mjs.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const columns = 128;
const rows = 24;
const tileSize = 32;
let nextObjectId = 1;
let nextLayerId = 1;
const properties = values => Object.entries(values).map(([name, value]) => ({
  name, type: typeof value === 'number' ? (Number.isInteger(value) ? 'int' : 'float') : typeof value === 'boolean' ? 'bool' : 'string', value,
}));
const point = (name, type, x, y, props = {}) => ({
  id: nextObjectId++, name, type, x, y, width: 0, height: 0, point: true,
  rotation: 0, visible: true, properties: properties(props),
});
const objectLayer = (name, objects, visible = true) => ({
  id: nextLayerId++, name, type: 'objectgroup', draworder: 'topdown', opacity: 1,
  visible, x: 0, y: 0, objects,
});
const rect = (name, kind, x, y, width, height) => ({
  id: nextObjectId++, name, type: 'solid', x, y, width, height,
  rotation: 0, visible: true, properties: properties({ kind, oneWay: kind === 'platform' }),
});

const solids = [
  rect('floor-west', 'ground', 0, 640, 2496, 128),
  rect('floor-east', 'ground', 2592, 640, 1504, 128),
  rect('jump-lesson', 'platform', 448, 576, 192, 32),
  rect('window-shelf', 'platform', 672, 512, 160, 32),
  rect('secret-nook-shelf', 'platform', 704, 384, 352, 32),
  rect('tower-step-one', 'platform', 1568, 576, 128, 32),
  rect('tower-step-two', 'platform', 1664, 512, 128, 32),
  rect('tower-step-three', 'platform', 1760, 448, 128, 32),
  rect('tower-top', 'platform', 1856, 384, 224, 32),
  rect('balcony-step-one', 'platform', 2592, 576, 128, 32),
  rect('balcony-step-two', 'platform', 2688, 512, 128, 32),
  rect('balcony-star-shelf', 'platform', 2784, 448, 256, 32),
  rect('balcony-flower-stand', 'platform', 3168, 576, 160, 32),
];
const tileLayer = (name, kind, tile) => {
  const data = Array(columns * rows).fill(0);
  for (const solid of solids.filter(solid => solid.properties.some(prop => prop.name === 'kind' && prop.value === kind))) {
    for (let y = solid.y / tileSize; y < (solid.y + solid.height) / tileSize; y++) {
      for (let x = solid.x / tileSize; x < (solid.x + solid.width) / tileSize; x++) data[y * columns + x] = tile;
    }
  }
  return { id: nextLayerId++, name, type: 'tilelayer', x: 0, y: 0, width: columns, height: rows, opacity: 1, visible: true, data };
};

const fishPositions = [
  [288,600],[352,600],[480,540],[560,540],[704,476],[768,476],
  [864,348],[960,348],[1008,600],[1160,600],[1300,600],[1456,600],
  [1616,540],[1736,476],[1824,412],[1932,348],[2112,600],[2240,600],
  [2424,600],[2648,540],[2736,476],[2848,412],[2960,412],[3096,600],
  [3200,540],[3264,540],[3408,600],[3600,600],[3736,600],[3832,600],
];
const collectibles = [
  ...fishPositions.map(([x,y], index) => point(`fish-${String(index + 1).padStart(2, '0')}`, 'fish', x, y, { amount: 1 })),
  point('feather-jump', 'feather', 544, 528, { color: 'pink' }),
  point('feather-tower', 'feather', 1808, 400, { color: 'blue' }),
  point('feather-secret', 'feather', 912, 332, { color: 'purple', secretId: 'secret-feather' }),
  point('key-balcony', 'key', 2000, 344),
  point('star-shelf', 'star', 2900, 404, { secretId: 'high-shelf' }),
  point('star-balcony', 'star', 3720, 584),
  point('heart-after-vacuum', 'heart', 1512, 604),
];

const objects = [
  point('toy-feather-wand', 'feather-wand', 416, 640),
  point('toy-yarn-one', 'yarn-ball', 880, 640, { color: 'pink' }),
  point('toy-yarn-two', 'yarn-ball', 1024, 640, { color: 'blue' }),
  point('toy-plush-mouse', 'plush-mouse', 1220, 640, { questId: 'mouse-delivery' }),
  point('toy-bell-ball', 'bell-ball', 1456, 640),
  point('toy-scratching-board', 'scratching-board', 1520, 640),
  point('tunnel-entry', 'cat-tunnel', 664, 640, { targetX: 760, targetY: 384, targetId: 'tunnel-return', secretId: 'secret-nook', label: 'A suspiciously cozy tunnel' }),
  point('tunnel-return', 'cat-tunnel', 760, 384, { targetX: 704, targetY: 640, targetId: 'tunnel-entry', label: 'Back to the living room' }),
  point('toy-treat-box', 'toy-box', 2352, 640, { requires: 'mouse-helped,scratched', reward: 'star-box', label: 'The empty treat box' }),
  point('balcony-door', 'door', 3500, 640, { width: 64, height: 192, requires: 'key-found,mouse-helped,box-open', label: 'Balcony door' }),
];
const decorBack = [
  point('home-window-one', 'window', 420, 410),
  point('home-window-two', 'window', 1300, 410),
  point('home-window-three', 'window', 2300, 410),
  point('home-window-four', 'window', 3096, 410),
  point('home-sofa', 'sofa', 300, 640),
  point('home-cushion', 'cushion', 160, 640),
  point('home-lamp-one', 'lamp', 84, 640),
  point('home-books-one', 'books', 792, 640),
  point('home-plant-one', 'plant', 1136, 640),
  point('home-cat-tree', 'cat-tree', 1872, 640),
  point('home-tower-books', 'books', 1648, 640),
  point('home-tower-plant', 'plant', 2080, 640),
  point('home-shelf-one', 'shelf', 864, 384),
  point('home-shelf-two', 'shelf', 2912, 448),
  point('home-secret-books', 'books', 1032, 384),
  point('home-lamp-two', 'lamp', 2470, 640),
  point('home-plant-two', 'plant', 3248, 576),
  point('balcony-plant-one', 'plant', 3616, 640),
  point('balcony-plant-two', 'plant', 4016, 640),
];
const decorFront = [
  point('home-rug-start', 'rug', 400, 640),
  point('home-rug-mouse', 'rug', 1152, 640),
  point('home-rug-box', 'rug', 2312, 640),
];
const npcs = [
  point('mouse-courier', 'mouse', 1120, 640, { dialogueId: 'mouse_intro', questId: 'mouse-delivery' }),
  point('vacuum-one', 'robot-vacuum', 1360, 640, { patrolMin: 1296, patrolMax: 1472, speed: 42 }),
  point('professional-napper', 'sleepy-cat', 1000, 384, { dialogueId: 'sleepy_cat' }),
];
const triggers = [
  point('tutorial-move', 'sign', 176, 510, { text: 'A / D or ← → to move', label: 'WAKING UP IS THE HARD PART' }),
  point('tutorial-jump', 'sign', 456, 464, { text: 'Space to jump • Hold for height', label: 'FOLLOW THAT FEATHER' }),
  point('tutorial-interact', 'sign', 1104, 500, { text: 'E to say hello', label: 'A VERY SMALL MISSION' }),
  point('tower-hint', 'sign', 1696, 330, { text: 'A key? On my cat tower?', label: 'THE HIGHER STANDARD' }),
  point('balcony-hint', 'sign', 3376, 472, { text: 'Help a friend. Find a key. Bring a star.', label: 'A BRIGHTER TOMORROW' }),
  point('secret-nook', 'secret', 880, 384, { width: 352, height: 112, secretId: 'secret-nook', label: 'THE PROFESSIONAL NAPPING CLUB' }),
];
const checkpoints = [point('checkpoint-paw', 'checkpoint', 2176, 640, { label: 'A small pause. A fresh start.' })];
const exits = [point('home-exit', 'stageExit', 3904, 640, { nextStage: 'rooftops', requires: 'balcony-open', width: 96, height: 128 })];
const layers = [
  tileLayer('Ground', 'ground', 1), tileLayer('Platforms', 'platform', 2),
  objectLayer('DecorBack', decorBack), objectLayer('DecorFront', decorFront),
  objectLayer('Collision', solids, false), objectLayer('Objects', objects),
  objectLayer('Spawn', [point('snowball-spawn', 'player', 160, 640)]),
  objectLayer('Collectibles', collectibles), objectLayer('NPC', npcs),
  objectLayer('Triggers', triggers), objectLayer('Checkpoints', checkpoints), objectLayer('Exit', exits),
];
const map = {
  compressionlevel: -1, height: rows, width: columns, infinite: false,
  tileheight: tileSize, tilewidth: tileSize, orientation: 'orthogonal',
  renderorder: 'right-down', tiledversion: '1.11.2', type: 'map', version: '1.10',
  nextlayerid: nextLayerId, nextobjectid: nextObjectId,
  properties: properties({ stageId: 'home', title: 'HOME — THE EMPTY TREAT BOX', fishTotal: 30, starTotal: 3, featherTotal: 3, secretTotal: 3, objectAnchor: 'bottom-center' }),
  tilesets: [{ firstgid: 1, name: 'world', tilewidth: 32, tileheight: 32, tilecount: 2, columns: 2, image: '../tiles/world.png', imagewidth: 64, imageheight: 32, margin: 0, spacing: 0 }],
  layers,
};
mkdirSync(resolve(root, 'public/assets/maps'), { recursive: true });
writeFileSync(resolve(root, 'public/assets/maps/home.json'), `${JSON.stringify(map, null, 2)}\n`);
console.log(`Home: ${map.width * tileSize}×${map.height * tileSize}, ${collectibles.filter(item => item.type === 'fish').length} fish, ${solids.length} collision rectangles.`);
