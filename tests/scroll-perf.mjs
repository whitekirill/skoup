// Плавность скролла: прокрутка всей страницы колесом (Lenis), CPU замедлен (CPU=4 по умолчанию),
// медленная сеть, живая WebGL-иллюстрация включена принудительно. Печатает долгие кадры (>25 мс) и где они.
// Запуск: npm run build && node tests/scroll-perf.mjs
import { chromium } from '@playwright/test';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const T = { '.js': 'text/javascript', '.svg': 'image/svg+xml', '.html': 'text/html', '.woff2': 'font/woff2', '.css': 'text/css', '.avif': 'image/avif', '.webp': 'image/webp', '.png': 'image/png' };
const s = http.createServer((q, r) => { let f = path.join('dist', q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html'; if (!fs.existsSync(f)) return r.writeHead(404).end(); r.writeHead(200, T[path.extname(f)] ? { 'content-type': T[path.extname(f)] } : {}); fs.createReadStream(f).pipe(r); }).listen(0);
const b = await chromium.launch({ args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.addInitScript(() => {
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, o) { return get.call(this, t, o && { ...o, failIfMajorPerformanceCaveat: false }); };
  const ext = WebGL2RenderingContext.prototype.getExtension;
  WebGL2RenderingContext.prototype.getExtension = function (n) { return n === 'WEBGL_debug_renderer_info' ? null : ext.call(this, n); };
});
const cdp = await p.context().newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.CPU || 4) });
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 1.5e6, uploadThroughput: 750e3 });
await p.goto(`http://localhost:${s.address().port}/`);
await p.waitForTimeout(1500);
await p.evaluate(() => {
  window.__frames = []; window.__loaf = [];
  let last = performance.now();
  const tick = (t) => { window.__frames.push([t - last, Math.round(scrollY)]); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__loaf.push({ y: Math.round(scrollY), dur: Math.round(e.duration), render: Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0), style: Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0), scripts: e.scripts.map((sc) => `${sc.invoker} ${Math.round(sc.duration)}ms ${sc.sourceURL.split('/').pop()}`) }); }).observe({ type: 'long-animation-frame', buffered: false });
});
await p.mouse.move(200, 450); // слева от иллюстрации: замер именно скролла (наведение во время скролла — tests/hero-scroll.mjs)
for (let i = 0; i < 90; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(60); }
await p.waitForTimeout(1500);
const r = await p.evaluate(() => ({ frames: window.__frames, loaf: window.__loaf }));
const ft = r.frames.map((f) => f[0]).sort((a, b) => a - b);
console.log(`кадров ${ft.length}, медиана ${ft[ft.length >> 1].toFixed(1)} мс, p95 ${ft[Math.floor(ft.length * 0.95)].toFixed(1)}, p99 ${ft[Math.floor(ft.length * 0.99)].toFixed(1)}, >25мс: ${ft.filter((x) => x > 25).length}, >50мс: ${ft.filter((x) => x > 50).length}`);
console.log('долгие кадры (scrollY: мс):', r.frames.filter((f) => f[0] > 25).map((f) => `${f[1]}:${Math.round(f[0])}`).join(' '));
console.log('hero live:', await p.evaluate(() => document.documentElement.className)); console.log('LoAF:'); for (const l of r.loaf.slice(0, 40)) console.log(`  y=${l.y} ${l.dur}мс render=${l.render} style/layout=${l.style} ${l.scripts.join(' | ')}`);
await b.close(); s.close();
