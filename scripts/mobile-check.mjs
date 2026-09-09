import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SNOWBALL_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ channel: process.env.SNOWBALL_BROWSER || 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1,
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const errors = [];
const checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
mkdirSync('test-results', { recursive: true });

const state = () => page.evaluate(() => {
  const game = window.__snowball;
  const home = game.scene.getScene('Home');
  const hud = game.scene.getScene('HUD');
  return {
    mode: home.mode, x: home.player?.x, y: home.player?.y,
    axis: home.controls?.axis, jumpHeld: home.controls?.jumpHeld,
    mobileVisible: hud.mobile?.container.visible,
  };
});
const point = async (id, x, y) => {
  const canvas = await page.locator('canvas').boundingBox();
  assert(canvas, 'Game canvas must be visible');
  return { id, x: canvas.x + x * canvas.width / 1280, y: canvas.y + y * canvas.height / 720, radiusX: 5, radiusY: 5, force: 1 };
};
const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
const tap = async (x, y) => {
  await touch('touchStart', [await point(10, x, y)]);
  await page.waitForTimeout(50);
  await touch('touchEnd', []);
  await page.waitForTimeout(130);
};

try {
  await page.goto(process.env.SNOWBALL_URL || 'http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__snowball?.scene.isActive('Menu'));
  await tap(257, 437);
  await page.waitForFunction(() => window.__snowball?.scene.isActive('Home'));
  await page.waitForTimeout(800);
  assert.equal((await state()).mode, 'dialogue', 'First-run story must appear');
  assert.equal((await state()).mobileVisible, false, 'Dialogue hides movement controls');
  // Touch detection must not resurrect controls above a dialogue overlay.
  await touch('touchStart', [await point(10, 640, 630)]);
  await page.waitForTimeout(80);
  assert.equal((await state()).mobileVisible, false);
  await touch('touchEnd', []);
  for (let i = 0; i < 5 && (await state()).mode === 'dialogue'; i++) await tap(640, 630);
  assert.equal((await state()).mode, 'playing');
  assert.equal((await state()).mobileVisible, true);
  checks.push('Touch starts game and advances dialogue; controls stay hidden during dialogue.');

  const right = await point(1, 200, 633);
  const jump = await point(2, 1190, 578);
  const initial = await state();
  await touch('touchStart', [right]);
  await page.waitForTimeout(250);
  assert.equal((await state()).axis, 1);
  assert((await state()).x > initial.x + 15, 'Right touch must move the player');
  await touch('touchStart', [right, jump]);
  await page.waitForTimeout(160);
  const both = await state();
  assert.equal(both.axis, 1); assert.equal(both.jumpHeld, true);
  assert(both.y < initial.y - 20, 'Move and jump must work together');
  // CDP touchEnd names the pointers being released (unlike touchStart's active set).
  await touch('touchEnd', [jump]);
  await page.waitForTimeout(100);
  const onlyRight = await state();
  assert.equal(onlyRight.axis, 1); assert.equal(onlyRight.jumpHeld, false);
  assert(onlyRight.x > both.x + 5, 'Releasing jump must leave movement active');
  await touch('touchEnd', []);
  await page.waitForTimeout(650);
  assert.equal((await state()).axis, 0);
  checks.push('Independent right + jump pointers; releasing jump preserves right movement.');

  const left = await point(3, 78, 633);
  const secondJump = await point(4, 1190, 578);
  await touch('touchStart', [left, secondJump]);
  await page.waitForTimeout(80);
  assert.equal((await state()).axis, -1); assert.equal((await state()).jumpHeld, true);
  await touch('touchEnd', [left]);
  await page.waitForTimeout(60);
  assert.equal((await state()).axis, 0); assert.equal((await state()).jumpHeld, true);
  await touch('touchCancel', []);
  await page.waitForTimeout(60);
  assert.equal((await state()).axis, 0); assert.equal((await state()).jumpHeld, false);
  checks.push('Independent left + jump pointers; releasing left preserves jump; touch cancellation releases jump.');

  await touch('touchStart', [right, jump]);
  await page.waitForTimeout(60);
  await touch('touchCancel', []);
  await page.waitForTimeout(100);
  assert.equal((await state()).axis, 0); assert.equal((await state()).jumpHeld, false);
  checks.push('Cancelling two active touches clears all movement and jump input.');

  await tap(1225, 54);
  assert.equal((await state()).mode, 'paused');
  assert.equal((await state()).mobileVisible, false);
  const pausedX = (await state()).x;
  await touch('touchStart', [await point(10, 450, 200)]);
  await page.waitForTimeout(100);
  assert.equal((await state()).mobileVisible, false, 'Touches on pause menu must not show gameplay controls');
  assert.equal((await state()).x, pausedX);
  await touch('touchEnd', []);
  await tap(640, 240);
  assert.equal((await state()).mode, 'playing');
  assert.equal((await state()).mobileVisible, true);
  checks.push('Touch pause freezes gameplay and keeps controls hidden; resume restores controls.');
  await page.screenshot({ path: 'test-results/mobile-landscape.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  // Phaser polls its parent bounds; wait for its resize pass rather than a partial frame.
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas').getBoundingClientRect();
    const frame = document.querySelector('.game-frame').getBoundingClientRect();
    return canvas.width <= frame.width + 1 && canvas.height <= frame.height + 1;
  }, undefined, { timeout: 5000 });
  const portrait = await page.evaluate(() => ({
    innerWidth, bodyWidth: document.body.scrollWidth,
    hintDisplay: getComputedStyle(document.querySelector('.rotate-hint')).display,
    hint: document.querySelector('.rotate-hint').textContent,
    bodyTouchAction: getComputedStyle(document.body).touchAction,
    canvas: { width: document.querySelector('canvas').getBoundingClientRect().width, height: document.querySelector('canvas').getBoundingClientRect().height },
  }));
  assert(portrait.bodyWidth <= portrait.innerWidth + 1, 'Portrait must not overflow horizontally');
  assert.notEqual(portrait.hintDisplay, 'none', 'Portrait rotate suggestion must appear');
  assert.notEqual(portrait.bodyTouchAction, 'none', 'Page must preserve normal touch scrolling outside the canvas');
  assert(portrait.canvas.width > 200 && portrait.canvas.height > 100, 'Portrait game remains playable');
  assert(portrait.canvas.width <= portrait.innerWidth, 'Portrait canvas must fit its frame without clipping');
  await page.screenshot({ path: 'test-results/mobile-portrait.png', fullPage: true });
  checks.push('Portrait keeps canvas accessible, shows rotate suggestion, and permits body touch scrolling.');
  assert.deepEqual(errors, [], 'Mobile emulation must have no browser runtime or console errors');
  const result = { checks, errors, portrait, checkedAt: new Date().toISOString(),
    environment: 'Microsoft Edge Chromium headless, mobile and multitouch emulation, 844×390 and 390×844',
    limitation: 'No physical iPhone, iOS Safari, or Android device was available; emulation is not Safari certification.' };
  writeFileSync('test-results/mobile.json', JSON.stringify(result, null, 2));
  rmSync('test-results/mobile-failure.json', { force: true });
  rmSync('test-results/mobile-failure.png', { force: true });
  console.log('PASS', JSON.stringify(result, null, 2));
} catch (error) {
  await page.screenshot({ path: 'test-results/mobile-failure.png', fullPage: true }).catch(() => {});
  writeFileSync('test-results/mobile-failure.json', JSON.stringify({ error: String(error), errors, checks, state: await state().catch(() => null) }, null, 2));
  throw error;
} finally {
  await browser.close();
}
