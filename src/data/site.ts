// Общие данные сайта: контакты, навигация, ссылки CTA

export const EMAIL = 'in@skoup.agency';

export const CTA = {
  discuss: { label: 'Обсудить проект', href: `mailto:${EMAIL}` },
  // TODO: заменить на реальную ссылку на презентацию, когда будет файл
  presentation: { label: 'Презентация', href: '#' },
  // TODO: куда ведёт «Подробнее» в блоке «О нас» — страницы пока нет
  about: { label: 'Подробнее', href: '#' },
} as const;

export const NAV = [
  { label: 'О нас', href: '#about' },
  { label: 'Услуги', href: '#services' },
  { label: 'Блог', href: '#blog' },
  { label: 'Кейсы', href: '#cases' },
] as const;
