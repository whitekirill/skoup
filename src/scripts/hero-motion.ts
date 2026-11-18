// Анимация картинок в шапках статей (Figma: «Платёж проходит» 910:13308, «Строим с фундамента» 910:13438).
// Играет один раз, когда картинка видна; после View Transition с карточки — когда переход закончится.
// Только transform, opacity, clip-path и цвета (WAAPI, fill: both). Начальный кадр включается здесь же, из JS:
// без JS остаётся статичная картинка. При reduced motion — сразу финальный кадр, без движения.

const M = 'cubic-bezier(0.4, 0, 0.2, 1)'; // движение и цвета
const O = 'cubic-bezier(0.22, 1, 0.36, 1)'; // появление

type Frame = Keyframe;

/** Твин from → to с start по end (секунды от начала анимации) */
function tween(el: Element | null, from: Frame, to: Frame, start: number, end: number, easing: string): Animation | null {
  if (!el) return null;
  return el.animate([from, to], { delay: start * 1000, duration: (end - start) * 1000, easing, fill: 'both' });
}

const fadeOut = (el: Element | null, start: number, end: number, easing = M) => tween(el, { opacity: 1 }, { opacity: 0 }, start, end, easing);
const fadeIn = (el: Element | null, start: number, end: number, easing = O) => tween(el, { opacity: 0 }, { opacity: 1 }, start, end, easing);

// Геометрия макета 688: сдвиги — в процентах от своего элемента, чтобы не зависеть от масштаба
const PILL_H = 220.58; // высота карточки
const ROW_W = 8 * 125.27 + 7 * 24; // ширина ряда
const LIFT = `translateY(${(-32 / PILL_H) * 100}%)`; // подъём на 32
const SHIFT = `translateX(${(-149 / ROW_W) * 100}%)`; // ряд на карточку + отступ

function payment(root: HTMLElement): Animation[] {
  const q = <T extends Element>(s: string) => root.querySelector<T>(s);
  const qa = (s: string) => Array.from(root.querySelectorAll(s));
  const css = getComputedStyle(root);
  const accent = css.getPropertyValue('--accent').trim();
  const white = getComputedStyle(document.documentElement).getPropertyValue('--color-surface-primary').trim() || '#fff';
  const ink = css.getPropertyValue('--color-text-primary').trim();
  const muted = css.getPropertyValue('--color-text-secondary-inversion').trim();
  const nowBody = q('[data-now-body]');
  const nextBody = q('[data-next-body]');
  const list: (Animation | null)[] = [
    // текущий платёж «нажимается»: 1 → 0,97 → 1
    nowBody?.animate(
      [
        { transform: 'scale(1)', easing: M },
        { transform: 'scale(0.97)', offset: 0.25 / 0.55, easing: M },
        { transform: 'scale(1)' },
      ],
      { delay: 600, duration: 550, fill: 'both' },
    ) ?? null,
    // ряд уезжает на одну карточку
    tween(q('[data-row]'), { transform: 'none' }, { transform: SHIFT }, 1, 2, M),
    // текущий опускается в ряд и белеет, «Внести» и плюс гаснут, проявляются «Оплачен» и галочка
    tween(q('[data-now]'), { transform: LIFT }, { transform: 'none' }, 1, 2, M),
    tween(nowBody, { backgroundColor: accent }, { backgroundColor: white }, 1, 2, M),
    ...qa('[data-now-a]').map((el) => fadeOut(el, 1, 1.45)),
    ...qa('[data-now-b]').map((el) => fadeIn(el, 1.3, 1.9)),
    tween(q('[data-now-icon]'), { transform: 'scale(0.9)' }, { transform: 'scale(1)' }, 1.3, 2, O),
    // следующий («1 нояб») поднимается, заливается лаймом, сумма темнеет, пунктир исчезает
    tween(q('[data-next]'), { transform: 'none' }, { transform: LIFT }, 1, 2, M),
    tween(nextBody, { backgroundColor: 'transparent' }, { backgroundColor: accent }, 1, 2, M),
    tween(q('[data-next-amount]'), { color: muted }, { color: ink }, 1, 2, M),
    fadeOut(q('[data-next-dash]'), 1, 1.5),
    ...qa('[data-next-a]').map((el) => fadeOut(el, 1.1, 1.55)),
    ...qa('[data-next-b]').map((el) => fadeIn(el, 1.4, 2)),
    tween(q('[data-next-icon]'), { transform: 'scale(0.9)' }, { transform: 'scale(1)' }, 1.4, 2.1, O),
  ];
  return list.filter((a): a is Animation => a !== null);
}

function levels(root: HTMLElement): Animation[] {
  const list: (Animation | null)[] = [];
  root.querySelectorAll('[data-level]').forEach((level, i) => {
    const s = 0.3 + 0.28 * i;
    const bg = level.querySelector('[data-level-bg]');
    const title = level.querySelector('[data-level-title]');
    const icon = level.querySelector('[data-level-icon]');
    list.push(
      // столбец растёт снизу (слой фона), проявляется
      tween(bg, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0 0 0 0)' }, s, s + 1.3, O),
      tween(bg, { opacity: 0 }, { opacity: 1 }, s, s + 0.4, M),
      // подпись проявляется и поднимается на 6 (30% её строки 20)
      fadeIn(title, s + 0.6, s + 1.2),
      tween(title, { transform: 'translateY(30%)' }, { transform: 'none' }, s + 0.6, s + 1.3, O),
      // иконка проявляется, 0,9 → 1
      fadeIn(icon, s + 0.75, s + 1.35),
      tween(icon, { transform: 'scale(0.9)' }, { transform: 'scale(1)' }, s + 0.75, s + 1.5, O),
    );
  });
  return list.filter((a): a is Animation => a !== null);
}

/** Переход View Transitions, с которым открыли страницу (ловит pagereveal в шапке статьи) */
function transitionDone(): Promise<unknown> {
  const vt = (window as { __heroVT?: ViewTransition }).__heroVT ?? (document as { activeViewTransition?: ViewTransition }).activeViewTransition;
  return vt ? vt.finished.catch(() => undefined) : Promise.resolve();
}

function whenVisible(el: Element): Promise<void> {
  return new Promise((resolve) => {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          resolve();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
  });
}

export function mountHeroMotion(root: HTMLElement) {
  const kind = root.dataset.heroMotion;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (kind === 'payment') root.classList.add('is-final');
    return;
  }
  if (!('animate' in root)) return;
  // начальный кадр — сразу, анимация на паузе до старта
  const anims = kind === 'payment' ? payment(root) : levels(root);
  anims.forEach((a) => a.pause());
  Promise.all([transitionDone(), whenVisible(root)]).then(() => anims.forEach((a) => a.play()));
}

document.querySelectorAll<HTMLElement>('[data-hero-motion]').forEach(mountHeroMotion);
