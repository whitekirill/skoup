// Прокрутка страницы — нативная (колесо, тачпад, тач — как в системе, без инерции поверх).
// Плавные только переходы по якорным ссылкам: нативный scrollTo({ behavior: 'smooth' }),
// при prefers-reduced-motion — мгновенные. Переход по ссылке из открытого брифа начинается после его закрытия.
const motion = matchMedia('(prefers-reduced-motion: no-preference)');
const root = document.documentElement;
const overlayOpen = () => root.classList.contains('is-brief-open');

/** Прокрутить страницу к y: плавно (если не reduced motion) или сразу */
export function scrollPageTo(y: number, smooth = true) {
  scrollTo({ top: y, behavior: smooth && motion.matches ? 'smooth' : 'instant' });
}

document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
  const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
  const hash = link?.getAttribute('href');
  if (!hash || hash === '#') return;
  const target = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!target) return;
  event.preventDefault();

  const go = () => {
    const y = target.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(target).scrollMarginTop || '0');
    scrollPageTo(y);
  };
  // Бриф закрывается своим обработчиком раньше, а класс на html снимается по событию close
  const overlay = link!.closest('dialog');
  if (overlay && overlayOpen()) overlay.addEventListener('close', () => requestAnimationFrame(go), { once: true });
  else go();
});
