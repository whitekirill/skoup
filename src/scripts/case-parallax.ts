// Параллакс обложек кейсов: двигается только картинка внутри рамки Case media, карточка и текст стоят.
// Картинка крупнее рамки (scale 1.08 в CaseCard), рамка обрезает края. Пока карточка проходит через окно —
// от входа снизу до выхода сверху — картинка линейно смещается по Y от −24 до +24 px (mobile ±12).
// Только translate3d в requestAnimationFrame и только для карточек в зоне видимости (IntersectionObserver).
// Источник скролла — общий: события scroll окна, которые генерирует и Lenis (он двигает нативный скролл).
// При prefers-reduced-motion ничего не двигаем.

const SHIFT = { desktop: 24, mobile: 12 }; // px
const SCALE = 1.08; // scale картинки из CaseCard: transform идёт после scale, поэтому сдвиг делим на него

export function mountCaseParallax() {
  const section = document.querySelector<HTMLElement>('.cases');
  if (!section) return;
  const motion = matchMedia('(prefers-reduced-motion: no-preference)');
  const mobile = matchMedia('(max-width: 767px)');
  const cards = Array.from(section.querySelectorAll<HTMLElement>('[data-case]')).map((el) => ({
    frame: el.querySelector<HTMLElement>('.case__media')!,
    img: el.querySelector<HTMLElement>('.case__media img')!,
  }));
  const visible = new Set<(typeof cards)[number]>();
  let raf = 0;

  function render() {
    raf = 0;
    const vh = innerHeight;
    const shift = mobile.matches ? SHIFT.mobile : SHIFT.desktop;
    for (const card of visible) {
      const r = card.frame.getBoundingClientRect();
      // 0 — верх рамки у низа окна (вход), 1 — низ рамки у верха окна (выход)
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      card.img.style.transform = `translate3d(0, ${(((p * 2 - 1) * shift) / SCALE).toFixed(2)}px, 0)`;
    }
  }
  const schedule = () => {
    if (!raf && visible.size) raf = requestAnimationFrame(render);
  };

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const card = cards.find((c) => c.frame === entry.target);
      if (!card) continue;
      if (entry.isIntersecting) visible.add(card);
      else visible.delete(card);
    }
    schedule();
  }, { rootMargin: '20% 0px' }); // считаем заранее, чтобы картинка входила в окно уже на месте

  const apply = () => {
    if (motion.matches) {
      section.classList.add('is-parallax');
      cards.forEach((c) => io.observe(c.frame));
      addEventListener('scroll', schedule, { passive: true });
      addEventListener('resize', schedule);
    } else {
      io.disconnect();
      visible.clear();
      removeEventListener('scroll', schedule);
      removeEventListener('resize', schedule);
      section.classList.remove('is-parallax');
      cards.forEach((c) => (c.img.style.transform = ''));
    }
  };
  motion.addEventListener('change', apply);
  apply();
}
