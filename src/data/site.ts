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

// TODO: ссылки на статьи, когда появятся страницы блога
export const POSTS = [
  { rubric: 'Наш подход', title: 'Регулирование, прозрачность, доверие: на чём держится UX в финтехе', href: '#' },
  { rubric: 'Безопасность', title: 'Passkeys в финтехе: безопасный вход, удобный UX, меньше трения', href: '#' },
  {
    rubric: 'Доверие пользователей',
    title: 'Европейский акт о доступности и WCAG: каким требованиям должен соответствовать финтех',
    href: '#',
  },
] as const;
