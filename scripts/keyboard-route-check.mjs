import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SNOWBALL_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ channel: process.env.SNOWBALL_BROWSER || 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
const route = [];
page.on('pageerror', error => errors.push(error.message));
const state = () => page.evaluate(() => {
  const scene = window.__snowball.scene.getScene('Home');
  return { x: scene.player.x, y: scene.player.y, grounded: scene.player.grounded,
    vx: scene.player.body.velocity.x, vy: scene.player.body.velocity.y,
    hearts: scene.hearts, key: scene.hasFlag('key-found'), stars: scene.stars, mode: scene.mode };
});
const release = async () => { await page.keyboard.up('ArrowRight'); await page.keyboard.up('ArrowLeft'); await page.keyboard.up('Space'); };
const fixture = async (x, y) => {
  await release();
  await page.evaluate(([x, y]) => window.__snowball.scene.getScene('Home').player.respawn(x, y), [x, y]);
  await page.waitForTimeout(200);
};
const walkTo = async x => {
  const start = await state();
  const right = x > start.x;
  const key = right ? 'ArrowRight' : 'ArrowLeft';
  await page.keyboard.down(key);
  for (let i = 0; i < 100; i++) {
    const current = await state();
    if (right ? current.x >= x - 15 : current.x <= x + 15) break;
    await page.waitForTimeout(20);
  }
  await page.keyboard.up(key);
  await page.waitForTimeout(180);
  const finish = await state();
  assert.ok(Math.abs(finish.x - x) < 35, `Walk should reach x${x}, got ${JSON.stringify(finish)}`);
};
const jumpTo = async (name, targetX, targetY) => {
  const start = await state();
  assert.ok(start.grounded, `${name} must begin from an actual grounded state`);
  await page.keyboard.down('Space');
  await page.keyboard.down('ArrowRight');
  let released = false;
  let tookOff = false;
  let landed = false;
  let finish = start;
  for (let i = 0; i < 130; i++) {
    await page.waitForTimeout(16);
    finish = await state();
    if (finish.y < start.y - 12) tookOff = true;
    if (!released && finish.x >= targetX - 16) {
      await page.keyboard.up('ArrowRight');
      released = true;
    }
    if (tookOff && finish.grounded) { landed = true; break; }
  }
  await release();
  await page.waitForTimeout(120);
  finish = await state();
  route.push({ name, start, finish });
  console.log(name, JSON.stringify(finish));
  assert.ok(tookOff && landed, `${name} must take off and land`);
  assert.ok(Math.abs(finish.y - targetY) <= 1, `${name} should land at ${targetY}, got ${finish.y}`);
  assert.equal(finish.hearts, start.hearts, `${name} must not cause a fall or hazard recovery`);
};

try {
  await page.goto(process.env.SNOWBALL_URL || 'http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__snowball?.scene.isActive('Menu'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__snowball?.scene.isActive('Home'));
  await page.waitForTimeout(650);
  for (let i = 0; i < 8 && (await state()).mode === 'dialogue'; i++) {
    await page.keyboard.press('KeyE'); await page.waitForTimeout(80);
  }
  assert.equal((await state()).mode, 'playing');

  // Fixtures isolate approaches. Every ascent and gap uses real keyboard input and physics.
  await fixture(1536, 640);
  await jumpTo('tower shelf one', 1632, 576);
  await jumpTo('tower shelf two', 1728, 512);
  await jumpTo('tower shelf three', 1824, 448);
  await jumpTo('tower crown platform', 1920, 384);
  await walkTo(2000);
  assert.ok((await state()).key, 'The key must be collected through ordinary keyboard platforming');
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/keyboard-tower.png', fullPage: true });

  await fixture(2448, 640);
  // Land on the first eastern shelf beyond the gap before climbing the optional route.
  await jumpTo('checkpoint floor gap', 2636, 576);
  await jumpTo('optional shelf two', 2744, 512);
  await jumpTo('optional star shelf', 2856, 448);
  await walkTo(2900);
  // The floating reward is intentionally above head height during part of its bob.
  await page.keyboard.down('Space');
  await page.waitForTimeout(650);
  await page.keyboard.up('Space');
  await page.waitForTimeout(450);
  assert.equal((await state()).stars, 1, 'The optional high star must be collected through keyboard platforming');
  await page.screenshot({ path: 'test-results/keyboard-star.png', fullPage: true });
  assert.deepEqual(errors, []);
  writeFileSync('test-results/keyboard-route.json', JSON.stringify({ route, errors, checkedAt: new Date().toISOString() }, null, 2));
  console.log('PASS: four tower ledges, mandatory key, floor gap, three optional ledges and high star using held jumps and keyboard movement.');
} finally {
  await release().catch(() => {});
  await browser.close();
}
