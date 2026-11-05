// Общие данные сайта: контакты, ссылки CTA

export const EMAIL = 'in@skoup.ru';

export const CTA = {
  discuss: { label: 'Обсудить проект', href: `mailto:${EMAIL}` },
  // TODO: заменить на реальную ссылку на презентацию, когда будет файл
  presentation: { label: 'Презентация', href: '#' },
} as const;

// TODO: реальные ссылки на юридические страницы
export const LEGAL = [
  { label: 'Политика в отношении персональных данных', href: '#' },
  { label: 'Сведения об организации', href: '#' },
] as const;

/** Статья блога (главная → карточка «Покупка частями в кредит…») */
export const ARTICLE_HREF = '/blog/marketplaces-installments';
