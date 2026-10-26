// Данные страницы «О нас» (Figma: desktop 524:28926, mobile 536:3431)

export interface Shot {
  /** файл в src/assets/about/shots/ */
  file: string;
  /** размер в макете, px (лента 542:33345, высоты 400 / 372 / 289 / 197) */
  width: number;
  height: number;
  alt: string;
}

// Шоты из кейсов в ленте «Почему мы» — в порядке макета. Картинки — рендер кадров Figma в 2x
export const SHOTS: Shot[] = [
  { file: 'shot-01.png', width: 299.13, height: 400, alt: 'Uzum: карта и микрозайм в мобильном приложении' },
  { file: 'shot-02.png', width: 312.97, height: 288.7, alt: 'Uzum: банкомат с предложением рассрочки' },
  { file: 'shot-03.png', width: 340.73, height: 372, alt: 'Рассрочка: график платежей в приложении' },
  { file: 'shot-04.png', width: 365.69, height: 197.49, alt: 'Кредитная линия: нет долга и предложение беспроцентного займа' },
  { file: 'shot-05.png', width: 264.44, height: 288.7, alt: 'Рассрочка: выбор суммы платежа и график' },
  { file: 'shot-06.png', width: 273.64, height: 400, alt: 'Round: заявка на кредит для бизнеса в мобильном приложении' },
  { file: 'shot-07.png', width: 365.69, height: 400, alt: 'Uzum: карта банкоматов и выбор суммы' },
  { file: 'shot-08.png', width: 365.69, height: 197.49, alt: 'Uzum: карта Visa с беспроцентным периодом' },
  { file: 'shot-09.png', width: 457.74, height: 400, alt: 'Round: кабинет бизнеса с предодобренным кредитом' },
  { file: 'shot-10.png', width: 533.89, height: 288.7, alt: 'Round: выбор суммы и срока кредита' },
  { file: 'shot-11.png', width: 365.69, height: 197.49, alt: 'Рассрочка: карточки товаров' },
  { file: 'shot-12.png', width: 365.69, height: 400, alt: 'Выбор карты для оплаты в приложении' },
  { file: 'shot-13.png', width: 313.81, height: 288.7, alt: 'Kilde: дашборд инвестора' },
];
