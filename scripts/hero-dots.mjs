// Извлекает точки халфтон-иллюстрации первого экрана из SVG (экспорт из Figma) для canvas-анимации.
// SVG растеризуется в Chromium в 4x без внешних масок-фейдов (их повторяет код: фейды привязаны
// к месту, а монеты при анимации двигаются). Каждая точка — связная область; берём центр, площадь
// и цвет. Координаты переводятся в систему кадра «Art» из Figma (там точки — квадраты без поворота),
// и каждая точка привязывается к монете по силуэтам монет из того же кадра (Coin 1…5, Face + Body).
// Запуск: node scripts/hero-dots.mjs → src/data/hero-dots-{desktop,mobile}.json
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import fs from 'node:fs';

const SCALE = 4;

// Кадр Art в координатах SVG: начало и поворот (Figma: «Hero illustration · Монеты ₽» → Fade → Art).
// Монеты — верхняя грань (Face) и габарит тела (Body) в координатах Art, из get_metadata.
const sources = {
  desktop: {
    svg: 'src/assets/hero/hero-desktop.svg',
    strip: [' mask="url(#c)"', ' mask="url(#e)"', ' opacity=".9"'],
    origin: [58.2, 235.1],
    angle: 30,
    coins: [
      { face: [-12.517, 510.395, 409.863, 409.863], body: [-12.52, 475.342, 427.392, 440.221] },
      { face: [195.571, 409.824, 449.273, 281.566], body: [195.571, 434.701, 444.77, 461.314] },
      { face: [479.035, 303.19, 350.811, 482.795], body: [479.035, 385.821, 318.224, 428.511] },
      { face: [548.426, 367.672, 279.048, 530.723], body: [501.921, 237.648, 438.081, 465.091] },
      { face: [647.898, 127.191, 409.863, 409.863], body: [647.897, 92.14, 427.39, 440.219] },
    ],
  },
  mobile: {
    svg: 'src/assets/hero/hero-mobile.svg',
    strip: [' opacity=".9"', '<path fill="url(#d)" d="M0 276h393v120H0z"/>'],
    origin: [-98, -70.4],
    angle: 2.4,
    coins: [
      { face: [-6.867, 279.997, 171.311, 171.311], body: [-6.868, 260.768, 172.115, 190.524] },
      { face: [107.288, 224.825, 157.847, 229.987], body: [107.29, 238.472, 177.488, 201.23] },
      { face: [262.793, 166.326, 47.77, 323.889], body: [262.793, 211.657, 76.925, 235.19] },
      { face: [300.861, 201.701, 138.453, 263.324], body: [275.351, 130.372, 169.371, 208.132] },
      { face: [355.429, 69.775, 171.311, 171.311], body: [355.43, 50.548, 172.115, 190.522] },
    ],
  },
};

// Тело монеты = верхняя грань, протянутая до габарита Body. Возвращает вектор протяжки.
function sweep({ face: [fx, fy, fw, fh], body: [bx, by, bw, bh] }) {
  const dx = bx < fx - 0.5 ? bx - fx : bx + bw - (fx + fw);
  const dy = by < fy - 0.5 ? by - fy : by + bh - (fy + fh);
  return [dx, dy];
}

function insideCoin(coin, u, v, pad = 0) {
  const [fx, fy, fw, fh] = coin.face;
  const [dx, dy] = coin.sweep;
  const rx = fw / 2 + pad, ry = fh / 2 + pad;
  for (let t = 0; t <= 1; t += 1 / 16) {
    const cx = fx + fw / 2 + dx * t, cy = fy + fh / 2 + dy * t;
    if (((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1) return true;
  }
  return false;
}

const browser = await chromium.launch();
for (const [name, src] of Object.entries(sources)) {
  let markup = fs.readFileSync(src.svg, 'utf8');
  for (const s of src.strip) {
    if (!markup.includes(s)) throw new Error(`${name}: нет фрагмента ${s}`);
    markup = markup.replace(s, '');
  }
  const [, w, h] = markup.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
  const page = await browser.newPage({ viewport: { width: Math.ceil(w), height: Math.ceil(h) }, deviceScaleFactor: SCALE });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${markup}`);
  const png = PNG.sync.read(await page.screenshot({ omitBackground: true }));
  await page.close();

  const { width, height, data } = png;
  const seen = new Uint8Array(width * height);
  const stack = [];
  const raw = [];
  for (let start = 0; start < width * height; start++) {
    if (seen[start] || data[start * 4 + 3] < 8) continue;
    let sa = 0, sx = 0, sy = 0, sr = 0, sg = 0, sb = 0, n = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      const x = i % width, y = (i / width) | 0;
      const a = data[i * 4 + 3] / 255;
      n++;
      sa += a; sx += (x + 0.5) * a; sy += (y + 0.5) * a;
      sr += data[i * 4] * a; sg += data[i * 4 + 1] * a; sb += data[i * 4 + 2] * a;
      if (x > 0) visit(i - 1);
      if (x < width - 1) visit(i + 1);
      if (y > 0) visit(i - width);
      if (y < height - 1) visit(i + width);
    }
    raw.push({ x: sx / sa / SCALE, y: sy / sa / SCALE, area: sa / SCALE ** 2, n, r: sr / sa, g: sg / sa, b: sb / sa });
  }
  function visit(j) {
    if (seen[j] || data[j * 4 + 3] < 8) return;
    seen[j] = 1;
    stack.push(j);
  }

  // Точки, обрезанные краем SVG, отбрасываем: в покое их не видно, а в движении они были бы обрубками
  const dots = raw.filter((d) => d.area > 0.15 && d.x > 1 && d.y > 1 && d.x < w - 1 && d.y < h - 1);

  const rad = (src.angle * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const [ox, oy] = src.origin;
  const coins = src.coins.map((c) => ({ ...c, sweep: sweep(c) }));
  for (const d of dots) {
    // SVG → Art: x = ox + u·cos + v·sin, y = oy − u·sin + v·cos
    const px = d.x - ox, py = d.y - oy;
    d.u = px * cos - py * sin;
    d.v = px * sin + py * cos;
    d.s = Math.sqrt(d.area);
    // верхняя монета (позже в слоях) перекрывает нижние
    d.coin = -1;
    for (const pad of [0, 12, 30, 80]) {
      for (let c = coins.length - 1; c >= 0 && d.coin < 0; c--) if (insideCoin(coins[c], d.u, d.v, pad)) d.coin = c;
      if (d.coin >= 0) break;
    }
    if (d.coin < 0) {
      let best = Infinity;
      coins.forEach((c, i) => {
        const dd = (c.face[0] + c.face[2] / 2 - d.u) ** 2 + (c.face[1] + c.face[3] / 2 - d.v) ** 2;
        if (dd < best) { best = dd; d.coin = i; }
      });
    }
  }

  const palette = [];
  const key = new Map();
  const out = [];
  for (const d of dots) {
    const rgb = [Math.round(d.r), Math.round(d.g), Math.round(d.b)];
    const k = rgb.join();
    if (!key.has(k)) { key.set(k, palette.length); palette.push(rgb); }
    out.push(Math.round(d.u * 10), Math.round(d.v * 10), Math.round(d.s * 10), key.get(k), d.coin);
  }
  const json = {
    width: w,
    height: h,
    origin: src.origin,
    angle: src.angle,
    // центр верхней грани каждой монеты (Art) — ось поворота при появлении
    coins: coins.map((c) => [+(c.face[0] + c.face[2] / 2).toFixed(1), +(c.face[1] + c.face[3] / 2).toFixed(1)]),
    palette,
    dots: out,
  };
  const file = `src/data/hero-dots-${name}.json`;
  fs.writeFileSync(file, JSON.stringify(json));
  const sizes = dots.map((d) => d.s).sort((a, b) => a - b);
  const perCoin = coins.map((_, i) => dots.filter((d) => d.coin === i).length);
  console.log(
    `${name}: ${dots.length} точек (отброшено ${raw.length - dots.length}), ${palette.length} цветов, ` +
      `сторона ${sizes[0].toFixed(1)}…${sizes.at(-1).toFixed(1)} (медиана ${sizes[sizes.length >> 1].toFixed(1)}), ` +
      `по монетам ${perCoin.join('/')}, ${(fs.statSync(file).size / 1024).toFixed(1)} KB`,
  );
}
await browser.close();
