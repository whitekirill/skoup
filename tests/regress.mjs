// Регресс «ни пикселя не изменилось»: полные скриншоты главной, статьи, брифа и экрана успеха
// на 1440 и 393 (reduced motion — всё в покое) и попиксельное сравнение с базой.
// Запуск: npm run build && node tests/regress.mjs shoot <dir>   — снять
//         npm run build && node tests/regress.mjs compare <baseDir> <dir> — снять и сравнить
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [mode, a, b] = process.argv.slice(2);
const OUT = path.resolve(mode === 'compare' ? b : a);
fs.mkdirSync(OUT, { recursive: true });
const ROOT = path.resolve('dist');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const SHOTS = [
  ['home', '/'],
  ['article', '/blog/marketplaces-installments/'],
  ['brief', '/#brief'],
];
const browser = await chromium.launch();
for (const width of [1440, 393]) {
  const mobile = width < 768;
  for (const [name, url] of SHOTS) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce' });
    await page.goto(base + url, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      document.querySelectorAll('img[loading="lazy"]').forEach((img) => (img.loading = 'eager'));
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
    });
    await page.waitForTimeout(500);
    if (name === 'brief') {
      const h = await page.evaluate(() => document.querySelector('[data-brief]').scrollHeight);
      await page.setViewportSize({ width, height: h });
      await page.waitForTimeout(300);
      fs.writeFileSync(path.join(OUT, `${name}-${width}.png`), await page.screenshot());
    } else {
      fs.writeFileSync(path.join(OUT, `${name}-${width}.png`), await page.screenshot({ fullPage: true, animations: 'disabled' }));
    }
    await page.close();
  }
}
await browser.close();
server.close();

if (mode === 'compare') {
  let bad = 0;
  for (const f of fs.readdirSync(path.resolve(a)).filter((f) => f.endsWith('.png') && !f.startsWith('diff-'))) {
    const x = PNG.sync.read(fs.readFileSync(path.join(path.resolve(a), f)));
    const y = PNG.sync.read(fs.readFileSync(path.join(OUT, f)));
    if (x.width !== y.width || x.height !== y.height) { console.log(`✗ ${f}: размер ${x.width}×${x.height} → ${y.width}×${y.height}`); bad++; continue; }
    const d = new PNG({ width: x.width, height: x.height });
    const n = pixelmatch(x.data, y.data, d.data, x.width, x.height, { threshold: 0 });
    if (n) { fs.writeFileSync(path.join(OUT, `diff-${f}`), PNG.sync.write(d)); bad++; }
    console.log(`${n ? '✗' : '✓'} ${f}: отличается пикселей ${n}`);
  }
  console.log(bad ? `различий: ${bad}` : 'всё совпадает пиксель в пиксель');
  process.exit(bad ? 1 : 0);
}
