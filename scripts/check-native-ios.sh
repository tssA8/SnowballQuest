#!/usr/bin/env bash
# Used by both unsigned native CI and the signed TestFlight release gate.
set -euo pipefail
mkdir -p test-results/native-ios
swift test --package-path ios/NativeCore 2>&1 | tee test-results/native-ios/swift-core.log
python3 - <<'PY'
import hashlib, json
from pathlib import Path
root = Path('ios/App/App/GameAssets')
manifest = json.loads((root / 'native-integrity.json').read_text())
for name, expected in manifest.items():
    path = root / name
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise SystemExit(f'Native asset integrity mismatch: {name}')
print(f'Verified {len(manifest)} native assets.')
PY
xcrun simctl list devices available --json > test-results/native-ios/simulators.json
simulator_id=$(python3 - <<'PY'
import json
from pathlib import Path
devices = json.loads(Path('test-results/native-ios/simulators.json').read_text())['devices']
phones = [d for runtime, items in devices.items() if 'iOS' in runtime for d in items
          if d.get('isAvailable') and d['name'].startswith('iPhone')]
if not phones:
    raise SystemExit('No available iPhone simulator')
phones.sort(key=lambda d: (d['name'].startswith('iPhone 17 Pro'), d['name']), reverse=True)
print(phones[0]['udid'])
PY
)
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Debug -sdk iphonesimulator \
  -destination "platform=iOS Simulator,id=$simulator_id" \
  -derivedDataPath build/native-ios-tests \
  -resultBundlePath test-results/native-ios/NativeTests.xcresult \
  -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO test \
  2>&1 | tee test-results/native-ios/xcode-tests.log
