// Навигация по статье.
// Кнопка внизу: подпись — текущий раздел (IntersectionObserver по заголовкам разделов).
// Прячется при скролле вниз и появляется при скролле вверх (порог 10 px), всегда видна в начале
// статьи и в самом низу, пока открыто оглавление или кнопка в фокусе с клавиатуры.
// Источник скролла — общий: событие scroll окна (Lenis двигает нативный скролл, так что события те же).
// Открытие: оверлей и панель, фокус на текущий пункт; закрытие — Esc, клик по оверлею, «Закрыть»,
// выбор пункта (плавный скролл к разделу через Lenis), фокус возвращается на кнопку.
import { getLenis } from './smooth-scroll';

const THRESHOLD = 10; // px движения, чтобы кнопка спряталась или появилась
const EDGE = 200; // px от верха и низа страницы, где кнопка видна всегда
const easing = (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t));

export function mountArticleNav(root: HTMLElement) {
  const button = root.querySelector<HTMLButtonElement>('[data-art-nav-button]')!;
  const panel = root.querySelector<HTMLElement>('[data-art-nav-panel]')!;
  const overlay = root.querySelector<HTMLElement>('[data-art-nav-overlay]')!;
  const current = root.querySelector<HTMLElement>('[data-art-nav-current]')!;
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-art-nav-item]'));
  const sections = links.map((a) => document.getElementById(a.dataset.artNavItem!)).filter(Boolean) as HTMLElement[];
  const motion = matchMedia('(prefers-reduced-motion: no-preference)');

  // --- текущий раздел: последний, чей заголовок прошёл середину окна
  let active = 0;
  const setActive = (i: number) => {
    active = i;
    current.textContent = links[i].querySelector('.art-nav__label')!.textContent;
    links.forEach((a, j) => a.setAttribute('aria-current', String(j === i)));
  };
  const pick = () => {
    let i = 0;
    sections.forEach((s, j) => {
      if (s.getBoundingClientRect().top < innerHeight * 0.5) i = j;
    });
    if (i !== active) setActive(i);
  };
  const io = new IntersectionObserver(pick, { rootMargin: '0px 0px -50% 0px' });
  sections.forEach((s) => io.observe(s));
  setActive(0);

  // --- прятать при скролле вниз
  let lastY = scrollY;
  let raf = 0;
  const update = () => {
    raf = 0;
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    const atEdge = y < EDGE || y > max - EDGE;
    const keep = root.classList.contains('is-open') || button.matches(':focus-visible');
    if (atEdge || keep) {
      root.classList.remove('is-hidden');
      lastY = y;
    } else if (y - lastY > THRESHOLD) {
      root.classList.add('is-hidden');
      lastY = y;
    } else if (lastY - y > THRESHOLD) {
      root.classList.remove('is-hidden');
      lastY = y;
    }
    pick();
  };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
  button.addEventListener('focus', () => root.classList.remove('is-hidden'));

  // --- открыть / закрыть
  const isOpen = () => root.classList.contains('is-open');
  function open() {
    pick();
    root.classList.add('is-open');
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    links[active].focus({ preventScroll: true });
  }
  function close(returnFocus = true) {
    root.classList.remove('is-open');
    panel.hidden = true;
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
