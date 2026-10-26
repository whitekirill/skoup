// Иллюстрация первого экрана + прокрутка колесом: пока мышь над иллюстрацией, она рисуется и
// во время скролла (разлёт не застывает), курсор пересчитывается, хотя мышь стоит на месте;
// без мыши над ней — во время скролла кадр держится. Печатает долгие кадры (CPU ×4 по умолчанию).
// В headless WebGL программный — кадры здесь дороже, чем на реальной видеокарте.
// Запуск: npm run build && node tests/hero-scroll.mjs
import { chromium } from '@playwright/test';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const T = { '.js': 'text/javascript', '.svg': 'image/svg+xml', '.html': 'text/html', '.woff2': 'font/woff2', '.css': 'text/css', '.avif': 'image/avif', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json' };
const s = http.createServer((q, r) => { let f = path.join('dist', q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html'; if (!fs.existsSync(f)) return r.writeHead(404).end(); r.writeHead(200, T[path.extname(f)] ? { 'content-type': T[path.extname(f)] } : {}); fs.createReadStream(f).pipe(r); }).listen(0);
const b = await chromium.launch();
let fails = 0;
const ok = (cond, name) => { console.log(`${cond ? '✓' : '✗'} ${name}`); if (!cond) fails++; };

async function run(overArt) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, o) { return get.call(this, t, o && { ...o, failIfMajorPerformanceCaveat: false }); };
    const ext = WebGL2RenderingContext.prototype.getExtension;
    WebGL2RenderingContext.prototype.getExtension = function (n) { return n === 'WEBGL_debug_renderer_info' ? null : ext.call(this, n); };
    // считаем кадры иллюстрации и запоминаем последний буфер точек
    const sub = WebGL2RenderingContext.prototype.bufferSubData;
    window.__draws = 0;
    WebGL2RenderingContext.prototype.bufferSubData = function (...a) { window.__draws++; window.__inst = a[2]; return sub.apply(this, a); };
  });
  await p.goto(`http://localhost:${s.address().port}/`);
  await p.waitForFunction(() => document.documentElement.classList.contains('hero-live-ready'), null, { timeout: 15000 });
  await p.waitForTimeout(3000); // сборка
  const box = await p.locator('.hero__canvas').boundingBox();
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.CPU || 4) });
  const mx = box.x + box.width * 0.5, my = box.y + box.height * 0.6;
  if (overArt) { await p.mouse.move(mx - 40, my); await p.mouse.move(mx, my, { steps: 5 }); }
  else await p.mouse.move(200, 700);
  await p.waitForTimeout(600);
  await p.evaluate(() => {
    window.__frames = []; window.__loaf = []; window.__d0 = window.__draws;
    let last = performance.now();
    const tick = (t) => { window.__frames.push(t - last); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__loaf.push(Math.round(e.duration)); }).observe({ type: 'long-animation-frame' });
  });
  // по чуть-чуть: иллюстрация остаётся под курсором
  for (let i = 0; i < 12; i++) { await p.mouse.wheel(0, 25); await p.waitForTimeout(80); }
  const r = await p.evaluate(() => ({ frames: window.__frames, loaf: window.__loaf, draws: window.__draws - window.__d0, y: scrollY }));
  const ft = r.frames.slice().sort((a, b) => a - b);
  console.log(`  кадров ${ft.length}, медиана ${ft[ft.length >> 1].toFixed(1)} мс, p95 ${ft[Math.floor(ft.length * 0.95)].toFixed(1)}, >25мс: ${ft.filter((x) => x > 25).length}; кадров иллюстрации за скролл: ${r.draws}; LoAF: ${r.loaf.join(' ')}`);
  await p.close();
  return r;
}

console.log('— мышь над иллюстрацией');
const a = await run(true);
ok(a.y > 100, `страница прокрутилась (y=${Math.round(a.y)})`);
ok(a.draws > a.frames.length * 0.5, 'во время скролла иллюстрация рисуется — разлёт не застывает');

console.log('— мышь в стороне');
const c = await run(false);
ok(c.draws < c.frames.length * 0.3, 'без курсора на ней во время скролла кадр держится');

// Курсор стоит, страница едет: точки под новым местом курсора разлетаются
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, o) { return get.call(this, t, o && { ...o, failIfMajorPerformanceCaveat: false }); };
    const ext = WebGL2RenderingContext.prototype.getExtension;
    WebGL2RenderingContext.prototype.getExtension = function (n) { return n === 'WEBGL_debug_renderer_info' ? null : ext.call(this, n); };
    const sub = WebGL2RenderingContext.prototype.bufferSubData;
    WebGL2RenderingContext.prototype.bufferSubData = function (...a) { window.__inst = new Float32Array(a[2]); return sub.apply(this, a); };
  });
  await p.goto(`http://localhost:${s.address().port}/`);
  await p.waitForFunction(() => document.documentElement.classList.contains('hero-live-ready'), null, { timeout: 15000 });
  await p.waitForTimeout(3000);
  const box = await p.locator('.hero__canvas').boundingBox();
  const mx = 1260, my = 260; // над монетами иллюстрации
  await p.mouse.move(mx - 40, my); await p.mouse.move(mx, my, { steps: 5 });
  await p.waitForTimeout(800);
  // центр «горячих» точек (позеленевших у курсора), в единицах иллюстрации
  const hot = () => p.evaluate(() => {
    const inst = window.__inst; let y = 0, w = 0;
    for (let i = 0; i < inst.length; i += 8) { const g = inst[i + 5] - inst[i + 4]; if (g > 0.15) { y += inst[i + 1] * g; w += g; } }
    return w ? y / w : NaN;
  });
  const before = await hot();
  for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 30); await p.waitForTimeout(60); }
  await p.waitForTimeout(500);
  const ys = await p.evaluate(() => scrollY);
  const after = await hot();
  ok(ys > 100 && after - before > 50, `мышь стоит, страница уехала на ${Math.round(ys)} px — разлёт сместился вслед за курсором (${before.toFixed(0)} → ${after.toFixed(0)})`);
  await p.close();
}

await b.close(); s.close();
console.log(fails ? `провалено: ${fails}` : 'всё прошло');
process.exit(fails ? 1 : 0);
