# skoup.ru

Лендинг студии «Скоуп». Astro + TypeScript, обычный CSS. Подробности — в `CLAUDE.md`.

```sh
nvm use            # Node 22 (.nvmrc)
npm ci
npm run dev        # http://localhost:4321
npm run build      # статическая сборка в dist/
```

## Сверка с Figma

Эталоны — скриншоты нод Figma в `tests/screens/figma/` (Desktop 1440, Mobile 393).

```sh
npm run build
node tests/compare.mjs desktop 0 836   # вьюпорт, диапазон по Y
node tests/compare.mjs mobile 0 934
```

Результат «сайт | Figma | diff» — в `tests/screens/diff/`. Если страница сдвинута относительно макета, четвёртый аргумент — начало того же участка в Figma: `node tests/compare.mjs mobile 6038 6960 6070`.

Координаты элементов для отладки: `node tests/measure.mjs 1440 "<js-выражение>"`.

Живая иллюстрация первого экрана: `node tests/hero-anim.mjs desktop|mobile [папка]` — кадры сборки, наведение, шлейф, касание и замер кадров. Сверка с Figma (`compare.mjs`) идёт с reduced motion, по статичной картинке.

Бриф: `node tests/brief-visual.mjs` — скриншоты формы и экрана успеха на 1440/393 против Figma; `node tests/brief-flow.mjs` — сценарии из ТЗ; `node tests/brief-perf.mjs` — плавность открытия/закрытия (CPU ×4, видимая полоса прокрутки) (валидация, файлы, отправка, Esc/«Назад», `/#brief`, клавиатура). Адрес отправки — env `PUBLIC_BRIEF_ENDPOINT`, без него мок.

Плавность скролла (долгие кадры при прокрутке, CPU ×4): `node tests/scroll-perf.mjs`. Иллюстрация первого экрана под курсором во время скролла: `node tests/hero-scroll.mjs`.

Свой ползунок прокрутки (появление/скрытие, перетаскивание, клик по дорожке, бриф, reduced motion): `node tests/scrollbar.mjs`.

Сверка отдельного блока со скриншотом ноды Figma: `node tests/compare-node.mjs 1440 ".services" tests/screens/figma/node-376-8149.png`.

## Деплой

Сборка: `npm ci && npm run build`, результат — `dist/`.

Страница «О нас» (/about): `node tests/about.mjs` — скриншоты на 1440/1024/768/393/360 и сверка секций 1440 и 393 с Figma; `node tests/about-motion.mjs` — закреплённый заголовок, лента шотов (сдвиг со скроллом, растяжение и сборка, параллакс, кадры при CPU ×4), видео на 1440 и 393, заливка абзаца, reduced motion, без JS.
