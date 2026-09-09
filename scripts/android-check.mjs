/** Exercise an installed development APK on a dedicated test device. Starts a fresh run. */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const devices = execFileSync('adb', ['devices'], {encoding:'utf8'}).split('\n')
  .map(line=>line.trim().split(/\s+/)).filter(parts=>parts[1]==='device').map(parts=>parts[0]);
const serial = process.env.SNOWBALL_ANDROID_DEVICE || (devices.length === 1 ? devices[0] : null);
assert(serial, 'Set SNOWBALL_ANDROID_DEVICE when zero or multiple devices are connected');
const app = 'io.github.tssa8.snowballquest';
const key = 'snowball-quest-save-v1';
const port = 9223;
const adb = (...args) => execFileSync('adb', ['-s', serial, ...args], {timeout:20000});
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
fs.mkdirSync('test-results',{recursive:true});
const errors = [];
const startupWarnings = [];
let connection;

async function connect() {
  const pid = adb('shell','pidof',app).toString().trim();
  assert(/^\d+$/.test(pid), 'App process must be running');
  adb('forward',`tcp:${port}`,`localabstract:webview_devtools_remote_${pid}`);
  let target;
  for(let i=0;i<30;i++) {
    try { target=(await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(page=>page.url==='https://localhost/'); } catch { /* WebView is starting. */ }
    if(target) break;
    await delay(250);
  }
  assert(target,'Bundled game WebView must be available');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let id=0; let ready=false; const pending=new Map();
  ws.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(message.id) {
      const request=pending.get(message.id); if(!request) return;
      clearTimeout(request.timer);pending.delete(message.id);
      if(message.error) request.reject(new Error(JSON.stringify(message.error)));else request.resolve(message.result);
    } else if(message.method==='Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    else if(message.method==='Runtime.consoleAPICalled' && message.params.type==='error') {
      const error=message.params.args.map(arg=>arg.value ?? arg.description).join(' ');
      // Capacitor 8.5.1 injects insets before <html> exists, catches the error, then
      // retries on DOM ready. Retain this diagnostic and require recovered CSS below.
      if(!ready && /^Error injecting safe area CSS: TypeError: Cannot read property 'style' of null\b/.test(error)) startupWarnings.push(error);
      else errors.push(error);
    }
    else if(message.method==='Network.loadingFailed' && message.params.errorText!=='net::ERR_ABORTED') errors.push(message.params.errorText);
    else if(message.method==='Network.responseReceived' && message.params.response.status>=400) errors.push(`${message.params.response.status} ${message.params.response.url}`);
  };
  const call=(method,params={})=>new Promise((resolve,reject)=>{
    const next=++id;
    pending.set(next,{resolve,reject,timer:setTimeout(()=>{pending.delete(next);reject(new Error(`${method} timed out`));},15000)});
    ws.send(JSON.stringify({id:next,method,params}));
  });
  const evaluate=async expression=>{
    const response=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  await call('Runtime.enable');await call('Page.enable');await call('Network.enable');
  return {call,evaluate,markReady:()=>{ready=true;},close:()=>ws.close()};
}
async function until(expression, label) {
  for(let i=0;i<60;i++) {if(await connection.evaluate(expression)) return; await delay(150);}
  throw new Error(label);
}
const run=()=>connection.evaluate(`JSON.parse(localStorage.getItem('${key}'))?.run`);
async function verifyInsets() {
  const insets=await connection.evaluate(`['top','right','bottom','left'].map(side=>getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-'+side).trim())`);
  assert(insets.every(value=>/^\d+(\.\d+)?px$/.test(value)),'Native safe-area CSS must recover after DOM ready');
  connection.markReady();
}
const nativeRun=async()=> {
  const xml=adb('shell','run-as',app,'cat','shared_prefs/CapacitorStorage.xml').toString();
  const encoded=xml.match(new RegExp(`<string name="${key}">([\\s\\S]*?)</string>`))?.[1];
  assert(encoded,'Native Preferences must contain the game save');
  const json=encoded.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  return JSON.parse(json).run;
};
async function point(id,x,y) {
  const r=await connection.evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()`);
  return {id,x:r.x+x*r.w/1280,y:r.y+y*r.h/720,radiusX:5,radiusY:5,force:1};
}
const touch=(type,touchPoints)=>connection.call('Input.dispatchTouchEvent',{type,touchPoints});
async function tap(x,y) {await touch('touchStart',[await point(1,x,y)]);await delay(70);await touch('touchEnd',[]);await delay(250);}
const capture=name=>fs.writeFileSync(`test-results/android-${name}.png`,adb('exec-out','screencap','-p'));

try {
  adb('shell','am','force-stop',app);
  adb('shell','am','start','-W','-n',`${app}/.MainActivity`);
  connection=await connect();
  await connection.call('Network.setCacheDisabled',{cacheDisabled:true});
  await connection.call('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await connection.call('Page.reload',{ignoreCache:true});
  await until(`(()=>{const r=document.querySelector('canvas')?.getBoundingClientRect();return !document.querySelector('#loading') && r?.width > 500 && r.height > 200 && Math.abs(r.width/r.height-16/9)<.02})()`,'Offline game must load at a playable size and aspect ratio');
  await verifyInsets();
  assert.equal(await connection.evaluate('Capacitor.getPlatform()'),'android');
  assert.equal(await connection.evaluate('typeof window.__snowball'),'undefined');
  assert.equal(await connection.evaluate('navigator.onLine'),false);
  capture('title');
  await tap(257,437);
  await until(`JSON.parse(localStorage.getItem('${key}'))?.run.flags['intro-seen']`,'Introduction must open');
  await tap(640,630);await tap(640,630);
  await touch('touchStart',[await point(2,200,633)]);
  try {await until(`JSON.parse(localStorage.getItem('${key}'))?.run.collected.some(id=>id.startsWith('fish-'))`,'Touch movement must collect fish');}
  finally {await touch('touchEnd',[]);}
  capture('playing');
  adb('shell','input','keyevent','4'); // Native Back must pause.
  await delay(300);
  const paused=await run();
  await touch('touchStart',[await point(2,200,633)]);await delay(3500);await touch('touchEnd',[]);
  assert.deepEqual(await run(),paused,'Back freezes play time and progress beyond an autosave interval');
  capture('paused');
  adb('shell','input','keyevent','4');
  await until(`JSON.parse(localStorage.getItem('${key}')).run.elapsed > ${paused.elapsed}`,'Back must resume active play time');
  // Background with a held pointer, then verify foreground does not silently resume.
  await touch('touchStart',[await point(3,200,633)]);
  adb('shell','input','keyevent','3');
  await delay(500);
  adb('shell','am','start','-W','-n',`${app}/.MainActivity`);
  await delay(400);
  await touch('touchEnd',[]);
  const backgroundSave=await run();
  await delay(3500);
  assert.deepEqual(await run(),backgroundSave,'Foreground leaves play time and progress paused');
  capture('foreground-paused');
  assert.deepEqual(await nativeRun(),backgroundSave,'Native Preferences contains the complete current run');
  // Remove only the test run's WebView recovery copies so relaunch must load native data.
  await connection.evaluate(`localStorage.removeItem('${key}'); localStorage.removeItem('${key}:native-pending');`);
  connection.close();connection=undefined;
  adb('shell','am','force-stop',app);
  adb('shell','am','start','-W','-n',`${app}/.MainActivity`);
  connection=await connect();
  await until(`!document.querySelector('#loading') && !!document.querySelector('canvas')`,'Relaunched game must load');
  await verifyInsets();
  assert.deepEqual(await run(),backgroundSave,'Cold restart restores native progress without a localStorage copy');
  await tap(257,503); // Continue saved run.
  await until(`JSON.parse(localStorage.getItem('${key}')).run.elapsed > ${backgroundSave.elapsed}`,'Continue must enter active gameplay');
  assert.deepEqual((await run()).collected,backgroundSave.collected,'Continue does not reset the run');
  capture('continued');
  assert.deepEqual(errors,[]);
  const result={app,androidApi:adb('shell','getprop','ro.build.version.sdk').toString().trim(),webView:adb('shell','dumpsys','webviewupdate').toString().match(/Current WebView package.*$/m)?.[0],offline:true,nativeSave:true,coldRestartWithoutWebCopy:true,backPauseAndResume:true,backgroundPause:true,continue:true,fish:backgroundSave.collected.filter(id=>id.startsWith('fish-')).length,errors,startupWarnings,checkedAt:new Date().toISOString()};
  fs.writeFileSync('test-results/android-device.json',JSON.stringify(result,null,2));
  console.log('PASS',JSON.stringify(result));
} finally {
  if(connection) {await connection.call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1}).catch(()=>{});connection.close();}
  adb('forward','--remove',`tcp:${port}`);
}
