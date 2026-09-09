import Phaser from 'phaser';
import { HOME_MISSIONS, type MissionDefinition } from '../data/missions';

export interface MissionStatus extends MissionDefinition { complete: boolean }

/** Mission content stays in data; scene and HUD share a small event-based interface. */
export class MissionSystem {
  private flags: Record<string, boolean>;

  constructor(private readonly events: Phaser.Events.EventEmitter,
    flags: Readonly<Record<string, boolean>> = {},
    private readonly definitions: readonly MissionDefinition[] = HOME_MISSIONS) {
    this.flags = { ...flags };
  }

  hasFlag(id: string): boolean { return this.flags[id] === true; }
  setFlag(id: string, complete = true): void {
    if (this.hasFlag(id) === complete) return;
    this.flags[id] = complete;
    const mission = this.definitions.find(item => item.flag === id);
    this.events.emit('mission-updated', this.list());
    if (complete && mission) this.events.emit('mission-completed', { ...mission, complete });
  }

  list(): MissionStatus[] {
    return this.definitions.map(mission => ({ ...mission, complete: this.hasFlag(mission.flag) }));
  }
  get active(): MissionStatus | undefined { return this.list().find(mission => !mission.complete && !mission.optional); }
  get allComplete(): boolean { return this.list().every(mission => mission.optional || mission.complete); }
}
