// Качества на /about: нет вспышки до старта, слова падают из-за верхнего края окна, ряды снизу вверх,
// ~2 с на всё, кадры при CPU ×4 (393), халфтон при наведении, перетаскивание (возврат на место),
// заливка абзаца по скроллу,
// prefers-reduced-motion и страница без JS — плашки на местах. Пишет видео падения на 1440 и 393.
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

// состояние плашек: центр, угол, прозрачность
const state = () => [...document.querySelectorAll('.pile__item')].map((el) => {
  const r = el.getBoundingClientRect();
  const m = new DOMMatrix(getComputedStyle(el).transform);
  return { label: el.textContent, x: r.left + r.width / 2, y: r.top + r.height / 2 + scrollY, angle: (Math.atan2(m.b, m.a) * 180) / Math.PI, opacity: +getComputedStyle(el).opacity, z: el.style.zIndex };
});
// прокрутка так, чтобы в окне была видна доля зоны (0…1) снизу
const reveal = (fraction) => {
  const box = document.querySelector('.pile__box');
  const top = box.getBoundingClientRect().top + scrollY;
  scrollTo(0, top + box.offsetHeight * fraction - innerHeight);
};

const browser = await chromium.launch();

for (const [width, name] of [[1440, 'desktop'], [393, 'mobile']]) {
  const mobile = width < 768;
  const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: mobile, isMobile: mobile, recordVideo: { dir: OUT, size: { width, height: 900 } } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  if (mobile) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }

  // 20% зоны в окне — ещё рано: слова скрыты (без вспышки)
  await page.evaluate(reveal, 0.2);
  await page.waitForTimeout(800);
  const early = await page.evaluate(state);
  ok(early.every((s) => s.opacity === 0), `${name}: до 35% зоны в окне слова скрыты`);

  // 45% — запуск. Пишем траектории и кадры
  await page.evaluate(() => {
    window.__track = []; window.__frames = [];
    let last = performance.now();
    const t0 = performance.now();
    const tick = (now) => {
      window.__frames.push(now - last); last = now;
      const items = [...document.querySelectorAll('.pile__item')];
      window.__track.push({ t: now - t0, y: items.map((el) => new DOMMatrix(getComputedStyle(el).transform).f), o: items.map((el) => +getComputedStyle(el).opacity), b: items.map((el) => el.getBoundingClientRect().bottom) });
      if (now - t0 < 3500) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.evaluate(reveal, 0.45);
  await page.waitForTimeout(4000);
  const { track, frames } = await page.evaluate(() => ({ track: window.__track, frames: window.__frames }));
  const final = await page.evaluate(state);
  ok(final.every((s) => s.opacity === 1), `${name}: все слова упали и видны`);

  // момент приземления каждой плашки: последний кадр, когда она ещё была выше места больше чем на 1 px
  const n = final.length;
  const rest = track.at(-1).y; // f матрицы на месте (в нём и сдвиг −50% центровки)
  const landed = Array.from({ length: n }, (_, i) => {
    let t = 0;
    for (const f of track) if (Math.abs(f.y[i] - rest[i]) > 1) t = f.t;
    return t;
  });
  const start = Math.min(...Array.from({ length: n }, (_, i) => track.find((f) => f.o[i] > 0)?.t ?? Infinity));
  const total = Math.max(...landed) - start;
  // первый кадр, где слово видно, — оно ещё над верхним краем окна
  const firstSeen = Array.from({ length: n }, (_, i) => track.find((f) => f.o[i] > 0)?.b[i] ?? Infinity);
  ok(firstSeen.every((bottom) => bottom <= 2), `${name}: слова влетают из-за верхнего края окна (низ слова в первом кадре: макс ${Math.round(Math.max(...firstSeen))} px)`);
  ok(total > 1500 && total < 2800, `${name}: вся куча ложится за ${(total / 1000).toFixed(2)} с (≈2 с)`);
  // ряды снизу вверх: средний момент приземления ряда растёт с подъёмом ряда
  const rows = new Map();
  final.forEach((s, i) => {
    const key = [...rows.keys()].find((y) => Math.abs(y - s.y) < 30 * (width / (mobile ? 393 : 1440))) ?? s.y;
    rows.set(key, [...(rows.get(key) ?? []), landed[i]]);
  });
  const order = [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, t]) => t.reduce((a, b) => a + b) / t.length);
  ok(order.every((t, i) => i === 0 || t >= order[i - 1] - 60), `${name}: ряды ложатся снизу вверх (${order.map((t) => Math.round(t)).join(' → ')} мс)`);
  const ft = frames.slice(5).sort((a, b) => a - b);
  console.log(`  кадры во время падения${mobile ? ' (CPU ×4)' : ''}: медиана ${ft[ft.length >> 1].toFixed(1)} мс, p95 ${ft[Math.floor(ft.length * 0.95)].toFixed(1)}, >34 мс: ${ft.filter((x) => x > 34).length} из ${ft.length}`);

  // перетаскивание (только desktop с мышью)
  if (!mobile) {
    await page.evaluate(() => document.querySelector('[data-pile]').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(500);
    const before = await page.evaluate(state);
    const target = before.findIndex((s) => s.label === 'Аккуратные');
    // халфтон: наведение — слово рассыпается в точки, увели — текст вернулся
    {
      const word = page.locator('.pile__item').nth(target);
      const b = await word.boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
      await page.waitForTimeout(400);
      const on = await word.evaluate((el) => {
        const c = el.querySelector('canvas');
        const px = c?.getContext('2d').getImageData(0, 0, c.width, c.height).data ?? [];
        let ink = 0;
        for (let i = 3; i < px.length; i += 4) if (px[i] > 0) ink++;
        return { text: +getComputedStyle(el.querySelector('.pile__text')).opacity, ink };
      });
      ok(on.text < 0.05 && on.ink > 200, `desktop: при наведении слово — в халфтоне (текст ${on.text.toFixed(2)}, точек-пикселей ${on.ink})`);
      await page.mouse.move(10, 10, { steps: 4 });
      await page.waitForTimeout(400);
      const off = await word.evaluate((el) => +getComputedStyle(el.querySelector('.pile__text')).opacity);
      ok(off === 1, 'desktop: увели курсор — снова текст');
    }
    const box = await page.locator('.pile__item').nth(target).boundingBox();
    const cursor = await page.locator('.pile__item').nth(target).evaluate((el) => getComputedStyle(el).cursor);
    ok(cursor === 'grab', `desktop: курсор над словом — grab (${cursor})`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2 - 220, { steps: 12 });
    const dragging = await page.evaluate(state);
    const moved = Math.hypot(dragging[target].x - before[target].x, dragging[target].y - before[target].y);
    ok(moved > 150, `desktop: слово тащится за мышью (сдвиг ${Math.round(moved)} px)`);
    ok(+dragging[target].z > 0, 'desktop: во время перетаскивания слово поверх остальных');
    ok(Math.abs(dragging[target].angle - before[target].angle) > 0.5 && Math.abs(dragging[target].angle - before[target].angle) <= 8.01, `desktop: наклон по движению (${(dragging[target].angle - before[target].angle).toFixed(1)}°)`);
    await page.mouse.up();
    await page.waitForTimeout(1200);
    const after = await page.evaluate(state);
    const back = Math.hypot(after[target].x - before[target].x, after[target].y - before[target].y);
    ok(back < 0.5 && Math.abs(after[target].angle - before[target].angle) < 0.1, `desktop: вернулась точно на место (${back.toFixed(2)} px, ${(after[target].angle - before[target].angle).toFixed(2)}°)`);
    const others = after.every((s, i) => i === target || (Math.hypot(s.x - before[i].x, s.y - before[i].y) < 0.01 && Math.abs(s.angle - before[i].angle) < 0.01));
    ok(others, 'desktop: остальные слова не сдвинулись');
  } else {
    const draggable = await page.locator('.pile__item').first().evaluate((el) => getComputedStyle(el).cursor);
    ok(draggable !== 'grab', 'mobile: перетаскивания нет');
  }
  await page.close();
  await context.close();
  const video = fs.readdirSync(OUT).filter((f) => f.endsWith('.webm')).map((f) => path.join(OUT, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  fs.renameSync(video, path.join(OUT, `pile-${width}.webm`));
}

// заливка абзаца по скроллу: сначала серый, к концу — итоговые цвета
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: 'networkidle' });
  const fill = (top) => page.evaluate(async (top) => {
    const p = document.querySelector('.why__text');
    scrollTo(0, p.getBoundingClientRect().top + scrollY - top);
    await new Promise((r) => setTimeout(r, 300));
    const words = [...p.querySelectorAll('.fill-word')];
    return { n: words.length, filled: words.filter((w) => +getComputedStyle(w).getPropertyValue('--fill') === 1).length, first: getComputedStyle(words[0]).color, last: getComputedStyle(words.at(-1)).color };
  }, top);
  const start = await fill(900 * 0.9);
  const mid = await fill(900 * 0.6);
  const end = await fill(-200);
  ok(start.filled === 0, `заливка: абзац внизу окна — серый (${start.filled}/${start.n} залито)`);
  ok(mid.filled > 0 && mid.filled < mid.n, `заливка: середина — частично (${mid.filled}/${mid.n})`);
  ok(end.filled === end.n, `заливка: дочитали — весь текст в цвете (${end.filled}/${end.n}; первое слово ${end.first}, последнее ${end.last})`);
  await page.close();
}

// prefers-reduced-motion: без падения — сразу на местах, fade 200 мс, без перетаскивания
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(reveal, 0.6);
  await page.waitForTimeout(100);
  const mid = await page.evaluate(state);
  await page.waitForTimeout(400);
  const s = await page.evaluate(state);
  ok(mid.every((m, i) => Math.abs(m.y - s[i].y) < 0.5 && Math.abs(m.angle - s[i].angle) < 0.01), 'reduced motion: слова сразу на местах (без падения)');
  ok(s.every((x) => x.opacity === 1), 'reduced motion: проявились (fade)');
  const cursor = await page.locator('.pile__item').first().evaluate((el) => getComputedStyle(el).cursor);
  ok(cursor !== 'grab', 'reduced motion: без перетаскивания');
  const plain = await page.evaluate(() => document.querySelectorAll('.fill-word').length);
  ok(plain === 0, 'reduced motion: абзац сразу в итоговых цветах (без заливки)');
  await page.close();
}

// без JS: плашки видны на финальных местах (позиции из CSS)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  const s = await page.evaluate(() => [...document.querySelectorAll('.pile__item')].map((el) => +getComputedStyle(el).opacity)).catch(() => null);
  // evaluate работает и без JS страницы — это скрипт теста
  ok(s && s.every((o) => o === 1), 'без JS: все слова видны');
  await ctx.close();
}

await browser.close();
server.close();
console.log(fails ? `провалено: ${fails}` : 'всё прошло');
process.exit(fails ? 1 : 0);
