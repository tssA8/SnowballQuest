/** Tiled point objects use a bottom-center anchor; collision rectangles use top-left. */
export type LevelProperty = string | number | boolean;
export type LevelProperties = Record<string, LevelProperty>;

export interface LevelObject {
  /** Stable save key, authored as the object name in Tiled. */
  id: string;
  tiledId: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: LevelProperties;
}

export interface LevelPlatform {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: 'ground' | 'platform';
  oneWay: boolean;
}

export interface LevelData {
  id: string;
  title: string;
  width: number;
  height: number;
  tileSize: number;
  properties: LevelProperties;
  spawn: LevelObject;
  platforms: LevelPlatform[];
  objects: LevelObject[];
  collectibles: LevelObject[];
  npcs: LevelObject[];
  triggers: LevelObject[];
  checkpoints: LevelObject[];
  exits: LevelObject[];
  decorBack: LevelObject[];
  decorFront: LevelObject[];
}

interface JsonRecord { [key: string]: unknown }

function record(value: unknown, context: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid level: ${context} must be an object`);
  return value as JsonRecord;
}

function numeric(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid level: ${context} must be a finite number`);
  return value;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function parseProperties(value: unknown): LevelProperties {
  if (!Array.isArray(value)) return {};
  const properties: LevelProperties = {};
  for (const entry of value) {
    const property = record(entry, 'property');
    if (typeof property.name === 'string' && ['string', 'number', 'boolean'].includes(typeof property.value)) {
      properties[property.name] = property.value as LevelProperty;
    }
  }
  return properties;
}

function parseObject(value: unknown): LevelObject {
  const object = record(value, 'map object');
  const tiledId = numeric(object.id, 'object id');
  const name = stringValue(object.name, `object-${tiledId}`);
  const properties = parseProperties(object.properties);
  return {
    id: name, name, tiledId,
    type: stringValue(object.type ?? object.class, ''),
    x: numeric(object.x, `${name}.x`), y: numeric(object.y, `${name}.y`),
    width: typeof properties.width === 'number' ? properties.width : numeric(object.width ?? 0, `${name}.width`),
    height: typeof properties.height === 'number' ? properties.height : numeric(object.height ?? 0, `${name}.height`),
    properties,
  };
}

export function parseTiledMap(raw: unknown): LevelData {
  const map = record(raw, 'map');
  if (!Array.isArray(map.layers)) throw new Error('Invalid level: missing layers');
  const layers = new Map(map.layers.map(value => {
    const layer = record(value, 'layer');
    return [stringValue(layer.name, ''), layer] as const;
  }));
  const readObjects = (name: string): LevelObject[] => {
    const layer = layers.get(name);
    if (!layer || !Array.isArray(layer.objects)) throw new Error(`Invalid level: missing ${name} object layer`);
    return layer.objects.map(parseObject);
  };
  for (const name of ['Ground', 'Platforms']) {
    if (layers.get(name)?.type !== 'tilelayer') throw new Error(`Invalid level: missing ${name} tile layer`);
  }
  const properties = parseProperties(map.properties);
  const spawnPoints = readObjects('Spawn');
  const spawn = spawnPoints[0];
  if (!spawn) throw new Error('Invalid level: at least one spawn point is required');
  const collision = readObjects('Collision');
  const platforms = collision.map((object): LevelPlatform => ({
    id: object.id, x: object.x, y: object.y, width: object.width, height: object.height,
    kind: object.properties.kind === 'ground' ? 'ground' : 'platform',
    oneWay: object.properties.oneWay === true,
  }));
  const tileSize = numeric(map.tilewidth, 'tilewidth');
  return {
    id: stringValue(properties.stageId, 'home'),
    title: stringValue(properties.title, 'HOME — THE EMPTY TREAT BOX'),
    width: numeric(map.width, 'width') * tileSize,
    height: numeric(map.height, 'height') * numeric(map.tileheight, 'tileheight'),
    tileSize, properties, spawn, platforms,
    objects: readObjects('Objects'), collectibles: readObjects('Collectibles'),
    npcs: readObjects('NPC'), triggers: readObjects('Triggers'),
    checkpoints: readObjects('Checkpoints'), exits: readObjects('Exit'),
    decorBack: readObjects('DecorBack'), decorFront: readObjects('DecorFront'),
  };
}

/** Load after scene.load.json('home-map', 'assets/maps/home.json') completes. */
export function loadLevel(scene: { cache: { json: { get(key: string): unknown } } }, key = 'home-map'): LevelData {
  return parseTiledMap(scene.cache.json.get(key));
}
