// Вордмарк «СКОУП» на первом экране: при скролле уезжает вверх медленнее страницы (параллакс)
// и растворяется, а заголовок с кнопками наезжает на него. Только transform и opacity, в rAF,
// пока первый экран виден. Источник — scroll окна (его же двигает Lenis). При reduced motion — стоит.

const SPEED = 0.4; // скорость вордмарка относительно страницы
const FADE = 0.5; // доля высоты окна, за которую вордмарк гаснет полностью

export function mountHeroWordmark(hero: HTMLElement) {
  const mark = hero.querySelector<HTMLElement>('.hero__wordmark');
  if (!mark) return;
  const motion = matchMedia('(prefers-reduced-motion: no-preference)');
  let raf = 0;
  let visible = true;

  const render = () => {
    raf = 0;
    if (!motion.matches) {
      mark.style.transform = '';
      mark.style.opacity = '';
      return;
    }
    const y = Math.max(0, scrollY);
    const fade = Math.min(1, y / (innerHeight * FADE));
    // страница уносит вордмарк вверх на y, мы возвращаем (1 − SPEED)·y — он едет медленнее
    mark.style.transform = `translate3d(0, ${(y * (1 - SPEED)).toFixed(1)}px, 0)`;
    mark.style.opacity = (1 - fade).toFixed(3);
  };
  const schedule = () => {
    if (visible && !raf) raf = requestAnimationFrame(render);
  };

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    schedule();
  }).observe(hero);
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  motion.addEventListener('change', render);
  render();
}
