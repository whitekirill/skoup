// Общие данные сайта: контакты, навигация, ссылки CTA

export const EMAIL = 'in@skoup.ru';

export const CTA = {
  discuss: { label: 'Обсудить проект', href: `mailto:${EMAIL}` },
  // TODO: заменить на реальную ссылку на презентацию, когда будет файл
  presentation: { label: 'Презентация', href: '#' },
  // TODO: ссылка на форму брифа, пока — письмо
  brief: { label: 'Начните с брифа', href: `mailto:${EMAIL}` },
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

// TODO: реальные ссылки на соцсети и юридические страницы
export const SOCIALS = [
  { label: 'VC', href: '#' },
  { label: 'Telegram', href: '#' },
  { label: 'Designers', href: '#' },
] as const;

export const LEGAL = [
  { label: 'Политика в отношении персональных данных', href: '#' },
  { label: 'Сведения об организации', href: '#' },
] as const;

/** Порядок ссылок в футере отличается от шапки — как в макете */
export const FOOTER_NAV = [
  { label: 'О нас', href: '#about' },
  { label: 'Кейсы', href: '#cases' },
  { label: 'Услуги', href: '#services' },
  { label: 'Блог', href: '#blog' },
] as const;
