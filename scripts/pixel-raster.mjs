import zlib from 'node:zlib';

export class Raster {
  constructor(width, height) { this.width=width; this.height=height; this.data=new Uint8Array(width*height*4); this.fillStyle='#000000'; }
  fillRect(x,y,w,h) {
    const color=this.fillStyle.replace('#','');
    const rgb=[0,2,4].map(i=>parseInt(color.slice(i,i+2),16));
    const x0=Math.max(0,Math.round(x)),y0=Math.max(0,Math.round(y));
    for(let yy=y0;yy<Math.min(this.height,Math.round(y+h));yy++)for(let xx=x0;xx<Math.min(this.width,Math.round(x+w));xx++) this.data.set([...rgb,255],(yy*this.width+xx)*4);
  }
}
function crc32(buffer) { let crc=0xffffffff; for(const b of buffer) { crc^=b; for(let i=0;i<8;i++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); } return (crc^0xffffffff)>>>0; }
function chunk(type,data) { const name=Buffer.from(type),buf=Buffer.alloc(data.length+12); buf.writeUInt32BE(data.length);name.copy(buf,4);data.copy(buf,8);buf.writeUInt32BE(crc32(Buffer.concat([name,data])),data.length+8);return buf; }
export function png(raster) {
  const header=Buffer.alloc(13);header.writeUInt32BE(raster.width);header.writeUInt32BE(raster.height,4);header[8]=8;header[9]=6;
  const scan=Buffer.alloc((raster.width*4+1)*raster.height);
  for(let y=0;y<raster.height;y++)Buffer.from(raster.data.subarray(y*raster.width*4,(y+1)*raster.width*4)).copy(scan,y*(raster.width*4+1)+1);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);
}
