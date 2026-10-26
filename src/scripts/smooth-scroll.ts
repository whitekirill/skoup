// Плавный инерционный скролл колесом/тачпадом (Lenis) и плавный переход по якорным ссылкам.
// Тач-скролл остаётся нативным. При prefers-reduced-motion ничего не включаем — обычный скролл
// и мгновенные переходы по якорям.
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

const motion = matchMedia('(prefers-reduced-motion: no-preference)');
const root = document.documentElement;
// expo out — та же мягкая кривая, что у инерции колеса
const easing = (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t));
let lenis: Lenis | null = null;

function start() {
  if (lenis) return;
  lenis = new Lenis({ lerp: 0.1, autoRaf: true, allowNestedScroll: true, stopInertiaOnNavigate: true });
}

function stop() {
  lenis?.destroy();
  lenis = null;
}

// Открытое мобильное меню или бриф — страницу под ними не крутим
const overlayOpen = () => root.classList.contains('is-menu-open') || root.classList.contains('is-brief-open');
new MutationObserver(() => {
  if (overlayOpen()) lenis?.stop();
  else lenis?.start();
}).observe(root, { attributes: true, attributeFilter: ['class'] });

// Якорные ссылки: свой обработчик, чтобы цель считалась от реального положения страницы
// и переход из мобильного меню начинался после его закрытия
document.addEventListener('click', (event) => {
  if (!lenis || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
  const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
  const hash = link?.getAttribute('href');
  if (!hash || hash === '#') return;
  const target = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!target) return;
  event.preventDefault();

  const go = () => {
    const y = target.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(target).scrollMarginTop || '0');
    lenis?.scrollTo(y, { duration: 1.2, easing });
  };
  // Меню/бриф закрываются своим обработчиком раньше, а класс на html снимается по событию close
  const overlay = link!.closest('dialog');
  if (overlay && overlayOpen()) overlay.addEventListener('close', () => requestAnimationFrame(go), { once: true });
  else go();
});

if (motion.matches) start();
motion.addEventListener('change', () => (motion.matches ? start() : stop()));
