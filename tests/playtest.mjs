// SABLE — tests/playtest.mjs
// End-to-end browser playtest in headless Chromium (Playwright, installed under
// ~/workspace/makefun/shot/node_modules). Serves game/ itself on port 8131.
// Checks: page loads with no console errors and no failed or external requests; title screen
// shows; Enter starts; WASD moves Sable; Space spends a veil (smoke hides Sable); E spends a
// decoy (costs 100 loot); P pauses/resumes; being spotted raises the alarm and getting caught
// ends the run; Enter restarts; and ?auto=1 (the autopilot) steals the Sapphire and escapes.
// Exits non-zero on failure.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), 'package.json'));
const { chromium } = require('/home/hatch/workspace/makefun/shot/node_modules/playwright');

const PORT = 8131;
const ROOT = dirname(fileURLToPath(import.meta.url));
const BASE = `http://127.0.0.1:${PORT}/index.html`;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail: detail ?? '' });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const server = spawn('node', ['serve.ts', '--port', String(PORT)], {
  cwd: join(ROOT, '..'),
  stdio: ['ignore', 'pipe', 'pipe'],
});
await new Promise((resolve) => setTimeout(resolve, 1200));

let browser;
try {
  browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  const failedRequests = [];
  const externalRequests = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('requestfailed', (req) => failedRequests.push(`${req.url()} ${req.failure()?.errorText}`));
  page.on('request', (req) => {
    if (!req.url().startsWith(`http://127.0.0.1:${PORT}`)) externalRequests.push(req.url());
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const hasGame = await page.evaluate(() => !!window.__game);
  check('game object boots', hasGame);

  const state0 = await page.evaluate(() => window.__game.state());
  check('title screen on load', state0 === 'title', `state=${state0}`);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const state1 = await page.evaluate(() => window.__game.state());
  check('Enter starts the heist', state1 === 'play', `state=${state1}`);

  // WASD moves Sable: hold D for a second, x must grow.
  const x0 = await page.evaluate(() => window.__game.world.state.thief.x);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyD');
  const x1 = await page.evaluate(() => window.__game.world.state.thief.x);
  check('D moves Sable right', x1 > x0 + 100, `x ${x0.toFixed(0)} -> ${x1.toFixed(0)}`);

  // Shift sneak is slower: same hold covers less ground.
  const sx0 = await page.evaluate(() => window.__game.world.state.thief.x);
  await page.keyboard.down('Shift');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyD');
  await page.keyboard.up('Shift');
  const sx1 = await page.evaluate(() => window.__game.world.state.thief.x);
  check('Shift sneak is slower', sx1 - sx0 < x1 - x0, `sneak ${sx1 - sx0 | 0}px vs walk ${x1 - x0 | 0}px`);

  // Space spends a veil and the smoke cloud follows Sable.
  const veils0 = await page.evaluate(() => window.__game.world.state.thief.veils);
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  const veil = await page.evaluate(() => ({
    veils: window.__game.world.state.thief.veils,
    time: window.__game.world.state.thief.veilTime,
  }));
  check('Space spends a veil, smoke is up', veil.veils === veils0 - 1 && veil.time > 5, `veils ${veils0}->${veil.veils} time=${veil.time.toFixed(1)}`);
  await page.waitForTimeout(6500);
  const veilGone = await page.evaluate(() => window.__game.world.state.thief.veilTime);
  check('smoke lasts ~6s then clears', veilGone === 0, `veilTime=${veilGone}`);
  // Back to a known-safe spot: the investigating guard is still near where the smoke was.
  await page.evaluate(() => {
    window.__game.world.state.thief.x = 75;
    window.__game.world.state.thief.y = 645;
  });

  // E spends a decoy coin, costing 100 loot.
  await page.evaluate(() => { window.__game.world.state.score.value = 500; });
  const decoys0 = await page.evaluate(() => window.__game.world.state.thief.decoys);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  const decoy = await page.evaluate(() => ({
    decoys: window.__game.world.state.thief.decoys,
    score: window.__game.world.state.score.value,
    active: !!window.__game.world.state.thief.decoy,
  }));
  check('E spends a decoy for 100 loot', decoy.decoys === decoys0 - 1 && decoy.score === 400 && decoy.active,
    `decoys ${decoys0}->${decoy.decoys} score=${decoy.score} active=${decoy.active}`);

  // P pauses and resumes.
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(200);
  const paused = await page.evaluate(() => window.__game.state());
  check('P pauses', paused === 'paused', `state=${paused}`);
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(200);
  const resumed = await page.evaluate(() => window.__game.state());
  check('P resumes', resumed === 'play', `state=${resumed}`);

  // Being spotted raises the alarm: pin Sable in front of Bram's cone for a few seconds.
  await page.evaluate(() => {
    const g = window.__game.world.state.guards[0];
    window.__game.world.state.thief.x = g.x + Math.cos(g.facing) * 100;
    window.__game.world.state.thief.y = g.y + Math.sin(g.facing) * 100;
  });
  await page.waitForTimeout(1200);
  const alarm = await page.evaluate(() => window.__game.world.state.alarm.value);
  check('spotted by a guard raises the alarm', alarm > 20, `alarm=${alarm.toFixed(0)}`);
  // Keep Sable pinned in the cone until the meter fills.
  for (let i = 0; i < 14; i++) {
    await page.evaluate(() => {
      const g = window.__game.world.state.guards[0];
      window.__game.world.state.thief.x = g.x + Math.cos(g.facing) * 100;
      window.__game.world.state.thief.y = g.y + Math.sin(g.facing) * 100;
    });
    await page.waitForTimeout(250);
    const done = await page.evaluate(() => window.__game.state());
    if (done === 'over') break;
  }
  const over = await page.evaluate(() => window.__game.state());
  check('alarm 100 ends the run (caught)', over === 'over', `state=${over}`);

  // Enter restarts a fresh run.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const fresh = await page.evaluate(() => ({
    state: window.__game.state(),
    score: window.__game.world.state.score.value,
    alarm: window.__game.world.state.alarm.value,
    veils: window.__game.world.state.thief.veils,
  }));
  check('Enter restarts a fresh run', fresh.state === 'play' && fresh.score === 0 && fresh.alarm === 0 && fresh.veils === 3,
    `state=${fresh.state} score=${fresh.score} alarm=${fresh.alarm} veils=${fresh.veils}`);

  // Autopilot end to end in the real browser: it must steal the Sapphire and escape.
  await page.goto(`${BASE}?auto=1`, { waitUntil: 'networkidle' });
  let won = false;
  let final = null;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);
    final = await page.evaluate(() => ({
      state: window.__game.state(),
      phase: window.__game.world.state.phase,
      score: window.__game.world.state.score.value,
      trinkets: window.__game.world.state.loot.trinketsTaken,
      sapphire: window.__game.world.state.loot.sapphireTaken,
      time: window.__game.world.state.elapsed,
    }));
    if (final.state === 'escaped') { won = true; break; }
    if (final.state === 'over') break;
  }
  check('autopilot wins end to end in the browser', won,
    `state=${final?.state} score=${final?.score} trinkets=${final?.trinkets}/3 sapphire=${final?.sapphire} time=${final?.time?.toFixed(1)}s`);

  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('no failed requests', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | '));
  check('no external requests', externalRequests.length === 0, externalRequests.slice(0, 3).join(' | '));
} finally {
  if (browser) await browser.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
