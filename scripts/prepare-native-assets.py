"""Copy the reviewed, versioned PNGs and maps into the native resource bundle."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'public/assets'
target = ROOT / 'ios/App/App/GameAssets'
target.mkdir(parents=True, exist_ok=True)
files = sorted(p for p in source.rglob('*') if p.is_file() and p.suffix in ('.png', '.json'))
manifest = {}
for path in files:
    destination = target / path.relative_to(source)
    destination.parent.mkdir(parents=True, exist_ok=True)
    data = path.read_bytes()
    if path.suffix == '.json':
        data = data.replace(b'\r\n', b'\n')
    destination.write_bytes(data)
    manifest[path.relative_to(source).as_posix()] = hashlib.sha256(data).hexdigest()
(target / 'native-integrity.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8', newline='\n')
print(f'Prepared {len(files)} native resources ({sum(p.stat().st_size for p in files):,} bytes).')
