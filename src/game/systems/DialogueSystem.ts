import Phaser from 'phaser';

export interface Dialogue { speaker: string; lines: string[]; }
export const DIALOGUE: Record<string, Dialogue> = {
  intro: { speaker: '小鈴', lines: ['09:03，主人已出門。\n雪球，陽台偵測到異常訊號。喵艦 SNOW-01，出勤！', 'J / E 肉球攻擊，Shift 閃避，Space 跳躍。\n前方有火焰果實；找到扳手就能完成這次出勤。'] },
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
