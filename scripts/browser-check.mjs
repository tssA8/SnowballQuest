import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const browser = process.env.SNOWBALL_CDP
  ? await chromium.connectOverCDP(process.env.SNOWBALL_CDP)
  : await chromium.launch({ channel: process.env.SNOWBALL_BROWSER || 'msedge', headless: true });
const context = await browser.newContext({ viewport:{width:1280,height:720} });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
mkdirSync('test-results',{recursive:true});
try {
  await page.goto(process.env.SNOWBALL_URL || 'http://localhost:5173', {waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__snowball?.scene.isActive('Menu'));
  await page.screenshot({path:'test-results/title.png',fullPage:true});
  await page.addScriptTag({ path:fileURLToPath(new URL('./campaign-browser-fixture.js',import.meta.url)), type:'module' });
  await page.getByRole('button',{name:'Run seven-stage checks'}).click();
  await page.waitForFunction(()=>/ALL CAMPAIGN CHECKS PASSED|FAIL /.test(document.getElementById('qa-results')?.textContent || ''),{},{timeout:180000});
  const result = await page.locator('#qa-results').innerText();
  await page.screenshot({path:'test-results/adventure-checks.png',fullPage:true});
  writeFileSync('test-results/browser.json',JSON.stringify({result,errors,checkedAt:new Date().toISOString()},null,2));
  assert.match(result,/ALL CAMPAIGN CHECKS PASSED/);
  assert.deepEqual(errors,[]);
  console.log(result);
} finally { await context.close(); await browser.close(); }
