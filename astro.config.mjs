// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://skoup.ru',
  output: 'static',
  build: {
    inlineStylesheets: 'always',
  },
});
