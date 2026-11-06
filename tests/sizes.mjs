// Размеры сборки: JS-бандлы (сырой / gzip) и CSS, встроенный в HTML страниц.
// Запуск: npm run build && node tests/sizes.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const kb = (n) => (n / 1024).toFixed(1);
const gz = (buf) => zlib.gzipSync(buf, { level: 9 }).length;
const walk = (d) => fs.readdirSync(d).flatMap((f) => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk('dist');
const js = files.filter((f) => f.endsWith('.js'));
let jsRaw = 0, jsGz = 0;
for (const f of js) { const b = fs.readFileSync(f); jsRaw += b.length; jsGz += gz(b); }
console.log(`JS: ${js.length} файлов, ${kb(jsRaw)} КБ / gzip ${kb(jsGz)} КБ`);
for (const f of js) { const b = fs.readFileSync(f); console.log(`  ${path.basename(f)}: ${kb(b.length)} / ${kb(gz(b))}`); }
for (const f of files.filter((f) => f.endsWith('.html'))) {
  const h = fs.readFileSync(f, 'utf8');
  const css = [...h.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('');
  const scripts = [...h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('');
  console.log(`${f.replace('dist', '')}: HTML ${kb(h.length)} / gzip ${kb(gz(Buffer.from(h)))} КБ; CSS ${kb(css.length)} / gzip ${kb(gz(Buffer.from(css)))} КБ; inline JS ${kb(scripts.length)} КБ`);
}
const fonts = files.filter((f) => f.endsWith('.woff2'));
console.log(`шрифты: ${fonts.length} файлов, ${kb(fonts.reduce((s, f) => s + fs.statSync(f).size, 0))} КБ`);
