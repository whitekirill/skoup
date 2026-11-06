// Галерея проектов в финальном CTA едет влево вместе со скроллом страницы: пока лента в окне, каждый пиксель
// прокрутки сдвигает её на DRIFT px. Пока лента внизу окна и только появляется — она на месте, как в макете.
// Растяжение: каждый шот догоняет ленту своей пружиной — первые жёстче, последние мягче. При резком скролле
// хвост отстаёт и промежутки растягиваются, на остановке лента собирается обратно.
// Параллакс: карточки ниже ростом (197, 289) едут по вертикали чуть быстрее страницы — будто ближе к зрителю.
// Motion: позиция прокрутки — из scroll() (одно общее чтение за кадр, той же прокрутки окна, что двигает Lenis);
// общая позиция ленты и каждый шот — springValue (на тач-экранах без инерции Lenis пружина и сглаживает рывки);
// перерисовка — раз в кадр через цикл Motion, в покое он спит. Только translate.
// При prefers-reduced-motion скрипт не включается — ленту листают пальцем/тачпадом.
import { frame, motionValue, scroll, springValue } from 'motion';

const DRIFT = 0.7; // px ленты на px прокрутки
// Пружины пересчитаны из прежнего сглаживания «доля пути за кадр» и сверены по записи: отклик и растяжение
// те же, что были, лента собирается чуть быстрее
const BASE_FOLLOW = 0.12; // общая позиция ленты
const STIFF = [0.22, 0.08]; // первый и последний шот
const DAMPING_RATIO = 0.9; // чуть меньше критического — лента собирается мягко, почти без перелёта
const MAX_STRETCH = 180; // px, предел отставания шота от ленты
const DEPTH = 0.1; // параллакс самого низкого шота: доля его смещения от центра окна

// «доля пути за кадр 60 fps» → пружина: ω = 3 / τ, где τ — постоянная времени прежнего сглаживания
const spring = (k: number) => {
  const tau = -16.67 / Math.log(1 - k) / 1000; // с
  const w = 3 / tau;
  return { stiffness: w * w, damping: 2 * DAMPING_RATIO * w };
};

export function mountShotsDrift(root: HTMLElement) {
  if (!matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
  const track = root.querySelector<HTMLElement>('.shots__track');
  const items = Array.from(root.querySelectorAll<HTMLElement>('.shots__item'));
  if (!track || !items.length) return;
  root.classList.add('is-drifting');

  const heights = items.map((el) => parseFloat(el.style.getPropertyValue('--h')) || 0);
  const tallest = Math.max(...heights);
  const depth = heights.map((h) => DEPTH * (1 - h / tallest));

  const goal = () => {
    const r = root.getBoundingClientRect();
    // дальше конца ленты не уезжаем: последний шот остаётся у правого поля
    const pad = parseFloat(getComputedStyle(root).paddingLeft) || 0;
    const max = Math.max(0, track.scrollWidth - (root.clientWidth - pad));
    return -Math.min(max, Math.max(0, innerHeight - r.top) * DRIFT);
  };
  const target = motionValue(goal());
  const base = springValue(target, spring(BASE_FOLLOW));
  const xs = items.map((_, i) => springValue(base, spring(STIFF[0] + ((STIFF[1] - STIFF[0]) * i) / Math.max(1, items.length - 1))));

  const render = () => {
    const r = root.getBoundingClientRect();
    const offset = r.top + r.height / 2 - innerHeight / 2; // 0 — лента в центре окна
    const b = base.get();
    items.forEach((el, i) => {
      const x = Math.min(b + MAX_STRETCH, Math.max(b - MAX_STRETCH, xs[i].get()));
      el.style.translate = `${x.toFixed(2)}px ${(offset * depth[i]).toFixed(2)}px`;
    });
  };
  const schedule = () => frame.render(render);
  xs.forEach((x) => x.on('change', schedule));

  // прокрутка и изменение размера окна: новая цель для ленты и вертикальный параллакс
  scroll(() => {
    target.set(goal());
    schedule();
  });
  render();
}
