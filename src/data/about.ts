// Данные страницы «О нас» (Figma: desktop 524:28926, mobile 536:3431)

/** Плашка качества: центр (cx, cy) в px макета от левого верхнего угла зоны и угол в знаке CSS */
export interface QualitySpot {
  cx: number;
  cy: number;
  rotate: number;
}

export interface Quality {
  label: string;
  /** зона 1440×274 */
  desktop: QualitySpot;
  /** зона 393×504 */
  mobile: QualitySpot;
}

/** Зоны кучи плашек в пространстве макета */
export const PILE = {
  desktop: { width: 1440, height: 274 },
  mobile: { width: 393, height: 504 },
} as const;

// Порядок — как в таблице desktop: снизу вверх, слева направо. Финальные позиции — ровно из макета
export const QUALITIES: Quality[] = [
  { label: 'Экспертиза', desktop: { cx: 91, cy: 236, rotate: 0 }, mobile: { cx: 64, cy: 335, rotate: 0 } },
  { label: 'Въедливые', desktop: { cx: 372, cy: 236, rotate: 0 }, mobile: { cx: 333, cy: 466, rotate: -3 } },
  { label: 'Партнёрство', desktop: { cx: 621, cy: 236, rotate: 0 }, mobile: { cx: 73, cy: 143, rotate: -18 } },
  { label: 'Результат', desktop: { cx: 872, cy: 236, rotate: 0 }, mobile: { cx: 99, cy: 403, rotate: 0 } },
  { label: 'Ответственность', desktop: { cx: 1203, cy: 236, rotate: 0 }, mobile: { cx: 115, cy: 267, rotate: 0 } },
  { label: 'Вдумчивые', desktop: { cx: 198, cy: 152, rotate: 0 }, mobile: { cx: 334, cy: 186, rotate: -3 } },
  { label: 'Вкус', desktop: { cx: 560, cy: 152, rotate: 0 }, mobile: { cx: 32, cy: 471, rotate: 0 } },
  { label: 'Аккуратные', desktop: { cx: 898, cy: 152, rotate: 0 }, mobile: { cx: 328, cy: 254, rotate: -3 } },
  { label: 'Быстрые', desktop: { cx: 1156, cy: 152, rotate: 0 }, mobile: { cx: 269, cy: 49, rotate: -5 } },
  { label: 'Открытые', desktop: { cx: 1376, cy: 155, rotate: 8 }, mobile: { cx: 333, cy: 399, rotate: -3 } },
  { label: 'Данные', desktop: { cx: 63, cy: 78, rotate: -18 }, mobile: { cx: 178, cy: 471, rotate: 0 } },
  { label: 'Регуляторика', desktop: { cx: 433, cy: 83, rotate: -12 }, mobile: { cx: 93, cy: 59, rotate: -12 } },
  { label: 'Финтех', desktop: { cx: 665, cy: 78, rotate: 12 }, mobile: { cx: 176, cy: 199, rotate: 0 } },
  { label: 'Аналитика', desktop: { cx: 919, cy: 68, rotate: 4.6 }, mobile: { cx: 272, cy: 332, rotate: -8 } },
  { label: 'Предсказуемые', desktop: { cx: 1267, cy: 53, rotate: -6.4 }, mobile: { cx: 302, cy: 117, rotate: -3 } },
];
