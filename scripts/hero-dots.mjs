// Точки иллюстрации первого экрана — ровно из макета, без растеризации.
// Источник — экспорт нод Figma в SVG (scripts/figma-hero/*.svg: десктоп 382:18621, мобилка 392:9520).
// Каждая точка — подпуть в слоях «Dots L0…L3 · shade 0…3» (Shading (gray)): берём центр, размер и тон.
//
// Тон в покое — серый той же яркости, что и итоговый цвет точки в макете (серый слой × зелёный
// градиент multiply), чтобы контраст совпадал. Точки привязываются к монетам по силуэтам из
// кадра Art (Coin 1…5: Face + Body); разлетающиеся точки дальше EDGE от силуэта отбрасываются.
//
// Пишет: src/data/hero-dots-{desktop,mobile}.json (для canvas) и src/assets/hero/hero-{desktop,mobile}.svg
// (статичная серая картинка: без JS, reduced motion, до первого кадра).
// Запуск: node scripts/hero-dots.mjs
import fs from 'node:fs';
import { optimize } from 'svgo';

const sources = {
  desktop: {
    svg: 'scripts/figma-hero/desktop.svg',
    // кадр Art в координатах SVG: начало и поворот (rect «Color gradient» лежит ровно на нём)
    origin: [58.2178, 235.115],
    angle: 30,
    gradient: { x1: 142.468, y1: 1072.18, x2: 899.516, y2: 234.024 },
    edge: 6,
    coins: [
      { face: [-12.517, 510.395, 409.863, 409.863], body: [-12.52, 475.342, 427.392, 440.221] },
      { face: [195.571, 409.824, 449.273, 281.566], body: [195.571, 434.701, 444.77, 461.314] },
      { face: [479.035, 303.19, 350.811, 482.795], body: [479.035, 385.821, 318.224, 428.511] },
      { face: [548.426, 367.672, 279.048, 530.723], body: [501.921, 237.648, 438.081, 465.091] },
      { face: [647.898, 127.191, 409.863, 409.863], body: [647.897, 92.14, 427.39, 440.219] },
    ],
  },
  mobile: {
    svg: 'scripts/figma-hero/mobile.svg',
    origin: [-97.9873, -70.3639],
    angle: 2.38698,
    gradient: { x1: -51.7684, y1: 388.843, x2: 363.539, y2: -70.962 },
    edge: 3,
    coins: [
      { face: [-6.867, 279.997, 171.311, 171.311], body: [-6.868, 260.768, 172.115, 190.524] },
      { face: [107.288, 224.825, 157.847, 229.987], body: [107.29, 238.472, 177.488, 201.23] },
      { face: [262.793, 166.326, 47.77, 323.889], body: [262.793, 211.657, 76.925, 235.19] },
      { face: [300.861, 201.701, 138.453, 263.324], body: [275.351, 130.372, 169.371, 208.132] },
      { face: [355.429, 69.775, 171.311, 171.311], body: [355.43, 50.548, 172.115, 190.522] },
    ],
  },
};

const MULTIPLY = 0.42;
const STOPS = [[0, [0x47, 0xf6, 0x3b]], [0.5, [0x8a, 0xff, 0xaf]], [1, [0x2c, 0xff, 0xb9]]];
const SHADES = { '#B3B3BD': 0, '#C7C7CF': 1, '#E0E0E6': 2, '#F0F0F2': 3 };

// Подпути SVG-пути. Экспорт Figma пишет только абсолютные M/C/L/Z — каждый подпуть начинается с M.
// Точки подпути (концы и контрольные) — для габарита скруглённого квадрата этого хватает.
function subpaths(d) {
  return d.split(/(?=M)/).filter(Boolean).map((src) => {
    const nums = src.match(/-?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g).map(Number);
    const pts = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    return { pts, src: src.trim() };
  });
}

function sweep({ face: [fx, fy, fw, fh], body: [bx, by, bw, bh] }) {
  const dx = bx < fx - 0.5 ? bx - fx : bx + bw - (fx + fw);
  const dy = by < fy - 0.5 ? by - fy : by + bh - (fy + fh);
  return [dx, dy];
}

// Насколько точка вне силуэта монеты (0 — внутри), в единицах SVG
function outside(coin, u, v) {
  const [fx, fy, fw, fh] = coin.face;
  const [dx, dy] = coin.sweep;
  let best = Infinity;
  for (let t = 0; t <= 1; t += 1 / 16) {
    const cx = fx + fw / 2 + dx * t, cy = fy + fh / 2 + dy * t;
    const rx = fw / 2, ry = fh / 2;
    const k = Math.hypot((u - cx) / rx, (v - cy) / ry);
    best = Math.min(best, Math.max(0, k - 1) * Math.min(rx, ry));
  }
  return best;
}

function gradientAt(g, angle, origin, x, y) {
  // градиент задан в системе прямоугольника, повёрнутого на −angle вокруг origin
  const r = (angle * Math.PI) / 180;
  const px = x - origin[0], py = y - origin[1];
  const lx = origin[0] + px * Math.cos(r) - py * Math.sin(r);
  const ly = origin[1] + px * Math.sin(r) + py * Math.cos(r);
  const vx = g.x2 - g.x1, vy = g.y2 - g.y1;
  const t = Math.min(1, Math.max(0, ((lx - g.x1) * vx + (ly - g.y1) * vy) / (vx * vx + vy * vy)));
  const i = t < 0.5 ? 0 : 1;
  const k = (t - STOPS[i][0]) / (STOPS[i + 1][0] - STOPS[i][0]);
  return STOPS[i][1].map((c, j) => c + (STOPS[i + 1][1][j] - c) * k);
}

const hex = (n) => n.toString(16).padStart(2, '0');

for (const [name, src] of Object.entries(sources)) {
  const markup = fs.readFileSync(src.svg, 'utf8');
  const [, w, h] = markup.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
  const rad = (src.angle * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const [ox, oy] = src.origin;
  const coins = src.coins.map((c) => ({ ...c, sweep: sweep(c) }));

  const layers = [...markup.matchAll(/<path id="Dots L(\d) [^"]*" d="([^"]+)" fill="(#[0-9A-F]{6})"\/>/g)];
  if (layers.length !== 13) throw new Error(`${name}: ожидалось 13 слоёв Shading (gray), найдено ${layers.length}`);

  const dots = [];
  const sizeSum = [0, 0, 0, 0], sizeN = [0, 0, 0, 0];
  for (const [, level, d, fill] of layers) {
    const shade = SHADES[fill];
    const base = [1, 3, 5].map((k) => parseInt(fill.slice(k, k + 2), 16));
    for (const sp of subpaths(d)) {
      // габарит в кадре Art (там точки — квадраты без поворота)
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (const [x, y] of sp.pts) {
        const px = x - ox, py = y - oy;
        const u = px * cos - py * sin, v = px * sin + py * cos;
        u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
      }
      const u = (u0 + u1) / 2, v = (v0 + v1) / 2;
      const x = ox + u * cos + v * sin, y = oy - u * sin + v * cos;
      // серый той же яркости, что итоговый цвет в макете
      const g = gradientAt(src.gradient, src.angle, src.origin, x, y);
      const mixed = base.map((c, j) => c * (1 - MULTIPLY + (MULTIPLY * g[j]) / 255));
      const gray = Math.round(0.2126 * mixed[0] + 0.7152 * mixed[1] + 0.0722 * mixed[2]);
      // монета: верхняя (последняя) из тех, в чей силуэт попадает точка, иначе ближайшая
      let coin = -1, dist = Infinity;
      for (let c = coins.length - 1; c >= 0; c--) {
        const o = outside(coins[c], u, v);
        if (o === 0 && coin < 0) { coin = c; dist = 0; }
        if (coin < 0 && o < dist) dist = o;
      }
      if (coin < 0) {
        let best = Infinity;
        coins.forEach((c, i) => { const o = outside(c, u, v); if (o < best) { best = o; coin = i; } });
      }
      const size = Math.max(u1 - u0, v1 - v0);
      sizeSum[level] += size; sizeN[level]++;
      dots.push({ x, y, u, v, level: +level, shade, gray, coin, dist, src: sp.src });
    }
  }
  const kept = dots.filter((d) => d.dist <= src.edge);
  const sizes = sizeSum.map((s, i) => +(s / sizeN[i]).toFixed(2));

  // JSON для canvas: x, y (центр в координатах SVG ×10), слой (размер), тон макета, серый, монета
  const json = {
    width: w,
    height: h,
    origin: src.origin,
    angle: src.angle,
    sizes,
    coins: coins.map((c) => [+(c.face[0] + c.face[2] / 2).toFixed(1), +(c.face[1] + c.face[3] / 2).toFixed(1)]),
    dots: kept.flatMap((d) => [Math.round(d.x * 10), Math.round(d.y * 10), d.level, d.shade, d.gray, d.coin]),
  };
  fs.writeFileSync(`src/data/hero-dots-${name}.json`, JSON.stringify(json));

  // Статичная серая картинка: те же точки и фейды, без цветного градиента
  const byGray = new Map();
  for (const d of kept) {
    if (!byGray.has(d.gray)) byGray.set(d.gray, []);
    byGray.get(d.gray).push(d.src);
  }
  const paths = [...byGray].map(([g, list]) => `<path fill="#${hex(g).repeat(3)}" d="${list.join('')}"/>`).join('');
  const defs = markup.slice(markup.indexOf('<defs>'), markup.indexOf('</defs>') + 7)
    .replace(/<linearGradient id="paint\d_linear_1_15402" x1="[-\d.]+" y1="[-\d.]+" x2="[-\d.]+" y2="[-\d.]+" gradientUnits="userSpaceOnUse">\s*<stop stop-color="#47F63B"\/>[\s\S]*?<\/linearGradient>/, '')
    .replace(/<clipPath[\s\S]*?<\/clipPath>/, '');
  let body;
  if (name === 'desktop') {
    const m0 = markup.match(/<mask id="mask0_1_15402"[\s\S]*?<\/mask>/)[0];
    const m1 = markup.match(/<mask id="mask1_1_15402"[\s\S]*?<\/mask>/)[0];
    body = `${m0}<g mask="url(#mask0_1_15402)">${m1}<g mask="url(#mask1_1_15402)"><g opacity="0.9">${paths}</g></g></g>`;
  } else {
    const fade = markup.match(/<rect id="Fade &#194;&#183; bottom"[^>]*\/>/)[0];
    body = `<g opacity="0.9">${paths}</g>${fade}`;
  }
  const out = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" fill="none" viewBox="0 0 ${w} ${h}">${body}${defs}</svg>`;
  const { data } = optimize(out, {
    multipass: true,
    floatPrecision: 2,
    plugins: [{ name: 'preset-default', params: { overrides: { cleanupIds: { minify: true } } } }],
  });
  fs.writeFileSync(`src/assets/hero/hero-${name}.svg`, data);

  const grays = kept.map((d) => d.gray);
  console.log(
    `${name}: ${kept.length} точек из ${dots.length} (за контуром отброшено ${dots.length - kept.length}), ` +
      `размеры ${sizes.join('/')}, серый ${Math.min(...grays)}…${Math.max(...grays)}, ` +
      `по монетам ${coins.map((_, i) => kept.filter((d) => d.coin === i).length).join('/')}, ` +
      `JSON ${(fs.statSync(`src/data/hero-dots-${name}.json`).size / 1024).toFixed(1)} KB, SVG ${(data.length / 1024).toFixed(1)} KB`,
  );
}
