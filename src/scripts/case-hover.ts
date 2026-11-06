// Наведение на кейсы (desktop, мышь): над обложкой системный курсор скрыт и его заменяет одна общая
// плашка «Скоро покажем». Плашка идёт за мышью с лёгкой пружиной, вытягивается и наклоняется по скорости,
// между соседними кейсами не гаснет, а перелетает; появляется и исчезает упругим масштабом.
// Картинка под ней медленно приближается (CSS). Только transform/opacity в rAF, пока плашка жива.
// При reduced motion и на тач-экранах — выключено (системный курсор как обычно).

const FOLLOW = 0.35; // доля пути до курсора за кадр (60 fps)
const SHOW = 0.22; // скорость появления/исчезания
const HIDE_DELAY = 140; // мс: успеть перейти на соседний кейс и не мигнуть
const STRETCH = 0.0025; // вытягивание на px/кадр скорости
const TILT = 0.15; // наклон, градусов на px/кадр по горизонтали

const ease = (k: number, dt: number) => 1 - Math.pow(1 - k, dt / 16.67);

export function mountCaseHover(section: HTMLElement) {
  const pill = section.querySelector<HTMLElement>('.case-cursor');
  if (!pill) return;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const motion = matchMedia('(prefers-reduced-motion: no-preference)');

  let x = 0, y = 0, tx = 0, ty = 0;
  let s = 0, ts = 0; // масштаб появления
  let vx = 0, vy = 0;
  let raf = 0, last = 0, hideTimer = 0;

  const frame = (now: number) => {
    const dt = last ? Math.min(64, now - last) : 16.67;
    last = now;
    const px = x, py = y;
    x += (tx - x) * ease(FOLLOW, dt);
    y += (ty - y) * ease(FOLLOW, dt);
    s += (ts - s) * ease(SHOW, dt);
    vx = (x - px) * (16.67 / dt);
    vy = (y - py) * (16.67 / dt);
    const speed = Math.hypot(vx, vy);
    const k = Math.min(0.25, speed * STRETCH); // вытягивание вдоль движения
    const angle = Math.atan2(vy, vx);
    const tilt = Math.max(-12, Math.min(12, vx * TILT));
    pill.style.transform =
      `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) ` +
      `rotate(${tilt.toFixed(2)}deg) rotate(${angle}rad) scale(${(1 + k).toFixed(3)}, ${(1 - k * 0.6).toFixed(3)}) rotate(${-angle}rad) ` +
      `scale(${s.toFixed(3)})`;
    pill.style.opacity = Math.min(1, s * 1.5).toFixed(3);
    const busy = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 || Math.abs(ts - s) > 0.002 || speed > 0.05;
    raf = busy ? requestAnimationFrame(frame) : 0;
    if (!busy) last = 0;
  };
  const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };

  const enabled = () => fine.matches && motion.matches;

  section.querySelectorAll<HTMLElement>('.case__media').forEach((media) => {
    media.addEventListener('pointerenter', (e) => {
      if (!enabled() || e.pointerType !== 'mouse') return;
      clearTimeout(hideTimer);
      if (s < 0.05) { x = tx = e.clientX; y = ty = e.clientY; } // из ниоткуда — сразу под курсором
      ts = 1;
      media.classList.add('is-hover');
      wake();
    });
    media.addEventListener('pointermove', (e) => {
      if (!enabled() || e.pointerType !== 'mouse') return;
      tx = e.clientX;
      ty = e.clientY;
      wake();
    });
    media.addEventListener('pointerleave', () => {
      media.classList.remove('is-hover');
      clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => { ts = 0; wake(); }, HIDE_DELAY);
    });
  });
  // плашка привязана к окну: при скролле колесом под неподвижной мышью её не уводит
  addEventListener('scroll', () => { if (ts) wake(); }, { passive: true });
}
