// Видео анимаций для сравнения «до / после»: вордмарк, параллакс кейсов, плашка «Скоро покажем»,
// дрейф галереи в CTA (главная, 1440) и навигация статьи (1440). Плавный скролл колесом — как у человека.
// Запуск: npm run build && node tests/anim-video.mjs <outDir>
import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] ?? 'tests/.videos');
fs.mkdirSync(OUT, { recursive: true });
const ROOT = path.resolve('dist');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif' };
const server = http.createServer((req, res) => {
  let file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch();

async function record(name, url, run) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: OUT, size: { width: 1440, height: 900 } } });
  const page = await ctx.newPage();
  await page.goto(base + url, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => (img.loading = 'eager'));
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
  });
  await page.waitForTimeout(500);
  await run(page);
  const video = page.video();
  await page.close();
  await ctx.close();
  fs.renameSync(await video.path(), path.join(OUT, `${name}.webm`));
  console.log('записано', name);
}
const wheel = async (page, total, step = 60, pause = 30) => { for (let d = 0; Math.abs(d) < Math.abs(total); d += step * Math.sign(total)) { await page.mouse.wheel(0, step * Math.sign(total)); await page.waitForTimeout(pause); } };
const jump = (page, sel, off = 0) => page.evaluate(async ([s, o]) => { const el = document.querySelector(s); scrollTo(0, el.getBoundingClientRect().top + scrollY - o); await new Promise((r) => setTimeout(r, 1200)); }, [sel, off]);

await record('wordmark', '/', async (p) => { await p.mouse.move(700, 450); await wheel(p, 900); await p.waitForTimeout(800); await wheel(p, -900); await p.waitForTimeout(800); });
await record('case-parallax', '/', async (p) => { await jump(p, '.cases', 600); await p.mouse.move(20, 450); await wheel(p, 2400); await p.waitForTimeout(800); });
await record('case-hover', '/', async (p) => {
  await jump(p, '#case-atm', 60);
  const r = await p.evaluate(() => ['#case-atm', '#case-installments'].map((s) => { const b = document.querySelector(s + ' .case__media').getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; }));
  await p.mouse.move(r[0][0] - 40, r[0][1] + 100);
  await p.mouse.move(r[0][0] + 120, r[0][1] + 140, { steps: 10 }); await p.waitForTimeout(400);
  await p.mouse.move(r[0][0] + r[0][2] - 60, r[0][1] + r[0][3] - 80, { steps: 25 }); await p.waitForTimeout(300);
  await p.mouse.move(r[1][0] + 140, r[1][1] + 200, { steps: 12 }); await p.waitForTimeout(500);
  await p.mouse.move(r[1][0] + r[1][2] - 80, r[1][1] + 120, { steps: 6 }); await p.waitForTimeout(400);
  await p.mouse.move(r[1][0] + r[1][2] + 40, r[1][1] - 60, { steps: 6 }); await p.waitForTimeout(800);
});
await record('gallery-drift', '/', async (p) => { await jump(p, '.cta', 900); await p.mouse.move(20, 450); await wheel(p, 600, 40, 40); await p.waitForTimeout(400); await wheel(p, 400, 160, 20); await p.waitForTimeout(1500); });
await record('article-nav', '/blog/marketplaces-installments/', async (p) => {
  await p.mouse.move(20, 450);
  await wheel(p, 1400); await p.waitForTimeout(800);
  await p.click('[data-art-nav-button]'); await p.waitForTimeout(900);
  await p.click('[data-art-nav-item="purchase"]'); await p.waitForTimeout(1800);
  await p.click('[data-art-nav-button]'); await p.waitForTimeout(700);
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  await jump(p, '.art-cta', 1100); await wheel(p, 600); await p.waitForTimeout(900);
});
await browser.close();
server.close();
