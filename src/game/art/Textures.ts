import Phaser from 'phaser';

/** Original, replaceable pixel art. Presentation-sheet pixels are never sampled. */
export const PALETTE = {
  ink: '#493c48', deep: '#373845', shade: '#9c8581', fur: '#e9dac3', cream: '#fff1d8',
  white: '#fff8e8', pink: '#e89b9b', coral: '#d17c7d', rose: '#ac616d', gold: '#efbb66',
  goldLight: '#ffe8a0', wood: '#b98b68', woodLight: '#d8ab7d', woodDark: '#876651',
  green: '#6f8664', moss: '#96a276', leaf: '#b7b984', blue: '#7c9aab', lavender: '#a799b0',
} as const;
const C = PALETTE;

// Match Snowball's own photos rather than a generic breed color template.
const SNOWBALL_COAT = {
  body: '#ebe5d8', bodyShade: '#cec6b9', white: '#faf5e9',
  face: '#d4cbbf', point: '#b2a79b', stripe: '#988d83', outline: '#746b68',
  ear: '#d4aaa3', earLight: '#ead0c3', nose: '#594c49',
  eye: '#a8cbd9', eyeLight: '#d5e7eb', eyeLine: '#504951',
} as const;
type Draw = (p: Pixels) => void;

/** All primitives resolve to integer rectangles, including ellipse and polygon edges. */
class Pixels {
  constructor(readonly ctx: CanvasRenderingContext2D, readonly ox = 0, readonly oy = 0, readonly scale = 1, readonly wrapWidth = 0) {}
  rect(x: number, y: number, w: number, h: number, color: string) {
    this.ctx.fillStyle = color;
    const px = Math.round(this.ox + x * this.scale), py = Math.round(this.oy + y * this.scale);
    const pw = Math.round(w * this.scale), ph = Math.round(h * this.scale);
    if (this.wrapWidth) {
      const left = ((px % this.wrapWidth) + this.wrapWidth) % this.wrapWidth;
      this.ctx.fillRect(left, py, pw, ph);
      if (left + pw > this.wrapWidth) this.ctx.fillRect(left - this.wrapWidth, py, pw, ph);
    } else this.ctx.fillRect(px, py, pw, ph);
  }
  ellipse(x: number, y: number, w: number, h: number, color: string) {
    for (let row = 0; row < h; row++) {
      const extent = Math.sqrt(Math.max(0, 1 - Math.pow((row + .5 - h / 2) / (h / 2), 2))) * w / 2;
      const left = Math.ceil(w / 2 - extent);
      this.rect(x + left, y + row, Math.max(1, Math.floor(w / 2 + extent) - left), 1, color);
    }
  }
  poly(points: number[][], color: string) {
    const ys = points.map(p => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        if ((a[1] <= y + .5 && b[1] > y + .5) || (b[1] <= y + .5 && a[1] > y + .5)) xs.push(a[0] + (y + .5 - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) this.rect(Math.round(xs[i]), y, Math.max(1, Math.round(xs[i + 1]) - Math.round(xs[i])), 1, color);
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, color: string, weight = 1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) this.rect(Math.round(x0 + (x1 - x0) * i / (steps || 1)), Math.round(y0 + (y1 - y0) * i / (steps || 1)), weight, weight, color);
  }
  frame(x: number, y: number, w: number, h: number, fill: string, border: string = C.ink, weight = 2) {
    this.rect(x, y, w, h, border); this.rect(x + weight, y + weight, w - weight * 2, h - weight * 2, fill);
  }
}

export const SNOWBALL_ANIMATIONS: Record<string, { start: number; end: number; fps: number; repeat: number }> = {
  idle: { start: 0, end: 3, fps: 3, repeat: -1 },
  'idle-blink': { start: 2, end: 3, fps: 5, repeat: 0 },
  walk: { start: 4, end: 9, fps: 10, repeat: -1 },
  run: { start: 10, end: 15, fps: 14, repeat: -1 },
  jump: { start: 16, end: 17, fps: 8, repeat: 0 },
  'jump-start': { start: 16, end: 16, fps: 8, repeat: 0 },
  'jump-rise': { start: 17, end: 17, fps: 8, repeat: 0 },
  'jump-apex': { start: 18, end: 18, fps: 8, repeat: 0 },
  fall: { start: 18, end: 19, fps: 8, repeat: -1 },
  land: { start: 20, end: 21, fps: 10, repeat: 0 },
  sit: { start: 22, end: 23, fps: 2, repeat: -1 },
  sleep: { start: 24, end: 27, fps: 2, repeat: -1 },
  interact: { start: 28, end: 31, fps: 8, repeat: 0 },
  pickup: { start: 28, end: 29, fps: 8, repeat: 0 },
  dash: { start: 10, end: 15, fps: 18, repeat: -1 },
  celebrate: { start: 32, end: 35, fps: 7, repeat: -1 },
  victory: { start: 36, end: 39, fps: 5, repeat: -1 },
  stumble: { start: 40, end: 43, fps: 9, repeat: 0 },
  'enter-door': { start: 4, end: 9, fps: 9, repeat: 0 },
  'exit-door': { start: 4, end: 9, fps: 9, repeat: 0 },
};

/** Shared by the PNG preload pipeline and the development drawing generator. */
export function registerAnimations(scene: Phaser.Scene): void {
  for (const [name, anim] of Object.entries(SNOWBALL_ANIMATIONS)) {
    const key = `snowball-${name}`;
    if (!scene.anims.exists(key)) scene.anims.create({
      key, frames: scene.anims.generateFrameNumbers('snowball', { start: anim.start, end: anim.end }),
      frameRate: anim.fps, repeat: anim.repeat,
    });
  }
}

function crown(p: Pixels, x: number, y: number) {
  p.poly([[x,y+2],[x+3,y+5],[x+6,y],[x+9,y+5],[x+12,y+2],[x+11,y+10],[x+1,y+10]], C.woodDark);
  p.poly([[x+1,y+3],[x+4,y+6],[x+6,y+2],[x+8,y+6],[x+11,y+3],[x+10,y+8],[x+2,y+8]], C.gold);
  p.rect(x+2,y+8,8,1,C.goldLight); p.rect(x+5,y+6,2,2,C.coral);
}

function snowball(p: Pixels, frame: number) {
  const S = SNOWBALL_COAT;
  const asleep = frame >= 24 && frame < 28;
  const sitting = frame >= 22 && frame < 24;
  const moving = frame >= 4 && frame < 16;
  const leaping = frame >= 16 && frame < 20;
  const celebrating = frame >= 32 && frame < 40;
  const squash = frame === 20 || frame === 40;
  const phase = frame % 6;
  const bob = moving ? [0,-1,-1,0,0,0][phase] : celebrating ? -(frame % 2) : 0;
  const b = bob + (squash ? 2 : 0);
  if (asleep) {
    p.ellipse(4,19,24,12,S.outline); p.ellipse(5,18,22,11,S.bodyShade); p.ellipse(7,18,18,9,S.body);
    p.ellipse(17,23,12,8,S.outline); p.ellipse(18,23,10,7,S.face);
    p.poly([[18,24],[18,19],[23,24]],S.point); p.poly([[19,23],[19,21],[22,24]],S.ear);
    p.ellipse(21,26,8,4,S.white); p.line(23,26,26,26,S.outline); p.rect(27,27,1,1,S.nose);
    p.ellipse(3,26,18,5,S.outline); p.ellipse(4,26,17,4,S.point); p.rect(7,27,8,1,S.face);
    p.rect(21,29,7,2,S.body); if (frame % 2) p.rect(12,19,6,1,S.white);
    return;
  }
  // The photos do not resolve a complete tail pattern: keep its gray shading simple.
  p.line(9,25+b,4,19+b,S.outline,4); p.line(4,19+b,4,13+b,S.outline,4);
  p.line(8,25+b,5,19+b,S.point,2); p.line(5,19+b,5,14+b,S.point,2);
  p.rect(5,14+b,1,5,S.face);
  p.ellipse(sitting?9:7,16+b,sitting?17:21,squash?13:14,S.outline);
  p.ellipse(sitting?10:8,17+b,sitting?15:19,squash?10:12,S.body);
  p.ellipse(8,21+b,8,7,S.bodyShade); p.ellipse(13,18+b,12,11,S.white);
  // Round pale paws retain the 64 px bottom baseline and existing animation indices.
  const step = moving ? [-2,0,2,2,0,-2][phase] : 0;
  const footY = leaping ? 26 : 28;
  for (const x of [9+step,21-step]) {
    p.ellipse(x,footY,7,4,S.outline); p.ellipse(x+1,footY,5,3,S.body);
    p.rect(x+2,footY+2,3,1,S.bodyShade);
  }
  if (sitting) {
    p.ellipse(13,23,5,7,S.bodyShade); p.ellipse(14,23,4,7,S.body);
    p.ellipse(23,23,5,7,S.bodyShade); p.ellipse(24,23,4,7,S.body);
  }
  const hy = 5 + b;
  p.poly([[11,hy+6],[11,hy-2],[13,hy-3],[19,hy+3],[24,hy+3],[28,hy-3],[30,hy-2],[31,hy+7]],S.outline);
  p.poly([[12,hy+5],[12,hy-1],[14,hy],[18,hy+4],[25,hy+4],[29,hy-1],[30,hy],[30,hy+7]],S.face);
  p.poly([[13,hy],[17,hy+4],[13,hy+5]],S.ear); p.poly([[26,hy+4],[29,hy],[29,hy+5]],S.ear);
  p.rect(13,hy+1,1,3,S.earLight); p.rect(28,hy+2,1,3,S.earLight);
  p.ellipse(9,hy+3,23,17,S.outline); p.ellipse(10,hy+3,21,16,S.body);
  p.rect(9,hy+10,2,5,S.body); p.rect(30,hy+10,2,5,S.body);
  // Photo 4 anchors the pale face; photo 7 anchors the gray bridge and blue eyes.
  p.ellipse(12,hy+7,9,8,S.face); p.ellipse(23,hy+7,8,8,S.face);
  p.poly([[20,hy+6],[23,hy+6],[25,hy+13],[22,hy+15],[19,hy+12]],S.point);
  p.ellipse(15,hy+13,15,6,S.white);
  // Snowball's own narrow forehead and cheek markings stay soft and localized.
  p.line(16,hy+4,19,hy+7,S.stripe);
  p.line(21,hy+4,21,hy+8,S.stripe);
  p.line(26,hy+4,23,hy+7,S.stripe);
  p.rect(11,hy+12,3,1,S.point); p.rect(10,hy+15,3,1,S.point);
  p.rect(29,hy+12,2,1,S.point); p.rect(29,hy+15,3,1,S.point);
  const blink = frame === 3 || sitting && frame % 2 === 1 || frame >= 40;
  if (blink) {
    p.line(14,hy+11,18,hy+12,S.outline); p.line(24,hy+12,28,hy+11,S.outline);
  } else {
    for (const x of [13,24]) {
      p.ellipse(x,hy+8,7,7,S.eyeLine); p.ellipse(x+1,hy+9,5,5,S.eye);
      p.rect(x+3,hy+10,2,3,S.eyeLine); p.rect(x+2,hy+9,1,1,S.white);
      p.rect(x+2,hy+13,2,1,S.eyeLight);
    }
  }
  p.poly([[21,hy+14],[24,hy+14],[22,hy+16]],S.nose);
  p.rect(22,hy+16,1,1,S.outline);
  p.line(20,hy+17,21,hy+18,S.outline); p.line(23,hy+18,24,hy+17,S.outline);
  p.rect(11,hy+17,4,1,S.white); p.rect(28,hy+17,4,1,S.white);
  if (frame >= 28 && frame < 32) {
    p.ellipse(26,22-frame%2*2,6,6,S.outline); p.ellipse(27,22-frame%2*2,4,5,S.body);
  }
  if (celebrating) {
    p.ellipse(7,20+b,6,7,S.outline); p.ellipse(8,20+b,4,6,S.body);
    if (frame >= 36) crown(p,16,0);
  }
}

/** The sleeping neighbor is a separate cat, not Snowball's sleep animation. */
function sleepyNeighbor(p: Pixels) {
  p.ellipse(4,19,24,12,C.ink); p.ellipse(5,18,22,11,C.fur); p.ellipse(12,18,13,8,C.shade);
  p.ellipse(17,23,12,8,C.ink); p.ellipse(18,23,10,7,C.cream);
  p.poly([[18,24],[18,19],[23,24]],C.ink); p.poly([[19,23],[19,21],[22,24]],C.pink);
  p.line(23,26,26,26,C.ink); p.rect(27,27,1,1,C.coral);
  p.ellipse(3,26,18,5,C.ink); p.ellipse(4,26,17,4,C.shade); p.rect(7,27,8,1,C.fur);
  p.rect(21,29,7,2,C.cream);
}

function paw(p: Pixels, x: number, y: number, s: number, color: string) {
  p.ellipse(x+2*s,y+4*s,6*s,5*s,color);
  [[0,2],[3,0],[6,0],[9,2]].forEach(([a,b])=>p.ellipse(x+a*s,y+b*s,3*s,3*s,color));
}
function fish(p: Pixels) {
  p.poly([[5,12],[0,7],[0,23],[6,20]],C.woodDark); p.poly([[5,13],[2,11],[2,20],[6,18]],C.gold);
  p.ellipse(4,7,26,18,C.woodDark); p.ellipse(5,7,24,16,C.gold); p.ellipse(8,8,15,7,C.goldLight);
  p.poly([[13,8],[18,3],[19,10]],C.woodDark); p.poly([[14,8],[17,5],[18,9]],C.gold);
  p.poly([[13,23],[18,27],[18,21]],C.woodDark); p.rect(23,12,3,3,C.ink); p.rect(23,12,1,1,C.white);
  p.line(15,14,13,17,C.woodDark); p.line(13,17,16,18,C.woodDark); p.rect(8,18,2,1,C.goldLight);
}
function star(p: Pixels) {
  const points=[[16,1],[20,10],[30,11],[23,19],[25,29],[16,24],[7,29],[9,19],[1,11],[12,10]];
  p.poly(points,C.woodDark); p.poly(points.map(([x,y])=>[16+(x-16)*.79,16+(y-16)*.79]),C.gold);
  p.poly([[16,5],[18,12],[25,13],[19,16],[10,22],[11,16],[6,13],[14,12]],C.goldLight);
  p.rect(13,16,2,3,C.woodDark); p.rect(20,16,2,3,C.woodDark); p.rect(16,21,3,1,C.coral);
}
function feather(p: Pixels) {
  p.poly([[6,29],[8,17],[14,8],[25,2],[28,3],[25,15],[15,24]],C.ink);
  p.poly([[8,26],[10,16],[16,9],[26,3],[24,14],[15,22]],C.pink);
  p.poly([[10,22],[12,15],[22,6],[20,13]],C.cream); p.line(6,29,23,8,C.white,2);
  for(let k=0;k<4;k++){p.line(12+k*3,22-k*3,18+k*2,21-k*3,C.rose);}
}
function plant(p: Pixels) {
  p.frame(23,91,50,12,C.woodLight); p.poly([[27,103],[69,103],[65,127],[32,127]],C.ink);
  p.poly([[30,103],[66,103],[62,124],[35,124]],C.wood); p.rect(35,106,5,15,C.woodLight); p.rect(37,121,23,2,C.woodDark);
  p.line(47,93,49,27,C.woodDark,4); p.line(49,71,22,45,C.woodDark,3); p.line(49,56,75,23,C.woodDark,3);
  [[17,38,29,18],[48,49,29,20],[32,22,24,29],[61,14,26,20],[21,64,26,17],[50,73,30,18],[41,4,18,24]].forEach(([x,y,w,h],i)=>{
    p.ellipse(x-2,y-2,w+4,h+4,C.ink);p.ellipse(x,y,w,h,i%2?C.green:C.moss);p.ellipse(x+3,y+2,w/2,h/3,C.leaf);
    p.line(x+w/3,y+h/2,x+w-4,y+h-3,C.green,2);
  });
}
function furniture(p: Pixels, key: string) {
  if(key==='sofa') {
    p.frame(28,29,232,107,C.coral,C.ink,4);p.rect(34,35,220,73,C.pink);p.rect(39,40,210,3,'#f7b5aa');
    p.line(144,41,144,103,C.coral,3);p.rect(39,84,208,15,'#df9991');
    p.frame(7,77,38,62,C.coral,C.ink,4);p.frame(243,77,38,62,C.coral,C.ink,4);
    p.rect(13,82,27,6,C.pink);p.rect(247,82,28,6,C.pink);p.frame(42,106,201,33,C.coral,C.ink,3);
    p.rect(45,109,195,13,C.pink);p.rect(51,133,182,3,C.rose);p.rect(30,139,12,21,C.woodDark);p.rect(248,139,12,21,C.woodDark);
    p.frame(61,64,50,41,C.cream,C.rose,2);p.rect(65,67,41,4,C.white);paw(p,73,76,2,C.pink);
    p.poly([[194,57],[234,69],[221,104],[181,93]],C.rose);p.poly([[196,60],[230,71],[219,100],[185,91]],C.gold);
    for(let x=196;x<222;x+=8)p.line(x,69,x-8,91,C.goldLight,2);
  } else if(key==='cushion') {
    p.ellipse(1,9,126,38,C.ink);p.ellipse(3,7,122,36,C.coral);p.ellipse(6,5,116,30,C.pink);p.ellipse(18,11,90,22,'#edb5a4');
    p.ellipse(32,16,64,19,C.coral);p.ellipse(35,14,58,18,'#e9b39d');p.rect(21,15,12,2,C.cream);p.rect(93,18,9,2,C.cream);
    for(let x=11;x<119;x+=12)p.rect(x,33+Math.round(Math.sin(x)*2),3,2,C.rose);
  } else if(key==='lamp') {
    p.ellipse(16,213,64,11,C.ink);p.ellipse(22,212,52,7,C.woodDark);p.rect(45,85,8,130,C.ink);p.rect(47,86,3,127,C.woodLight);
    p.poly([[26,18],[70,18],[88,85],[8,85]],C.ink);p.poly([[29,21],[67,21],[82,80],[14,80]],C.goldLight);
    p.rect(16,73,65,7,C.gold);p.line(35,25,28,69,C.cream,3);p.line(62,25,68,69,C.gold,2);
    p.rect(44,9,9,10,C.woodDark);p.line(73,83,73,111,C.woodDark,2);p.ellipse(70,108,7,8,C.gold);
  } else if(key==='shelf') {
    p.frame(5,0,118,219,C.wood,C.ink,3);p.rect(13,8,102,201,C.woodDark);
    for(let y=57;y<218;y+=52){p.frame(10,y,108,9,C.woodLight,C.ink,2);}
    p.rect(11,219,10,5,C.ink);p.rect(108,219,10,5,C.ink);
    const colors=[C.green,C.coral,C.blue,C.gold,C.lavender];
    for(let row=0;row<4;row++)for(let i=0;i<7;i++){
      const x=18+i*13,y=15+row*52+((i+row)%3)*5,h=42-((i+row)%3)*5;
      p.frame(x,y,11,h,colors[(i+row)%5],C.ink,1);p.rect(x+2,y+4,7,2,C.cream);p.rect(x+2,y+h-6,7,1,C.cream);
    }
    p.ellipse(57,129,29,29,C.cream);paw(p,63,137,1,C.pink);
  } else if(key==='cat-tree') {
    p.frame(9,271,144,17,C.fur,C.ink,3);p.frame(24,195,61,78,C.fur,C.ink,3);
    p.ellipse(34,220,40,57,C.ink);p.ellipse(38,223,32,49,C.woodDark);p.rect(37,266,37,7,C.fur);
    [[110,83,176],[41,140,55],[41,16,102]].forEach(([x,y,h])=>{
      p.frame(x,y,21,h,C.fur,C.ink,2);for(let n=y+5;n<y+h;n+=6)p.line(x+2,n,x+18,n-3,C.woodLight,2);
    });
    [[21,0,64],[89,73,64],[7,125,95],[72,204,80]].forEach(([x,y,w])=>{p.frame(x,y,w,16,C.fur,C.ink,3);p.rect(x+4,y+3,w-8,4,C.cream);});
    p.line(102,89,102,133,C.ink,2);p.ellipse(95,130,16,17,C.ink);p.ellipse(97,131,12,13,C.pink);
  } else if(key==='window') {
    p.frame(14,7,292,266,C.woodDark,C.ink,4);p.frame(23,16,274,247,'#eac7ad',C.woodLight,4);
    p.rect(32,24,256,232,'#b2abb9');p.rect(32,120,256,136,'#dab4b2');p.rect(32,170,256,86,'#edc6a9');
    p.ellipse(202,119,46,46,C.goldLight);
    for(let x=32;x<288;x+=25){const h=37+((x*17)%43);p.rect(x,242-h,21,h,'#908ca2');for(let y=249-h;y<237;y+=12)p.rect(x+5,y,4,5,'#f7d5a1');}
    p.rect(155,24,10,232,C.woodDark);p.rect(159,24,3,232,C.woodLight);p.rect(32,145,256,9,C.woodDark);p.rect(32,145,256,3,C.woodLight);
    p.line(44,31,84,31,'#e6d4cf',3);p.line(44,35,69,35,'#e6d4cf',3);
    p.frame(0,268,320,14,C.woodLight,C.ink,3);p.rect(7,272,306,3,C.cream);
    p.rect(0,0,320,7,C.woodDark);
    for(const [x,dir] of [[0,1],[266,-1]]){
      p.poly([[x,8],[x+54,8],[x+44,79],[x+27,184],[x+50,265],[x,265]],C.coral);
      p.poly([[x+3,8],[x+43,8],[x+32,91],[x+17,181],[x+40,261],[x+3,261]],C.pink);
      for(let xx=x+7;xx<x+40;xx+=11)p.line(xx,14,xx-dir*3,84,'#f0b6ac',3);
      p.rect(x+8,178,27,5,C.gold);for(let yy=25;yy<170;yy+=25)p.rect(x+10,yy,4,4,C.cream);
    }
  } else if(key==='door') {
    p.frame(4,0,120,224,C.woodDark,C.ink,4);p.frame(13,9,102,215,C.woodLight,C.ink,3);
    p.frame(22,19,84,133,'#9aa3b0',C.woodDark,3);p.rect(25,73,78,75,'#e6b8a2');
    p.ellipse(69,81,20,20,C.goldLight);for(let x=25;x<103;x+=16)p.rect(x,124-(x%19),13,24+x%19,'#858b9f');
    p.rect(61,22,5,126,C.woodDark);p.rect(25,83,78,5,C.woodDark);p.frame(23,166,80,41,C.wood,C.woodDark,3);
    p.ellipse(96,154,10,10,C.ink);p.ellipse(97,154,7,7,C.gold);p.rect(1,216,126,8,C.woodDark);
  } else if(key==='toy-box'||key==='treat-box') {
    p.frame(5,21,86,42,C.wood,C.ink,3);p.frame(1,14,94,14,C.woodLight,C.ink,3);
    p.rect(9,31,77,3,C.woodLight);p.rect(9,56,77,3,C.woodDark);p.rect(9,30,4,28,C.woodLight);p.rect(81,30,4,28,C.woodDark);
    p.frame(32,32,32,23,C.cream,C.woodDark,2);paw(p,37,37,2,key==='toy-box'?C.coral:C.gold);
    p.rect(45,22,9,8,C.gold);p.rect(48,24,3,4,C.woodDark);
  } else if(key==='scratch') {
    p.poly([[11,63],[33,2],[83,2],[62,63]],C.ink);p.poly([[16,59],[36,6],[77,6],[58,59]],C.woodLight);
    p.poly([[23,54],[39,12],[70,12],[55,54]],C.wood);for(let y=18;y<52;y+=5)p.line(40-(y-18)*.3,y,66-(y-18)*.3,y,C.woodDark,2);
    paw(p,40,25,1,C.cream);
  } else if(key==='tunnel') {
    p.frame(27,7,63,50,C.rose,C.ink,3);p.ellipse(48,6,47,51,C.ink);p.ellipse(49,8,43,46,C.coral);
    p.ellipse(0,7,52,56,C.ink);p.ellipse(3,9,47,51,C.gold);p.ellipse(7,13,39,44,C.rose);p.ellipse(9,16,34,38,C.deep);
    p.line(59,12,63,52,C.gold,3);p.rect(32,7,44,3,C.pink);
  } else if(key==='books') {
    [[3,47,73,15,C.blue],[9,31,65,15,C.coral],[0,16,69,15,C.green]].forEach(([x,y,w,h,color])=>{
      p.frame(Number(x),Number(y),Number(w),Number(h),String(color),C.ink,2);p.rect(Number(x)+8,Number(y)+4,Number(w)-12,Number(h)-7,C.cream);
      p.rect(Number(x)+10,Number(y)+7,Number(w)-16,1,C.fur);
    });
  } else if(key==='rug') {
    p.ellipse(0,1,256,61,C.rose);p.ellipse(5,3,246,55,C.coral);p.ellipse(14,7,228,47,C.gold);p.ellipse(18,9,220,43,C.pink);
    for(let x=28;x<232;x+=16){p.rect(x,14,5,3,C.cream);p.rect(x,47,5,3,C.cream);}paw(p,104,20,4,C.cream);
  }
}

function toy(p: Pixels, key: string) {
  if(key==='yarn') {
    p.ellipse(2,1,29,30,C.ink);p.ellipse(3,2,27,27,C.coral);p.ellipse(5,3,19,20,C.pink);
    for(let i=0;i<4;i++){p.line(6+i*5,4,3+i*4,19,C.rose);p.line(7,10+i*4,25,7+i*4,C.rose);}
    p.line(9,25,27,15,C.rose,2);p.line(16,29,31,29,C.coral,2);p.rect(7,5,2,7,'#f9c2b4');
  } else if(key==='bell-ball') {
    p.ellipse(2,2,29,29,C.ink);p.ellipse(3,3,26,26,C.gold);p.ellipse(5,4,19,14,C.goldLight);
    p.rect(3,17,26,2,C.woodDark);p.ellipse(13,16,6,8,C.ink);p.rect(15,22,2,5,C.ink);p.ellipse(12,0,8,7,C.woodDark);p.rect(14,2,4,3,C.gold);
  } else if(key==='plush'||key==='mouse') {
    const q=new Pixels(p.ctx,p.ox+(key==='mouse'?8:0),p.oy+(key==='mouse'?16:0),p.scale);
    q.line(8,23,2,18,C.pink,2);q.line(2,18,1,12,C.pink,2);q.ellipse(7,12,22,16,C.ink);q.ellipse(8,12,20,14,C.shade);
    q.ellipse(14,3,12,13,C.ink);q.ellipse(15,4,10,11,C.fur);q.ellipse(17,6,6,7,C.pink);
    q.ellipse(8,6,10,10,C.ink);q.ellipse(9,7,8,8,C.pink);q.ellipse(20,15,10,9,C.fur);q.rect(25,15,2,2,C.ink);q.rect(29,20,2,2,C.pink);
    q.rect(10,26,6,2,C.pink);q.rect(24,25,5,3,C.pink);if(key==='mouse'){q.rect(21,2,1,11,C.woodDark);q.rect(22,2,9,5,C.cream);}
  } else if(key==='vacuum') {
    p.ellipse(0,5,64,27,C.ink);p.ellipse(2,3,60,25,C.lavender);p.ellipse(4,2,56,20,C.fur);p.ellipse(8,4,47,14,'#d7d2d2');
    p.ellipse(24,8,14,7,C.ink);p.ellipse(26,8,10,5,C.coral);p.rect(10,23,45,3,C.shade);p.rect(40,23,5,2,C.gold);
    p.rect(20,17,4,2,C.ink);p.rect(40,17,4,2,C.ink);
  } else if(key==='spring') {
    p.frame(4,40,40,8,C.coral,C.ink,2);for(let y=17;y<40;y+=6){p.ellipse(11,y,27,9,C.ink);p.ellipse(14,y+1,21,5,C.blue);p.rect(14,y+3,20,2,C.cream);}
    p.ellipse(6,1,38,18,C.ink);p.ellipse(8,1,34,14,C.pink);paw(p,18,3,1,C.cream);
  } else if(key==='wand') {
    p.line(4,124,46,22,C.ink,5);p.line(5,123,47,22,C.woodLight,2);p.line(48,22,55,63,C.ink,2);
    const f=new Pixels(p.ctx,p.ox+28,p.oy+57,p.scale);feather(f);p.ellipse(43,15,12,12,C.ink);p.ellipse(45,16,8,8,C.gold);
  } else if(key==='checkpoint'||key==='flag') {
    p.frame(10,11,7,110,C.woodLight,C.ink,2);p.ellipse(8,3,12,12,C.ink);p.ellipse(9,4,10,9,C.gold);
    p.poly([[17,18],[61,23],[49,40],[60,58],[17,52]],C.ink);p.poly([[18,21],[56,26],[44,40],[55,54],[18,49]],key==='flag'?C.coral:C.green);
    paw(p,27,30,2,C.cream);p.frame(4,118,23,10,C.woodDark,C.ink,2);
  }
}

function backgrounds(p: Pixels, key: string) {
  if(key==='sky') {
    const bands=['#8d899f','#a095ac','#b49dad','#c4a7b1','#d6adb1','#e8b6ad','#efc5b0','#f4d4bb'];
    bands.forEach((color,i)=>p.rect(0,i*90,1024,90,color));
    p.ellipse(715,280,122,122,'#f9dfb5');p.ellipse(726,287,101,101,'#ffe8ba');
    for(let k=0;k<13;k++){const x=(k*137+47)%1000,y=180+(k*53)%300;for(let i=0;i<4;i++)p.ellipse(x+i*19,y-(i%2)*13,75,32,'#e7b6b5');p.rect(x+18,y+26,98,4,'#eec5bc');}
    [[53,79],[411,62],[618,111],[870,42]].forEach(([x,y])=>{p.rect(x,y,2,7,C.cream);p.rect(x-2,y+2,6,2,C.cream);});
  } else if(key==='far-city') {
    for(let i=0;i<32;i++){const x=i*32,h=80+(i*73)%150,y=680-h;p.rect(x,y,32,h,'#8d889e');p.rect(x+3,y+4,25,h-4,'#9690a4');if(i%4===0)p.rect(x+14,y-21,3,22,'#8d889e');for(let yy=y+10;yy<663;yy+=17)for(let xx=x+7;xx<x+28;xx+=11)if((xx+yy)%3!==0)p.rect(xx,yy,3,5,'#d8c1ad');}p.rect(0,680,1024,40,'#8d889e');
  } else if(key==='mid-buildings') {
    for(let i=0;i<12;i++){const x=i*88,h=92+(i*67)%156,y=720-h;p.frame(x,y,81,h,'#a38f9b','#797786',3);p.rect(x-2,y-5,86,7,'#777481');for(let yy=y+16;yy<710;yy+=30)for(let xx=x+12;xx<x+74;xx+=25){p.frame(xx,yy,12,17,'#e0b6a1','#847885',2);if((xx+yy)%3===0)p.rect(xx+3,yy+3,5,10,'#f5d4a5');}p.rect(x+8,y+8,57,3,'#b69baa');}
  } else if(key==='near-houses') {
    for(let i=0;i<6;i++){const x=i*180+10,y=561-(i%2)*32;p.frame(x,y,157,159,'#bd9a8d','#685b69',4);p.poly([[x-8,y],[x+24,y-43],[x+130,y-43],[x+165,y]],'#665e75');
      for(let yy=y-33;yy<y;yy+=10)for(let xx=x+15;xx<x+146;xx+=20)p.rect(xx+(yy%3)*3,yy,16,3,'#8f8496');
      for(let xx=x+21;xx<x+139;xx+=63){p.frame(xx,y+27,35,55,C.goldLight,C.woodDark,4);p.rect(xx+16,y+30,3,49,C.woodDark);p.rect(xx+2,y+52,31,3,C.woodDark);p.rect(xx-5,y+81,46,6,C.woodDark);}
      p.frame(x+65,y+100,31,60,C.wood,C.woodDark,3);}
  } else {
    for(let i=0;i<18;i++){const x=i*62,y=55+(i*19)%40;p.ellipse(x,y,80,94,'#616e61');p.ellipse(x+8,y+5,61,61,'#728369');p.ellipse(x+13,y+3,30,29,'#8c9874');if(i%3===0){p.ellipse(x+24,y+16,11,10,C.coral);p.rect(x+28,y+19,3,3,C.gold);}}
  }
}

export const TEXTURE_SIZES: Record<string, [number, number]> = {
  fish:[32,32],star:[32,32],feather:[32,32],key:[32,32],heart:[32,32],yarn:[32,32],
  'bell-ball':[32,32],plush:[32,32],mouse:[48,48],'sleepy-cat':[64,64],vacuum:[64,32],
  'toy-box':[96,64],'treat-box':[96,64],door:[128,224],checkpoint:[64,128],flag:[64,128],scratch:[96,64],tunnel:[96,64],
  wand:[64,128],spring:[48,48],cushion:[128,48],plant:[96,128],'cat-tree':[160,288],window:[320,288],sofa:[288,160],lamp:[96,224],
  shelf:[128,224],rug:[256,64],books:[80,64],sky:[1024,720],'far-city':[1024,720],'mid-buildings':[1024,720],'near-houses':[1024,720],foreground:[1024,128],
  sparkle:[16,16],crown:[32,32],paw:[32,32],
};

export function createTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('snowball')) return;
  const make=(key:string,w:number,h:number,draw:Draw)=>{
    const texture=scene.textures.createCanvas(key,w,h);
    if(!texture) throw new Error(`Unable to create texture ${key}`);
    texture.context.imageSmoothingEnabled=false;draw(new Pixels(texture.context));texture.refresh();return texture;
  };
  const cat=make('snowball',64*44,64,p=>{for(let i=0;i<44;i++)snowball(new Pixels(p.ctx,i*64,0,2),i);});
  for(let i=0;i<44;i++)cat.add(i,0,i*64,0,64,64);
  registerAnimations(scene);
  const world=make('world',64,32,p=>{
    p.rect(0,0,32,32,C.wood);p.rect(0,0,32,3,C.cream);p.rect(0,3,32,5,C.woodLight);p.rect(0,8,32,2,C.woodDark);p.rect(0,30,32,2,C.woodDark);
    p.rect(0,10,2,20,C.woodDark);p.rect(3,11,17,1,C.woodLight);p.rect(16,18,15,1,C.woodDark);p.rect(7,24,20,1,C.woodLight);p.rect(5,14,2,2,C.woodDark);
    p.frame(32,0,32,16,C.wood,C.ink,2);p.rect(34,2,28,4,C.woodLight);p.rect(34,2,28,1,C.cream);p.rect(36,10,22,2,C.woodDark);
  });world.add(0,0,0,0,32,32);world.add(1,0,32,0,32,32);
  for(const [key,[w,h]] of Object.entries(TEXTURE_SIZES))make(key,w,h,p=>{
    if(key==='fish')fish(p);else if(key==='star')star(p);else if(key==='feather')feather(p);
    else if(key==='key'){p.ellipse(7,1,19,19,C.woodDark);p.ellipse(8,2,17,17,C.gold);p.ellipse(12,5,9,10,C.woodDark);p.ellipse(13,6,7,8,C.goldLight);p.frame(13,17,7,15,C.gold,C.woodDark,1);p.rect(18,24,7,4,C.woodDark);p.rect(19,24,5,2,C.gold);p.rect(18,29,5,3,C.gold);}
    else if(key==='heart'){p.poly([[2,7],[6,3],[12,3],[16,7],[20,3],[27,3],[31,8],[30,16],[16,30],[2,16]],C.rose);p.poly([[4,8],[7,5],[11,5],[16,10],[21,5],[26,5],[29,9],[27,16],[16,27],[5,16]],C.pink);p.rect(7,7,4,4,C.cream);}
    else if(key==='plant')plant(p);else if(key==='sleepy-cat')sleepyNeighbor(new Pixels(p.ctx,0,0,2));
    else if(['sky','far-city','mid-buildings','near-houses','foreground'].includes(key))backgrounds(new Pixels(p.ctx,0,0,1,w),key);
    else if(key==='crown')crown(new Pixels(p.ctx,3,4,2),0,0);
    else if(key==='paw')paw(p,4,7,2,C.cream);
    else if(key==='sparkle'){p.rect(7,1,2,14,C.goldLight);p.rect(1,7,14,2,C.goldLight);p.rect(5,5,6,6,C.cream);}
    else if(['yarn','bell-ball','plush','mouse','vacuum','spring','wand','checkpoint','flag'].includes(key))toy(p,key);
    else furniture(p,key);
  });
}
