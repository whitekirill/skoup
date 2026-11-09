// Фиксированная кнопка «Заполнить бриф» на главной: спрятана на первом экране, видна между первым экраном
// и CTA, уходит на CTA; при открытом брифе спрятана; открывает бриф.
// Запуск: npm run build && node tests/sticky-brief.mjs [папка для скриншотов]
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
const url = `http://localhost:${server.address().port}`;
const out = process.argv[2];
let fails = 0;
const ok = (c, n) => { console.log(`${c ? '✓' : '✗'} ${n}`); if (!c) fails++; };
const browser = await chromium.launch();

for (const [width, height] of [[1440, 900], [393, 852]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: out ? 2 : 1 });
  await page.goto(`${url}/`, { waitUntil: 'networkidle' });
  const state = () => page.evaluate(() => {
    const el = document.querySelector('[data-sticky-brief]');
    const r = el.getBoundingClientRect();
    return { hidden: el.classList.contains('is-hidden'), inert: el.inert, bottom: Math.round(innerHeight - r.bottom), width: Math.round(r.width), visible: r.top < innerHeight };
  });
  const go = async (sel, offset = 0) => { await page.evaluate(([s, o]) => scrollTo(0, document.querySelector(s).offsetTop + o), [sel, offset]); await page.waitForTimeout(700); };
  let s = await state();
  ok(s.hidden && s.inert && !s.visible, `${width}: на первом экране спрятана`);
  await go('.cases', 200);
  s = await state();
  ok(!s.hidden && !s.inert && s.bottom === 24, `${width}: после первого экрана видна, 24 px от низа (ширина ${s.width})`);
  if (out) await page.screenshot({ path: path.join(out, `sticky-${width}.png`) });
  await go('.about');
  ok(!(await state()).hidden, `${width}: в середине страницы видна`);
  await go('.cta', -height / 2);
  ok((await state()).hidden, `${width}: на последнем блоке ушла`);
  await go('.about');
  await page.click('[data-sticky-brief] a');
  await page.waitForTimeout(900);
  const open = await page.evaluate(() => document.documentElement.classList.contains('is-brief-open'));
  const op = await page.evaluate(() => +getComputedStyle(document.querySelector('[data-sticky-brief]')).opacity);
  ok(open && op === 0, `${width}: открывает бриф и прячется под ним`);
  await page.close();
}

await browser.close();
server.close();
console.log(fails ? `провалено: ${fails}` : 'всё прошло');
process.exit(fails ? 1 : 0);
