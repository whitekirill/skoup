// Страница «О нас» (/about): скриншоты на 1440, 1024, 768, 393 и 360, сверка 1440 и 393 с Figma,
// пересечения слов-качеств после падения (SAT по реальным углам, допуск 2 px).
// Запуск: npm run build && node tests/about.mjs [outDir]
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('dist');
const OUT = path.resolve(process.argv[2] ?? 'tests/screens/about');
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif' };
const server = http.createServer((req, res) => {
  let file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);
const url = `http://localhost:${server.address().port}/about/`;

let fails = 0;
const ok = (cond, name) => { console.log(`${cond ? '✓' : '✗'} ${name}`); if (!cond) fails++; };

// углы повёрнутого прямоугольника плашки в координатах страницы
const corners = () => [...document.querySelectorAll('.pile__item')].map((el) => {
  const m = new DOMMatrix(getComputedStyle(el).transform);
  const angle = Math.atan2(m.b, m.a);
  const r = el.getBoundingClientRect();
  const s = el.getBoundingClientRect().width / (el.offsetWidth * Math.abs(Math.cos(angle)) + el.offsetHeight * Math.abs(Math.sin(angle)));
  const w = el.offsetWidth * s, h = el.offsetHeight * s, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const c = Math.cos(angle), n = Math.sin(angle);
  return { label: el.textContent, layoutWidth: el.offsetWidth, pts: [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => [cx + x * c - y * n, cy + x * n + y * c]) };
});

// SAT: глубина пересечения двух выпуклых многоугольников (0 — не пересекаются)
function overlap(a, b) {
  let min = Infinity;
  for (const poly of [a, b]) {
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % 4];
      const len = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
      const pa = a.map(([x, y]) => x * nx + y * ny), pb = b.map(([x, y]) => x * nx + y * ny);
      const depth = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
      if (depth <= 0) return 0;
      min = Math.min(min, depth);
    }
  }
  return min;
}

const browser = await chromium.launch();
for (const width of [1440, 1024, 768, 393, 360]) {
  const mobile = width < 768;
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => (img.loading = 'eager'));
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
  });
  // доезжаем до кучи — падение — ждём окончания
  await page.evaluate(() => document.querySelector('[data-pile]').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(3500);
  const rects = await page.evaluate(corners);
  let worst = 0, pair = '';
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const d = overlap(rects[i].pts, rects[j].pts);
    if (d > worst) { worst = d; pair = `${rects[i].label} × ${rects[j].label}`; }
  }
  ok(worst <= 2, `${width}: пересечений качеств нет (максимум ${worst.toFixed(2)} px${pair ? ` — ${pair}` : ''})`);
  const visible = await page.evaluate(() => [...document.querySelectorAll('.pile__item')].every((el) => getComputedStyle(el).opacity === '1'));
  ok(visible, `${width}: все качества видны после падения`);
  ok(errors.length === 0, `${width}: ошибок в консоли нет${errors.length ? ` (${errors.join('; ')})` : ''}`);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(1500); // ползунок прокрутки гаснет
  const file = path.join(OUT, `about-${width}.png`);
  fs.writeFileSync(file, await page.screenshot({ fullPage: true, animations: 'disabled' }));

  // сверка с Figma: секции по отдельности (высоты футера на сайте и в макете могут отличаться)
  if (width === 1440 || width === 393) {
    const figma = PNG.sync.read(fs.readFileSync(path.resolve('tests/screens/figma', width === 1440 ? 'about-desktop.png' : 'about-mobile.png')));
    const shot = PNG.sync.read(fs.readFileSync(file));
    const h = Math.min(figma.height, shot.height);
    const crop = (img, y, height) => {
      const out = new PNG({ width, height });
      for (let r = 0; r < height; r++) img.data.copy(out.data, r * width * 4, (y + r) * img.width * 4, (y + r) * img.width * 4 + width * 4);
      return out;
    };
    const sections = width === 1440
      ? [['первый экран', 56, 1168], ['почему мы', 1168, 2232], ['форматы', 2232, 3584]]
      : [['первый экран', 56, 1040], ['почему мы', 1040, 2252], ['форматы', 2252, 3888]];
    for (const [name, y0, y1] of sections) {
      if (y1 > h) { ok(false, `${width}: ${name} — страница короче макета (${shot.height} < ${y1})`); continue; }
      const a = crop(shot, y0, y1 - y0), b = crop(figma, y0, y1 - y0), diff = new PNG({ width, height: y1 - y0 });
      const n = pixelmatch(a.data, b.data, diff.data, width, y1 - y0, { threshold: 0.1 });
      const pct = (n / (width * (y1 - y0))) * 100;
      fs.writeFileSync(path.join(OUT, `diff-${width}-${name.replace(/ /g, '-')}.png`), PNG.sync.write(diff));
      console.log(`  ${width} ${name}: отличается ${pct.toFixed(2)}% пикселей`);
    }
    console.log(`  высота страницы ${shot.height}, макета ${figma.height}`);
  }
  await page.close();
}
await browser.close();
server.close();
console.log(fails ? `провалено: ${fails}` : 'всё прошло');
process.exit(fails ? 1 : 0);
