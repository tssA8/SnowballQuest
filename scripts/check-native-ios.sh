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
import json, subprocess
from pathlib import Path
devices = json.loads(Path('test-results/native-ios/simulators.json').read_text())['devices']
sdk = subprocess.check_output(['xcrun', '--sdk', 'iphonesimulator', '--show-sdk-version'], text=True).strip()
runtime = 'com.apple.CoreSimulator.SimRuntime.iOS-' + sdk.replace('.', '-')
phones = [d for d in devices.get(runtime, [])
          if d.get('isAvailable') and d['name'].startswith('iPhone')]
if not phones:
    raise SystemExit(f'No available iPhone simulator matching selected SDK {sdk}')
phones.sort(key=lambda d: (d['name'] == 'iPhone 17 Pro', d['name']), reverse=True)
Path('test-results/native-ios/selected-simulator.json').write_text(json.dumps({'runtime': runtime, **phones[0]}, indent=2))
print(phones[0]['udid'])
PY
)
python3 - "$simulator_id" <<'PY'
import subprocess, sys
print('Booting the simulator and waiting for system services before launching tests.', flush=True)
subprocess.run(['xcrun', 'simctl', 'bootstatus', sys.argv[1], '-b'], check=True, timeout=240)
PY
set +e
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Debug -sdk iphonesimulator \
  -destination "platform=iOS Simulator,id=$simulator_id" \
  -derivedDataPath build/native-ios-tests \
  -resultBundlePath test-results/native-ios/NativeTests.xcresult \
  -parallel-testing-enabled NO \
  -test-timeouts-enabled YES -default-test-execution-time-allowance 120 \
  -maximum-test-execution-time-allowance 300 \
  CODE_SIGN_IDENTITY=- CODE_SIGNING_ALLOWED=YES test \
  2>&1 | tee test-results/native-ios/xcode-tests.log
test_status=${PIPESTATUS[0]}
set -e
if [ -d test-results/native-ios/NativeTests.xcresult ]; then
  xcrun xcresulttool export attachments \
    --path test-results/native-ios/NativeTests.xcresult \
    --output-path test-results/native-ios/screenshots
fi
exit "$test_status"
