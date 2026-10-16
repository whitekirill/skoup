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

Результат «сайт | Figma | diff» — в `tests/screens/diff/`.

## Деплой

Сборка: `npm ci && npm run build`, результат — `dist/`.
