/** Export approved Snowball sprites alongside the original scenery drawings.
 * The canvas adapter implements the fillRect-only drawing contract in Textures.ts.
 * The imported player master is authoritative and survives every re-export.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { readPng } from './png-codec.mjs';
import { Raster, png } from './pixel-raster.mjs';
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'public/assets');
const textures = new Map();
const source=fs.readFileSync(path.join(root,'src/game/art/Textures.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const module={exports:{}};new Function('exports','module',compiled)(module.exports,module);
const scene={textures:{exists:key=>textures.has(key),createCanvas:(key,w,h)=>{
  const raster=new Raster(w,h);textures.set(key,raster);return {context:raster,refresh(){},add(){}};
}},anims:{exists(){return false;},create(){},generateFrameNumbers(){return [];}}};
module.exports.createTextures(scene);
const playerSource = 'resources/art/snowball-runtime.png';
const player = readPng(fs.readFileSync(path.join(root, playerSource)));
if (player.width !== 2816 || player.height !== 64) throw new Error('Snowball master must contain 44 frames of 64 × 64');
textures.set('snowball', player);
const save=(relative,data)=>{const dest=path.join(out,relative);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);};
const groups={
  player:['snowball'],tiles:['world'],toys:['feather','yarn','bell-ball','plush','scratch','tunnel','wand','spring','toy-box'],
  npcs:['mouse','sleepy-cat','vacuum'],props:['door','checkpoint','flag','treat-box','cushion','plant','cat-tree','window','sofa','lamp','shelf','rug','books'],
  items:['fish','star','key','heart','crown'],fx:['sparkle','paw'],
};
const manifest={version:4,artStatus:'normalized-player-and-code-generated-scenery',source:'src/game/art/Textures.ts',referenceInventory:'../../references/inventory.json',pixelArt:true,smoothing:false,textures:[],atlases:[],pendingGroups:['ui','title','mobile','ending']};
for(const [group,keys] of Object.entries(groups))for(const key of keys){const raster=textures.get(key);const relative=`${group}/${key}.png`;save(relative,png(raster));manifest.textures.push({key,path:relative,width:raster.width,height:raster.height,status:key==='snowball'?'normalized-style-reference':'placeholder-ready',source:key==='snowball'?playerSource:undefined,origin:key==='snowball'?[.5,1]:undefined});}
for(const key of ['sky','far-city','mid-buildings','near-houses','foreground']){const raster=textures.get(key),relative=`backgrounds/home/${key}.png`;save(relative,png(raster));manifest.textures.push({key,path:relative,width:raster.width,height:raster.height,status:'placeholder-ready',repeat:'x'});}
const playerFrames={};for(let i=0;i<44;i++)playerFrames[i]={frame:{x:i*64,y:0,w:64,h:64},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:64,h:64},sourceSize:{w:64,h:64},pivot:{x:.5,y:1}};
save('player/snowball.json',JSON.stringify({frames:playerFrames,meta:{image:'snowball.png',size:{w:2816,h:64},scale:'1'},animations:module.exports.SNOWBALL_ANIMATIONS},null,2));
function atlas(group,name,keys){
  const placements=[];let x=0,y=0,rowHeight=0;const width=1024;
  for(const key of keys){const r=textures.get(key);if(x+r.width>width){x=0;y+=rowHeight+2;rowHeight=0;}placements.push({key,x,y,r});x+=r.width+2;rowHeight=Math.max(rowHeight,r.height);}
  const r=new Raster(width,y+rowHeight),frames={};for(const p of placements){for(let yy=0;yy<p.r.height;yy++)r.data.set(p.r.data.subarray(yy*p.r.width*4,(yy+1)*p.r.width*4),((p.y+yy)*width+p.x)*4);frames[p.key]={frame:{x:p.x,y:p.y,w:p.r.width,h:p.r.height},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:p.r.width,h:p.r.height},sourceSize:{w:p.r.width,h:p.r.height}};}
  save(`${group}/${name}.png`,png(r));save(`${group}/${name}.json`,JSON.stringify({frames,meta:{image:`${name}.png`,size:{w:r.width,h:r.height},scale:'1'}},null,2));manifest.atlases.push({group,image:`${group}/${name}.png`,metadata:`${group}/${name}.json`,status:'placeholder-ready'});
}
atlas('toys','cat-toys',groups.toys);atlas('toys','feathers',['feather']);atlas('npcs','npcs',groups.npcs);atlas('props','home-props',groups.props);atlas('items','collectibles',groups.items);atlas('fx','effects',groups.fx);
save('manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(`Exported the approved Snowball master, ${textures.size-1} scenery textures and 6 atlases to public/assets.`);
export { Raster, png, textures };
