// Навигация по статье: подпись текущего раздела, видна между первым экраном и оффером,
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
  ok((await state()).hidden, `${name}: на первом экране кнопки нет`);
  // ушли с первого экрана — кнопка появилась (новый раздел)
  await page.evaluate(() => { const el = document.getElementById('intro'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + 10); });
  await page.waitForTimeout(1500);
  const s0 = await state();
  ok(!s0.hidden && s0.bottom === 24, `${name}: после первого экрана кнопка видна, 24 px от низа (${s0.bottom})`);
  ok(mobile ? s0.width === width - 40 : s0.width === 356, `${name}: ширина кнопки ${s0.width}`);
  // скролл вниз по статье — кнопка остаётся
  if (mobile) { const y0 = await page.evaluate(() => scrollY); for (let i = 1; i <= 10; i++) { await page.evaluate((y) => window.scrollTo(0, y), y0 + i * 300); await page.waitForTimeout(60); } }
  else { for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(60); } }
  await page.waitForTimeout(1500);
  ok(!(await state()).hidden, `${name}: при скролле по статье кнопка не прячется`);
  // на оффере «Заполнить бриф» — спрятана
  await page.evaluate(() => { const el = document.querySelector('.art-cta'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight / 2); });
  await page.waitForTimeout(1500);
  ok((await state()).hidden, `${name}: на оффере кнопка спрятана`);
  // подпись — текущий раздел
  await page.evaluate(() => { const el = document.getElementById('limit'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + 200); });
  await page.waitForTimeout(1500);
  const sl = await state();
  ok(sl.label === 'Оформление лимита' && !sl.hidden, `${name}: подпись — текущий раздел «${sl.label}»`);
  const cur = await page.evaluate(() => document.querySelector('[data-art-nav-item][aria-current="true"]')?.dataset.artNavItem);
  ok(cur === 'limit', `${name}: в оглавлении подсвечен текущий раздел (${cur})`);

  // открыть
  await page.click('[data-art-nav-button]');
  await page.waitForTimeout(500);
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
  // в футере — спрятана
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(1500);
  ok((await state()).hidden, `${name}: в футере кнопка спрятана`);
  await page.close();
  await ctx.close();
  const video = fs.readdirSync(OUT).filter((f) => f.endsWith('.webm') && !f.startsWith('nav-')).map((f) => path.join(OUT, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  fs.renameSync(video, path.join(OUT, `nav-${width}.webm`));
}

// reduced motion — кнопка гаснет, а не уезжает
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => { const d = getComputedStyle(document.querySelector('.art-nav__dock')); return { opacity: d.opacity, transform: d.transform }; });
  ok(r.opacity === '0' && r.transform === 'none', `reduced motion: на первом экране кнопка скрыта прозрачностью, без сдвига (${r.opacity}, ${r.transform})`);
  await page.close();
}
await browser.close();
server.close();
console.log(fails ? `провалено: ${fails}` : 'всё прошло');
process.exit(fails ? 1 : 0);
