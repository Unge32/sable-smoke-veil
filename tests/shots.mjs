// SABLE — tests/shots.mjs
// Takes the entry's 4 screenshots from the staged scenes (?shot=...&seed=1) in headless
// Chromium (Playwright, installed under ~/workspace/makefun/shot/node_modules).
// Saves 1280x720 JPEGs to ../screenshots/ and prints each file's size.
// Usage: node tests/shots.mjs (serves game/ itself on port 8132).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), 'package.json'));
const { chromium } = require('/home/hatch/workspace/makefun/shot/node_modules/playwright');

const PORT = 8132;
const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, '..', 'screenshots');
const SCENES = [
  ['1-start.jpg', 'start'],
  ['2-play.jpg', 'play'],
  ['3-veil.jpg', 'veil'],
  ['4-getaway.jpg', 'getaway'],
];

const server = spawn('node', ['serve.ts', '--port', String(PORT)], {
  cwd: join(ROOT, '..'),
  stdio: ['ignore', 'pipe', 'pipe'],
});
await new Promise((resolve) => setTimeout(resolve, 1200));

const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  for (const [file, scene] of SCENES) {
    await page.goto(`http://127.0.0.1:${PORT}/index.html?shot=${scene}&seed=1`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 15000 });
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(OUT, file), type: 'jpeg', quality: 85 });
    const size = statSync(join(OUT, file)).size;
    console.log(`${file}: ${(size / 1024).toFixed(1)} KiB${size > 262144 ? '  OVER 256 KiB!' : ''}`);
  }
  if (errors.length) {
    console.log('CONSOLE ERRORS:', errors.slice(0, 5).join(' | '));
    process.exitCode = 1;
  } else {
    console.log('no console errors');
  }
} finally {
  await browser.close();
  server.kill();
}
