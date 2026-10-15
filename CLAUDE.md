# Скоуп — сайт skoup.ru

Лендинг продуктовой дизайн-студии «Скоуп» (финтех, банки, регуляторика). Вся копия на русском.

## Жёсткие правила контента
- Нигде не упоминать Module / module.agency.
- Никакой географии (города, страны, «из России» и т. п.).
- Не писать «команда из 4 человек».
- Дизайн чистый, минималистичный, с воздухом. Ничего не «украшать» от себя — только то, что есть в макете.

## Источник правды — Figma
Файл: `C5Sq8NZLbfXobJ6Szbybcb` (https://www.figma.com/design/C5Sq8NZLbfXobJ6Szbybcb/Skoup.ru)

| Что | Node ID |
|---|---|
| Desktop · Главная (1440) | `381:17691` |
| Desktop · Скролл (sticky CTA) | `381:18310` |
| Mobile · Главная (393) | `391:2634` |
| Mobile · Скролл (sticky CTA) | `391:5856` |
| Mobile · Меню открыто | `411:14165` |
| Foundations (документация токенов) | `411:14290` |
| Components: Buttons / Navigation / Cards / Footer / Brand / Illustrations | секции `411:14284` … `411:14289` |

Перед реализацией блока — `get_design_context` + `get_screenshot` по нужной ноде на обоих брейкпоинтах.

## Стек
- Astro + TypeScript, без UI-фреймворка на клиенте. Обычный CSS (без Tailwind).
- Токены: `src/styles/tokens.css` (сгенерированы из Figma-переменных), стили текста: `src/styles/typography.css` (`.t-h1` … `.t-display` = текстовые стили Figma).
- Шрифты self-hosted: Manrope 500, Geist Mono 300/500 (кириллица + латиница, woff2, preload).
- Картинки: обложки кейсов в двух кадрированиях (Desktop / Mobile) → `<picture>` AVIF/WebP, lazy. Халфтон-иллюстрации — SVG.
- Анимации (позже): отдельные острова Astro, GSAP/Motion One или canvas/WebGL для халфтона, обязательно `prefers-reduced-motion`.

## Адаптив
- Брейкпоинты макета: Mobile 393, Desktop 1440. Между ними — резина: adaptive-токены уже интерполируются `clamp()` в `tokens.css`.
- Структурные перестроения (бургер вместо навигации, карусель услуг, стопка колонок в футере, этапы в горизонтальном скролле) — через `@media (max-width: 767px)`.
- Поля страницы `--layout-page-padding`, вертикальные отступы секций `--layout-section-padding`.

## Компоненты (имена = имена в Figma)
Button (Primary / Secondary / Inverse / Navbutton × Default / Hover / Focus / Disabled; hover = скругление в pill), IconButton, Header, MobileMenu, StickyCTA, Footer, ServiceCard, CaseCard, FormatCard, FactCard, StepCard, BlogPost, IncludedItem, Logo.
Свойства компонентов в Figma (Title, Description, Media, Logo, Illustration…) = пропсы.

## Качество
- Pixel perfect на 393 и 1440: Playwright-скриншоты страницы сравниваются со скриншотами нод Figma.
- Lighthouse ≥ 95 (Performance, Accessibility, Best Practices, SEO).
- Семантика, фокус-стейты, alt-тексты, контраст.

## Деплой
- Тест: превью на Vercel (импорт репозитория, каждый пуш — новая ссылка).
- Прод: статическая сборка `dist/` на свой сервер skoup.ru.
