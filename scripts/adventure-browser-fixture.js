const out = document.createElement('pre');
out.id='qa-results'; out.style='position:fixed;z-index:9999;top:0;right:0;background:#fff9edee;color:#372939;font:13px monospace;padding:12px;max-width:510px;max-height:48vh;overflow:auto;white-space:pre-wrap';
document.body.append(out);
const lines=[], errors=[];
window.addEventListener('error',e=>{errors.push(e.message);log('RUNTIME '+e.message)});
function log(t){lines.push(t);out.textContent=lines.join('\n');}
function ok(value,message){if(!value)throw Error(message);log('PASS '+message)}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const codes={Enter:13,KeyE:69,KeyJ:74,KeyK:75,KeyQ:81,Space:32,ArrowRight:39,ArrowLeft:37,Escape:27,ShiftLeft:16};
function key(code,down){window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,key:code==='Space'?' ':code,keyCode:codes[code],which:codes[code],bubbles:true,cancelable:true}));}
async function tap(code,ms=30){key(code,true);await wait(ms);key(code,false);await wait(30);}
const button=document.createElement('button');button.textContent='Run integration checks';button.style='position:fixed;z-index:10000;top:0;left:0';document.body.append(button);
button.onclick=async()=>{
button.disabled=true;
try {
  const game=window.__snowball;
  ok(game?.scene.isActive('Menu'),'menu booted');
  for(const name of ['snowball-combat','enemy-vacuum','enemy-mouse','boss-wrench','portrait-snowball','fire-fruit'])ok(game.textures.exists(name),'texture '+name);
  await tap('Enter');await wait(200);
  const s=game.scene.getScene('Home');
  for(let i=0;i<5&&s.mode==='dialogue';i++)await tap('KeyE');
  ok(s.mode==='playing','intro continues into gameplay');
  const start=s.player.x;key('ArrowRight',true);await wait(700);key('ArrowRight',false);await wait(100);
  ok(s.player.x>start+100,'keyboard movement');
  await tap('KeyJ',15);ok(s.player.texture.key==='snowball-combat','real attack switches to new combat frames');
  await wait(300);await tap('Space',150);ok(s.player.y<610,'keyboard jump');await wait(800);
  s.player.respawn(500,640);await wait(200);ok(s.combat.fruit==='fire'&&s.hasFlag('fire-trial'),'altar grants saved fire trial');
  const energy=s.combat.energy;await tap('KeyK');ok(s.combat.energy<energy-12,'fireball consumes energy');
  await tap('KeyQ');ok(s.combat.fruit===null,'Q removes element');await tap('KeyQ');ok(s.combat.fruit==='fire','Q restores trial element');
  const before=s.player.x;await tap('ShiftLeft');await wait(130);ok(s.player.x>before+35,'dash advances player');
  await wait(1400);const hearts=s.hearts;s.damage(1,s.player.x+80);s.damage(1,s.player.x+80);ok(s.hearts===hearts-1,'consecutive damage has invulnerability');
  const enemy=s.combat.enemies[0];s.player.respawn(enemy.x-48,640);await wait(100);
  for(let i=0;i<5&&!enemy.defeated;i++){s.player.respawn(enemy.x-45,640);s.player.facing=1;await tap('KeyJ');await wait(340)}
  ok(enemy.defeated,'keyboard claws defeat ordinary enemy');
  s.player.respawn(3440,640);key('ArrowRight',true);await wait(1000);key('ArrowRight',false);await wait(100);
  ok(s.combat.boss.active,'balcony crossed without quest prerequisites');
  ok(!s.hasFlag('key-found')&&!s.hasFlag('box-open')&&s.stars===0,'boss entered with zero stars and no key');
  const boss=s.combat.boss;await wait(1800);await tap('Escape');const state=boss.state,hp=boss.health,x=boss.x;await wait(1200);
  ok(s.mode==='paused'&&boss.state===state&&boss.health===hp&&boss.x===x,'pause freezes boss warning and position');await tap('Escape');
  await wait(1700);s.hearts=1;s.invulnerableUntil=0;s.damage(1,boss.x);
  ok(s.hearts===5&&!boss.active&&Math.abs(s.player.x-3590)<5,'lethal damage retries at boss entrance');
  ok(s.hasFlag('fire-trial')&&s.combat.fruit==='fire'&&boss.health===boss.maxHealth,'retry keeps trial and resets boss health');
  // Verify deterministic rendering/completion while separate keyboard play tests handle pacing.
  s.player.respawn(3680,640);await wait(2300);
  const phases=new Set();
  for(let i=0;i<100&&!boss.defeated;i++){phases.add(boss.phase);boss.hit(20,boss.x-200,s.combat.clock);await wait(20)}
  ok(phases.size===3,'all three boss phases rendered');
  ok(boss.defeated&&s.mode==='dialogue','boss defeat begins reconciliation');
  for(let i=0;i<5&&s.mode==='dialogue';i++)await tap('KeyE');
  ok(s.mode==='complete','reconciliation leads to completion');
  const data=JSON.parse(localStorage.getItem('snowball-quest-save-v1'));
  ok(data.adventure.fireUnlocked&&data.adventure.wrenchJoined&&data.adventure.attackBonus===.1,'completion persists permanent rewards');
  s.replay();await wait(400);const replay=game.scene.getScene('Home');
  for(let i=0;i<5&&replay.mode==='dialogue';i++)await tap('KeyE');
  ok(replay.combat.fruit==='fire'&&!replay.hasFlag('boss-defeated'),'replay keeps permanent fire and resets boss');
  ok(errors.length===0,'no browser runtime errors');
  log('ALL CHECKS PASSED');
}catch(e){log('FAIL '+e.message+'\n'+e.stack)}
button.disabled=false;
};
