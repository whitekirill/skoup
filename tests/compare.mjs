// Pixel-perfect сверка: скриншот собранной страницы (dist/) vs скриншот ноды Figma.
// Запуск: npm run build && node tests/compare.mjs [desktop|mobile] [yFrom] [yTo] [figmaYFrom]
// figmaYFrom — начало того же участка в макете, если страница сдвинута относительно Figma
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('dist');
const OUT = path.resolve('tests/screens');
const VIEWPORTS = {
  desktop: { width: 1440, figma: 'desktop-1440.png' },
  mobile: { width: 393, figma: 'mobile-393.png' },
};
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif' };

const [which = 'desktop', from = '0', to, figmaFrom] = process.argv.slice(2);
const vp = VIEWPORTS[which];

const server = http.createServer((req, res) => {
  let file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);
const port = server.address().port;

const figma = PNG.sync.read(fs.readFileSync(path.join(OUT, 'figma', vp.figma)));
const y0 = +from;
const y1 = Math.min(+(to ?? figma.height), figma.height);
const h = y1 - y0;

const browser = await chromium.launch();
// живая иллюстрация первого экрана сверяется по статичному кадру (reduced motion)
const page = await browser.newPage({ viewport: { width: vp.width, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  // lazy-картинки грузим сразу, иначе полностраничный скриншот их не увидит
  document.querySelectorAll('img[loading="lazy"]').forEach((img) => (img.loading = 'eager'));
  await document.fonts.ready;
  await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
});
const shot = PNG.sync.read(await page.screenshot({ fullPage: true, animations: 'disabled' }));
await browser.close();
server.close();

const crop = (img, y, height) => {
  const out = new PNG({ width: vp.width, height });
  for (let r = 0; r < height; r++) {
    const sy = y + r;
    if (sy >= img.height) break;
    img.data.copy(out.data, r * vp.width * 4, sy * img.width * 4, sy * img.width * 4 + vp.width * 4);
  }
  return out;
};

const a = crop(shot, y0, h);
const b = crop(figma, figmaFrom === undefined ? y0 : +figmaFrom, h);
const diff = new PNG({ width: vp.width, height: h });
const n = pixelmatch(a.data, b.data, diff.data, vp.width, h, { threshold: 0.1, includeAA: false });

// Бок о бок: сайт | Figma | diff
const side = new PNG({ width: vp.width * 3, height: h });
for (let r = 0; r < h; r++) {
  for (const [i, img] of [a, b, diff].entries()) {
    img.data.copy(side.data, (r * vp.width * 3 + i * vp.width) * 4, r * vp.width * 4, (r + 1) * vp.width * 4);
  }
}
for (const dir of ['actual', 'diff']) fs.mkdirSync(path.join(OUT, dir), { recursive: true });
const tag = `${which}-${y0}-${y1}`;
fs.writeFileSync(path.join(OUT, 'actual', `${which}-full.png`), PNG.sync.write(shot));
fs.writeFileSync(path.join(OUT, 'diff', `${tag}.png`), PNG.sync.write(side));

console.log(`${which} y=${y0}..${y1}: page height ${shot.height} (figma ${figma.height}), diff ${n} px = ${((n / (vp.width * h)) * 100).toFixed(2)}%`);
console.log(`→ tests/screens/diff/${tag}.png`);
