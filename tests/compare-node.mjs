// Сверка блока страницы со скриншотом ноды Figma (get_screenshot в масштабе 1).
// Запуск: npm run build && node tests/compare-node.mjs <ширина> "<селектор>" <figma.png> [dx] [dy]
// Кадр берётся от левого верхнего угла элемента (+dx, +dy) размером с картинку Figma.
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('dist');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif' };
const [width, selector, figmaFile, dx = '0', dy = '0'] = process.argv.slice(2);

const server = http.createServer((req, res) => {
  let file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);

const figma = PNG.sync.read(fs.readFileSync(figmaFile));
const { width: w, height: h } = figma;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +width, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  document.querySelectorAll('img[loading="lazy"]').forEach((img) => (img.loading = 'eager'));
  await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
  await document.fonts.ready;
});
const box = await page.evaluate((sel) => {
  const r = document.querySelector(sel).getBoundingClientRect();
  return { x: r.left + scrollX, y: r.top + scrollY };
}, selector);
const site = PNG.sync.read(await page.screenshot({ fullPage: true, clip: { x: box.x + +dx, y: box.y + +dy, width: w, height: h } }));
await browser.close();
server.close();

const diff = new PNG({ width: w, height: h });
const n = pixelmatch(site.data, figma.data, diff.data, w, h, { threshold: 0.1 });
const out = new PNG({ width: w * 3, height: h });
PNG.bitblt(site, out, 0, 0, w, h, 0, 0);
PNG.bitblt(figma, out, 0, 0, w, h, w, 0);
PNG.bitblt(diff, out, 0, 0, w, h, w * 2, 0);
const name = path.basename(figmaFile, '.png');
fs.mkdirSync('tests/screens/diff', { recursive: true });
fs.writeFileSync(`tests/screens/diff/${name}-${width}.png`, PNG.sync.write(out));
console.log(`${name} @${width}: ${selector} (${box.x + +dx}, ${box.y + +dy}) ${w}×${h}, diff ${n} px = ${((n / (w * h)) * 100).toFixed(2)}% → tests/screens/diff/${name}-${width}.png`);
