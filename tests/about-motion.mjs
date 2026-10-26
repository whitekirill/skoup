// Движение на /about: закреплённый заголовок первого экрана, лента шотов (сдвиг влево со скроллом,
// растяжение при резком скролле и сборка, параллакс по высоте), заливка абзаца по скроллу, кадры при CPU ×4,
// reduced motion и страница без JS. Пишет видео прокрутки на 1440 и 393.
// Запуск: npm run build && node tests/about-motion.mjs [outDir]
import { chromium } from '@playwright/test';
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

// сдвиги шотов из их translate
const shots = () => [...document.querySelectorAll('.shots__item')].map((el) => {
  const [x = '0', y = '0'] = el.style.translate.split(' ');
  return { x: parseFloat(x), y: parseFloat(y), h: parseFloat(el.style.getPropertyValue('--h')) };
});
// прокрутить так, чтобы верх ленты был на from px от верха окна
const placeShots = (from) => {
  const el = document.querySelector('[data-shots]');
  scrollTo(0, el.getBoundingClientRect().top + scrollY - from);
};

const browser = await chromium.launch();

// --- заголовок закреплён до конца первого экрана (desktop)
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: 'networkidle' });
  const at = (y) => page.evaluate(async (y) => {
    scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 1300));
    const t = document.querySelector('.intro__title').getBoundingClientRect();
    const intro = document.querySelector('.intro').getBoundingClientRect();
    const facts = document.querySelector('.intro__facts').getBoundingClientRect();
    return { top: Math.round(t.top), bottom: Math.round(t.bottom), factsBottom: Math.round(facts.bottom), introBottom: Math.round(intro.bottom) };
  }, y);
  const a = await at(0), b = await at(400), c = await at(1000);
  ok(a.top === 100 && b.top === 100, `заголовок стоит на месте, пока идут факты (верх ${a.top} → ${b.top})`);
  ok(c.top < 100 && c.bottom <= c.factsBottom + 1, `в конце блока заголовок уходит вместе с ним (верх ${c.top}, низ ${c.bottom} ≤ низ фактов ${c.factsBottom})`);
  await page.close();
}

// --- лента шотов
for (const [width, name] of [[1440, 'desktop'], [393, 'mobile']]) {
  const mobile = width < 768;
  const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: mobile, isMobile: mobile, recordVideo: { dir: OUT, size: { width, height: 900 } } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => (img.loading = 'eager'));
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
  });
  if (mobile) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });

  // лента только появилась внизу окна — стоит как в макете
  await page.evaluate(placeShots, 900 - 10);
  await page.waitForTimeout(1500);
  const enter = await page.evaluate(shots);
  ok(enter.every((s) => Math.abs(s.x) < 10), `${name}: появилась внизу окна — на месте (сдвиг ${Math.round(Math.min(...enter.map((s) => s.x)))} px)`);

  // ровная прокрутка на 400 px — лента уехала влево примерно на 280 px и собралась
  await page.evaluate(placeShots, 900 - 410);
  await page.waitForTimeout(2000);
  const later = await page.evaluate(shots);
  const xs = later.map((s) => s.x);
  ok(Math.abs(xs[0] + 280) < 15, `${name}: прокрутили на 400 px — лента левее на ${Math.round(-xs[0])} px (≈280)`);
  ok(Math.max(...xs) - Math.min(...xs) < 1, `${name}: в покое лента собрана (разброс ${(Math.max(...xs) - Math.min(...xs)).toFixed(2)} px)`);
  const low = later.filter((s) => s.h < 250).map((s) => s.y), tall = later.filter((s) => s.h === 400).map((s) => s.y);
  ok(tall.every((y) => Math.abs(y) < 0.01) && low.every((y) => Math.abs(y) > 2), `${name}: параллакс — низкие шоты сдвинуты (${low[0]?.toFixed(1)} px), высокие нет`);

  // резкий скролл — хвост ленты отстаёт (растяжение), потом собирается
  await page.evaluate(() => { window.__spread = 0; const tick = () => { const x = [...document.querySelectorAll('.shots__item')].map((el) => parseFloat(el.style.translate) || 0); window.__spread = Math.max(window.__spread, Math.max(...x) - Math.min(...x)); if (!window.__stop) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await page.evaluate(() => { window.__frames = []; let last = performance.now(); const tick = (t) => { window.__frames.push(t - last); last = t; if (!window.__stop) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  if (mobile) await page.evaluate(() => scrollBy(0, 450));
  else for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 160); await page.waitForTimeout(16); }
  await page.waitForTimeout(2500);
  const { spread, frames } = await page.evaluate(() => { window.__stop = true; return { spread: window.__spread, frames: window.__frames }; });
  const settled = (await page.evaluate(shots)).map((s) => s.x);
  ok(spread > 20, `${name}: при резком скролле лента растягивается (до ${Math.round(spread)} px)`);
  ok(Math.max(...settled) - Math.min(...settled) < 1, `${name}: и собирается обратно`);
  const ft = frames.slice(3).sort((a, b) => a - b);
  console.log(`  кадры${mobile ? ' (CPU ×4)' : ''}: медиана ${ft[ft.length >> 1].toFixed(1)} мс, p95 ${ft[Math.floor(ft.length * 0.95)].toFixed(1)}, >34 мс: ${ft.filter((x) => x > 34).length} из ${ft.length}`);

  // прокрутка видео: плавно через всю секцию
  await page.evaluate(placeShots, 900);
  await page.waitForTimeout(500);
  if (!mobile) for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 40); await page.waitForTimeout(30); }
  else for (let i = 0; i < 20; i++) { await page.evaluate(() => scrollBy(0, 60)); await page.waitForTimeout(50); }
  await page.waitForTimeout(800);
  await page.close();
  await context.close();
  const video = fs.readdirSync(OUT).filter((f) => f.endsWith('.webm') && !f.startsWith('shots-')).map((f) => path.join(OUT, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  fs.renameSync(video, path.join(OUT, `shots-${width}.webm`));
}

// --- заливка абзаца по скроллу
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: 'networkidle' });
  const fill = (top) => page.evaluate(async (top) => {
    const p = document.querySelector('.why__text');
    scrollTo(0, p.getBoundingClientRect().top + scrollY - top);
    await new Promise((r) => setTimeout(r, 400));
    const words = [...p.querySelectorAll('.fill-word')];
    return { n: words.length, filled: words.filter((w) => +getComputedStyle(w).getPropertyValue('--fill') === 1).length };
  }, top);
  const start = await fill(900 * 0.9), mid = await fill(900 * 0.6), end = await fill(-200);
  ok(start.filled === 0, `заливка: абзац внизу окна — серый (${start.filled}/${start.n})`);
  ok(mid.filled > 0 && mid.filled < mid.n, `заливка: середина — частично (${mid.filled}/${mid.n})`);
  ok(end.filled === end.n, `заливка: дочитали — весь текст в цвете (${end.filled}/${end.n})`);
  await page.close();
}

// --- reduced motion: лента стоит, листается сама; абзац сразу в цвете
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(placeShots, 300);
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const el = document.querySelector('[data-shots]');
    return { moved: [...document.querySelectorAll('.shots__item')].some((s) => s.style.translate), scrollable: el.scrollWidth > el.clientWidth && getComputedStyle(el).overflowX === 'auto', fill: document.querySelectorAll('.fill-word').length };
  });
  ok(!r.moved && r.scrollable, 'reduced motion: лента не едет сама, её можно пролистать');
  ok(r.fill === 0, 'reduced motion: абзац сразу в итоговых цветах');
  await page.close();
}

// --- без JS: шоты на месте, ленту можно пролистать
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  const r = await page.evaluate(() => ({ n: document.querySelectorAll('.shots__item img').length, alts: [...document.querySelectorAll('.shots__item img')].every((i) => i.alt) }));
  ok(r.n === 13 && r.alts, `без JS: 13 шотов с alt (${r.n})`);
  await ctx.close();
}

await browser.close();
server.close();
console.log(fails ? `провалено: ${fails}` : 'всё прошло');
process.exit(fails ? 1 : 0);
