// Общие данные сайта: контакты, ссылки CTA

export const EMAIL = 'in@skoup.ru';

export const CTA = {
  discuss: { label: 'Обсудить проект', href: `mailto:${EMAIL}` },
  // презентация — файл на Google Диске, открывается в новой вкладке
  presentation: { label: 'Презентация', href: 'https://drive.google.com/file/d/1i2Wn6xnAcXXtroaFJQoP_7YxDYzV83tO/view?usp=sharing' },
} as const;

// Юридические страницы — пока заглушки (LegalPage draft: noindex, не в sitemap)
export const LEGAL = {
  privacy: { label: 'Политика конфиденциальности', href: '/privacy/' },
  consent: { label: 'Согласие на обработку персональных данных', href: '/consent/' },
} as const;

/** Статья блога (главная → карточка «Покупка частями в кредит…») */
export const ARTICLE_HREF = '/blog/marketplaces-installments/';
