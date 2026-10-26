// Карточки кейсов «живут» при скролле: обложка едет внутри рамки медленнее карточки,
// а карточки со ступенькой (правая колонка) чуть обгоняют соседние. Сдвиг зависит от положения
// карточки в окне: в центре экрана всё стоит ровно как в макете. Только transform, без раскладки.
// При prefers-reduced-motion ничего не двигаем.

const MEDIA_SHIFT = 4; // %, сдвиг обложки от центра до края окна (запас — scale 1.08 в CaseCard)
const DRIFT = 48; // px, обгон карточек со ступенькой; только на десктопе (на мобильном — столбик)

export function mountCaseParallax() {
  const section = document.querySelector<HTMLElement>('.cases');
  if (!section) return;
  const motion = matchMedia('(prefers-reduced-motion: no-preference)');
  const desktop = matchMedia('(min-width: 768px)');
  const cards = Array.from(section.querySelectorAll<HTMLElement>('[data-case]')).map((el) => ({
    el,
    img: el.querySelector<HTMLElement>('.case__media img')!,
    offset: el.dataset.case === 'offset',
  }));

  let raf = 0, visible = false, lastY = NaN, lastH = 0;

  function render() {
    raf = visible ? requestAnimationFrame(render) : 0;
    const vh = innerHeight;
    if (scrollY === lastY && vh === lastH) return; // страница стоит — кадр не трогаем
    lastY = scrollY;
    lastH = vh;
    const drift = desktop.matches ? DRIFT : 0;
    for (const card of cards) {
      // собственный сдвиг карточки вычитаем, чтобы он не влиял на расчёт положения
      const r = card.el.getBoundingClientRect();
      const own = card.offset ? parseFloat(card.el.style.translate.split(' ')[1] || '0') : 0;
      const center = r.top - own + r.height / 2;
      // −1 — карточка уходит вверх за край, 0 — в центре окна, 1 — входит снизу
      const p = Math.max(-1, Math.min(1, (center - vh / 2) / (vh / 2 + r.height / 2)));
      card.img.style.translate = `0 ${(-p * MEDIA_SHIFT).toFixed(3)}%`;
      if (card.offset) card.el.style.translate = `0 ${(p * drift).toFixed(2)}px`;
    }
  }

  const reset = () => {
    for (const card of cards) {
      card.img.style.translate = '';
      card.el.style.translate = '';
    }
  };

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !raf) { lastY = NaN; raf = requestAnimationFrame(render); }
  }, { rootMargin: '20% 0px' });

  const apply = () => {
    if (motion.matches) {
      section.classList.add('is-parallax');
      io.observe(section);
    } else {
      io.disconnect();
      visible = false;
      cancelAnimationFrame(raf);
      raf = 0;
      section.classList.remove('is-parallax');
      reset();
    }
  };
  motion.addEventListener('change', apply);
  desktop.addEventListener('change', () => { lastY = NaN; });
  apply();
}
