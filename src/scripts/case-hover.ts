// Наведение на кейс (desktop, мышь): картинка медленно приближается (CSS), а за курсором плывёт
// тёмная плашка-подпись — догоняет его со сглаживанием. Только transform/opacity, rAF пока курсор над обложкой.
// При reduced motion и на тач-экранах — выключено.

const FOLLOW = 0.18; // доля пути до курсора за кадр

export function mountCaseHover(section: HTMLElement) {
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const motion = matchMedia('(prefers-reduced-motion: no-preference)');
  section.querySelectorAll<HTMLElement>('.case__media').forEach((media) => {
    const cursor = media.querySelector<HTMLElement>('.case__cursor');
    if (!cursor) return;
    let x = 0, y = 0, tx = 0, ty = 0, raf = 0, inside = false;
    const frame = () => {
      x += (tx - x) * FOLLOW;
      y += (ty - y) * FOLLOW;
      cursor.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      raf = inside || Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(frame) : 0;
    };
    const point = (e: PointerEvent) => {
      const r = media.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
    };
    media.addEventListener('pointerenter', (e) => {
      if (!fine.matches || !motion.matches || e.pointerType !== 'mouse') return;
      point(e);
      x = tx; y = ty; // появляется сразу под курсором
      inside = true;
      media.classList.add('is-hover');
      if (!raf) raf = requestAnimationFrame(frame);
    });
    media.addEventListener('pointermove', (e) => { if (inside) point(e); });
    media.addEventListener('pointerleave', () => {
      inside = false;
      media.classList.remove('is-hover');
    });
  });
}
