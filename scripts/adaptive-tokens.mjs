// Пересобирает adaptive-токены в src/styles/tokens.css из значений переменных Figma
// (коллекция Adaptive: scripts/figma-vars/{desktop,mobile}.json — режимы Desktop 1440 и Mobile 393).
// Блок между /* adaptive:start */ и /* adaptive:end */ генерируется целиком. Значение между брейкпоинтами —
// линейная интерполяция через clamp(): на 1440 — Desktop, на 393 и уже — Mobile, между ними — резина.
// Запуск: node scripts/adaptive-tokens.mjs
import fs from 'node:fs';

const MOBILE = 393;
const DESKTOP = 1440;
const desktop = JSON.parse(fs.readFileSync('scripts/figma-vars/desktop.json', 'utf8'));
const mobile = JSON.parse(fs.readFileSync('scripts/figma-vars/mobile.json', 'utf8'));
const file = 'src/styles/tokens.css';
const css = fs.readFileSync(file, 'utf8');

const num = (n) => String(Math.round(n * 10000) / 10000);
const clampFor = (m, d) => {
  if (m === d) return `${num(m)}px`;
  const slope = (d - m) / (DESKTOP - MOBILE);
  const intercept = m - slope * MOBILE;
  const sign = slope < 0 ? '-' : '+';
  return `clamp(${num(Math.min(m, d))}px, ${num(intercept)}px ${sign} ${num(Math.abs(slope) * 100)}vw, ${num(Math.max(m, d))}px)`;
};

// имя переменной Figma (typography/h1/size, gap/xl, size/button/height) → CSS-переменная
const cssName = (name) => `--${name.replaceAll('/', '-')}`;
const group = (name) => name.split('/')[0];
const titles = { typography: 'типографика', gap: 'зазоры', layout: 'лэйаут', size: 'размеры компонентов' };

let current = '';
const lines = [];
for (const [name, d] of Object.entries(desktop)) {
  const m = mobile[name];
  if (m === undefined) continue;
  if (group(name) !== current) {
    current = group(name);
    lines.push(`${lines.length ? '\n' : ''}  /* ── Adaptive: ${titles[current] ?? current} (Mobile 393 → Desktop 1440) ── */`);
  }
  lines.push(`  ${cssName(name)}: ${clampFor(m, d)};${m === d ? '' : ` /* ${num(m)} → ${num(d)} */`}`);
}

const start = '/* adaptive:start */';
const end = '/* adaptive:end */';
const a = css.indexOf(start);
const b = css.indexOf(end);
if (a < 0 || b < 0) throw new Error('В tokens.css нет маркеров adaptive:start / adaptive:end');
fs.writeFileSync(file, `${css.slice(0, a + start.length)}\n${lines.join('\n')}\n  ${css.slice(b)}`);
console.log(`adaptive-токенов: ${lines.filter((l) => l.includes(': ')).length}`);
