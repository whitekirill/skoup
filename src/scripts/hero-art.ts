// Живая иллюстрация первого экрана: точки монет из макета (scripts/hero-dots.mjs) на WebGL2,
// один инстанс-вызов на кадр, все буферы выделены заранее — в кадре ничего не аллоцируется.
//
// В покое — серая, как статичная картинка; монеты плывут по диагонали, по точкам идёт волна размера.
// Загрузка — точки собираются в силуэт за ~1,2 с.
// Курсор/касание: точки в радиусе отталкиваются и растут (пружина с лёгким перелётом), окрашиваются
// живым градиентом и гаснут за ~800 мс; вся иллюстрация слегка подкрашивается; за быстрым курсором
// тянется шлейф, от точки входа расходится волна. Фейды из макета привязаны к месту, а не к монетам.

export interface HeroDots {
  width: number;
  height: number;
  origin: [number, number];
  angle: number;
  sizes: number[];
  coins: [number, number][];
  /** x·10, y·10 (центр, координаты SVG), слой (размер), тон макета 0…3, серый, монета */
  dots: number[];
}

type Kind = 'desktop' | 'mobile';

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - (1 - t) ** 3;

// Фейды из макета (desktop: маски «Fade · bottom» и «Fade · start», mobile: белый фейд снизу) + opacity 0.9
function maskDesktop(x: number, y: number) {
  const tb = (y + 304) / 1363.55;
  const b = tb <= 0.650306 ? 1 : 1 - clamp01((tb - 0.650306) / (0.814583 - 0.650306));
  const dx = 1361.06, dy = -1445.927;
  const ts = (x * dx + (y - 1059.55) * dy) / (dx * dx + dy * dy);
  const s = ts <= 0 ? 0 : ts <= 0.22 ? (ts / 0.22) * 0.35 : ts <= 0.42 ? 0.35 + ((ts - 0.22) / 0.2) * 0.65 : 1;
  return 0.9 * b * s;
}
const maskMobile = (_x: number, y: number) => 0.9 * (1 - clamp01((y - 276) / 120));

// Цвет при наведении — градиент иконки 411:11739, тени — для тёмных тонов
const FLOW = [0x26ff9b, 0x17ffc2, 0x5cffb4, 0x95ffdf].map((c) => [(c >> 16) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255]);
const SHADOW = [0x01916a, 0x16c78b].map((c) => [(c >> 16) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255]);

const CFG = {
  desktop: { mask: maskDesktop, radius: 180, rise: 50, noise: 36, float: 6 },
  mobile: { mask: maskMobile, radius: 110, rise: 24, noise: 16, float: 3 },
};

const ASSEMBLE = { stagger: 70, duration: 850, dotDelay: 120 };
const SPRING = { k: 180, c: 2 * 0.55 * Math.sqrt(180) }; // ζ = 0.55 — лёгкий перелёт
const TRAIL = 10, TRAIL_LIFE = 0.32;
const SCROLL_IDLE = 150;
const WAVES = 3, WAVE_LIFE = 1.1, WAVE_SPEED = 520, WAVE_WIDTH = 70;

const VERT = `#version 300 es
in vec2 a_corner;
in vec4 a_geo;
in vec4 a_col;
uniform vec2 u_view;
uniform float u_px;
out vec2 v_local;
out float v_half;
out vec4 v_col;
void main() {
  float h = a_geo.z * 0.5;
  vec2 l = a_corner * (h + 1.0 / u_px);
  float c = cos(a_geo.w), s = sin(a_geo.w);
  vec2 p = a_geo.xy + vec2(l.x * c + l.y * s, -l.x * s + l.y * c);
  gl_Position = vec4(p.x / u_view.x * 2.0 - 1.0, 1.0 - p.y / u_view.y * 2.0, 0.0, 1.0);
  v_local = l;
  v_half = h;
  v_col = a_col;
}`;

// Скруглённый квадрат (радиус 0.28 стороны — как в точках макета), сглаживание по SDF
const FRAG = `#version 300 es
precision highp float;
in vec2 v_local;
in float v_half;
in vec4 v_col;
uniform float u_px;
out vec4 o;
void main() {
  float r = v_half * 0.56;
  vec2 q = abs(v_local) - vec2(v_half - r);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  float a = clamp(0.5 - d * u_px, 0.0, 1.0) * v_col.a;
  o = vec4(v_col.rgb * a, a);
}`;

function compile(gl: WebGL2RenderingContext) {
  const prog = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]] as const) {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    gl.attachShader(prog, sh);
  }
  gl.linkProgram(prog);
  return gl.getProgramParameter(prog, gl.LINK_STATUS) ? prog : null;
}

/** Возвращает функцию остановки или null, если нет WebGL2 с аппаратным ускорением (остаётся статичная картинка). */
export function mountHeroArt(canvas: HTMLCanvasElement, data: HeroDots, kind: Kind, target: HTMLElement, onLost: () => void) {
  // Без аппаратного ускорения (программный WebGL) анимация грузит процессор — остаётся статичная картинка
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true, alpha: true, failIfMajorPerformanceCaveat: true });
  if (!gl) return null;
  // программный рендер (SwiftShader, llvmpipe) флаг выше пропускает — проверяем по имени
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  if (info && /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))) return null;
  const prog = compile(gl);
  if (!prog) return null;
  const cfg = CFG[kind];
  const rad = (data.angle * Math.PI) / 180;
  const dirX = Math.cos(rad), dirY = -Math.sin(rad); // диагональ монет на экране

  // --- данные точек
  const n = data.dots.length / 6;
  const X0 = new Float32Array(n), Y0 = new Float32Array(n), S = new Float32Array(n), G = new Float32Array(n);
  const SH = new Uint8Array(n), CO = new Uint8Array(n);
  const JX = new Float32Array(n), JY = new Float32Array(n), DL = new Float32Array(n), PR = new Float32Array(n);
  const OX = new Float32Array(n), OY = new Float32Array(n), VX = new Float32Array(n), VY = new Float32Array(n);
  const SC = new Float32Array(n).fill(1), SV = new Float32Array(n), HEAT = new Float32Array(n);
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const k = i * 6;
    X0[i] = data.dots[k] / 10;
    Y0[i] = data.dots[k + 1] / 10;
    S[i] = data.sizes[data.dots[k + 2]];
    SH[i] = data.dots[k + 3];
    G[i] = data.dots[k + 4] / 255;
    CO[i] = data.dots[k + 5];
    const a = rnd() * Math.PI * 2, r = (0.3 + 0.7 * rnd()) * cfg.noise;
    JX[i] = Math.cos(a) * r;
    JY[i] = Math.sin(a) * r;
    DL[i] = rnd() * ASSEMBLE.dotDelay;
    PR[i] = X0[i] * dirX + Y0[i] * dirY; // проекция на диагональ — фаза волны и градиента
  }
  const [ox, oy] = data.origin;
  const cosA = Math.cos(rad), sinA = Math.sin(rad);
  const coins = data.coins.map(([u, v], i) => ({
    x: ox + u * cosA + v * sinA,
    y: oy - u * sinA + v * cosA,
    tilt: ((i % 2 ? -1 : 1) * (5 + (i % 3)) * Math.PI) / 180,
    phase: i * 1.3,
    // покадровое состояние монеты
    c: 1, s: 0, tx: 0, ty: 0, p: 0, local: 0,
  }));

  // --- GPU
  const inst = new Float32Array(n * 8);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const aCorner = gl.getAttribLocation(prog, 'a_corner');
  gl.enableVertexAttribArray(aCorner);
  gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, inst.byteLength, gl.DYNAMIC_DRAW);
  for (const [name, off] of [['a_geo', 0], ['a_col', 16]] as const) {
    const loc = gl.getAttribLocation(prog, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 32, off);
    gl.vertexAttribDivisor(loc, 1);
  }
  gl.useProgram(prog);
  const uView = gl.getUniformLocation(prog, 'u_view');
  const uPx = gl.getUniformLocation(prog, 'u_px');
  gl.uniform2f(uView, data.width, data.height);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  let scale = 1;
  const resize = () => {
    const w = canvas.clientWidth;
    if (!w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    scale = w / data.width;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(data.height * scale * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uPx, scale * dpr);
  };
  resize();
  const ro = new ResizeObserver(() => { resize(); if (!running) frame(performance.now()); });
  ro.observe(canvas);

  // --- ввод: координаты в единицах SVG
  const ptr = { x: 0, y: 0, px: 0, py: 0, on: false, amt: 0, lastT: 0 };
  // мышь: последние координаты в окне (null — вне окна). Попадание в иллюстрацию считается
  // в каждом кадре — колесо двигает страницу под неподвижным курсором без pointermove
  let mouse: { x: number; y: number } | null = null;
  const trail = new Float32Array(TRAIL * 4); // x, y, время, сила
  let trailHead = 0;
  const waves = new Float32Array(WAVES * 3); // x, y, время (−1 — свободна)
  for (let i = 0; i < WAVES; i++) waves[i * 3 + 2] = -1;
  let waveHead = 0;
  let clock = 0; // секунды с начала

  const toLocal = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    return x >= 0 && y >= 0 && x <= r.width && y <= r.height ? [x / scale, y / scale] : null;
  };
  const enter = (x: number, y: number) => {
    ptr.on = true;
    ptr.x = ptr.px = x;
    ptr.y = ptr.py = y;
    waves[waveHead * 3] = x;
    waves[waveHead * 3 + 1] = y;
    waves[waveHead * 3 + 2] = clock;
    waveHead = (waveHead + 1) % WAVES;
  };
  const point = (p: number[] | null) => {
    if (!p) ptr.on = false;
    else if (!ptr.on) enter(p[0], p[1]);
    else { ptr.x = p[0]; ptr.y = p[1]; }
  };
  const onMouse = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') mouse = { x: e.clientX, y: e.clientY };
  };
  const onMouseOut = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && !e.relatedTarget) mouse = null; // ушла за пределы окна
  };
  // касание: только пока палец на иллюстрации
  const onMove = (e: PointerEvent) => { if (e.pointerType !== 'mouse') point(toLocal(e)); };
  const onUp = (e: PointerEvent) => { if (e.pointerType !== 'mouse') ptr.on = false; };
  addEventListener('pointermove', onMouse, { passive: true });
  document.addEventListener('pointerout', onMouseOut, { passive: true });
  target.addEventListener('pointermove', onMove, { passive: true });
  target.addEventListener('pointerdown', onMove, { passive: true });
  target.addEventListener('pointerup', onUp, { passive: true });
  target.addEventListener('pointercancel', onUp, { passive: true });

  const onContextLost = (e: Event) => { e.preventDefault(); stop(); onLost(); };
  canvas.addEventListener('webglcontextlost', onContextLost);

  // --- кадр
  let start = -1, last = 0, raf = 0, running = false, pausedAt = 0;
  const R = () => cfg.radius / scale;
  let mouseWas = false;
  const followMouse = () => {
    if (mouse) point(toLocal({ clientX: mouse.x, clientY: mouse.y } as PointerEvent));
    else if (mouseWas) ptr.on = false;
    mouseWas = !!mouse;
  };
  // курсор рядом с точками (в радиусе разлёта) — а не над пустой частью холста или заголовком
  const nearDots = () => {
    if (!ptr.on) return false;
    const r = R() * 1.2, r2 = r * r;
    for (let i = 0; i < n; i++) {
      const dx = X0[i] - ptr.x, dy = Y0[i] - ptr.y;
      if (dx * dx + dy * dy < r2) return true;
    }
    return false;
  };
  // энергия пружин в прошлом кадре — пока точки не успокоились, иллюстрация «занята»
  let energy = 0;

  function frame(now: number) {
    if (start < 0) start = now;
    const t = now - start;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    clock = t / 1000;

    // курсор: присутствие и шлейф по скорости
    ptr.amt += ((ptr.on ? 1 : 0) - ptr.amt) * (1 - Math.exp(-dt / (ptr.on ? 0.25 : 0.27)));
    if (ptr.on) {
      const speed = Math.hypot(ptr.x - ptr.px, ptr.y - ptr.py) / dt;
      if (speed > 700 / scale) {
        const k = trailHead * 4;
        trail[k] = ptr.x; trail[k + 1] = ptr.y; trail[k + 2] = clock;
        trail[k + 3] = Math.min(1, (speed * scale - 700) / 1600);
        trailHead = (trailHead + 1) % TRAIL;
      }
    }
    ptr.px = ptr.x;
    ptr.py = ptr.y;

    for (let c = 0; c < coins.length; c++) {
      const coin = coins[c];
      coin.local = t - c * ASSEMBLE.stagger;
      coin.p = easeOut(clamp01(coin.local / ASSEMBLE.duration));
      const phi = coin.tilt * (1 - coin.p);
      coin.c = Math.cos(phi);
      coin.s = Math.sin(phi);
      const fl = cfg.float * Math.sin(clock * 0.7 + coin.phase) * smooth(clamp01((coin.local - ASSEMBLE.duration) / 1200));
      coin.tx = fl * dirX;
      coin.ty = cfg.rise * (1 - coin.p) + fl * dirY;
    }

    const radius = R(), r2 = radius * radius;
    const pushMin = 24 / scale, pushMax = 40 / scale;
    const flowT = clock / 7;
    const hOn = 1 - Math.exp(-dt / 0.12), hOff = Math.exp(-dt / 0.27);
    const tintFar = 450 / scale;

    energy = 0;
    for (let i = 0; i < n; i++) {
      const coin = coins[CO[i]];
      const q = easeOut(clamp01((coin.local - DL[i]) / (ASSEMBLE.duration - ASSEMBLE.dotDelay)));
      // положение в покое с поворотом монеты вокруг её центра и шумом сборки
      const rx = X0[i] - coin.x, ry = Y0[i] - coin.y;
      const bx = coin.x + rx * coin.c + ry * coin.s + coin.tx + JX[i] * (1 - q);
      const by = coin.y - rx * coin.s + ry * coin.c + coin.ty + JY[i] * (1 - q);

      let tx = 0, ty = 0, ts = 1, heat = 0, tint = 0;
      if (ptr.amt > 0.001) {
        const dx = bx - ptr.x, dy = by - ptr.y, dd = dx * dx + dy * dy;
        const d = Math.sqrt(dd);
        tint = ptr.amt * (0.1 + 0.05 * Math.exp(-d / tintFar));
        if (ptr.on && dd < r2 && d > 0.001) {
          const f = 1 - d / radius, e = smooth(f);
          const m = (pushMin + (pushMax - pushMin) * e) * smooth(clamp01(f / 0.3));
          tx += (dx / d) * m;
          ty += (dy / d) * m;
          ts += 0.6 * e;
          heat = e;
        }
      }
      for (let j = 0; j < TRAIL; j++) {
        const k = j * 4, age = clock - trail[k + 2];
        if (age < 0 || age > TRAIL_LIFE) continue;
        const dx = bx - trail[k], dy = by - trail[k + 1], d = Math.hypot(dx, dy), rt = radius * 0.5;
        if (d >= rt || d < 0.001) continue;
        const e = smooth(1 - d / rt) * trail[k + 3] * (1 - age / TRAIL_LIFE);
        tx += (dx / d) * e * pushMin * 0.6;
        ty += (dy / d) * e * pushMin * 0.6;
        ts += 0.3 * e;
        if (e > heat) heat = e;
      }
      for (let j = 0; j < WAVES; j++) {
        const k = j * 3, age = clock - waves[k + 2];
        if (waves[k + 2] < 0 || age > WAVE_LIFE) continue;
        const dx = bx - waves[k], dy = by - waves[k + 1], d = Math.hypot(dx, dy);
        const band = 1 - Math.abs(d - (WAVE_SPEED / scale) * age) / (WAVE_WIDTH / scale);
        if (band <= 0 || d < 0.001) continue;
        const e = smooth(band) * (1 - age / WAVE_LIFE);
        tx += (dx / d) * e * pushMin * 0.5;
        ty += (dy / d) * e * pushMin * 0.5;
        ts += 0.3 * e;
        if (e * 0.6 > heat) heat = e * 0.6;
      }

      energy += Math.abs(VX[i]) + Math.abs(VY[i]) + Math.abs(SV[i]) * 40;
      // пружины смещения и размера
      VX[i] += (SPRING.k * (tx - OX[i]) - SPRING.c * VX[i]) * dt;
      VY[i] += (SPRING.k * (ty - OY[i]) - SPRING.c * VY[i]) * dt;
      SV[i] += (SPRING.k * (ts - SC[i]) - SPRING.c * SV[i]) * dt;
      OX[i] += VX[i] * dt;
      OY[i] += VY[i] * dt;
      SC[i] += SV[i] * dt;
      HEAT[i] = heat > HEAT[i] ? HEAT[i] + (heat - HEAT[i]) * hOn : HEAT[i] * hOff;

      const x = bx + OX[i], y = by + OY[i];
      const wave = 1 + 0.25 * Math.sin(PR[i] * 0.011 - clock * 1.3);
      const mix = HEAT[i] > tint ? HEAT[i] : tint;

      // цвет: серый → живой градиент (тени — для тёмных тонов)
      let cr = G[i], cg = G[i], cb = G[i];
      if (mix > 0.002) {
        let pr: number, pg: number, pb: number;
        if (SH[i] < 2) {
          const A = SHADOW[SH[i]];
          pr = A[0];
          pg = A[1];
          pb = A[2];
        } else {
          let f = PR[i] / 700 + flowT;
          f = (f - Math.floor(f)) * 4;
          const a = f | 0, w = f - a, A = FLOW[a], B = FLOW[(a + 1) & 3];
          pr = A[0] + (B[0] - A[0]) * w;
          pg = A[1] + (B[1] - A[1]) * w;
          pb = A[2] + (B[2] - A[2]) * w;
        }
        cr += (pr - cr) * mix;
        cg += (pg - cg) * mix;
        cb += (pb - cb) * mix;
      }

      const k = i * 8;
      inst[k] = x;
      inst[k + 1] = y;
      inst[k + 2] = S[i] * q * wave * SC[i];
      inst[k + 3] = rad + Math.atan2(coin.s, coin.c);
      inst[k + 4] = cr;
      inst[k + 5] = cg;
      inst[k + 6] = cb;
      inst[k + 7] = cfg.mask(x, y) * clamp01(q * 1.6);
    }

    gl!.clearColor(0, 0, 0, 0);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buf);
    gl!.bufferSubData(gl!.ARRAY_BUFFER, 0, inst);
    gl!.drawArraysInstanced(gl!.TRIANGLE_STRIP, 0, 4, n);
  }

  // Пока страница прокручивается, спокойную иллюстрацию не перерисовываем: GPU отдаём скроллу,
  // кадр держится последний. Через SCROLL_IDLE мс после остановки анимация продолжается с того же
  // места. Если курсор над иллюстрацией или точки ещё не вернулись на место — рисуем как обычно,
  // иначе разлёт застывает на полпути. Сборку при загрузке не прерываем.
  let scrollIdleAt = 0, frozenAt = 0;
  const onScroll = () => { scrollIdleAt = performance.now() + SCROLL_IDLE; };
  addEventListener('scroll', onScroll, { passive: true });

  // Если устройство не тянет (первые кадры дольше 24 мс), возвращаем статичную картинку
  let probed = 0, slow = 0;
  function loop(now: number) {
    const assembled = start >= 0 && now - start > ASSEMBLE.stagger * coins.length + ASSEMBLE.duration;
    followMouse();
    const hold = now < scrollIdleAt && !(energy > n * 0.05 || nearDots());
    // под открытым брифом иллюстрацию не видно — не рисуем
    if (assembled && (hold || document.documentElement.classList.contains('is-brief-open'))) {
      if (!frozenAt) frozenAt = now;
      raf = requestAnimationFrame(loop);
      return;
    }
    if (frozenAt) {
      start += now - frozenAt;
      last = 0;
      frozenAt = 0;
    }
    const t0 = performance.now();
    frame(now);
    if (probed < 60) {
      probed++;
      if (performance.now() - t0 > 24 && ++slow >= 8) { stop(); onLost(); return; }
    }
    raf = requestAnimationFrame(loop);
  }
  const play = () => {
    if (running) return;
    running = true;
    if (pausedAt && start >= 0) start += performance.now() - pausedAt;
    pausedAt = 0;
    last = 0;
    raf = requestAnimationFrame(loop);
  };
  const pause = () => {
    if (!running) return;
    running = false;
    pausedAt = performance.now();
    if (frozenAt) { start += pausedAt - frozenAt; frozenAt = 0; }
    cancelAnimationFrame(raf);
  };
  // вне экрана — пауза
  const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? play() : pause()));
  io.observe(canvas);

  function stop() {
    pause();
    io.disconnect();
    ro.disconnect();
    removeEventListener('pointermove', onMouse);
    document.removeEventListener('pointerout', onMouseOut);
    target.removeEventListener('pointermove', onMove);
    target.removeEventListener('pointerdown', onMove);
    target.removeEventListener('pointerup', onUp);
    target.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    removeEventListener('scroll', onScroll);
  }
  return stop;
}
