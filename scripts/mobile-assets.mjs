// Use the same approved Snowball master as the game for native app icons.
import fs from 'node:fs';
import path from 'node:path';
import { Raster, png, textures } from './export-assets.mjs';

const root = path.resolve(import.meta.dirname, '..');
const cat = textures.get('snowball');
const bounds = { left:64, top:64, right:0, bottom:0 };
for (let y=0;y<64;y++) for (let x=0;x<64;x++) if (cat.data[(y*cat.width+36*64+x)*4+3]) {
  bounds.left=Math.min(bounds.left,x);bounds.top=Math.min(bounds.top,y);bounds.right=Math.max(bounds.right,x);bounds.bottom=Math.max(bounds.bottom,y);
}
const catWidth=bounds.right-bounds.left+1,catHeight=bounds.bottom-bounds.top+1;
function icon(size, transparent = false, adaptive = false) {
  const canvas = new Raster(size, size);
  if (!transparent) { canvas.fillStyle = '#e8d8b9'; canvas.fillRect(0, 0, size, size); }
  // Pixel-aligned fills keep the icon crisp, including small legacy launcher sizes.
  const wanted = size * (adaptive ? .60 : .82) / Math.max(catWidth,catHeight);
  const scale = wanted < 1 ? wanted : Math.floor(wanted);
  const x0 = Math.floor((size - catWidth * scale) / 2);
  const y0 = Math.floor((size - catHeight * scale) / 2);
  for (let y = y0; y < y0 + catHeight * scale; y++) for (let x = x0; x < x0 + catWidth * scale; x++) {
    const sx = bounds.left + Math.floor((x - x0) / scale), sy = bounds.top + Math.floor((y - y0) / scale);
    const source = (sy * cat.width + 36 * 64 + sx) * 4;
    const alpha = cat.data[source + 3] / 255;
    if (!alpha) continue;
    const destination = (y * size + x) * 4;
    if (transparent) canvas.data.set(cat.data.subarray(source, source + 4), destination);
    else {
      for (let channel = 0; channel < 3; channel++) canvas.data[destination + channel] = Math.round(cat.data[source + channel] * alpha + canvas.data[destination + channel] * (1 - alpha));
      canvas.data[destination + 3] = 255;
    }
  }
  return png(canvas);
}
function write(relative, bytes) {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes);
}
for (const [density, size, foreground] of [['mdpi',48,108], ['hdpi',72,162], ['xhdpi',96,216], ['xxhdpi',144,324], ['xxxhdpi',192,432]]) {
  const directory = `android/app/src/main/res/mipmap-${density}`;
  write(`${directory}/ic_launcher.png`, icon(size));
  write(`${directory}/ic_launcher_round.png`, icon(size));
  write(`${directory}/ic_launcher_foreground.png`, icon(foreground, true, true));
}
write('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', icon(1024));
write('resources/icon.png', icon(1024));
// Replace Capacitor's default splash artwork with the game's own quiet background.
const splash = new Raster(64, 64); splash.fillStyle = '#242633'; splash.fillRect(0, 0, 64, 64);
for (const file of fs.readdirSync(path.join(root, 'android/app/src/main/res'))) {
  if (file.startsWith('drawable')) {
    const existing = `android/app/src/main/res/${file}/splash.png`;
    if (fs.existsSync(path.join(root, existing))) write(existing, png(splash));
  }
}
const iosSplash = 'ios/App/App/Assets.xcassets/Splash.imageset';
if (fs.existsSync(path.join(root, iosSplash))) for (const file of fs.readdirSync(path.join(root, iosSplash))) {
  if (file.endsWith('.png')) write(`${iosSplash}/${file}`, png(splash));
}
console.log('Exported Snowball icons and native splash backgrounds.');
