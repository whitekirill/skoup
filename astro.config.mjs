// @ts-check
import { defineConfig } from 'astro/config';
import typograph from './scripts/typograph-integration.mjs';

export default defineConfig({
  site: 'https://skoup.ru',
  output: 'static',
  build: {
    inlineStylesheets: 'always',
  },
  // неразрывные пробелы после предлогов и перед тире во всём тексте сайта
  integrations: [typograph()],
});
