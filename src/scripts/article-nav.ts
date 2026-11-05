// Навигация по статье.
// Кнопка внизу: подпись — текущий раздел (заголовок раздела прошёл середину окна), в оглавлении он подсвечен.
// На первом экране кнопки нет. Дальше прячется при скролле вниз — не сразу, а пройдя HIDE_AFTER px подряд,
// и не раньше HOLD мс после того, как появилась; появляется при скролле вверх, при смене раздела и в самом низу.
// Всегда видна, пока открыто оглавление или кнопка в фокусе с клавиатуры.
// Источник скролла — общий: событие scroll окна (Lenis двигает нативный скролл, так что события те же).
// Открытие: оверлей и панель, фокус на текущий пункт; закрытие — Esc, клик по оверлею, «Закрыть»,
// выбор пункта (плавный скролл к разделу через Lenis), фокус возвращается на кнопку.
import { getLenis } from './smooth-scroll';

const HIDE_AFTER = 240; // px прокрутки вниз подряд, чтобы кнопка уехала
const SHOW_AFTER = 24; // px прокрутки вверх, чтобы вернулась
const HOLD = 1200; // мс после появления, пока кнопка не прячется
const BOTTOM = 200; // px до конца страницы, где кнопка видна всегда
const easing = (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t));

export function mountArticleNav(root: HTMLElement) {
  const button = root.querySelector<HTMLButtonElement>('[data-art-nav-button]')!;
  const panel = root.querySelector<HTMLElement>('[data-art-nav-panel]')!;
  const hero = document.querySelector<HTMLElement>('.art-hero');
  const overlay = root.querySelector<HTMLElement>('[data-art-nav-overlay]')!;
  const current = root.querySelector<HTMLElement>('[data-art-nav-current]')!;
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-art-nav-item]'));
  const sections = links.map((a) => document.getElementById(a.dataset.artNavItem!)).filter(Boolean) as HTMLElement[];
  const motion = matchMedia('(prefers-reduced-motion: no-preference)');

  // --- текущий раздел: последний, чей заголовок прошёл середину окна
  let active = 0;
  const setActive = (i: number, reveal = false) => {
    if (reveal && i !== active) show();
    active = i;
    current.textContent = links[i].querySelector('.art-nav__label')!.textContent;
    links.forEach((a, j) => a.setAttribute('aria-current', String(j === i)));
  };
  const pick = () => {
    let i = 0;
    sections.forEach((s, j) => {
      if (s.getBoundingClientRect().top < innerHeight * 0.5) i = j;
    });
    if (i !== active) setActive(i, true);
  };
  const io = new IntersectionObserver(pick, { rootMargin: '0px 0px -50% 0px' });
  sections.forEach((s) => io.observe(s));
  setActive(0);

  // --- показ и прятание
  let lastY = scrollY;
  let down = 0; // сколько прокрутили вниз подряд
  let up = 0; // сколько вверх подряд (медленный плавный скролл копится)
  let shownAt = 0;
  let raf = 0;
  let wasInHero = true;
  const inHero = () => !!hero && hero.getBoundingClientRect().bottom > 0;
  function show(force = false) {
    down = 0;
    if (!force && inHero()) return;
    if (root.classList.contains('is-hidden')) {
      root.classList.remove('is-hidden');
      shownAt = performance.now();
    }
  }
  const update = () => {
    raf = 0;
    const y = scrollY;
    const dy = y - lastY;
    lastY = y;
    const max = document.documentElement.scrollHeight - innerHeight;
    if (root.classList.contains('is-open') || button.matches(':focus-visible')) {
      show(true);
    } else if (inHero()) {
      root.classList.add('is-hidden'); // первый экран — кнопки нет
      down = up = 0;
      wasInHero = true;
    } else if (wasInHero) {
      wasInHero = false; // ушли с первого экрана — кнопка появляется
      show();
    } else if (y > max - BOTTOM) {
      show();
    } else if (dy > 0) {
      up = 0;
      down += dy;
      if (down > HIDE_AFTER && performance.now() - shownAt > HOLD) root.classList.add('is-hidden');
    } else if (dy < 0) {
      down = 0;
      up -= dy;
      if (up >= SHOW_AFTER) { up = 0; show(); }
    }
    pick();
  };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
  button.addEventListener('focus', () => { if (button.matches(':focus-visible')) show(true); });
  update();

  // --- открыть / закрыть
  const isOpen = () => root.classList.contains('is-open');
  function open() {
    pick();
    root.classList.add('is-open');
    panel.inert = false;
    button.setAttribute('aria-expanded', 'true');
    links[active].focus({ preventScroll: true });
  }
  function close(returnFocus = true) {
    root.classList.remove('is-open');
    panel.inert = true;
    button.setAttribute('aria-expanded', 'false');
    if (returnFocus) button.focus({ preventScroll: true });
  }
  button.addEventListener('click', () => (isOpen() ? close() : open()));
  overlay.addEventListener('click', () => close());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      close();
    }
  });
  // фокус ушёл за пределы оглавления и кнопки — закрываем
  root.addEventListener('focusout', (e) => {
    if (isOpen() && e.relatedTarget && !root.contains(e.relatedTarget as Node)) close(false);
  });

  links.forEach((link, i) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = sections[i];
      close(false);
      setActive(i);
      const lenis = getLenis();
      const y = target.getBoundingClientRect().top + scrollY;
      if (lenis) lenis.scrollTo(y, { duration: 1.2, easing });
      else scrollTo({ top: y, behavior: motion.matches ? 'smooth' : 'auto' });
      history.replaceState(null, '', `#${target.id}`);
      // фокус — на заголовок раздела, чтобы клавиатура продолжила оттуда
      const heading = target.querySelector<HTMLElement>('h2, h3') ?? target;
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    });
  });
}
