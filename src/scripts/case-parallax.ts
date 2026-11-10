// Параллакс обложек кейсов: двигается только картинка внутри рамки Case media, карточка и текст стоят.
// Картинка крупнее рамки (scale 1.08 в CaseCard), рамка обрезает края. Пока карточка проходит через окно —
// от входа снизу до выхода сверху — картинка линейно смещается по Y от −24 до +24 px (mobile ±12).
// Motion: анимация transform привязана к прокрутке через scroll() с целью-рамкой. Где браузер умеет
// ViewTimeline (Chrome, Safari 26), её ведёт сам браузер по нативной прокрутке, без JS в каждом кадре;
// в остальных Motion считает прогресс сам, один раз за кадр для всех карточек. Источник — прокрутка
// окна, так что картинка и страница не расходятся ни на кадр.
// При prefers-reduced-motion ничего не двигаем.
import { animateMini, scroll } from 'motion';

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
  let stops: VoidFunction[] = [];

  const apply = () => {
    stops.forEach((stop) => stop());
    stops = [];
    section.classList.toggle('is-parallax', motion.matches);
    if (!motion.matches) return;
    const d = (mobile.matches ? SHIFT.mobile : SHIFT.desktop) / SCALE;
    for (const { frame, img } of cards) {
      const animation = animateMini(img, { transform: [`translate3d(0, ${-d}px, 0)`, `translate3d(0, ${d}px, 0)`] }, { ease: 'linear' });
      // 'start end' — верх рамки у низа окна (вход), 'end start' — низ рамки у верха окна (выход)
      const detach = scroll(animation, { target: frame, offset: ['start end', 'end start'] });
      stops.push(() => {
        detach();
        animation.cancel();
      });
    }
  };
  motion.addEventListener('change', apply);
  mobile.addEventListener('change', apply);
  apply();
}
