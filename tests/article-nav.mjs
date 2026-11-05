// Навигация по статье: подпись текущего раздела, прятание при скролле вниз и появление при скролле вверх,
// открытие/закрытие (кнопка, Esc, оверлей, пункт), фокус, плавный переход к разделу. Пишет видео на 1440 и 393 (тач).
// Запуск: npm run build && node tests/article-nav.mjs
import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('dist');
const OUT = path.resolve('tests/screens/article');
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif' };
const server = http.createServer((req, res) => {
  let file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);
const url = `http://localhost:${server.address().port}/blog/marketplaces-installments/`;

let fails = 0;
const ok = (cond, name) => { console.log(`${cond ? '✓' : '✗'} ${name}`); if (!cond) fails++; };
const browser = await chromium.launch();

for (const [width, name] of [[1440, 'desktop'], [393, 'mobile']]) {
  const mobile = width < 768;
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: mobile, isMobile: mobile, recordVideo: { dir: OUT, size: { width, height: 900 } } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  const state = () => page.evaluate(() => {
    const root = document.querySelector('[data-art-nav]');
    const dock = root.querySelector('.art-nav__dock').getBoundingClientRect();
    return { hidden: root.classList.contains('is-hidden'), open: root.classList.contains('is-open'), label: root.querySelector('[data-art-nav-current]').textContent, bottom: Math.round(innerHeight - dock.bottom), width: Math.round(root.querySelector('[data-art-nav-button]').getBoundingClientRect().width), expanded: root.querySelector('[data-art-nav-button]').getAttribute('aria-expanded') };
  });
  const s0 = await state();
  ok(!s0.hidden && s0.bottom === 24, `${name}: вверху статьи кнопка видна, 24 px от низа (${s0.bottom})`);
  ok(mobile ? s0.width === width - 40 : s0.width === 356, `${name}: ширина кнопки ${s0.width}`);

  // скролл вниз — прячется
  const scrollTo = (y) => page.evaluate((y) => window.scrollTo(0, y), y);
  if (mobile) { for (let i = 1; i <= 10; i++) { await scrollTo(i * 300); await page.waitForTimeout(40); } }
  else { for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 250); await page.waitForTimeout(40); } }
  await page.waitForTimeout(1500);
  ok((await state()).hidden, `${name}: при скролле вниз кнопка уехала`);
  // скролл вверх — появляется
  if (mobile) await scrollTo(2700); else await page.mouse.wheel(0, -200);
  await page.waitForTimeout(1200);
  ok(!(await state()).hidden, `${name}: при скролле вверх кнопка вернулась`);

  // подпись — текущий раздел
  await page.evaluate(() => { const el = document.getElementById('limit'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + 200); });
  await page.waitForTimeout(1500);
  ok((await state()).label === 'Оформление лимита', `${name}: подпись — текущий раздел («${(await state()).label}»)`);

  // открыть
  if ((await state()).hidden) { if (mobile) await page.evaluate(() => scrollBy(0, -100)); else await page.mouse.wheel(0, -100); await page.waitForTimeout(800); }
  await page.click('[data-art-nav-button]');
  await page.waitForTimeout(400);
  const so = await state();
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-current'));
  ok(so.open && so.expanded === 'true', `${name}: по клику открылось оглавление (aria-expanded=${so.expanded})`);
  ok(focused === 'true', `${name}: фокус на текущем пункте`);
  fs.writeFileSync(path.join(OUT, `nav-open-${width}.png`), await page.screenshot());
  // Esc
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const back = await page.evaluate(() => document.activeElement?.hasAttribute('data-art-nav-button'));
  ok(!(await state()).open && back, `${name}: Esc закрывает, фокус на кнопке`);
  // клик по оверлею
  await page.click('[data-art-nav-button]'); await page.waitForTimeout(300);
  await page.mouse.click(20, 40); await page.waitForTimeout(300);
  ok(!(await state()).open, `${name}: клик по оверлею закрывает`);
  // пункт — переход к разделу
  await page.click('[data-art-nav-button]'); await page.waitForTimeout(300);
  await page.click('[data-art-nav-item="findings"]');
  await page.waitForTimeout(2000);
  const top = await page.evaluate(() => Math.round(document.getElementById('findings').getBoundingClientRect().top));
  ok(!(await state()).open && Math.abs(top) < 4, `${name}: пункт «Находки» — плавно к разделу и закрыть (верх раздела ${top})`);
  // в самом низу кнопка видна
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(1500);
  ok(!(await state()).hidden, `${name}: в самом низу кнопка видна`);
  await page.close();
  await ctx.close();
  const video = fs.readdirSync(OUT).filter((f) => f.endsWith('.webm') && !f.startsWith('nav-')).map((f) => path.join(OUT, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  fs.renameSync(video, path.join(OUT, `nav-${width}.webm`));
}

// reduced motion — кнопка гаснет, а не уезжает
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { for (let i = 1; i < 10; i++) { scrollTo(0, i * 300); await new Promise((r) => setTimeout(r, 50)); } });
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => { const d = getComputedStyle(document.querySelector('.art-nav__dock')); return { opacity: d.opacity, transform: d.transform }; });
  ok(r.opacity === '0' && r.transform === 'none', `reduced motion: кнопка гаснет без сдвига (${r.opacity}, ${r.transform})`);
  await page.close();
}
await browser.close();
server.close();
console.log(fails ? `провалено: ${fails}` : 'всё прошло');
process.exit(fails ? 1 : 0);
