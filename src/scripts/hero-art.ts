// Живая иллюстрация первого экрана: халфтон-точки монет на <canvas>.
// Появление — монеты по очереди снизу вверх выезжают с лёгким поворотом и встают на место,
// точки собираются из лёгкого шума. Дальше — медленное покачивание монет вдоль диагонали,
// мягкая волна размера и отклик на курсор (точки растут и переливаются в бирюзово-синий).
// Данные — scripts/hero-dots.mjs. Фейды из макета повторены здесь: они привязаны к месту, а не к монетам.

export interface HeroDots {
  width: number;
  height: number;
  origin: [number, number];
  angle: number;
  coins: [number, number][];
  palette: [number, number, number][];
  dots: number[];
}

interface Look {
  /** прозрачность группы и фейды из макета, x/y — в координатах SVG */
  mask: (x: number, y: number) => number;
  /** амплитуды в единицах SVG */
  rise: number;
  noise: number;
  float: number;
  radius: number;
  push: number;
}

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - (1 - t) ** 4;

// Градиенты масок из SVG (hero-desktop.svg: mask #c и #e)
const desktopMask = (x: number, y: number) => {
  const tc = (y + 304) / 1363.5;
  const c = tc <= 0.7 ? 1 : 1 - clamp01((tc - 0.7) / 0.1);
  const dx = 1361.1, dy = -1445.9;
  const te = (x * dx + (y - 1059.5) * dy) / (dx * dx + dy * dy);
  const e = te <= 0.2 ? (clamp01(te) / 0.2) * 0.3 : te <= 0.4 ? 0.3 + ((te - 0.2) / 0.2) * 0.7 : 1;
  return 0.9 * c * e;
};
// hero-mobile.svg: белый фейд снизу 276…396
const mobileMask = (_x: number, y: number) => 0.9 * (1 - clamp01((y - 276) / 120));

const LOOKS: Record<'desktop' | 'mobile', Look> = {
  desktop: { mask: desktopMask, rise: 140, noise: 14, float: 5, radius: 150, push: 5 },
  mobile: { mask: mobileMask, rise: 70, noise: 7, float: 2.5, radius: 0, push: 0 },
};

// Курсор: бирюзовый (mint) в ореоле → голубой (blue-400) в центре
const MINT = [142, 238, 255];
const BLUE = [77, 180, 255];

const ENTER = { stagger: 140, duration: 1300, dotDelay: 260 };

export function mountHeroArt(canvas: HTMLCanvasElement, data: HeroDots, kind: 'desktop' | 'mobile', hoverTarget: HTMLElement | null) {
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return () => {};
  const look = LOOKS[kind];
  const rad = (data.angle * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const [ox, oy] = data.origin;

  const n = data.dots.length / 5;
  const U = new Float32Array(n), V = new Float32Array(n), S = new Float32Array(n);
  const JX = new Float32Array(n), JY = new Float32Array(n), D = new Float32Array(n);
  const C = new Uint16Array(n);
  const byCoin: number[][] = data.coins.map(() => []);
  // детерминированный шум, чтобы появление выглядело одинаково
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    U[i] = data.dots[i * 5] / 10;
    V[i] = data.dots[i * 5 + 1] / 10;
    S[i] = data.dots[i * 5 + 2] / 10;
    C[i] = data.dots[i * 5 + 3];
    const a = rnd() * Math.PI * 2, r = (0.4 + 0.6 * rnd()) * look.noise;
    JX[i] = Math.cos(a) * r;
    JY[i] = Math.sin(a) * r;
    D[i] = rnd() * ENTER.dotDelay;
    byCoin[data.dots[i * 5 + 4]].push(i);
  }
  const fills = data.palette.map(([r, g, b]) => `rgb(${r} ${g} ${b})`);
  const coins = data.coins.map(([u, v], i) => ({
    // центр монеты на экране (SVG) — ось поворота при появлении
    x: ox + u * cos + v * sin,
    y: oy - u * sin + v * cos,
    dots: byCoin[i],
    tilt: (i % 2 ? -1 : 1) * (7 + (i % 3) * 2),
    phase: i * 1.3,
  }));

  let scale = 1, dpr = 1;
  const resize = () => {
    const w = canvas.clientWidth;
    if (!w) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    scale = w / data.width;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(data.height * scale * dpr);
  };
  resize();
  const ro = new ResizeObserver(() => { resize(); if (!running) draw(performance.now()); });
  ro.observe(canvas);

  // Курсор в координатах SVG, сглаженный
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, amt: 0, on: false };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect();
    pointer.tx = (e.clientX - r.left) / scale;
    pointer.ty = (e.clientY - r.top) / scale;
    if (!pointer.on) { pointer.x = pointer.tx; pointer.y = pointer.ty; }
    pointer.on = true;
  };
  const onLeave = () => { pointer.on = false; };
  const hover = look.radius > 0 && hoverTarget && matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (hover) {
    hoverTarget.addEventListener('pointermove', onMove, { passive: true });
    hoverTarget.addEventListener('pointerleave', onLeave);
  }

  let start = -1, last = 0, raf = 0, running = false;

  function draw(now: number) {
    if (start < 0) start = now;
    const t = now - start;
    const dt = Math.min(64, now - (last || now));
    last = now;
    const k = 1 - Math.exp(-dt / 90);
    pointer.x += (pointer.tx - pointer.x) * k;
    pointer.y += (pointer.ty - pointer.y) * k;
    pointer.amt += ((pointer.on ? 1 : 0) - pointer.amt) * (1 - Math.exp(-dt / 260));

    ctx!.setTransform(1, 0, 0, 1, 0, 0);
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    const z = scale * dpr;
    const R = look.radius, R2 = R * R;
    const sec = t / 1000;

    for (let ci = 0; ci < coins.length; ci++) {
      const coin = coins[ci];
      const local = t - ci * ENTER.stagger;
      if (local <= 0) continue;
      const p = easeOut(clamp01(local / ENTER.duration));
      // поворот вокруг центра монеты + подъём снизу; в покое — покачивание вдоль диагонали
      const phi = ((coin.tilt * (1 - p)) * Math.PI) / 180;
      const pc = Math.cos(rad + phi), ps = Math.sin(rad + phi);
      const fl = look.float * Math.sin(sec * 0.9 + coin.phase) * smooth(clamp01((local - ENTER.duration * 0.6) / 1500));
      const tx = fl * cos, ty = look.rise * (1 - p) - fl * sin;
      // (u, v) → экран: x = a·u + c·v + e, y = b·u + d·v + f
      const a = pc, b = -ps, c = ps, d = pc;
      // поворот начала координат Art вокруг центра монеты
      const e0 = ox - coin.x, f0 = oy - coin.y;
      const cphi = Math.cos(phi), sphi = Math.sin(phi);
      const e = coin.x + e0 * cphi + f0 * sphi + tx;
      const f = coin.y - e0 * sphi + f0 * cphi + ty;
      ctx!.setTransform(a * z, b * z, c * z, d * z, e * z, f * z);

      // курсор в координатах монеты (матрица ортонормальная — обратная = транспонированная)
      const px = pointer.x - e, py = pointer.y - f;
      const pu = a * px + b * py, pv = c * px + d * py;
      const hoverOn = hover && pointer.amt > 0.01;

      for (const i of coin.dots) {
        const q = easeOut(clamp01((local - D[i]) / (ENTER.duration - ENTER.dotDelay * 0.5)));
        if (q <= 0) continue;
        let u = U[i] + JX[i] * (1 - q), v = V[i] + JY[i] * (1 - q);
        // волна размера бежит вдоль диагонали снизу вверх
        let s = S[i] * (0.3 + 0.7 * q) * (1 + 0.14 * Math.sin(u * 0.012 - sec * 1.4));
        let fill = fills[C[i]];
        if (hoverOn) {
          const du = u - pu, dv = v - pv, dd = du * du + dv * dv;
          if (dd < R2) {
            const dist = Math.sqrt(dd);
            const h = smooth(1 - dist / R) * pointer.amt;
            s *= 1 + 0.55 * h;
            if (dist > 0.01) { u += (du / dist) * look.push * h; v += (dv / dist) * look.push * h; }
            const [r0, g0, b0] = data.palette[C[i]];
            const m = h * 0.9;
            const tr = MINT[0] + (BLUE[0] - MINT[0]) * h, tg = MINT[1] + (BLUE[1] - MINT[1]) * h, tb = MINT[2] + (BLUE[2] - MINT[2]) * h;
            fill = `rgb(${(r0 + (tr - r0) * m) | 0} ${(g0 + (tg - g0) * m) | 0} ${(b0 + (tb - b0) * m) | 0})`;
          }
        }
        const sx = a * u + c * v + e, sy = b * u + d * v + f;
        const alpha = look.mask(sx, sy) * clamp01(q * 1.8);
        if (alpha < 0.004) continue;
        ctx!.globalAlpha = alpha;
        ctx!.fillStyle = fill;
        const hs = s / 2;
        ctx!.beginPath();
        ctx!.roundRect(u - hs, v - hs, s, s, s * 0.2);
        ctx!.fill();
      }
    }
  }

  function frame(now: number) {
    draw(now);
    raf = requestAnimationFrame(frame);
  }
  const play = () => { if (!running) { running = true; last = 0; raf = requestAnimationFrame(frame); } };
  const pause = () => { running = false; cancelAnimationFrame(raf); };

  // вне экрана — пауза; время появления не «съедается» паузой
  let pausedAt = 0;
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      if (pausedAt && start >= 0) start += performance.now() - pausedAt;
      pausedAt = 0;
      play();
    } else {
      pausedAt = performance.now();
      pause();
    }
  });
  io.observe(canvas);

  return () => {
    pause();
    io.disconnect();
    ro.disconnect();
    if (hover) {
      hoverTarget!.removeEventListener('pointermove', onMove);
      hoverTarget!.removeEventListener('pointerleave', onLeave);
    }
  };
}
