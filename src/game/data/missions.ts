export interface MissionDefinition {
  id: string;
  flag: string;
  label: string;
  hint: string;
  optional: boolean;
}

export const HOME_MISSIONS: readonly MissionDefinition[] = [
  { id: 'mouse', flag: 'mouse-helped', label: 'Return the little mouse toy',
    hint: 'The mouse courier has lost a very small friend.', optional: false },
  { id: 'key', flag: 'key-found', label: 'Find the balcony key',
    hint: 'A little shine is hiding near the cat tower.', optional: false },
  { id: 'box', flag: 'box-open', label: 'Open the toy box',
    hint: 'Good deeds have a habit of opening things.', optional: false },
  { id: 'balcony', flag: 'balcony-open', label: 'Open the balcony door',
    hint: 'Bring the key and follow the evening light.', optional: false },
];
