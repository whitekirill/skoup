// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import typograph from './scripts/typograph-integration.mjs';

// В логе сборки: включена ли индексация и какие переменные про ветку/коммит видит сборщик
const buildInfo = {
  name: 'skoup-build-info',
  hooks: {
    'astro:build:start': ({ logger }) => {
      logger.info(`индексация: ${process.env.PUBLIC_INDEXABLE === 'true' ? 'включена' : 'выключена (noindex)'}`);
      const keys = Object.keys(process.env).filter((k) => /BRANCH|LAYERO|COMMIT|DEPLOY|GIT|^CI$|ENVIRONMENT/i.test(k));
      logger.info(`переменные сборки: ${keys.map((k) => (/BRANCH|ENVIRONMENT/i.test(k) ? `${k}=${process.env[k]}` : k)).join(', ') || 'нет'}`);
    },
  },
};

export default defineConfig({
  site: 'https://skoup.ru',
  output: 'static',
  // единый вид адресов — со слешем на конце; без слеша — 301 (public/_redirects для Layero, nginx — в README)
  trailingSlash: 'always',
  build: {
    inlineStylesheets: 'always',
  },
  // предзагрузка страниц только по data-astro-prefetch (карточка статьи в блоге)
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  integrations: [
    buildInfo,
    // sitemap: только страницы сайта (404 Astro не включает)
    sitemap(),
    // неразрывные пробелы после предлогов и перед тире во всём тексте сайта
    typograph(),
  ],
});
