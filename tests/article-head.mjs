// Всплывающая шапка статьи: на первом экране спрятана; ниже — появляется при скролле вверх, уезжает при скролле вниз.
// Запуск: npm run build && node tests/article-head.mjs [папка для скриншотов стекла]
import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('dist');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif' };
const server = http.createServer((req, res) => {
  let file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);
const url = `http://localhost:${server.address().port}/blog/marketplaces-installments/`;
const out = process.argv[2];
let fails = 0;
const ok = (c, n) => { console.log(`${c ? '✓' : '✗'} ${n}`); if (!c) fails++; };
const browser = await chromium.launch();

for (const [width, height] of [[1440, 900], [393, 852]]) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(url, { waitUntil: 'networkidle' });
  const state = () => page.evaluate(() => {
    const h = document.querySelector('[data-art-head]');
    const r = h.getBoundingClientRect();
    return { hidden: h.classList.contains('is-hidden'), inert: h.inert, top: Math.round(r.top), height: Math.round(r.height) };
  });
  const wheel = async (dy, steps = 10) => { for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await page.waitForTimeout(30); } await page.waitForTimeout(900); };
  await page.mouse.move(width / 2, height / 2);
  let s = await state();
  ok(s.hidden && s.inert, `${width}: на первом экране спрятана`);
  await wheel(-300);
  ok((await state()).hidden, `${width}: на первом экране не появляется и при скролле вверх`);
  await page.evaluate(() => scrollTo(0, document.querySelector('#entry')?.offsetTop ?? 3000));
  await page.waitForTimeout(500);
  await wheel(600);
  ok((await state()).hidden, `${width}: при скролле вниз спрятана`);
  await wheel(-300);
  s = await state();
  ok(!s.hidden && !s.inert && s.top === 0, `${width}: при скролле вверх появилась (высота ${s.height})`);
  await wheel(300);
  ok((await state()).hidden, `${width}: снова вниз — уехала`);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(700);
  ok((await state()).hidden, `${width}: вернулись на первый экран — спрятана`);
  await page.close();
}

// скриншот стекла над иллюстрацией (для глаз)
if (out) {
  fs.mkdirSync(out, { recursive: true });
  for (const [width, height] of [[1440, 900], [393, 852]]) {
    for (const glass of ['progressive']) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.evaluate(async () => {
        const fig = document.querySelectorAll('.art-figure')[1];
        fig.scrollIntoView({ block: 'start' });
        scrollBy(0, 40);
        await new Promise((r) => setTimeout(r, 300));
        const h = document.querySelector('[data-art-head]');
        h.style.transition = 'none';
        h.classList.remove('is-hidden');
        await new Promise((r) => setTimeout(r, 300));
      });
      await page.screenshot({ path: path.join(out, `glass-${width}-${glass}.png`), clip: { x: 0, y: 0, width, height: 220 } });
      await page.close();
    }
  }
}

await browser.close();
server.close();
console.log(fails ? `провалено: ${fails}` : 'всё прошло');
process.exit(fails ? 1 : 0);
