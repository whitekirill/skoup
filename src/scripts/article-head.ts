// Всплывающая шапка статьи: на первом экране статьи её нет совсем (там свои крошки), ниже — появляется,
// когда читатель листает вверх (хочет вернуться или уйти на главную), и уезжает, когда листает вниз.
// Направление — по накопленному сдвигу, чтобы мелкая дрожь трекпада не дёргала шапку.
// Источник — scroll окна (его же двигает Lenis). Скрытая шапка недоступна с клавиатуры (inert).

const THRESHOLD = 12; // px в одну сторону, после которых шапка реагирует

export function mountArticleHead(root: HTMLElement) {
  const hero = document.querySelector<HTMLElement>('.art-hero');

  let lastY = scrollY;
  let travel = 0; // накопленный сдвиг в текущем направлении
  let shown = false;
  let raf = 0;

  const set = (show: boolean) => {
    if (show === shown) return;
    shown = show;
    root.classList.toggle('is-hidden', !show);
    root.inert = !show;
  };

  const update = () => {
    raf = 0;
    const y = scrollY;
    const dy = y - lastY;
    lastY = y;
    // первый экран статьи — шапки нет
    if (!hero || hero.getBoundingClientRect().bottom > 0) {
      travel = 0;
      set(false);
      return;
    }
    if (root.contains(document.activeElement)) return; // в фокусе — не прячем
    if (dy === 0) return;
    travel = Math.sign(dy) === Math.sign(travel) ? travel + dy : dy;
    if (travel <= -THRESHOLD) set(true);
    else if (travel >= THRESHOLD) set(false);
  };

  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
  update();
}
