// Пересчитывает adaptive-токены в src/styles/tokens.css из значений переменных Figma
// (scripts/figma-vars/{mobile,desktop}.json — режимы Mobile 393 и Desktop 1440).
// Значение между брейкпоинтами — линейная интерполяция через clamp(), на 393 и 1440 — точно как в макете.
// Запуск: node scripts/adaptive-tokens.mjs
import fs from 'node:fs';

const MOBILE = 393;
const DESKTOP = 1440;
const mobile = JSON.parse(fs.readFileSync('scripts/figma-vars/mobile.json', 'utf8'));
const desktop = JSON.parse(fs.readFileSync('scripts/figma-vars/desktop.json', 'utf8'));
const file = 'src/styles/tokens.css';
let css = fs.readFileSync(file, 'utf8');

const num = (n) => String(Math.round(n * 10000) / 10000);
const clampFor = (m, d) => {
  if (m === d) return `${num(m)}px`;
  const slope = (d - m) / (DESKTOP - MOBILE);
  const intercept = m - slope * MOBILE;
  const sign = slope < 0 ? '-' : '+';
  return `clamp(${num(Math.min(m, d))}px, ${num(intercept)}px ${sign} ${num(Math.abs(slope) * 100)}vw, ${num(Math.max(m, d))}px)`;
};

// имя переменной Figma → имя CSS-переменной в tokens.css
const cssName = (name) => (/^(h\d|body|button|caption|display)/.test(name) ? `--typography-${name}` : `--${name}`);

let changed = 0;
for (const [name, d] of Object.entries(desktop)) {
  const m = mobile[name];
  if (m === undefined) continue;
  const prop = cssName(name);
  const re = new RegExp(`(\\n\\s*${prop}:\\s*)[^;]+;([^\\n]*)`);
  if (!re.test(css)) continue;
  const comment = m === d ? '' : ` /* ${m} → ${d} */`;
  css = css.replace(re, `$1${clampFor(m, d)};${comment}`);
  changed++;
}
fs.writeFileSync(file, css);
console.log(`обновлено токенов: ${changed}`);
