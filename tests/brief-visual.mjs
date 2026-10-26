// Бриф: скриншоты формы и экрана успеха на 1440 и 393, сверка со скриншотами нод Figma.
// Запуск: npm run build && node tests/brief-visual.mjs
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
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
const url = `http://localhost:${server.address().port}/#brief`;
fs.mkdirSync('tests/screens/diff', { recursive: true });

async function shot(page, width) {
  // разворачиваем оверлей на всю высоту контента, чтобы снять его целиком
  const h = await page.evaluate(() => document.querySelector('[data-brief]').scrollHeight);
  await page.setViewportSize({ width, height: h });
  await page.waitForTimeout(200);
  return PNG.sync.read(await page.screenshot());
}

function compare(site, figmaFile, name) {
  const figma = PNG.sync.read(fs.readFileSync(figmaFile));
  const w = figma.width, h = Math.min(site.height, figma.height);
  const crop = (img) => { const o = new PNG({ width: w, height: h }); PNG.bitblt(img, o, 0, 0, w, h, 0, 0); return o; };
  const a = crop(site), b = crop(figma), d = new PNG({ width: w, height: h });
  const n = pixelmatch(a.data, b.data, d.data, w, h, { threshold: 0.1 });
  const out = new PNG({ width: w * 3, height: h });
  PNG.bitblt(a, out, 0, 0, w, h, 0, 0); PNG.bitblt(b, out, 0, 0, w, h, w, 0); PNG.bitblt(d, out, 0, 0, w, h, w * 2, 0);
  fs.writeFileSync(`tests/screens/diff/${name}.png`, PNG.sync.write(out));
  console.log(`${name}: сайт ${site.width}×${site.height}, макет ${figma.width}×${figma.height}, diff ${(n / (w * h) * 100).toFixed(2)}%`);
}

const browser = await chromium.launch();
for (const [width, kind] of [[1440, 'desktop'], [393, 'mobile']]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  compare(await shot(page, width), `tests/screens/figma/brief-${kind}.png`, `brief-${kind}`);
  // экран успеха: заполняем и отправляем (мок 800 мс)
  await page.setViewportSize({ width, height: 900 });
  await page.fill('#brief-name', 'Анна Смирнова');
  await page.fill('#brief-company', 'Банк');
  await page.fill('#brief-contact', 'anna@company.ru');
  await page.fill('#brief-phone', '+7 999 123-45-67');
  await page.click('.chip:has(input[value="Стратегия"])');
  await page.click('.chip:has(input[value="более 6 млн ₽"])');
  await page.click('[data-brief-submit]');
  await page.waitForSelector('[data-brief-view="success"]:not([hidden])', { timeout: 5000 });
  await page.waitForTimeout(400);
  compare(await shot(page, width), `tests/screens/figma/brief-success-${kind}.png`, `brief-success-${kind}`);
  await page.close();
}
await browser.close();
server.close();
