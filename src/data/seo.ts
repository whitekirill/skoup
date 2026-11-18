// SEO: организация, сайт, статьи — общие данные для мета-тегов и JSON-LD
import { EMAIL } from './site';

export const SITE_NAME = 'Скоуп';
export const SITE_URL = 'https://skoup.ru';

export const ORGANIZATION = {
  name: SITE_NAME,
  url: SITE_URL,
  email: EMAIL,
};

export interface ArticleMeta {
  /** путь страницы со слешем на конце */
  path: string;
  headline: string;
  section: string;
  /** ISO-дата публикации и обновления */
  published: string;
  modified: string;
  /** og-картинка 1200×630 в public/ — выводится, только если файл лежит */
  ogImage: string;
  ogImageAlt: string;
}

// Даты — только для поисковиков (на странице не выводятся): публикация — выход статьи на skoup.ru.
// Обновили текст статьи — поменяйте modified.
export const ARTICLE_MARKETPLACES: ArticleMeta = {
  path: '/blog/marketplaces-installments/',
  headline: 'UX рассрочки на маркетплейсах: Ozon, Wildberries и Яндекс Маркете: как это выглядит и что говорит закон',
  section: 'Финтех и регуляторика',
  published: '2026-11-06',
  modified: '2026-11-06',
  ogImage: '/og/marketplaces-installments.png',
  ogImageAlt: 'Покупка частями в кредит на Ozon, Wildberries и Яндекс Маркете',
};

export const ARTICLE_UX_LEVELS: ArticleMeta = {
  path: '/blog/three-levels-of-ux/',
  headline: 'Три уровня проектирования UX, на которых строится фундамент финтех-сервисов',
  section: 'Финтех и регуляторика',
  published: '2026-11-18',
  modified: '2026-11-18',
  ogImage: '/og/three-levels-of-ux.png',
  ogImageAlt: 'Три уровня UX для финтеха: регуляторика, прозрачность, доверие',
};
