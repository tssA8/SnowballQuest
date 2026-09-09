// Extend the original code-drawn artwork into native app icons; no source photos.
import fs from 'node:fs';
import path from 'node:path';
import { Raster, png, textures } from './export-assets.mjs';

const root = path.resolve(import.meta.dirname, '..');
const cat = textures.get('snowball');
function icon(size, transparent = false, adaptive = false) {
  const canvas = new Raster(size, size);
  if (!transparent) { canvas.fillStyle = '#e8d8b9'; canvas.fillRect(0, 0, size, size); }
  // Pixel-aligned fills keep the icon crisp, including small legacy launcher sizes.
  const wanted = size * (adaptive ? .60 : .82) / 64;
  const scale = wanted < 1 ? wanted : Math.floor(wanted);
  const x0 = Math.floor((size - 64 * scale) / 2);
  const y0 = Math.floor((size - 64 * scale) / 2);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const source = (y * cat.width + 36 * 64 + x) * 4;
    if (!cat.data[source + 3]) continue;
    canvas.fillStyle = '#' + [...cat.data.slice(source, source + 3)].map(n => n.toString(16).padStart(2, '0')).join('');
    canvas.fillRect(x0 + x * scale, y0 + y * scale, scale, scale);
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
