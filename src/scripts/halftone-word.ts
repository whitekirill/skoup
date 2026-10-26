// Халфтон для слова: при наведении текст рассыпается в точки — скруглённые квадраты, как в иллюстрациях
// сайта. Размер точки — от заливки букв в клетке сетки (площадь точки ∝ заливке); пока курсор на слове,
// по точкам идёт волна размера ±25%, как в иллюстрации первого экрана. Цвет — цвет текста.
// Холст создаётся при первом наведении и рисуется, только пока эффект виден.

const PER_CHAR = 6; // клеток сетки на ширину моно-знака: сетка совпадает со знаками, одна буква — один рисунок точек
const BLUR = 0.045; // размытие букв перед замером — доля кегля: тонкие штрихи не пропадают, к краям точки мельчают
const ENTER = 260; // мс, текст → точки
const LEAVE = 220; // мс, обратно
const WAVE = 0.25;
const SAMPLE = 4; // разрешение растра букв на 1 px

const smooth = (t: number) => t * t * (3 - 2 * t);

export function halftone(word: HTMLElement, text: HTMLElement, scale: () => number) {
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let dots = new Float32Array(0); // x, y, размер, фаза
  let color = '';
  let t = 0;
  let target = 0;
  let raf = 0;
  let last = 0;

  function build() {
    const w = word.offsetWidth;
    const h = word.offsetHeight;
    const cs = getComputedStyle(text);
    const size = parseFloat(cs.fontSize);
    color = cs.color;
    const label = cs.textTransform === 'uppercase' ? text.textContent!.toUpperCase() : text.textContent!;

    // буквы — в растр, оттуда заливка каждой клетки сетки
    const raster = document.createElement('canvas');
    raster.width = Math.ceil(w * SAMPLE);
    raster.height = Math.ceil(h * SAMPLE);
    const r = raster.getContext('2d', { willReadFrequently: true })!;
    r.scale(SAMPLE, SAMPLE);
    r.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    if ('letterSpacing' in r) (r as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = cs.letterSpacing;
    r.textBaseline = 'middle';
    r.filter = `blur(${size * BLUR}px)`;
    r.fillText(label, 0, h / 2);
    const pixels = r.getImageData(0, 0, raster.width, raster.height).data;

    const cell = w / label.length / PER_CHAR;
    const list: number[] = [];
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        let sum = 0, count = 0;
        const x0 = Math.floor(x * SAMPLE), x1 = Math.min(raster.width, Math.floor((x + cell) * SAMPLE));
        const y0 = Math.floor(y * SAMPLE), y1 = Math.min(raster.height, Math.floor((y + cell) * SAMPLE));
        for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++, count++) sum += pixels[(py * raster.width + px) * 4 + 3];
        const cover = count ? sum / count / 255 : 0;
        if (cover < 0.03) continue;
        list.push(x + cell / 2, y + cell / 2, cell * 0.9 * Math.sqrt(Math.min(1, cover * 1.15)), (x - y) * 0.06);
      }
    }
    dots = new Float32Array(list);

    canvas = document.createElement('canvas');
    canvas.className = 'pile__dots';
    canvas.setAttribute('aria-hidden', 'true');
    const k = scale() * Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(w * k);
    canvas.height = Math.ceil(h * k);
    ctx = canvas.getContext('2d')!;
    ctx.scale(k, k);
    word.append(canvas);
  }

  function frame(now: number) {
    const dt = last ? now - last : 16;
    last = now;
    t = target ? Math.min(1, t + dt / ENTER) : Math.max(0, t - dt / LEAVE);
    const e = smooth(t);
    text.style.opacity = String(1 - e);
    const c = ctx!;
    c.clearRect(0, 0, word.offsetWidth, word.offsetHeight);
    c.fillStyle = color;
    c.beginPath();
    const clock = now / 1000;
    for (let i = 0; i < dots.length; i += 4) {
      const s = dots[i + 2] * e * (1 + WAVE * e * Math.sin(dots[i + 3] - clock * 3));
      if (s < 0.2) continue;
      c.roundRect(dots[i] - s / 2, dots[i + 1] - s / 2, s, s, s * 0.28);
    }
    c.fill();
    if (t > 0 || target) raf = requestAnimationFrame(frame);
    else {
      raf = 0;
      text.style.opacity = '';
    }
  }

  return {
    enter() {
      if (!canvas) build();
      target = 1;
      if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
    },
    leave() {
      target = 0;
    },
    /** раскладка сменилась (кегль, масштаб) — точки пересчитаем при следующем наведении */
    reset() {
      cancelAnimationFrame(raf);
      raf = 0;
      t = target = 0;
      text.style.opacity = '';
      canvas?.remove();
      canvas = null;
    },
  };
}
