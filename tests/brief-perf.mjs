// Плавность открытия/закрытия брифа: кадры во время анимации и горизонтальный сдвиг страницы
// (полоса прокрутки видима, как в Windows / macOS «всегда показывать»). CPU ×4 по умолчанию.
// Запуск: npm run build && node tests/brief-perf.mjs
import { chromium } from '@playwright/test';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const T = { '.js': 'text/javascript', '.svg': 'image/svg+xml', '.html': 'text/html', '.woff2': 'font/woff2', '.css': 'text/css', '.webp': 'image/webp', '.avif': 'image/avif' };
const s = http.createServer((q, r) => { let f = path.join('dist', q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html'; if (!fs.existsSync(f)) return r.writeHead(404).end(); r.writeHead(200, T[path.extname(f)] ? { 'content-type': T[path.extname(f)] } : {}); fs.createReadStream(f).pipe(r); }).listen(0);
const b = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await p.context().newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.CPU || 4) });
await p.goto(`http://localhost:${s.address().port}/`);
if (process.env.NOSCALE) await p.addStyleTag({ content: 'html.is-brief-open .page > main, html.is-brief-open .page > footer { scale: 1 !important; transition: none !important }' });
await p.waitForTimeout(1500);
await p.mouse.wheel(0, 1200); await p.waitForTimeout(1500);
const run = async (label, action) => {
  await p.evaluate(() => {
    window.__f = []; window.__x = [];
    let last = performance.now(); const t0 = last;
    const el = document.querySelector('.page > main');
    const tick = (t) => { window.__f.push(t - last); window.__x.push(Math.round(el.getBoundingClientRect().left * 10) / 10); last = t; if (t - t0 < 1100) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await action();
  await p.waitForTimeout(1300);
  const { f, x } = await p.evaluate(() => ({ f: window.__f, x: window.__x }));
  const sorted = [...f].sort((a, b) => a - b);
  const shifts = new Set(x.map((v) => v.toFixed(1)));
  console.log(`${label}: кадров ${f.length}, медиана ${sorted[f.length >> 1].toFixed(1)} мс, макс ${sorted.at(-1).toFixed(1)} мс, >25 мс: ${f.filter((v) => v > 25).length}; левый край main: ${[...shifts].slice(0, 6).join(' → ')}`);
};
await run('открытие', () => p.click('[data-sticky-cta] [data-brief-open], .hero [data-brief-open]').catch(() => p.evaluate(() => document.querySelector('[data-brief-open]').click())));
await run('закрытие', () => p.click('.brief__close'));
await b.close(); s.close();
