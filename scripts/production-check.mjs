import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SNOWBALL_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ channel: process.env.SNOWBALL_BROWSER || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors=[];
page.on('pageerror', e=>errors.push(e.message));
page.on('console', msg=>{if(msg.type()==='error') errors.push(msg.text());});
page.on('response', r=>{if(r.status()>=400) errors.push(`${r.status()} ${r.url()}`);});
try {
  const response = await page.goto(process.env.SNOWBALL_URL || 'http://localhost:4173', {waitUntil:'networkidle'});
  assert.equal(response.status(), 200, 'Game is available without signing in');
  await page.waitForSelector('#loading',{state:'detached'});
  assert.equal(await page.evaluate(()=>typeof window.__snowball),'undefined','Production excludes test access');
  const box=await page.locator('canvas').boundingBox();
  assert(box.width>500 && box.height>300);
  await page.mouse.click(box.x+257*box.width/1280,box.y+437*box.height/720);
  // Wait for the introduction to open instead of assuming a fixed loading time.
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('snowball-quest-save-v1'))?.run.flags['intro-seen']);
  for (let line = 0; line < 2; line++) {
    await page.keyboard.press('KeyE', {delay: 100});
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  await page.keyboard.down('ArrowRight');
  try {
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('snowball-quest-save-v1'))?.run.collected.some(id => id.startsWith('fish-')), null, {timeout: 10000});
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  await page.waitForTimeout(200);mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/production.png',fullPage:true});
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('snowball-quest-save-v1')));
  assert(saved.run.collected.some(id=>id.startsWith('fish-')),'Production keyboard play collects fish');
  assert.deepEqual(errors,[]);
  writeFileSync('test-results/production.json',JSON.stringify({errors,fish:saved.run.collected.filter(id=>id.startsWith('fish-')).length,debugAccess:false},null,2));
  console.log('PASS: production PNGs and map load, keyboard play collects fish, no console/resource errors, debug access removed');
} finally {await browser.close();}
