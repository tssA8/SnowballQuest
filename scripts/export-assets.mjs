/** Export the exact original runtime pixel drawings as drop-in PNGs and atlases.
 * No browser, network, raster editing, or third-party canvas dependency required.
 * The canvas adapter implements the fillRect-only drawing contract in Textures.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import ts from 'typescript';
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'public/assets');
const textures = new Map();
class Raster {
  constructor(width,height) {this.width=width;this.height=height;this.data=new Uint8Array(width*height*4);this.fillStyle='#000000';}
  fillRect(x,y,w,h) {
    const color=this.fillStyle.replace('#','');
    const rgb=[0,2,4].map(i=>parseInt(color.slice(i,i+2),16));
    const x0=Math.max(0,Math.round(x)),y0=Math.max(0,Math.round(y));
    for(let yy=y0;yy<Math.min(this.height,Math.round(y+h));yy++)for(let xx=x0;xx<Math.min(this.width,Math.round(x+w));xx++) {
      const offset=(yy*this.width+xx)*4;this.data.set([...rgb,255],offset);
    }
  }
}
const source=fs.readFileSync(path.join(root,'src/game/art/Textures.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const module={exports:{}};new Function('exports','module',compiled)(module.exports,module);
const scene={textures:{exists:key=>textures.has(key),createCanvas:(key,w,h)=>{
  const raster=new Raster(w,h);textures.set(key,raster);return {context:raster,refresh(){},add(){}};
}},anims:{exists(){return false;},create(){},generateFrameNumbers(){return [];}}};
module.exports.createTextures(scene);
function crc32(buffer){let crc=0xffffffff;for(const b of buffer){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type);const buf=Buffer.alloc(data.length+12);buf.writeUInt32BE(data.length);name.copy(buf,4);data.copy(buf,8);buf.writeUInt32BE(crc32(Buffer.concat([name,data])),data.length+8);return buf;}
function png(raster){
  const header=Buffer.alloc(13);header.writeUInt32BE(raster.width);header.writeUInt32BE(raster.height,4);header[8]=8;header[9]=6;
  const scan=Buffer.alloc((raster.width*4+1)*raster.height);for(let y=0;y<raster.height;y++)Buffer.from(raster.data.subarray(y*raster.width*4,(y+1)*raster.width*4)).copy(scan,y*(raster.width*4+1)+1);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);
}
const save=(relative,data)=>{const dest=path.join(out,relative);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);};
const groups={
  player:['snowball'],tiles:['world'],toys:['feather','yarn','bell-ball','plush','scratch','tunnel','wand','spring','toy-box'],
  npcs:['mouse','sleepy-cat','vacuum'],props:['door','checkpoint','flag','treat-box','cushion','plant','cat-tree','window','sofa','lamp','shelf','rug','books'],
  items:['fish','star','key','heart','crown'],fx:['sparkle','paw'],
};
const manifest={version:3,artStatus:'original-code-generated-placeholder',source:'src/game/art/Textures.ts',referenceInventory:'../../references/inventory.json',pixelArt:true,smoothing:false,textures:[],atlases:[],pendingGroups:['ui','title','mobile','ending']};
for(const [group,keys] of Object.entries(groups))for(const key of keys){const raster=textures.get(key);const relative=`${group}/${key}.png`;save(relative,png(raster));manifest.textures.push({key,path:relative,width:raster.width,height:raster.height,status:'placeholder-ready',origin:key==='snowball'?[.5,1]:undefined});}
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
console.log(`Exported ${textures.size} original textures and 6 atlases to public/assets.`);
