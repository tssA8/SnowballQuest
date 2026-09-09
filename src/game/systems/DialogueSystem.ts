import Phaser from 'phaser';

export interface Dialogue { speaker: string; lines: string[]; }
export const DIALOGUE: Record<string, Dialogue> = {
  intro: { speaker: 'SNOWBALL', lines: ['The treat box is empty.\nThis is a very serious development.', 'A brighter tomorrow has gone missing.\nPerhaps start with a small kindness?'] },
  mouse: { speaker: 'MOUSE COURIER', lines: ['I have a flag. That means I have a mission.', 'My plush friend is by the vacuum.\nCould you bring him back? He is terrible at walking.'] },
  delivered: { speaker: 'MOUSE COURIER', lines: ['My friend! You brought him home!', 'The toy box likes helpful cats.\nTry the scratching board, then give it a nudge.'] },
  scratch: { speaker: 'SNOWBALL', lines: ['An excellent board. Very scratchable.\nSomewhere, a tiny lock clicks.'] },
  box: { speaker: 'A LITTLE HAPPINESS', lines: ['One small kindness. One very good scratch.\nA happiness star, just for you.'] },
  key: { speaker: 'SNOWBALL', lines: ['The balcony key. Of course it was on my throne.'] },
  tunnel: { speaker: 'SECRET FOUND', lines: ['Welcome to the Professional Napping Club.\nPlease keep your enthusiasm to a minimum.'] },
};

export class DialogueSystem extends Phaser.Events.EventEmitter {
  current?: Dialogue;
  index = 0;
  open(dialogue: Dialogue): void { this.current = dialogue; this.index = 0; this.emit('change'); }
  next(): void {
    if (!this.current) return;
    if (++this.index >= this.current.lines.length) { this.current = undefined; this.emit('close'); }
    else this.emit('change');
  }
  get line(): string { return this.current?.lines[this.index] ?? ''; }
}
