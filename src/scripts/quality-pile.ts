// Качества в «Почему мы»: один раз, когда зона на 35% в окне, слова падают из-за верхнего края окна
// на свои места (GSAP + ScrollTrigger) — снизу вверх по рядам, с отскоком при приземлении; время падения —
// от высоты, как при свободном падении. После падения на desktop с мышью: наведение — слово рассыпается
// в халфтон, слово можно потаскать (Draggable) — отпустили, пружиной возвращается к месту и углу.
// Финальные позиции задаёт CSS (без JS слова и так на местах), здесь — только transform и opacity.
// prefers-reduced-motion: без падения — слова на местах, fade 200 мс, без перетаскивания и халфтона.
// GSAP грузится, только когда зона близко.
import { QUALITIES } from '../data/about';
import { halftone } from './halftone-word';

type Gsap = typeof import('gsap').gsap;

// above — насколько выше верхнего края окна стартует слово (px экрана); gravity — px/с², падение ~1 с с 700 px
const FALL = { above: [40, 220], gravity: 1400, duration: [0.7, 1.3], tilt: [10, 25], step: [0.045, 0.06], bounce: [6, 10] };
const LANDING = 0.35;
const ROW_TOLERANCE = 30; // слова с близким cy — один ряд
const DRAG_LEAN = 8; // град, наклон по направлению движения при перетаскивании

// Случайно, но стабильно: сид от индекса слова
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
  const stage = pile.querySelector<HTMLElement>('.pile__stage')!;
  // масштаб зоны: она нарисована в пространстве макета и уменьшена/увеличена целиком
  const scale = () => stage.getBoundingClientRect().width / stage.offsetWidth || 1;
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
      // transform слова теперь ведёт GSAP: центр в точке (cx, cy) и угол из макета, пока невидима
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
      show(); // без GSAP слова просто стоят на местах
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
    const tl = gsap.timeline({ onComplete: () => void interactive(gsap) });
    const k = scale();
    let at = 0;
    for (const i of order()) {
      const el = items[i];
      const rnd = random(i + 1);
      const final = spot(i).rotate;
      // старт — над верхним краем окна: путь от него до места виден целиком
      const distance = el.getBoundingClientRect().bottom + between(rnd, FALL.above);
      const side = rnd() < 0.5 ? -1 : 1;
      const tilt = side * between(rnd, FALL.tilt);
      const over = -side * between(rnd, [1, 2]); // доворот с перелётом через финальный угол
      const duration = gsap.utils.clamp(FALL.duration[0], FALL.duration[1], Math.sqrt((2 * distance) / FALL.gravity));
      const bounce = between(rnd, FALL.bounce);

      // y — в пикселях макета (зона масштабирована), поэтому делим на масштаб
      gsap.set(el, { y: -distance / k, rotation: final + tilt, willChange: 'transform' });
      tl.set(el, { opacity: 1 }, at)
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

  // После падения, с мышью: халфтон при наведении и перетаскивание
  async function interactive(gsap: Gsap) {
    if (!mouse.matches || reduced.matches) return;
    const effects = items.map((el) => {
      const effect = halftone(el, el.querySelector<HTMLElement>('.pile__text')!, scale);
      el.addEventListener('pointerenter', (event) => event.pointerType === 'mouse' && effect.enter());
      el.addEventListener('pointerleave', () => effect.leave());
      return effect;
    });
    const relayout = () => effects.forEach((effect) => effect.reset());
    mobile.addEventListener('change', relayout);
    addEventListener('resize', relayout);
    await draggable(gsap);
  }

  // Перетаскивание — только с мышью и после падения
  async function draggable(gsap: Gsap) {
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
