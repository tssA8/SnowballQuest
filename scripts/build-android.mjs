import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const env = { ...process.env };
// Optional workspace-only JDK; otherwise respect the developer's configured toolchain.
const tools = path.join(root, '.mobile-tools');
if (process.platform === 'win32' && fs.existsSync(tools)) {
  const bundled = fs.readdirSync(tools).find(name => name.startsWith('jdk-21') &&
    fs.existsSync(path.join(tools, name, 'bin/java.exe')));
  if (bundled) env.JAVA_HOME = path.join(tools, bundled);
}
if (process.platform === 'win32') {
  execFileSync('cmd.exe', ['/d', '/s', '/c', 'gradlew.bat assembleDebug --no-daemon'], { cwd: path.join(root, 'android'), env, stdio: 'inherit' });
} else {
  execFileSync('sh', ['gradlew', 'assembleDebug', '--no-daemon'], { cwd: path.join(root, 'android'), env, stdio: 'inherit' });
}
fs.mkdirSync(path.join(root, 'releases'), { recursive: true });
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const output = path.join(root, 'releases', `snowball-quest-${version}-android-debug.apk`);
fs.copyFileSync(path.join(root, 'android/app/build/outputs/apk/debug/app-debug.apk'), output);
console.log(`Installable development APK: ${output}`);
