"""Normalize approved art-pack key poses; never writes to the source pack.

Pillow only. All source rectangles were measured against the supplied PNGs.
Run from any directory with --source PATH. The repository root is resolved from
this script; output is public/assets/adventure with work/ QA previews.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import deque
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/adventure'
WORK = ROOT / 'work'
parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True, type=Path)
SOURCE = parser.parse_args().source.resolve()
if not SOURCE.is_dir():
    parser.error('--source must name the existing SnowballQuest_Art_Pack directory')
OUT.mkdir(parents=True, exist_ok=True)
WORK.mkdir(parents=True, exist_ok=True)


def clean(image: Image.Image, minimum_component: int = 4, keep_largest: bool = False) -> Image.Image:
    """Discard tiny detached extraction debris, retain original alpha elsewhere."""
    image = image.convert('RGBA')
    width, height = image.size
    pixels = list(image.getdata())
    visited = bytearray(width * height)
    components = []
    for at, color in enumerate(pixels):
        if visited[at] or color[3] == 0:
            continue
        component = [at]
        visited[at] = 1
        queue = deque([at])
        while queue:
            pos = queue.popleft()
            x, y = pos % width, pos // width
            for ny in range(max(0, y-1), min(height, y+2)):
                for nx in range(max(0, x-1), min(width, x+2)):
                    index = ny * width + nx
                    if not visited[index] and pixels[index][3] > 0:
                        visited[index] = 1
                        component.append(index)
                        queue.append(index)
        components.append(component)
        if len(component) < minimum_component:
            for index in component:
                pixels[index] = (0, 0, 0, 0)
    if keep_largest:
        largest = max(components, key=len)
        for component in components:
            if component is not largest:
                for index in component:
                    pixels[index] = (0, 0, 0, 0)
    # Transparent RGB in source combat sheets contains a checker preview.
    # Alpha is authoritative; zeroing invisible RGB prevents misleading previews.
    pixels = [(0, 0, 0, 0) if p[3] == 0 else p for p in pixels]
    image.putdata(pixels)
    return image


def source_crop(relative: str, box: tuple[int, int, int, int]) -> Image.Image:
    with Image.open(SOURCE / relative) as image:
        return clean(image.crop(box))


manifest: list[dict] = []
for name, source, size, frames in [
    ('enemy-vacuum', 'runtime/enemies/enemy_01_vacuum_drone.png', 64, 6),
    ('enemy-mouse', 'runtime/enemies/enemy_02_clockwork_mouse.png', 64, 6),
    ('enemy-pigeon', 'runtime/enemies/enemy_03_pigeon_scout.png', 64, 6),
    ('enemy-slime', 'runtime/enemies/enemy_04_bubble_slime.png', 64, 6),
    ('enemy-beetle', 'runtime/enemies/enemy_05_battery_beetle.png', 64, 6),
    ('enemy-mole', 'runtime/enemies/enemy_06_miner_mole.png', 64, 6),
    ('enemy-dragon', 'runtime/enemies/enemy_07_baby_bubble_dragon.png', 64, 6),
    ('enemy-shadow', 'runtime/enemies/enemy_08_shadow_fuzz.png', 64, 6),
    ('boss-wrench', 'runtime/bosses/boss_01_wrench_atlas.png', 128, 8),
    ('boss-galeplume', 'runtime/bosses/boss_02_galeplume_atlas.png', 128, 8),
    ('boss-bobo', 'runtime/bosses/boss_03_bobo_atlas.png', 128, 8),
    ('boss-volt', 'runtime/bosses/boss_04_volt_atlas.png', 128, 8),
    ('boss-tato', 'runtime/bosses/boss_05_tato_atlas.png', 128, 8),
    ('boss-bubble', 'runtime/bosses/boss_06_bubble_dragon_family_atlas.png', 192, 8),
    ('boss-nightink', 'runtime/bosses/boss_07_nightink_atlas.png', 192, 8),
]:
    with Image.open(SOURCE / source) as image:
        assert image.size == (size * frames, size)
        clean(image, minimum_component=1).save(OUT / f'{name}.png', optimize=True)
    manifest.append({'key': name, 'source': source, 'width': size*frames, 'height': size, 'frameSize': size, 'frameCount': frames})


ui = [
    ('fire-fruit', 'ui/fruit_pickups_icons.png', (60, 25, 365, 360), 32),
    # The top row contains unadorned pickup icons. Their opaque bases end by
    # y=357; the lower row's auras start immediately below the y=360 gutter.
    # Unequal column gutters were measured on the 1983 x 793 source PNG.
    ('fruit-wind', 'ui/fruit_pickups_icons.png', (470, 20, 760, 360), 32),
    ('fruit-water', 'ui/fruit_pickups_icons.png', (845, 20, 1130, 360), 32),
    ('fruit-lightning', 'ui/fruit_pickups_icons.png', (1210, 20, 1510, 360), 32),
    ('fruit-earth', 'ui/fruit_pickups_icons.png', (1610, 20, 1880, 360), 32),
    ('portrait-snowball', 'ui/dialogue_portraits.png', (25, 5, 415, 406), 96),
    ('portrait-ai', 'ui/dialogue_portraits.png', (439, 12, 840, 406), 96),
    ('portrait-wrench', 'ui/dialogue_portraits.png', (843, 8, 1289, 407), 96),
    ('badge-wrench', 'ui/boss_badges_and_collectibles.png', (4, 22, 368, 401), 64),
    ('ship-icon', 'ui/ship_ai_and_map_icons.png', (6, 75, 325, 324), 64),
]
ui_previews = []
for name, relative, box, size in ui:
    crop = source_crop(relative, box)
    if name == 'fire-fruit' or name.startswith('fruit-'):
        crop = clean(crop, keep_largest=True)
    bounds = crop.getchannel('A').getbbox()
    assert bounds is not None
    crop = crop.crop(bounds)
    scale = min((size - 4)/crop.width, (size - 4)/crop.height)
    resized = crop.resize((round(crop.width*scale), round(crop.height*scale)), Image.Resampling.NEAREST)
    final = Image.new('RGBA', (size, size))
    final.alpha_composite(resized, ((size-resized.width)//2, (size-resized.height)//2))
    final = clean(final, minimum_component=1)
    final.save(OUT / f'{name}.png', optimize=True)
    ui_previews.append((name, final))
    manifest.append({'key': name, 'source': relative, 'sourceBox': box, 'width': size, 'height': size})


# Coordinates follow observed, unequal gutters. Avoid the two reversed-facing
# poses in the first row. All poses use one scale, never per-frame fit-to-cell.
POSES = [
    ('ready', (5, 136, 158, 282)),
    ('paw-reach', (158, 139, 306, 283)),
    ('paw-swipe', (306, 137, 466, 284)),
    ('second-swipe', (602, 139, 743, 284)),
    ('heavy-windup', (1014, 135, 1151, 286)),
    ('heavy-sweep', (1143, 134, 1314, 286)),
    ('low-sweep', (1312, 137, 1467, 286)),
    ('rising-swipe', (1456, 131, 1628, 288)),
    ('air-rise', (162, 347, 300, 552)),
    ('air-slash', (299, 349, 469, 552)),
    ('pounce', (602, 351, 739, 552)),
    ('pound-impact', (739, 380, 886, 555)),
    ('pound-land', (884, 416, 1018, 555)),
    ('pound-recover', (1017, 408, 1162, 552)),
    ('dodge-start', (1165, 405, 1314, 552)),
    ('dodge-streak', (1313, 403, 1466, 552)),
    ('dodge-low', (1468, 414, 1616, 554)),
    ('counter-swipe', (1617, 405, 1774, 553)),
    ('hurt-alert', (2, 635, 134, 792)),
    ('hurt-flinch', (133, 635, 244, 792)),
    ('hurt-dizzy', (340, 641, 443, 793)),
    ('ko-nap', (440, 685, 569, 793)),
    ('ko-sleep', (567, 654, 672, 793)),
    ('fruit-look', (1202, 648, 1323, 794)),
    ('fruit-bite', (1321, 648, 1421, 794)),
    ('fruit-eat', (1420, 648, 1533, 794)),
    ('transform-a', (1533, 644, 1650, 795)),
    ('transform-b', (1650, 634, 1774, 795)),
]
SCALE = 0.32
atlas = Image.new('RGBA', (64*len(POSES), 64))
frames = []
for index, (name, box) in enumerate(POSES):
    crop = source_crop('characters/snowball/snowball_combat_sheet.png', box)
    if index == 3:
        # The next, reversed-facing cat's tail touches this paw's light effect.
        # Remove its measured upper-right region before component isolation.
        ImageDraw.Draw(crop).rectangle((711-box[0], 0, crop.width, 243-box[1]), fill=(0,0,0,0))
    if index == 7:
        # Preserve the intentionally detached crescent at the right side.
        # Tiny components in the left gutter belong to the preceding slash.
        crop = clean(crop, minimum_component=100)
        ImageDraw.Draw(crop).rectangle((0, 214-box[1], 17, crop.height), fill=(0,0,0,0))
    if index < 18:
        # Eliminate detached fragments from adjacent poses at uneven gutters.
        # These attack/dodge poses have their primary effect joined to the body.
        # Hurt, eating and transformation retain their separate stars/VFX below.
        crop = clean(crop, keep_largest=index != 7)
    bounds = crop.getchannel('A').getbbox()
    assert bounds is not None
    crop = crop.crop(bounds)
    target_size = (round(crop.width*SCALE), round(crop.height*SCALE))
    assert target_size[0] <= 62 and target_size[1] <= 62, (name, target_size)
    resized = crop.resize(target_size, Image.Resampling.NEAREST)
    # A fixed bottom anchor is the prototype contact point; jump movement stays
    # controlled by the physics body, and attacks must not resize that body.
    x, y = (64-resized.width)//2, 64-resized.height
    frame = Image.new('RGBA', (64,64))
    frame.alpha_composite(resized, (x,y))
    atlas.alpha_composite(frame, (index*64,0))
    frames.append({'index': index, 'pose': name, 'sourceBox': box, 'sourceAlphaBounds': bounds, 'destination': [x,y,*target_size], 'groundAnchor': [32,64]})
atlas.save(OUT/'snowball-combat.png', optimize=True)
manifest.append({'key':'snowball-combat','source':'characters/snowball/snowball_combat_sheet.png','width':atlas.width,'height':64,'frameSize':64,'frameCount':len(POSES),'scale':SCALE,'frames':frames})

# Standalone alpha QA uses real compositing, on both bright and dark backgrounds.
for background, color in [('light',(245,236,221)),('dark',(39,38,57))]:
    preview=Image.new('RGB',(6*208,5*226),color)
    draw=ImageDraw.Draw(preview)
    for index, (name, _) in enumerate(POSES):
        frame=atlas.crop((index*64,0,(index+1)*64,64)).resize((192,192),Image.Resampling.NEAREST)
        x,y=(index%6)*208,(index//6)*226
        preview.paste(frame,(x,y),frame)
        draw.line((x,y+192,x+192,y+192),fill=(120,130,140))
        draw.text((x+4,y+198),f'{index}: {name}',fill=(240,240,245) if background=='dark' else (35,35,45))
    preview.save(WORK/f'adventure-combat-{background}.png')
    ui_preview=Image.new('RGB',(3*320,((len(ui_previews)+2)//3)*345),color)
    draw=ImageDraw.Draw(ui_preview)
    for index,(name,frame) in enumerate(ui_previews):
        scale=3 if frame.width==96 else 4
        expanded=frame.resize((frame.width*scale,frame.height*scale),Image.Resampling.NEAREST)
        x,y=(index%3)*320,(index//3)*345
        ui_preview.paste(expanded,(x+(300-expanded.width)//2,y+(290-expanded.height)//2),expanded)
        draw.text((x+10,y+305),name,fill=(240,240,245) if background=='dark' else (35,35,45))
    ui_preview.save(WORK/f'adventure-ui-{background}.png')
    actors = [entry for entry in manifest if entry['key'].startswith(('enemy-', 'boss-'))]
    actor_preview=Image.new('RGB',(5*256,((len(actors)+4)//5)*224),color)
    draw=ImageDraw.Draw(actor_preview)
    for index, entry in enumerate(actors):
        size=entry['frameSize']
        with Image.open(OUT/f'{entry["key"]}.png') as sheet:
            frame=sheet.crop((0,0,size,size))
        expanded=frame.resize((176,176),Image.Resampling.NEAREST)
        x,y=(index%5)*256,(index//5)*224
        actor_preview.paste(expanded,(x+40,y+8),expanded)
        draw.text((x+14,y+195),entry['key'],fill=(240,240,245) if background=='dark' else (35,35,45))
    actor_preview.save(WORK/f'adventure-actors-{background}.png')

for entry in manifest:
    path=OUT/f'{entry["key"]}.png'
    entry['sha256']=hashlib.sha256(path.read_bytes()).hexdigest()
    with Image.open(path) as image:
        assert image.mode=='RGBA'
        assert image.getchannel('A').getextrema()[0]==0
        entry['alphaBounds']=image.getchannel('A').getbbox()
        entry['bytes']=path.stat().st_size
(OUT/'manifest.json').write_text(json.dumps({'version':2,'status':'Seven-stage runtime art; combat uses 28 approved key poses with procedural gameplay effects','assets':manifest},indent=2)+'\n',encoding='utf-8')
print(f'Prepared {len(manifest)} textures, {len(POSES)} combat key poses. See work/adventure-*.png for QA.')
