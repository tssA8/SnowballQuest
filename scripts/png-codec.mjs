/** Decode build-time PNG assets without altering their pixels or importing exporters. */
import { inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS = new Map([[0, 1], [2, 3], [3, 1], [4, 2], [6, 4]]);

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const a = Math.abs(estimate - left), b = Math.abs(estimate - above), c = Math.abs(estimate - upperLeft);
  return a <= b && a <= c ? left : b <= c ? above : upperLeft;
}

/** Accept non-interlaced 8-bit grayscale, RGB, indexed, grayscale-alpha and RGBA PNGs. */
export function readPng(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const invalid = message => { throw new Error(`PNG: ${message}`); };
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(SIGNATURE)) invalid('invalid signature or truncated header');
  let width, height, colorType, channels, palette, transparency, finished = false;
  const parts = [];
  for (let offset = 8; offset < buffer.length;) {
    if (offset + 12 > buffer.length) invalid('truncated chunk');
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > buffer.length) invalid(`truncated ${type} chunk`);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (offset === 8 && type !== 'IHDR') invalid('IHDR must be the first chunk');
    if (type === 'IHDR') {
      if (width !== undefined || length !== 13) invalid('invalid or duplicate IHDR');
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      colorType = data[9]; channels = CHANNELS.get(colorType);
      if (!width || !height || width * height > 32_000_000) invalid('invalid dimensions or image exceeds 32 million pixels');
      if (data[8] !== 8) invalid(`unsupported bit depth ${data[8]}; expected 8`);
      if (!channels) invalid(`unsupported color type ${colorType}`);
      if (data[10] !== 0 || data[11] !== 0) invalid('unsupported compression or filter method');
      if (data[12] !== 0) invalid('interlaced PNGs are unsupported');
    } else if (type === 'PLTE') {
      if (!length || length % 3 || length > 768) invalid('invalid palette');
      palette = data;
    } else if (type === 'tRNS') {
      transparency = data;
    } else if (type === 'IDAT') {
      parts.push(data);
    } else if (type === 'IEND') {
      if (length !== 0) invalid('invalid IEND');
      finished = true;
      break;
    } else if (type[0] === type[0].toUpperCase()) {
      invalid(`unsupported critical chunk ${type}`);
    }
    offset = end;
  }
  if (!finished || !parts.length) invalid('missing image data or IEND');
  if (colorType === 3 && !palette) invalid('indexed image has no palette');
  if (transparency && !((colorType === 0 && transparency.length === 2) ||
    (colorType === 2 && transparency.length === 6) ||
    (colorType === 3 && transparency.length <= palette.length / 3))) invalid('invalid transparency chunk');

  const stride = width * channels, expected = (stride + 1) * height;
  const filtered = inflateSync(Buffer.concat(parts), { maxOutputLength: expected });
  if (filtered.length !== expected) invalid(`expected ${expected} scanline bytes, received ${filtered.length}`);
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = filtered[y * (stride + 1)];
    if (filter > 4) invalid(`unsupported row filter ${filter}`);
    const row = y * stride, source = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[row + x - channels] : 0;
      const above = y ? pixels[row + x - stride] : 0;
      const upperLeft = y && x >= channels ? pixels[row + x - stride - channels] : 0;
      const prediction = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above :
        filter === 3 ? Math.floor((left + above) / 2) : paeth(left, above, upperLeft);
      pixels[row + x] = (filtered[source + x] + prediction) & 255;
    }
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let index = 0, target = 0; index < pixels.length; index += channels, target += 4) {
    const red = pixels[index];
    if (colorType === 3) {
      if (red * 3 + 2 >= palette.length) invalid(`palette index ${red} is out of range`);
      rgba.set(palette.subarray(red * 3, red * 3 + 3), target);
      rgba[target + 3] = transparency?.[red] ?? 255;
    } else if (colorType === 0 || colorType === 4) {
      rgba.set([red, red, red, colorType === 4 ? pixels[index + 1] :
        transparency && red === transparency.readUInt16BE(0) ? 0 : 255], target);
    } else {
      const green = pixels[index + 1], blue = pixels[index + 2];
      rgba.set([red, green, blue, colorType === 6 ? pixels[index + 3] :
        transparency && red === transparency.readUInt16BE(0) && green === transparency.readUInt16BE(2) &&
          blue === transparency.readUInt16BE(4) ? 0 : 255], target);
    }
  }
  return { width, height, data: rgba };
}
