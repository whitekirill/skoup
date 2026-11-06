// Наведение на кейсы (desktop, мышь): над обложкой системный курсор скрыт и его заменяет одна общая
// плашка «Скоро покажем». Плашка идёт за мышью на пружине, вытягивается и наклоняется по скорости,
// между соседними кейсами не гаснет, а перелетает; появляется и исчезает упругим масштабом.
// Картинка под ней медленно приближается (CSS). Motion: позиция и масштаб — springValue (пружины с инерцией:
// резкая смена направления не обрывает движение), кадры и сон, когда всё успокоилось, — цикл Motion.
// Только transform/opacity. При reduced motion и на тач-экранах — выключено (системный курсор как обычно).
import { frame, motionValue, springValue } from 'motion';

const FOLLOW = { stiffness: 3000, damping: 100 }; // за курсором: плотно, почти без перелёта
const SHOW = { stiffness: 480, damping: 32 }; // появление и исчезание: мягкая пружина
const HIDE_DELAY = 140; // мс: успеть перейти на соседний кейс и не мигнуть
const STRETCH = 0.0025; // вытягивание на px/кадр скорости
const TILT = 0.15; // наклон, градусов на px/кадр по горизонтали

export function mountCaseHover(section: HTMLElement) {
  const pill = section.querySelector<HTMLElement>('.case-cursor');
  if (!pill) return;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const motion = matchMedia('(prefers-reduced-motion: no-preference)');

  const tx = motionValue(0), ty = motionValue(0), ts = motionValue(0);
  const x = springValue(tx, FOLLOW), y = springValue(ty, FOLLOW);
  const s = springValue(ts, SHOW);
  let hideTimer = 0;

  const render = () => {
    // скорость пружины — px/с, переводим в px за кадр 60 fps, как было подобрано вытягивание
    const vx = x.getVelocity() / 60, vy = y.getVelocity() / 60;
    const speed = Math.hypot(vx, vy);
    const k = Math.min(0.25, speed * STRETCH); // вытягивание вдоль движения
    const angle = Math.atan2(vy, vx);
    const tilt = Math.max(-12, Math.min(12, vx * TILT));
    const scale = Math.max(0, s.get());
    pill.style.transform =
      `translate3d(${x.get().toFixed(1)}px, ${y.get().toFixed(1)}px, 0) translate(-50%, -50%) ` +
      `rotate(${tilt.toFixed(2)}deg) rotate(${angle}rad) scale(${(1 + k).toFixed(3)}, ${(1 - k * 0.6).toFixed(3)}) rotate(${-angle}rad) ` +
      `scale(${scale.toFixed(3)})`;
    pill.style.opacity = Math.min(1, scale * 1.5).toFixed(3);
  };
  // один пересчёт на кадр, сколько бы пружин ни сдвинулось
  const schedule = () => frame.render(render);
  [x, y, s].forEach((v) => v.on('change', schedule));

  const enabled = () => fine.matches && motion.matches;

  section.querySelectorAll<HTMLElement>('.case__media').forEach((media) => {
    media.addEventListener('pointerenter', (e) => {
      if (!enabled() || e.pointerType !== 'mouse') return;
      clearTimeout(hideTimer);
      if (s.get() < 0.05) {
        // из ниоткуда — сразу под курсором
        tx.set(e.clientX);
        ty.set(e.clientY);
        x.jump(e.clientX);
        y.jump(e.clientY);
      }
      ts.set(1);
      media.classList.add('is-hover');
    });
    media.addEventListener('pointermove', (e) => {
      if (!enabled() || e.pointerType !== 'mouse') return;
      tx.set(e.clientX);
      ty.set(e.clientY);
    });
    media.addEventListener('pointerleave', () => {
      media.classList.remove('is-hover');
      clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => ts.set(0), HIDE_DELAY);
    });
  });
}
