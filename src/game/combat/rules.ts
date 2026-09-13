/** Rules use the combat clock, which advances only while the game is playing. */
export const COMBAT = {
  comboWindow: 900,
  attackCooldown: [260, 290, 450],
  attackDamage: [10, 12, 18],
  fireCost: 16,
  fireDamage: 32,
  fireCooldown: 700,
  energyPerSecond: 12,
  bossHealth: 660,
  chargeTime: 1200,
  chargeCost: 30,
} as const;

export class ComboChain {
  count = 0;
  private lastAttack = -Infinity;
  private readyAt = 0;

  attack(now: number, airborne: boolean): { step: number; damage: number; air: boolean } | null {
    if (now < this.readyAt) return null;
    const step = airborne ? 1 : now - this.lastAttack > COMBAT.comboWindow ? 1 : this.count % 3 + 1;
    this.count = airborne ? 0 : step;
    this.lastAttack = now;
    this.readyAt = now + (airborne ? 360 : COMBAT.attackCooldown[step - 1]);
    return { step, damage: airborne ? 14 : COMBAT.attackDamage[step - 1], air: airborne };
  }

  update(now: number): void { if (now - this.lastAttack > COMBAT.comboWindow) this.count = 0; }
  reset(): void { this.count = 0; this.lastAttack = -Infinity; this.readyAt = 0; }
}

export function bossPhase(health: number, maxHealth: number): 1 | 2 | 3 {
  return health > maxHealth * 2 / 3 ? 1 : health > maxHealth / 3 ? 2 : 3;
}

export function bossHitDamage(damage: number, overheated: boolean, fromBehind: boolean, armored = false): number {
  return Math.max(1, Math.round(damage * (overheated ? (fromBehind ? 2 : 1.35) : armored ? .55 : 1)));
}

export class ChargeAttack {
  active = false;
  elapsed = 0;
  begin(): void { this.active = true; this.elapsed = 0; }
  update(delta: number): void { if (this.active) this.elapsed = Math.min(COMBAT.chargeTime, this.elapsed + Math.max(0, delta)); }
  get ratio(): number { return this.elapsed / COMBAT.chargeTime; }
  cancel(): void { this.active = false; this.elapsed = 0; }
}

export function chargedShot(heldMs: number, fire: boolean, energy: number) {
  if (energy < COMBAT.fireCost) return null;
  const ratio = Math.min(1, Math.max(0, (heldMs - 150) / (COMBAT.chargeTime - 150)),
    Math.max(0, (Math.floor(energy) - COMBAT.fireCost) / (COMBAT.chargeCost - COMBAT.fireCost)));
  return { ratio, cost: Math.round(COMBAT.fireCost + ratio * (COMBAT.chargeCost - COMBAT.fireCost)),
    damage: Math.round((fire ? 32 : 24) + ratio * (fire ? 108 : 86)), piercing: ratio >= .999 };
}

/** The attack reaches only in front of the player, including a small overlap allowance. */
export function inMeleeRange(playerX: number, playerY: number, facing: number,
  targetX: number, targetY: number, range: number, targetWidth = 40, airborne = false): boolean {
  const forward = (targetX - playerX) * facing;
  return forward >= -targetWidth / 2 && forward <= range + targetWidth / 2 &&
    Math.abs(targetY - playerY) <= (airborne ? 95 : 68);
}
