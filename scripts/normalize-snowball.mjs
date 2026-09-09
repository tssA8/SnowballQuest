/** Pack ImageGen's coat edit using the original design's alpha silhouettes.
 * Measured component seeds separate overlapping presentation-sheet rectangles.
 * This changes storage/layout and scale; the generated RGB supplies the coat edit.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { readPng } from './png-codec.mjs';
import { Raster, png } from './pixel-raster.mjs';

const root=path.resolve(import.meta.dirname,'..');
const config=JSON.parse(fs.readFileSync(path.join(root,'resources/art/snowball-frames.json'),'utf8'));
const coat=readPng(fs.readFileSync(path.join(root,config.colorSource)));
const original=readPng(fs.readFileSync(path.join(root,config.silhouetteSource)));
assert.deepEqual([coat.width,coat.height],config.sourceSize);
assert.deepEqual([original.width,original.height],config.sourceSize);
const {width,height}=original;
const labels=new Int32Array(width*height),seeds=[];
const neighbors=(at,visit)=>{
  const x=at%width,y=Math.floor(at/width);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if(!dx&&!dy)continue;
    if(x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height)visit((y+dy)*width+x+dx);
  }
};
const growth=[];
for(let at=0;at<labels.length;at++){
  if(labels[at] || original.data[at*4+3]<config.seedAlpha)continue;
  const id=seeds.length+1,queue=[at];labels[at]=id;
  const bounds={x:width,y:height,right:0,bottom:0,id,area:0};
  for(let p=0;p<queue.length;p++){
    const index=queue[p],x=index%width,y=Math.floor(index/width);
    bounds.x=Math.min(bounds.x,x);bounds.y=Math.min(bounds.y,y);bounds.right=Math.max(bounds.right,x);bounds.bottom=Math.max(bounds.bottom,y);bounds.area++;
    neighbors(index,next=>{if(!labels[next]&&original.data[next*4+3]>=config.seedAlpha){labels[next]=id;queue.push(next);}});
  }
  seeds.push(bounds);growth.push(...queue);
}
// Every high-confidence component grows simultaneously; touching low-alpha edges
// retain distinct identities instead of merging two adjacent walking poses.
for(let p=0;p<growth.length;p++){
  const index=growth[p];
  neighbors(index,next=>{if(!labels[next]&&original.data[next*4+3]>=config.edgeAlpha){labels[next]=labels[index];growth.push(next);}});
}
const entries=config.groups.flatMap(group=>group.boxes.map(box=>({group:group.name,box})));
assert.equal(entries.length,44);
const size=config.frameSize,atlas=new Raster(size*entries.length,size),report=[];
function overlap(box,seed){
  const [x,y,w,h]=box;
  const area=Math.max(0,Math.min(x+w,seed.right+1)-Math.max(x,seed.x))*Math.max(0,Math.min(y+h,seed.bottom+1)-Math.max(y,seed.y));
  return area/(w*h+(seed.right-seed.x+1)*(seed.bottom-seed.y+1)-area);
}
entries.forEach(({group,box},frame)=>{
  const seed=seeds.filter(s=>s.area>1000).sort((a,b)=>overlap(box,b)-overlap(box,a))[0];
  assert(overlap(box,seed)>.75,`Frame ${frame}: measured source no longer matches its original silhouette`);
  let left=width,top=height,right=0,bottom=0;
  for(let y=Math.max(0,seed.y-4);y<Math.min(height,seed.bottom+5);y++)for(let x=Math.max(0,seed.x-4);x<Math.min(width,seed.right+5);x++)if(labels[y*width+x]===seed.id){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  const w=right-left+1,h=bottom-top+1,dw=Math.round(w*config.scale),dh=Math.round(h*config.scale);
  assert(dw<=size && dh<=size,`Frame ${frame} would clip`);
  const x0=Math.floor((size-dw)/2),y0=size-dh;
  let pixels=0;
  for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
    const sx=left+Math.min(w-1,Math.floor((x+.5)/config.scale)),sy=top+Math.min(h-1,Math.floor((y+.5)/config.scale));
    const at=sy*width+sx;if(labels[at]!==seed.id)continue;
    const dest=((y0+y)*atlas.width+frame*size+x0+x)*4;
    atlas.data.set(coat.data.subarray(at*4,at*4+3),dest);
    atlas.data[dest+3]=original.data[at*4+3];pixels++;
  }
  assert(pixels>300,`Frame ${frame} is empty or incorrectly isolated`);
  report.push({frame,group,source:[left,top,w,h],destination:[x0,y0,dw,dh],pixels});
});
fs.writeFileSync(path.join(root,'resources/art/snowball-runtime.png'),png(atlas));
fs.writeFileSync(path.join(root,'resources/art/snowball-normalization.json'),JSON.stringify({method:'imagegen-rgb-with-original-alpha',frames:report},null,2)+'\n');
// Enlarged QA contact sheet with neutral checkerboard; never loaded in the game.
const preview=new Raster(8*64*3,6*64*3);
for(let y=0;y<preview.height;y++)for(let x=0;x<preview.width;x++){
  const bg=(Math.floor(x/24)+Math.floor(y/24))%2?232:211;
  preview.data.set([bg,bg,bg,255],(y*preview.width+x)*4);
}
for(let frame=0;frame<44;frame++)for(let y=0;y<64*3;y++)for(let x=0;x<64*3;x++){
  const at=(Math.floor(y/3)*atlas.width+frame*64+Math.floor(x/3))*4,alpha=atlas.data[at+3]/255;
  const dest=((Math.floor(frame/8)*64*3+y)*preview.width+(frame%8)*64*3+x)*4;
  for(let c=0;c<3;c++)preview.data[dest+c]=Math.round(atlas.data[at+c]*alpha+preview.data[dest+c]*(1-alpha));
}
fs.writeFileSync(path.join(root,'resources/art/snowball-contact-sheet.png'),png(preview));
console.log(`Packed ${report.length} verified silhouettes into ${atlas.width} × ${atlas.height}.`);
