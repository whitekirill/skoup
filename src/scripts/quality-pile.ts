// Куча плашек в «Почему мы»: один раз, когда зона на 35% в окне, плашки падают сверху на свои места
// (GSAP + ScrollTrigger) — снизу вверх по рядам, с отскоком при приземлении. После падения на desktop
// с мышью плашку можно потаскать (Draggable): отпустили — пружиной возвращается к своему месту и углу.
// Финальные позиции задаёт CSS (без JS плашки и так на местах), здесь — только transform и opacity.
// prefers-reduced-motion: без падения — плашки на местах, fade 200 мс, без перетаскивания.
// GSAP грузится, только когда зона близко.
import { QUALITIES } from '../data/about';

type Gsap = typeof import('gsap').gsap;

const FALL = { drop: [320, 620], tilt: [10, 25], duration: [0.8, 1.05], step: [0.045, 0.06], bounce: [6, 10] };
const LANDING = 0.35;
const ROW_TOLERANCE = 30; // плашки с близким cy — один ряд
const DRAG_LEAN = 8; // град, наклон по направлению движения при перетаскивании

// Случайно, но стабильно: сид от индекса плашки
function random(seed: number) {
  let t = seed * 0x9e3779b9;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (rnd: () => number, [min, max]: number[]) => min + (max - min) * rnd();

export function mountQualityPile() {
  const pile = document.querySelector<HTMLElement>('[data-pile]');
  if (!pile) return;
  const root = document.documentElement;
  const items = Array.from(pile.querySelectorAll<HTMLElement>('.pile__item'));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 791px)');
  const mouse = matchMedia('(hover: hover) and (pointer: fine)');
  const spot = (i: number) => (mobile.matches ? QUALITIES[i].mobile : QUALITIES[i].desktop);
  const show = () => root.classList.remove('pile-wait');
  (window as Window & { __pileArmed?: boolean }).__pileArmed = true;

  const near = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      near.disconnect();
      load();
    },
    { rootMargin: '100% 0px' },
  );
  near.observe(pile);

  async function load() {
    try {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
      gsap.registerPlugin(ScrollTrigger);
      // transform плашки теперь ведёт GSAP: центр в точке (cx, cy) и угол из макета, пока невидима
      gsap.set(items, { xPercent: -50, yPercent: -50, x: 0, y: 0, rotation: (i: number) => spot(i).rotate, opacity: 0 });
      show();
      ScrollTrigger.create({
        trigger: pile!.firstElementChild as HTMLElement,
        start: 'top+=35% bottom',
        once: true,
        onEnter: () => (reduced.matches ? fade(gsap) : fall(gsap)),
      });
      // смена раскладки (desktop ↔ mobile) — углы из другой таблицы
      mobile.addEventListener('change', () => items.forEach((el, i) => gsap.set(el, { rotation: spot(i).rotate })));
    } catch {
      show(); // без GSAP плашки просто стоят на местах
    }
  }

  function fade(gsap: Gsap) {
    gsap.to(items, { opacity: 1, duration: 0.2, ease: 'power1.out' });
  }

  // Порядок: сначала нижний ряд (большие cy), потом выше; внутри ряда — случайно
  function order() {
    const byRow = items.map((_, i) => i).sort((a, b) => spot(b).cy - spot(a).cy);
    const rows: number[][] = [];
    for (const i of byRow) {
      const row = rows.at(-1);
      if (row && spot(row[0]).cy - spot(i).cy <= ROW_TOLERANCE) row.push(i);
      else rows.push([i]);
    }
    return rows.flatMap((row) => {
      const rnd = random(row[0] + 101);
      return row.map((i) => ({ i, key: rnd() })).sort((a, b) => a.key - b.key).map(({ i }) => i);
    });
  }

  function fall(gsap: Gsap) {
    const tl = gsap.timeline({ onComplete: () => void draggable(gsap) });
    let at = 0;
    for (const i of order()) {
      const el = items[i];
      const rnd = random(i + 1);
      const final = spot(i).rotate;
      const drop = between(rnd, FALL.drop);
      const side = rnd() < 0.5 ? -1 : 1;
      const tilt = side * between(rnd, FALL.tilt);
      const over = -side * between(rnd, [1, 2]); // доворот с перелётом через финальный угол
      const duration = between(rnd, FALL.duration);
      const bounce = between(rnd, FALL.bounce);

      gsap.set(el, { y: -drop, rotation: final + tilt, willChange: 'transform' });
      tl.to(el, { opacity: 1, duration: 0.12, ease: 'none' }, at)
        // падение до касания — с ускорением
        .to(el, { y: 0, duration, ease: 'power2.in' }, at)
        .to(el, { rotation: final + over, duration, ease: 'power1.out' }, at)
        // приземление: короткий отскок вверх и обратно, угол возвращается к макету
        .to(el, { y: -bounce, duration: LANDING * 0.4, ease: 'power2.out' }, at + duration)
        .to(el, { y: 0, duration: LANDING * 0.6, ease: 'power2.in' }, at + duration + LANDING * 0.4)
        .to(el, { rotation: final, duration: LANDING, ease: 'back.out(1.6)' }, at + duration)
        .set(el, { willChange: 'auto' }, at + duration + LANDING);
      at += between(rnd, FALL.step);
    }
  }

  // Перетаскивание — только с мышью и после падения
  async function draggable(gsap: Gsap) {
    if (!mouse.matches || reduced.matches) return;
    const { Draggable } = await import('gsap/Draggable');
    gsap.registerPlugin(Draggable);
    let top = items.length;
    items.forEach((el, i) => {
      const lean = gsap.quickTo(el, 'rotation', { duration: 0.25, ease: 'power2.out' });
      let settle = 0;
      Draggable.create(el, {
        type: 'x,y',
        cursor: 'grab',
        activeCursor: 'grabbing',
        onPress() {
          gsap.killTweensOf(el);
          el.style.zIndex = String(++top); // поверх остальных
        },
        onDrag() {
          // наклон по направлению движения; остановились — выпрямляется
          lean(spot(i).rotate + gsap.utils.clamp(-DRAG_LEAN, DRAG_LEAN, this.deltaX * 0.6));
          clearTimeout(settle);
          settle = window.setTimeout(() => lean(spot(i).rotate), 120);
        },
        onRelease() {
          clearTimeout(settle);
          gsap.to(el, {
            x: 0,
            y: 0,
            rotation: spot(i).rotate,
            duration: 0.6,
            ease: 'elastic.out(1, 0.6)',
            overwrite: 'auto',
            onComplete: () => (el.style.zIndex = ''),
          });
        },
      });
    });
    // мобильная раскладка или палец вместо мыши — перетаскивания нет
    const sync = () => Draggable.get(items[0]) && items.forEach((el) => Draggable.get(el)?.[mobile.matches || !mouse.matches ? 'disable' : 'enable']());
    mobile.addEventListener('change', sync);
    mouse.addEventListener('change', sync);
    sync();
  }
}
