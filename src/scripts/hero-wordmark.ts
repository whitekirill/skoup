// Вордмарк «СКОУП» на первом экране: при скролле уезжает вверх медленнее страницы (параллакс)
// и растворяется за полэкрана, а заголовок с кнопками наезжает на него. Только transform и opacity.
// Motion: обе анимации привязаны к прокрутке через scroll() с целью — первым экраном: от его верха у верха
// окна до низа у верха окна. Где браузер умеет ViewTimeline, их ведёт сам браузер по нативной прокрутке
// (её же двигает Lenis), без JS в каждом кадре. При reduced motion — стоит.
import { animateMini, scroll } from 'motion';

const SPEED = 0.4; // скорость вордмарка относительно страницы
const FADE = 0.5; // доля высоты окна, за которую вордмарк гаснет полностью

export function mountHeroWordmark(hero: HTMLElement) {
  const mark = hero.querySelector<HTMLElement>('.hero__wordmark');
  if (!mark) return;
  const motion = matchMedia('(prefers-reduced-motion: no-preference)');
  let stop: VoidFunction | undefined;
  let size = '';

  const apply = () => {
    // пересобираем только когда поменялись высота первого экрана или окна (на мобильном resize при скролле)
    const key = motion.matches ? `${hero.offsetHeight}x${innerHeight}` : '';
    if (key === size) return;
    size = key;
    stop?.();
    stop = undefined;
    if (!motion.matches) return;
    // за всю высоту первого экрана H страница уносит вордмарк на H, мы возвращаем (1 − SPEED)·H
    const h = hero.offsetHeight;
    const fade = Math.min(1, (innerHeight * FADE) / h);
    const animation = animateMini(
      mark,
      {
        transform: ['translate3d(0, 0px, 0)', `translate3d(0, ${(h * (1 - SPEED)).toFixed(1)}px, 0)`],
        opacity: [1, 0, 0],
      },
      { ease: 'linear', opacity: { ease: 'linear', times: [0, fade, 1] } },
    );
    const detach = scroll(animation, { target: hero, offset: ['start start', 'end start'] });
    stop = () => {
      detach();
      animation.cancel();
    };
  };
  motion.addEventListener('change', apply);
  addEventListener('resize', apply);
  apply();
}
