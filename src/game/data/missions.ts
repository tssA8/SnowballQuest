export interface MissionDefinition {
  id: string;
  flag: string;
  label: string;
  hint: string;
  optional: boolean;
}

export const HOME_MISSIONS: readonly MissionDefinition[] = [
  { id: 'signal', flag: 'boss-defeated', label: '異常訊號在陽台外',
    hint: '找到扳手，解除失控的掃地機戰甲。', optional: false },
  { id: 'mouse', flag: 'mouse-helped', label: 'Return the little mouse toy',
    hint: 'The mouse courier has lost a very small friend.', optional: true },
  { id: 'key', flag: 'key-found', label: 'Find the balcony key',
    hint: 'A little shine is hiding near the cat tower.', optional: true },
  { id: 'box', flag: 'box-open', label: 'Open the toy box',
    hint: 'Good deeds have a habit of opening things.', optional: true },
  { id: 'balcony', flag: 'balcony-open', label: 'Open the balcony door',
    hint: '主線通道隨時開放。', optional: true },
];
