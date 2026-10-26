// Свой ползунок прокрутки: системной полосы нет, ползунок появляется при прокрутке и гаснет,
// тянется мышью, клик по дорожке переносит к месту, в открытом брифе крутит бриф.
// Запуск: npm run build && node tests/scrollbar.mjs
import { chromium } from '@playwright/test';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const T = { '.js': 'text/javascript', '.svg': 'image/svg+xml', '.html': 'text/html', '.woff2': 'font/woff2', '.css': 'text/css', '.avif': 'image/avif', '.webp': 'image/webp', '.png': 'image/png' };
const s = http.createServer((q, r) => { let f = path.join('dist', q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html'; if (!fs.existsSync(f)) return r.writeHead(404).end(); r.writeHead(200, T[path.extname(f)] ? { 'content-type': T[path.extname(f)] } : {}); fs.createReadStream(f).pipe(r); }).listen(0);
const b = await chromium.launch();
let fails = 0;
const ok = (cond, name) => { console.log(`${cond ? '✓' : '✗'} ${name}`); if (!cond) fails++; };

for (const reduced of [false, true]) {
  console.log(reduced ? '— reduced motion' : '— обычный режим');
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await p.goto(`http://localhost:${s.address().port}/`);
  await p.waitForTimeout(800);
  const st = () => p.evaluate(() => {
    const t = document.querySelector('.scrollbar__thumb'); const r = t.getBoundingClientRect();
    return { y: scrollY, top: r.top, h: r.height, w: r.width, op: +getComputedStyle(t).opacity, inner: innerWidth, client: document.documentElement.clientWidth, brief: document.querySelector('.brief').scrollTop, max: document.documentElement.scrollHeight - innerHeight };
  });
  let x = await st();
  ok(x.client === x.inner, `системной полосы нет (ширина ${x.client} = ${x.inner})`);
  ok(x.op === 0, 'в покое ползунок скрыт');

  await p.mouse.move(700, 450);
  for (let i = 0; i < 10; i++) { await p.mouse.wheel(0, 200); await p.waitForTimeout(40); }
  await p.waitForTimeout(400);
  x = await st();
  ok(x.op === 1 && x.y > 500, `при прокрутке виден (y=${Math.round(x.y)})`);
  const expected = 4 + (892 - x.h) * (x.y / x.max);
  ok(Math.abs(x.top - expected) < 2, `положение совпадает со страницей (${x.top.toFixed(1)} ≈ ${expected.toFixed(1)})`);
  await p.waitForTimeout(2500);
  ok((await st()).op === 0, 'после паузы гаснет');

  // Наведение и перетаскивание
  x = await st();
  await p.mouse.move(1434, x.top + x.h / 2);
  await p.waitForTimeout(300);
  x = await st();
  ok(x.op === 1 && x.w === 8, `под мышью виден и толще (${x.w}px)`);
  await p.mouse.down();
  await p.mouse.move(1434, x.top + x.h / 2 + 200, { steps: 8 });
  await p.mouse.up();
  await p.waitForTimeout(300);
  const after = await st();
  const want = x.y + (200 * after.max) / (892 - x.h);
  ok(Math.abs(after.y - want) < 10, `тянется: y ${Math.round(x.y)} → ${Math.round(after.y)} (ждали ≈${Math.round(want)})`);

  // Клик по дорожке у самого низа — к концу страницы
  await p.mouse.click(1434, 890);
  await p.waitForTimeout(1200);
  x = await st();
  ok(x.max - x.y < 5, `клик по дорожке внизу → конец страницы (y=${Math.round(x.y)} из ${x.max})`);
  await p.mouse.click(1434, 6);
  await p.waitForTimeout(1200);
  ok((await st()).y < 5, 'клик вверху → начало страницы');

  // Бриф: ползунок крутит бриф, страница стоит
  await p.mouse.move(700, 450);
  await p.locator('[data-brief-open]:visible').first().click();
  await p.waitForTimeout(900);
  x = await st();
  const pageY = x.y;
  ok(await p.evaluate(() => document.querySelector('.brief').open), 'бриф открыт');
  for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 200); await p.waitForTimeout(40); }
  await p.waitForTimeout(400);
  x = await st();
  ok(x.brief > 300 && x.y === pageY, `в брифе крутится бриф (brief=${x.brief}, страница ${x.y})`);
  const bmax = await p.evaluate(() => { const e = document.querySelector('.brief'); return e.scrollHeight - e.clientHeight; });
  const bexp = 4 + (892 - x.h) * (x.brief / bmax);
  ok(x.op === 1 && Math.abs(x.top - bexp) < 2, `ползунок показывает бриф (${x.top.toFixed(1)} ≈ ${bexp.toFixed(1)})`);
  await p.mouse.click(1434, 890);
  await p.waitForTimeout(1200);
  x = await st();
  ok(bmax - x.brief < 5 && x.y === pageY, 'клик по дорожке в брифе → конец брифа');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(900);
  x = await st();
  const pexp = 4 + (892 - x.h) * (x.y / x.max);
  ok(Math.abs(x.top - pexp) < 2, `после закрытия ползунок снова у страницы (${x.top.toFixed(1)} ≈ ${pexp.toFixed(1)}, y=${x.y}, cls=${await p.evaluate(() => document.documentElement.className)})`);
  await p.close();
}

// Телефон: полосы нет, ползунок не мешает касаниям
const m = await b.newPage({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });
await m.goto(`http://localhost:${s.address().port}/`);
await m.waitForTimeout(500);
ok(await m.evaluate(() => getComputedStyle(document.querySelector('.scrollbar')).pointerEvents === 'none'), 'на тач-экране ползунок не перехватывает касания');

await b.close(); s.close();
console.log(fails ? `провалено: ${fails}` : 'всё прошло');
process.exit(fails ? 1 : 0);
