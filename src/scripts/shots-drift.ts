// Лента шотов в «Почему мы» едет влево вместе со скроллом страницы: пока лента в окне, каждый пиксель
// прокрутки сдвигает её на DRIFT px. Пока лента внизу окна и только появляется — она на месте, как в макете.
// Движение сглажено (на тач-экранах нативный скролл без инерции Lenis — сглаживаем сами).
// Растяжение: каждый шот догоняет ленту своей пружиной — первые жёстче, последние мягче. При резком скролле
// хвост отстаёт и промежутки растягиваются, на остановке лента собирается обратно.
// Параллакс: шоты ниже ростом (197, 289) едут по вертикали чуть быстрее страницы — будто ближе к зрителю.
// Только translate. При prefers-reduced-motion скрипт не включается — ленту листают пальцем/тачпадом.

const DRIFT = 0.7; // px ленты на px прокрутки
const FOLLOW = 0.12; // сглаживание общей позиции за кадр (60 fps)
const STIFF = [0.22, 0.08]; // жёсткость пружины первого и последнего шота
const MAX_STRETCH = 180; // px, предел отставания шота от ленты
const DEPTH = 0.1; // параллакс самого низкого шота: доля его смещения от центра окна

// доля пути за кадр с учётом реального времени кадра
const ease = (k: number, dt: number) => 1 - Math.pow(1 - k, dt / 16.67);

export function mountShotsDrift(root: HTMLElement) {
  if (!matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
  const track = root.querySelector<HTMLElement>('.shots__track');
  const items = Array.from(root.querySelectorAll<HTMLElement>('.shots__item'));
  if (!track || !items.length) return;
  root.classList.add('is-drifting');

  const heights = items.map((el) => parseFloat(el.style.getPropertyValue('--h')) || 0);
  const tallest = Math.max(...heights);
  const depth = heights.map((h) => DEPTH * (1 - h / tallest));
  const stiff = items.map((_, i) => STIFF[0] + ((STIFF[1] - STIFF[0]) * i) / Math.max(1, items.length - 1));
  const xs = new Float32Array(items.length);
  let base = 0;
  let first = true;
  let raf = 0;
  let last = 0;
  let near = false;

  function frame(now: number) {
    raf = 0;
    const dt = last ? Math.min(64, now - last) : 16.67;
    last = now;
    const r = root.getBoundingClientRect();
    const vh = innerHeight;
    // дальше конца ленты не уезжаем: последний шот остаётся у правого поля
    const pad = parseFloat(getComputedStyle(root).paddingLeft) || 0;
    const max = Math.max(0, track!.scrollWidth - (root.clientWidth - pad));
    const target = -Math.min(max, Math.max(0, vh - r.top) * DRIFT);
    if (first) {
      base = target;
      xs.fill(target);
      first = false;
    }
    base += (target - base) * ease(FOLLOW, dt);
    let moving = Math.abs(target - base) > 0.1;
    const offset = r.top + r.height / 2 - vh / 2; // 0 — лента в центре окна
    items.forEach((el, i) => {
      xs[i] += (base - xs[i]) * ease(stiff[i], dt);
      xs[i] = Math.min(base + MAX_STRETCH, Math.max(base - MAX_STRETCH, xs[i]));
      if (Math.abs(base - xs[i]) > 0.1) moving = true;
      el.style.translate = `${xs[i].toFixed(2)}px ${(offset * depth[i]).toFixed(2)}px`;
    });
    if (near && moving) raf = requestAnimationFrame(frame);
    else last = 0;
  }

  const update = () => {
    if (near && !raf) raf = requestAnimationFrame(frame);
  };
  new IntersectionObserver(
    ([entry]) => {
      near = entry.isIntersecting;
      update();
    },
    { rootMargin: '25% 0px' },
  ).observe(root);
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
}
