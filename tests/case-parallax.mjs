// Параллакс кейсов: двигается только картинка (±24 desktop, ±12 mobile, линейно от входа до выхода),
// карточка стоит; кадры при CPU ×4 на мобильном; при reduced motion — без движения.
// Запуск: npm run build && node tests/case-parallax.mjs
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
const url = `http://localhost:${server.address().port}/`;
let fails = 0;
const ok = (c, n) => { console.log(`${c ? '✓' : '✗'} ${n}`); if (!c) fails++; };
const browser = await chromium.launch();

for (const [width, shift] of [[1440, 24], [393, 12]]) {
  const mobile = width < 768;
  const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: mobile, isMobile: mobile });
  await page.goto(url, { waitUntil: 'networkidle' });
  // сдвиг картинки на экране = разница верха картинки и рамки (с учётом scale 1.08)
  const measure = (top) => page.evaluate(async (top) => {
    const card = document.querySelector('#case-business-loans');
    const frame = card.querySelector('.case__media');
    scrollTo(0, frame.getBoundingClientRect().top + scrollY - top);
    await new Promise((r) => setTimeout(r, 1500));
    const f = frame.getBoundingClientRect(), i = frame.querySelector('img').getBoundingClientRect();
    return { shift: (i.top + i.height / 2) - (f.top + f.height / 2), cardTransform: getComputedStyle(card).transform };
  }, top);
  const h = await page.evaluate(() => document.querySelector('#case-business-loans .case__media').getBoundingClientRect().height);
  const enter = await measure(900), mid = await measure(450 - h / 2), exit = await measure(-h);
  ok(Math.abs(enter.shift + shift) < 1 && Math.abs(exit.shift - shift) < 1 && Math.abs(mid.shift) < 1, `${width}: картинка от ${enter.shift.toFixed(1)} через ${mid.shift.toFixed(1)} до ${exit.shift.toFixed(1)} px (±${shift})`);
  ok(enter.cardTransform === 'none' && mid.cardTransform === 'none', `${width}: карточка стоит`);
  if (mobile) {
    await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(() => scrollTo(0, document.querySelector('.cases').offsetTop));
    await page.evaluate(() => { window.__f = []; let l = performance.now(); const t = (n) => { window.__f.push(n - l); l = n; if (!window.__s) requestAnimationFrame(t); }; requestAnimationFrame(t); });
    for (let i = 0; i < 40; i++) { await page.evaluate(() => scrollBy(0, 40)); await page.waitForTimeout(16); }
    const ft = await page.evaluate(() => { window.__s = true; return window.__f.slice(3).sort((a, b) => a - b); });
    console.log(`  кадры (CPU ×4): медиана ${ft[ft.length >> 1].toFixed(1)} мс, p95 ${ft[Math.floor(ft.length * 0.95)].toFixed(1)} мс`);
  }
  await page.close();
}
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { scrollTo(0, document.querySelector('.cases').offsetTop + 500); await new Promise((r) => setTimeout(r, 600)); });
  const t = await page.evaluate(() => [...document.querySelectorAll('.case__media img')].every((i) => !i.style.transform && getComputedStyle(i).scale === 'none'));
  ok(t, 'reduced motion: картинки не двигаются и не увеличены');
  await page.close();
}
await browser.close();
server.close();
console.log(fails ? `провалено: ${fails}` : 'всё прошло');
process.exit(fails ? 1 : 0);
