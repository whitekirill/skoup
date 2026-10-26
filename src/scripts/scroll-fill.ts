// Текст заливается по словам вместе со скроллом: слово переходит из серого (text/secondary) в свой цвет —
// чёрный или акцент (--fill-color у родителя). Иконки в строке проявляются вместе с соседними словами.
// Заливка начинается, когда верх абзаца на 85% высоты окна, и заканчивается, когда низ — на 45%.
// Без JS и при prefers-reduced-motion текст сразу в итоговых цветах.

const START = 0.85;
const END = 0.45;
const SPREAD = 3; // слово заливается, пока прогресс проходит ~3 слова — переход мягкий

export function mountScrollFill(el: HTMLElement) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // текст — в слова (неразрывный пробел оставляем внутри слова), иконки — отдельные «слова»
  const words: HTMLElement[] = [];
  const split = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const part of child.textContent!.split(/([ \t\n\r]+)/)) {
          if (!part) continue;
          if (/^[ \t\n\r]+$/.test(part)) {
            frag.append(part);
            continue;
          }
          const word = document.createElement('span');
          word.className = 'fill-word';
          word.textContent = part;
          frag.append(word);
          words.push(word);
        }
        child.replaceWith(frag);
      } else if (child instanceof HTMLElement) {
        if (child.getAttribute('aria-hidden') === 'true') {
          child.classList.add('fill-word');
          words.push(child);
        } else split(child);
      }
    }
  };
  split(el);
  el.classList.add('is-filling');

  const fills = new Float32Array(words.length).fill(-1);
  let raf = 0;
  const render = () => {
    raf = 0;
    const r = el.getBoundingClientRect();
    const vh = innerHeight;
    const progress = Math.min(1, Math.max(0, (vh * START - r.top) / (vh * (START - END) + r.height)));
    const head = progress * (words.length + SPREAD);
    words.forEach((word, i) => {
      const f = Math.round(Math.min(1, Math.max(0, (head - i) / SPREAD)) * 100) / 100;
      if (f !== fills[i]) {
        fills[i] = f;
        word.style.setProperty('--fill', String(f));
      }
    });
  };
  const update = () => {
    if (!raf) raf = requestAnimationFrame(render);
  };

  let near = false;
  new IntersectionObserver(([entry]) => {
    near = entry.isIntersecting;
    update();
  }, { rootMargin: '50% 0px' }).observe(el);
  addEventListener('scroll', () => near && update(), { passive: true });
  addEventListener('resize', update);
  render();
}
