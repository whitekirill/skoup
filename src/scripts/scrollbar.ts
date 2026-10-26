// Свой ползунок прокрутки вместо системной полосы (она скрыта в base.css).
// Тонкая полоска у правого края: видна, пока страница крутится, и гаснет через секунду;
// под мышью утолщается, её можно тянуть, клик по дорожке — переход к этому месту.
// Пока открыт бриф, ползунок показывает и крутит бриф, а не страницу под ним.
// Клавиатура, колесо и тач работают как обычно — ползунок только для глаз и мыши.
import { getLenis } from './smooth-scroll';

const HIDE_DELAY = 1000;
const MIN_THUMB = 40;

const root = document.documentElement;
const brief = document.querySelector<HTMLElement>('[data-brief]');
const motion = matchMedia('(prefers-reduced-motion: no-preference)');

const bar = document.createElement('div');
bar.className = 'scrollbar';
bar.setAttribute('aria-hidden', 'true');
const thumb = document.createElement('div');
thumb.className = 'scrollbar__thumb';
bar.append(thumb);
document.body.append(bar);

// Что сейчас прокручиваем: бриф или страницу
const briefOpen = () => !!brief && root.classList.contains('is-brief-open');
const metrics = () =>
  briefOpen()
    ? { top: brief!.scrollTop, height: brief!.scrollHeight, view: brief!.clientHeight }
    : { top: scrollY, height: root.scrollHeight, view: innerHeight };

function scrollToY(y: number, smooth: boolean) {
  if (briefOpen()) {
    brief!.scrollTo({ top: y, behavior: smooth && motion.matches ? 'smooth' : 'auto' });
    return;
  }
  const lenis = getLenis();
  if (lenis) lenis.scrollTo(y, smooth ? { duration: 0.6 } : { immediate: true, force: true });
  else scrollTo({ top: y, behavior: smooth && motion.matches ? 'smooth' : 'auto' });
}

let thumbSize = 0;
let travel = 0; // сколько ползунок может пройти по дорожке
let maxScroll = 0;
let frame = 0;

function render() {
  frame = 0;
  const { top, height, view } = metrics();
  maxScroll = height - view;
  bar.hidden = maxScroll <= 1;
  if (bar.hidden) return;
  const track = bar.clientHeight;
  thumbSize = Math.max(MIN_THUMB, (track * view) / height);
  travel = track - thumbSize;
  thumb.style.height = `${thumbSize}px`;
  thumb.style.translate = `0 ${(travel * Math.min(1, Math.max(0, top / maxScroll))).toFixed(2)}px`;
}

const update = () => {
  if (!frame) frame = requestAnimationFrame(render);
};

// Показ во время прокрутки, гаснет после паузы (если мышь не на ползунке и его не тянут)
let hideTimer = 0;
let dragging = false;
function reveal() {
  bar.classList.add('is-active');
  clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    if (!dragging && !bar.matches(':hover')) bar.classList.remove('is-active');
  }, HIDE_DELAY);
}

const onScroll = () => {
  update();
  reveal();
};
addEventListener('scroll', () => !briefOpen() && onScroll(), { passive: true });
brief?.addEventListener('scroll', () => briefOpen() && onScroll(), { passive: true });
addEventListener('resize', update);

// Высота содержимого меняется (картинки, шрифты, файлы в брифе) — пересчитать ползунок
const resize = new ResizeObserver(update);
resize.observe(document.body);
if (brief) Array.from(brief.children).forEach((child) => resize.observe(child));

// Открыли или закрыли бриф — ползунок переключается между ним и страницей
new MutationObserver(update).observe(root, { attributes: true, attributeFilter: ['class'] });

bar.addEventListener('pointerleave', () => !dragging && reveal());

// Перетаскивание ползунка
let startY = 0;
let startTop = 0;
thumb.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  dragging = true;
  startY = event.clientY;
  startTop = metrics().top;
  thumb.setPointerCapture(event.pointerId);
  bar.classList.add('is-dragging', 'is-active');
});
thumb.addEventListener('pointermove', (event) => {
  if (!dragging || travel <= 0) return;
  const y = startTop + ((event.clientY - startY) * maxScroll) / travel;
  scrollToY(Math.min(maxScroll, Math.max(0, y)), false);
});
const endDrag = () => {
  if (!dragging) return;
  dragging = false;
  bar.classList.remove('is-dragging');
  reveal();
};
thumb.addEventListener('pointerup', endDrag);
thumb.addEventListener('pointercancel', endDrag);

// Клик по дорожке — ползунок встаёт серединой под курсор
bar.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.target === thumb || travel <= 0) return;
  event.preventDefault();
  const offset = event.clientY - bar.getBoundingClientRect().top - thumbSize / 2;
  scrollToY(Math.min(maxScroll, Math.max(0, (offset / travel) * maxScroll)), true);
});

render();
