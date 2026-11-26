#!/usr/bin/env node
/**
 * Capture real-time screenshots of the running app with a local Chrome over the
 * DevTools protocol (no puppeteer, no browser download).
 *
 *   node scripts/shoot.mjs <url> <out.png> [width=1600] [height=1000] [waitMs=4500] [js-to-eval]
 *
 * CHROME_PATH overrides the browser location; SHOT_DPR=2 captures at 2x.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, out, w = '1600', h = '1000', wait = '4500', js = ''] = process.argv.slice(2);
const dpr = Number(process.env.SHOT_DPR || 1);
if (!url || !out) {
  console.error('usage: node scripts/shoot.mjs <url> <out.png> [w] [h] [waitMs] [js]');
  process.exit(1);
}

const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].filter(Boolean);
const chrome = candidates.find((p) => existsSync(p));
if (!chrome) throw new Error('No Chrome/Edge found; set CHROME_PATH');

const port = 9300 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), 'sinkhole-shot-'));
const proc = spawn(
  chrome,
  [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${w},${h}`,
    `--force-device-scale-factor=${dpr}`,
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(150);
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    target = list.find((t) => t.type === 'page');
  } catch {
    /* not up yet */
  }
}
if (!target) throw new Error('Chrome did not start');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}) =>
  new Promise((res) => {
    const mid = ++id;
    pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: dpr, mobile: false });
await send('Page.navigate', { url });
await sleep(+wait);
if (js) {
  await send('Runtime.evaluate', { expression: js, awaitPromise: true });
  await sleep(1400);
}
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log('saved', out);
ws.close();
proc.kill();
await sleep(300);
try {
  rmSync(profile, { recursive: true, force: true });
} catch {
  /* chrome may still hold files */
}
