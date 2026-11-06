# skoup.ru

Лендинг студии «Скоуп». Astro + TypeScript, обычный CSS. Подробности — в `CLAUDE.md`.

```sh
nvm use            # Node 22 (.nvmrc), нужен >= 22.12
npm ci
npm run dev        # http://localhost:4321
npm run build      # статическая сборка в dist/
```

## Проверки

Все — по собранному `dist/` (`npm run build`). Результаты (скриншоты, видео, диффы) пишутся в `tests/screens/` и в git не попадают; эталоны Figma лежат в `tests/reference/figma/`.

| Что | Команда |
|---|---|
| Сверка главной, статьи и брифа с Figma на 1440 и 393 | `npm run test:visual` |
| Регресс «ни пикселя не изменилось» | `node tests/regress.mjs shoot <папка>` → после правок `node tests/regress.mjs compare <папка> <новая>` |
| Размеры JS и CSS сборки | `node tests/sizes.mjs` |
| Lighthouse mobile и desktop (главная, статья, бриф) | `bash tests/lighthouse.sh [папка]` |
| Видео анимаций (вордмарк, кейсы, галерея, навигация статьи) | `node tests/anim-video.mjs <папка>` |
| Бриф: сценарии, плавность | `node tests/brief-flow.mjs`, `node tests/brief-perf.mjs` |
| Навигация статьи, параллакс кейсов, свой ползунок | `node tests/article-nav.mjs`, `node tests/case-parallax.mjs`, `node tests/scrollbar.mjs` |
| Плавность скролла (CPU ×4) | `node tests/scroll-perf.mjs` |

Координаты элементов для отладки: `node tests/measure.mjs 1440 "<js-выражение>"`.

## SEO и индексация

| Переменная сборки | Что делает |
|---|---|
| `PUBLIC_INDEXABLE=true` | Сайт открыт для поиска. Без неё на всех страницах `<meta name="robots" content="noindex, nofollow">` — так собираются превью. Ставить только для сборки, которая уходит на skoup.ru |
| `PUBLIC_YANDEX_VERIFICATION` | Код подтверждения Яндекс.Вебмастера → `<meta name="yandex-verification">` |
| `PUBLIC_GOOGLE_SITE_VERIFICATION` | Код Google Search Console → `<meta name="google-site-verification">` |
| `PUBLIC_BRIEF_ENDPOINT` | Адрес отправки брифа (без неё — мок) |

- `robots.txt`, `sitemap-index.xml` (через `@astrojs/sitemap`, только реальные страницы), страница `404.html` — в сборке.
- Адреса — со слешем на конце (`trailingSlash: 'always'`). Без слеша — 301: на Layero через `public/_redirects`.
- Файлы, которые подключатся сами, как только появятся в `public/`: `favicon.svg`, `favicon.ico`, `apple-touch-icon.png` (180×180), `site.webmanifest`, `og/home.png` и `og/marketplaces-installments.png` (1200×630). Пока файла нет, тег не выводится.
- JSON-LD: `Organization` и `WebSite` на всех страницах, `Article` и `BreadcrumbList` на статье (`src/components/Seo.astro`, данные — `src/data/seo.ts`).

### Свой сервер (nginx)

```nginx
# адреса без слеша → со слешем
rewrite ^(/[^.]*[^/])$ $1/ permanent;
# своя страница 404
error_page 404 /404.html;
```

## Деплой

Сборка: `npm ci && npm run build`, результат — `dist/`. Превью — Layero, каждая ветка получает свой адрес `skoup-<ветка>.layero.app` (Layero сам отдаёт превью с `X-Robots-Tag: noindex`).
