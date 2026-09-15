"""Slice the supplied art pack's standalone effects into fixed, transparent cells.

Mechanical import only: preserve source RGB/alpha, nearest-neighbor sampling,
measured rectangles, no recoloring or generated replacement cat. Requires Pillow.
The source pack is read-only. Rebuild from retained sources by omitting --source.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import shutil
from collections import deque
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'resources/art/element-sources'
OUT = ROOT / 'public/assets/elements'
CELL = 128
# Measured standalone effects at the bottom of the five source sheets.
REGIONS = {
    'fire': [('spark', (57, 886, 199, 1008)), ('shot', (231, 850, 424, 1011)),
             ('slash', (450, 850, 690, 1012)), ('impact', (711, 847, 1074, 1012)),
             ('smoke', (1098, 872, 1308, 1012)), ('dust', (1310, 910, 1490, 1008))],
    'wind': [('swirl', (17, 884, 230, 1014)), ('ribbon', (216, 884, 458, 1014)),
             ('shot', (460, 874, 843, 1018)), ('vortex', (846, 852, 1044, 1020)),
             ('leaves', (1025, 877, 1210, 1018)), ('impact', (1220, 876, 1528, 1020))],
    'water': [('drop', (30, 848, 141, 996)), ('impact', (155, 832, 381, 1005)),
              ('slash', (386, 813, 626, 1008)), ('crest', (634, 803, 884, 1012)),
              ('shot', (901, 825, 1280, 1010)), ('bubbles', (1281, 830, 1530, 1015))],
    'lightning': [('gold-spark', (87, 860, 184, 1006)), ('blue-spark', (190, 858, 300, 1006)),
                  ('sparks', (319, 840, 508, 1006)), ('bolt', (514, 836, 665, 1012)),
                  ('fork', (667, 831, 841, 1012)), ('shot', (842, 835, 1061, 1016)),
                  ('impact', (1062, 826, 1256, 1020)), ('cloud', (1257, 820, 1514, 1020))],
    'earth': [('stones', (24, 881, 320, 1007)), ('dust', (321, 880, 478, 1007)),
              ('small-dust', (468, 880, 616, 1007)), ('crack', (614, 882, 829, 1012)),
              ('ridge', (830, 875, 1158, 1018)), ('impact', (1150, 850, 1535, 1020))],
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def remove_gutter_fragments(image):
    """Drop tiny isolated extraction dust and fragments cut by the measured gutter."""
    w, h = image.size
    pixels = list(image.getdata())
    seen = bytearray(w * h)
    removed = 0
    for start, pixel in enumerate(pixels):
        if seen[start] or pixel[3] == 0: continue
        component, queue, touches = [start], deque([start]), False
        seen[start] = 1
        while queue:
            pos = queue.popleft(); x, y = pos % w, pos // w
            touches = touches or x in (0, w - 1) or y in (0, h - 1)
            for ny in range(max(0, y - 1), min(h, y + 2)):
                for nx in range(max(0, x - 1), min(w, x + 2)):
                    i = ny * w + nx
                    if not seen[i] and pixels[i][3] > 0:
                        seen[i] = 1; component.append(i); queue.append(i)
        if touches and len(component) > w * h * 0.2:
            raise ValueError('A major effect crosses a slice boundary; revise the measured region')
        if touches or len(component) < 12:
            removed += len(component)
            for i in component: pixels[i] = (0, 0, 0, 0)
    image.putdata(pixels)
    return image, removed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path)
    args = parser.parse_args()
    SOURCES.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    if args.source:
        source = args.source.resolve()
        inventory = json.loads((source / 'asset-manifest.json').read_text(encoding='utf-8'))
        for record in inventory['files']:
            path = (source / record['path']).resolve()
            if not path.is_relative_to(source) or not path.is_file() or sha(path) != record['sha256']:
                raise ValueError(f"Source inventory mismatch: {record['path']}")
        for element in REGIONS:
            shutil.copyfile(source / f'characters/snowball/snowball_{element}_sheet.png', SOURCES / f'{element}.png')
        shutil.copyfile(source / 'asset-manifest.json', ROOT / 'resources/art/pack-manifest.json')
        shutil.copyfile(source / 'SnowballQuest_Game_Design.md', ROOT / 'docs/SnowballQuest_Game_Design.md')
        shutil.copyfile(source / 'characters/snowball/ELEMENT_GENERATION_NOTES.md', SOURCES / 'GENERATION_NOTES.md')
        print(f"Verified {len(inventory['files'])} pack files before import.")
    records = []
    preview = Image.new('RGB', (8 * 180, 5 * 168), '#182238')
    draw = ImageDraw.Draw(preview)
    for row, (element, regions) in enumerate(REGIONS.items()):
        source = SOURCES / f'{element}.png'
        image = Image.open(source).convert('RGBA')
        if image.size != (1536, 1024):
            raise ValueError(f'Unexpected source dimensions: {element}')
        sheet = Image.new('RGBA', (CELL * len(regions), CELL))
        frames = []
        for index, (name, rectangle) in enumerate(regions):
            try:
                part, removed = remove_gutter_fragments(image.crop(rectangle))
            except ValueError as error:
                raise ValueError(f'{element}/{name}: {error}') from error
            bounds = part.getchannel('A').getbbox()
            if not bounds: raise ValueError(f'Empty effect: {element}/{name}')
            part = part.crop(bounds)
            scale = 116 / max(part.size)
            size = tuple(max(1, round(n * scale)) for n in part.size)
            part = part.resize(size, Image.Resampling.NEAREST)
            # Clear invisible RGB only; some source files retain checker previews there.
            part.putdata([(0, 0, 0, 0) if p[3] == 0 else p for p in part.getdata()])
            x, y = (CELL - part.width) // 2, (CELL - part.height) // 2
            sheet.alpha_composite(part, (index * CELL + x, y))
            preview.paste(part, (index * 180 + x, row * 168 + y), part)
            draw.text((index * 180 + 6, row * 168 + 133), f'{element}/{index}: {name}', fill='white')
            frames.append({'name': name, 'sourceBox': rectangle, 'alphaBounds': bounds,
                           'destination': [x, y, *size], 'pivot': [0.5, 0.5], 'removedGutterPixels': removed})
        target = OUT / f'{element}.png'
        sheet.save(target, optimize=True)
        records.append({'key': f'element-{element}', 'path': f'elements/{element}.png',
                        'frameSize': CELL, 'frameCount': len(regions), 'width': sheet.width, 'height': CELL,
                        'sha256': sha(target), 'sourceSHA256': sha(source), 'frames': frames})
    (OUT / 'manifest.json').write_text(json.dumps({'version': 1, 'assets': records}, indent=2) + '\n', encoding='utf-8', newline='\n')
    output = ROOT / 'test-results/element-art-import.png'
    output.parent.mkdir(parents=True, exist_ok=True)
    preview.save(output)
    print(f'Prepared {sum(len(r) for r in REGIONS.values())} standalone effects in five atlases. QA: {output}')


if __name__ == '__main__':
    main()
