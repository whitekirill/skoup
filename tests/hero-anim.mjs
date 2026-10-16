// Кадры живой иллюстрации первого экрана и замер кадров.
// Запуск: npm run build && node tests/hero-anim.mjs [desktop|mobile] [outDir]
import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('dist');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.json': 'application/json' };
const [which = 'desktop', out = 'tests/screens/anim'] = process.argv.slice(2);
const width = which === 'mobile' ? 393 : 1440;
fs.mkdirSync(out, { recursive: true });

const server = http.createServer((req, res) => {
  let file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: which === 'mobile' ? 2 : 1, hasTouch: which === 'mobile' });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction(() => document.documentElement.classList.contains('hero-live-ready'));
const t0 = Date.now();
for (const ms of [150, 450, 800, 1200, 1700, 2500, 4000]) {
  await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
  await page.screenshot({ path: `${out}/${which}-${String(ms).padStart(4, '0')}.png`, clip: { x: 0, y: 0, width, height: which === 'mobile' ? 432 : 756 } });
}
if (which === 'desktop') {
  await page.mouse.move(1180, 260);
  for (let i = 0; i < 20; i++) { await page.mouse.move(1180 + i * 4, 260 + i * 2); await page.waitForTimeout(16); }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${which}-hover.png`, clip: { x: 0, y: 0, width, height: 756 } });
}
// кадры за 3 с
const stats = await page.evaluate(() => new Promise((resolve) => {
  const times = [];
  let prev = performance.now();
  const end = prev + 3000;
  const tick = (now) => { times.push(now - prev); prev = now; if (now < end) requestAnimationFrame(tick); else resolve(times); };
  requestAnimationFrame(tick);
}));
const sorted = [...stats].sort((a, b) => a - b);
console.log(`${which}: ${stats.length} кадров за 3 с, медиана ${sorted[sorted.length >> 1].toFixed(1)} мс, p95 ${sorted[Math.floor(sorted.length * 0.95)].toFixed(1)} мс, max ${sorted.at(-1).toFixed(1)} мс`);
if (errors.length) console.log('ошибки:', errors);
await browser.close();
server.close();
