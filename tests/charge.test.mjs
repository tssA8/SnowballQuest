import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const rulesUrl = moduleUrl(compile(await read('../src/game/combat/rules.ts')));
const { chargedShot, ChargeAttack } = await import(rulesUrl);
const serviceUrl = moduleUrl(`export const save = { data: {
  maxPurrEnergy:100, unlockedFruits:[], bossBadges:[], settings:{reducedMotion:false},
  adventure:{fireUnlocked:false,attackBonus:0,wrenchJoined:false}
} };`);
const { save } = await import(serviceUrl);
const bossStub = `export const ARENA = { spawn:4410, floor:640, left:3520, right:4864, trigger:3650 };
export class WrenchBoss {
  active=false; defeated=false; x=4410; y=640; warning='';
  hit() { return false; } start() { this.active=true; } reset() { this.active=false; }
  update() {} draw() {} destroy() {}
} export class StageBoss extends WrenchBoss {}`;
const enemyStub = `export class Enemy {
  defeated=false; active=true; visible=false; health=34;
  constructor(scene,kind,x,y,min,max,arena=false) { this.kind=kind; this.x=x; this.y=y; this.arena=arena; }
  updateCombat() {} hit() { return false; } destroy() { this.active=false; }
}`;
const phaserUrl = moduleUrl('export default { Math:{ Clamp:(v,min,max)=>Math.max(min,Math.min(max,v)) } };');
const replacements = {
  phaser: phaserUrl, '../services': serviceUrl, './rules': rulesUrl,
  '../entities/Enemy': moduleUrl(enemyStub), '../entities/WrenchBoss': moduleUrl(bossStub),
  '../entities/StageBoss': moduleUrl(bossStub),
  './HealingDrops': moduleUrl('export class HealingDrops { update() {} resetArena() {} destroy() {} }'),
};
const combatSource = compile(await read('../src/game/combat/CombatSystem.ts'))
  .replace(/from '([^']+)'/g, (_, path) => `from '${replacements[path] ?? path}'`);
const { CombatSystem } = await import(moduleUrl(combatSource));
// Execute the real pause transition too; unrelated scene construction is stubbed.
const sceneDependencies = moduleUrl(`export default { Scene:class{} };
export class Player{} export class InputSystem{} export class MissionSystem{} export class DialogueSystem{}
export class HomeWorld{} export class Interactions{} export class CombatSystem{}
export class StageWorld{} export const STAGES=[]; export const stageById=()=>({});
export const DIALOGUE={}; export const loadLevel=()=>({});
export const save={}; export const audio={startMusic(){},stopMusic(){}};`);
const homeSource = compile(await read('../src/game/scenes/HomeScene.ts'))
  .replace(/from '([^']+)'/g, `from '${sceneDependencies}'`);
const { HomeScene } = await import(moduleUrl(homeSource));

function graphic() {
  let object;
  object = new Proxy({ x: 0, y: 0 }, { get(target, key) {
    return key in target ? target[key] : () => object;
  } });
  return object;
}
function fight() {
  save.data.maxPurrEnergy=100; save.data.unlockedFruits=[]; save.data.bossBadges=[];
  save.data.adventure.attackBonus=0;
  const events = [];
  const controls = { revision:0, specialHeld:false, clear() { this.revision++; this.specialHeld=false; } };
  const scene = {
    mode:'playing', stage:{ id:'basement', index:3, fruit:null, enemies:['slime'], bossName:'波波' },
    add:{ graphics:graphic, ellipse:graphic, rectangle:graphic, image:graphic, text:graphic, container:graphic },
    player:{ x:100, y:640, facing:1, grounded:true, pose(){}, freeze(){} },
    controls, events:{ emit(name) { events.push(name); } }, physics:{ pause(){},resume(){} },
    hasFlag(){ return false; }, setFlag(){}, notify(){}, sparkle(){}, persist(){},
  };
  const combat = new CombatSystem(scene); scene.combat=combat;
  return { combat, scene, controls, events };
}

test('short taps cost 16 and full 1200ms charge costs 30 with 140 fire or 110 neutral damage', () => {
  for (const fire of [false,true]) {
    for (const held of [0,150]) assert.deepEqual(chargedShot(held,fire,100),
      {ratio:0,cost:16,damage:fire?32:24,piercing:false});
    for (const held of [1200,5000]) assert.deepEqual(chargedShot(held,fire,100),
      {ratio:1,cost:30,damage:fire?140:110,piercing:true});
    const half=chargedShot(675,fire,100);
    assert.equal(half.ratio,.5); assert.equal(half.cost,23); assert.equal(half.damage,fire?86:67);
  }
});

test('limited and fractional energy cannot overspend or produce free full-charge piercing', () => {
  assert.equal(chargedShot(1200,true,15.99),null);
  for (const energy of [16,16.4,16.6,20.6,29.6,30,100]) {
    const shot=chargedShot(1200,true,energy);
    assert.ok(shot.cost<=energy, `cost ${shot.cost} must not exceed available ${energy}`);
    assert.ok(shot.cost>=16); assert.equal(shot.piercing,energy>=30);
    assert.ok(shot.damage>=32 && shot.damage<=140);
  }
});

test('charge clock clamps elapsed time and cancellation removes its previous progress', () => {
  const charge=new ChargeAttack();
  charge.update(500); assert.equal(charge.elapsed,0);
  charge.begin(); charge.update(-50); assert.equal(charge.ratio,0);
  charge.update(600); assert.equal(charge.ratio,.5);
  charge.update(5000); assert.equal(charge.ratio,1);
  charge.cancel(); assert.equal(charge.active,false); assert.equal(charge.elapsed,0);
  charge.begin(); assert.equal(charge.ratio,0);
});

test('holding special charges once and releasing creates a single full-power projectile', () => {
  const {combat,controls}=fight(); combat.fruit='fire';
  controls.specialHeld=true; combat.beginCharge();
  for(let i=0;i<24;i++) combat.update(i*50,50);
  assert.equal(combat.chargeReady,true); assert.equal(combat.fireballs.length,0); assert.equal(combat.energy,100);
  controls.specialHeld=false; combat.update(1200,0);
  assert.equal(combat.charging,false); assert.equal(combat.fireballs.length,1);
  assert.equal(combat.fireballs[0].damage,140); assert.equal(combat.fireballs[0].piercing,true);
  assert.equal(combat.energy,70);
  combat.update(1200,0); assert.equal(combat.fireballs.length,1);
});

test('quick special tap spends base energy; fractional low-energy full charge never makes energy negative', () => {
  const tap=fight(); tap.combat.beginCharge(); tap.combat.update(0,0);
  assert.equal(tap.combat.energy,84); assert.equal(tap.combat.fireballs[0].damage,24);
  for (const energy of [16.6,20.6,29.6]) {
    const {combat}=fight(); combat.energy=energy; combat.cast(1200);
    assert.ok(combat.energy>=0, `remaining energy for ${energy}`);
    assert.equal(combat.fireballs[0].piercing,false);
  }
});

test('actual scene pause cancels a charge without firing when the game resumes', () => {
  const {combat,scene,controls}=fight();
  controls.specialHeld=true; combat.beginCharge(); combat.update(50,50);
  HomeScene.prototype.setMode.call(scene,'paused');
  assert.equal(combat.charging,false); assert.equal(scene.mode,'paused');
  combat.update(50000,50); assert.equal(combat.fireballs.length,0);
  HomeScene.prototype.setMode.call(scene,'playing'); combat.update(50050,50);
  assert.equal(combat.fireballs.length,0); assert.equal(combat.energy,100);
});

test('input revision invalidates a held charge without interpreting blur as a release attack', () => {
  const {combat,controls}=fight();
  controls.specialHeld=true; combat.beginCharge(); combat.update(50,50);
  controls.clear(); combat.update(100,50);
  assert.equal(combat.charging,false); assert.equal(combat.fireballs.length,0); assert.equal(combat.energy,100);
});

test('retry and destruction discard held charge and block delayed release attacks', () => {
  for(const action of ['retry','destroy']) {
    const {combat,controls}=fight();
    controls.specialHeld=true; combat.beginCharge(); combat.update(50,50);
    combat[action](); controls.specialHeld=false; combat.update(100,50);
    assert.equal(combat.charging,false); assert.equal(combat.fireballs.length,0);
  }
});

const playerPhaser = moduleUrl(`export default {
  Physics:{Arcade:{Sprite:class {
    constructor(scene,x,y) {this.scene=scene;this.x=x;this.y=y;this.active=true;}
    setOrigin(){return this;} setDepth(){return this;} setFlipX(){return this;}
    setAlpha(){return this;} setFrame(){return this;} play(){return this;}
  }}}, Math:{Clamp:(v,min,max)=>Math.max(min,Math.min(max,v))}
};`);
const { Player } = await import(moduleUrl(compile(await read('../src/game/entities/Player.ts'))
  .replace("from 'phaser'",`from '${playerPhaser}'`)));
function windPlayer() {
  const events=[];
  const body={ velocity:{x:0,y:0},blocked:{down:true},touching:{down:false},
    setSize(){return this;},setOffset(){return this;},setMaxVelocity(){return this;},setCollideWorldBounds(){return this;},
    setAllowGravity(){return this;},setAcceleration(){return this;},
    setVelocity(x,y){this.velocity={x,y};return this;},
    setVelocityX(x){this.velocity.x=x;return this;},setVelocityY(y){this.velocity.y=y;return this;},
  };
  const controls={axis:0,jumpHeld:false,queued:false,
    consumeJump(){const value=this.queued;this.queued=false;return value;},consumeDash(){return false;},clear(){},
  };
  const scene={time:{now:0},add:{existing(){}},physics:{add:{existing(sprite){sprite.body=body;}}},
    anims:{exists(){return false;}},events:{emit(name){events.push(name);}},
  };
  const player=new Player(scene,100,640,controls);player.element='wind';
  const step=time=>{scene.time.now=time;player.update(time,8);};
  const press=()=>{controls.jumpHeld=true;controls.queued=true;};
  return {player,body,controls,events,step,press};
}

test('wind grants exactly one fresh airborne jump and rearms only after landing', () => {
  const c=windPlayer();c.step(0);c.press();c.step(8);
  assert.equal(c.body.velocity.y,-420);
  c.body.blocked.down=false;c.controls.jumpHeld=false;c.step(16);c.press();c.step(24);
  assert.equal(c.body.velocity.y,-390);
  c.controls.jumpHeld=false;c.step(32);c.press();c.step(40);
  assert.equal(c.events.filter(name=>name==='player-jumped').length,2);
  c.body.blocked.down=true;c.body.velocity.y=0;c.controls.jumpHeld=false;c.step(800);
  c.press();c.step(808);
  assert.equal(c.events.filter(name=>name==='player-jumped').length,3);
});

test('wind glide slows a held jump descent while native form keeps normal falling speed', () => {
  const c=windPlayer();c.body.blocked.down=false;c.body.velocity.y=300;c.controls.jumpHeld=true;c.step(0);
  assert.equal(c.body.velocity.y,110);
  c.player.element=null;c.body.velocity.y=300;c.step(16);assert.equal(c.body.velocity.y,300);
});
