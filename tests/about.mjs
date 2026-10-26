// Страница «О нас» (/about): скриншоты на 1440, 1024, 768, 393 и 360 и сверка секций 1440 и 393 с Figma.
// Секции сравниваются по своему верху на странице и в макете (высоты соседних секций могут отличаться).
// Скриншоты — при reduced motion: лента шотов стоит как в макете, абзац сразу в итоговых цветах.
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

// секции: селектор на странице, верх и низ в макете
const FIGMA = {
  1440: { file: 'about-desktop.png', sections: [['первый экран', '.intro', 0, 1168], ['почему мы', '.why', 1168, 2452], ['форматы', '.formats', 2452, 3804]] },
  // мобильный макет «Почему мы» пока с плашками — сверяем первый экран и форматы
  393: { file: 'about-mobile.png', sections: [['первый экран', '.intro', 0, 1040], ['форматы', '.formats', 2252, 3888]] },
};

let fails = 0;
const ok = (cond, name) => { console.log(`${cond ? '✓' : '✗'} ${name}`); if (!cond) fails++; };

const browser = await chromium.launch();
for (const width of [1440, 1024, 768, 393, 360]) {
  const mobile = width < 768;
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => (img.loading = 'eager'));
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
  });
  ok(errors.length === 0, `${width}: ошибок в консоли нет${errors.length ? ` (${errors.join('; ')})` : ''}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(overflow <= 0, `${width}: нет горизонтальной прокрутки страницы (${overflow})`);
  const file = path.join(OUT, `about-${width}.png`);
  fs.writeFileSync(file, await page.screenshot({ fullPage: true, animations: 'disabled' }));

  const ref = FIGMA[width];
  if (ref) {
    const figma = PNG.sync.read(fs.readFileSync(path.resolve('tests/screens/figma', ref.file)));
    const shot = PNG.sync.read(fs.readFileSync(file));
    const crop = (img, y, height) => {
      const out = new PNG({ width, height });
      for (let r = 0; r < height; r++) if (y + r < img.height) img.data.copy(out.data, r * width * 4, (y + r) * img.width * 4, (y + r) * img.width * 4 + width * 4);
      return out;
    };
    for (const [name, selector, y0, y1] of ref.sections) {
      const top = await page.evaluate((s) => Math.round(document.querySelector(s).getBoundingClientRect().top + scrollY), selector);
      // шапка закреплена поверх первого экрана — его сравниваем с 56
      const skip = y0 === 0 ? 56 : 0;
      const h = y1 - y0 - skip;
      const a = crop(shot, top + skip, h), b = crop(figma, y0 + skip, h), diff = new PNG({ width, height: h });
      const n = pixelmatch(a.data, b.data, diff.data, width, h, { threshold: 0.1 });
      fs.writeFileSync(path.join(OUT, `diff-${width}-${name.replace(/ /g, '-')}.png`), PNG.sync.write(diff));
      console.log(`  ${width} ${name}: отличается ${((n / (width * h)) * 100).toFixed(2)}% пикселей${top !== y0 ? ` (на странице с ${top}, в макете с ${y0})` : ''}`);
    }
  }
  await page.close();
}
await browser.close();
server.close();
console.log(fails ? `провалено: ${fails}` : 'всё прошло');
process.exit(fails ? 1 : 0);
