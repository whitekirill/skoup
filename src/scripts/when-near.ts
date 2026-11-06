// Запускает mount, когда блок впервые оказывается в пределах экрана от окна (по умолчанию — за экран до входа),
// чтобы скрипты блоков ниже первого экрана не вешали слушатели скролла заранее.
// Запас в экран — с ним блок успевает подготовиться (классы, первый кадр) до того, как его видно.
export function whenNear(el: Element, mount: () => void, margin = '100% 0px') {
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    mount();
  }, { rootMargin: margin });
  io.observe(el);
}
