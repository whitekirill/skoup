// Бриф: сценарии из ТЗ. Собирает копию сайта с PUBLIC_BRIEF_ENDPOINT на локальный сервер,
// который записывает заявку (или отвечает 500 для проверки ошибки сети).
// Запуск: node tests/brief-flow.mjs
import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('tests/.brief-dist');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif' };
let failNext = false;
let lastBody = '';
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/brief') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      lastBody = Buffer.concat(chunks).toString('utf8');
      res.writeHead(failNext ? 500 : 200).end();
    });
    return;
  }
  let file = path.join(OUT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);
const port = server.address().port;
execSync(`npx astro build --outDir ${OUT}`, { env: { ...process.env, PUBLIC_BRIEF_ENDPOINT: `http://localhost:${port}/api/brief` }, stdio: 'ignore' });
const base = `http://localhost:${port}/`;

let pass = 0, fail = 0;
const check = (cond, msg) => { cond ? pass++ : fail++; console.log(`${cond ? '✓' : '✗'} ${msg}`); };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const isOpen = () => page.evaluate(() => document.getElementById('brief').open);
const errText = (name) => page.evaluate((n) => { const e = document.getElementById(`brief-${n}-error`); return e.hidden ? '' : e.textContent; }, name);
const submit = async () => { await page.click('[data-brief-submit]'); await page.waitForTimeout(150); };

// 1. Открытие по CTA
await page.goto(base); await page.waitForTimeout(500);
await page.click('.hero [data-brief-open]');
await page.waitForTimeout(900);
check(await isOpen(), 'CTA в hero открывает бриф');
check((await page.evaluate(() => location.hash)) === '#brief', 'в URL #brief');
check(await page.evaluate(() => document.getElementById('brief').contains(document.activeElement)), 'фокус внутри брифа');
check(await page.evaluate(() => ['hidden', 'clip'].includes(getComputedStyle(document.documentElement).overflowY)), 'скролл страницы заблокирован');

// 2. Пустая отправка — 6 обязательных пунктов
await submit();
const invalid = await page.evaluate(() => document.querySelectorAll('#brief [aria-invalid="true"]').length);
const groups = await page.evaluate(() => [...document.querySelectorAll('.brief__group-error')].filter((e) => !e.hidden).length);
check(invalid === 4 && groups === 2, `пустая отправка: полей с ошибкой ${invalid}, групп ${groups} (ждём 4 + 2)`);
check((await errText('name')) === 'Укажите имя' && (await errText('services')) === 'Выберите хотя бы одну услугу' && (await errText('budget')) === 'Выберите бюджет', 'тексты ошибок как в ТЗ');
check(await page.evaluate(() => document.activeElement?.id === 'brief-name'), 'фокус на первом поле с ошибкой');
check(await page.evaluate(() => document.getElementById('brief-name').getAttribute('aria-describedby') === 'brief-name-error'), 'aria-describedby на текст ошибки');

// 3. Исправление на лету
await page.fill('#brief-name', 'Анна');
check((await errText('name')) === '', 'ошибка имени исчезает при вводе');
await page.fill('#brief-company', 'Банк');

// 4. Контакт
for (const [v, okExpected] of [['anna@company.ru', true], ['@anna_skoup', true], ['t.me/anna_skoup', true], ['https://vk.com/anna', true], ['Анна', false], ['123', false]]) {
  await page.fill('#brief-contact', v);
  const e = await errText('contact');
  check(okExpected ? e === '' : e === 'Нужна почта, @ник или ссылка', `контакт «${v}» → ${e || 'ок'}`);
}
await page.fill('#brief-contact', 't.me/anna_skoup');

// 5a. Маска телефона +7
const phoneVal = () => page.inputValue('#brief-phone');
await page.fill('#brief-phone', '');
await page.focus('#brief-phone');
check((await phoneVal()) === '+7 ', 'фокус в пустом телефоне — «+7 »');
await page.keyboard.type('9991234567');
check((await phoneVal()) === '+7 (999) 123-45-67', `набор 9991234567 → ${await phoneVal()}`);
await page.keyboard.type('8');
check((await phoneVal()) === '+7 (999) 123-45-67', 'лишние цифры не добавляются');
await page.fill('#brief-phone', ''); await page.focus('#brief-phone');
await page.keyboard.type('89161234567');
check((await phoneVal()) === '+7 (916) 123-45-67', `набор с 8 → ${await phoneVal()}`);
await page.fill('#brief-phone', ''); await page.focus('#brief-phone');
await page.keyboard.insertText('+7 999 123 45 67');
check((await phoneVal()) === '+7 (999) 123-45-67', `вставка «+7 999 123 45 67» → ${await phoneVal()}`);
// Backspace сразу после «)» стирает цифру
await page.evaluate(() => { const i = document.getElementById('brief-phone'); i.setSelectionRange(8, 8); });
await page.keyboard.press('Backspace');
check((await phoneVal()) === '+7 (991) 234-56-7', `Backspace по «)» → ${await phoneVal()}`);
// правка в середине: курсор остаётся у цифры
await page.keyboard.type('9');
check((await phoneVal()) === '+7 (999) 123-45-67' && (await page.evaluate(() => document.getElementById('brief-phone').selectionStart)) === 7, 'вставка цифры в середину — курсор сразу после неё');
await page.fill('#brief-phone', ''); await page.focus('#brief-phone'); await page.locator('#brief-company').focus();
check((await phoneVal()) === '', 'пустой «+7 » при уходе с поля убирается (виден плейсхолдер)');
check((await errText('phone')) === 'Укажите телефон', 'только «+7 » — «Укажите телефон»');

// 5. Короткий телефон
await page.fill('#brief-phone', '+7 999');
check((await errText('phone')) === 'Проверьте номер', 'короткий телефон → «Проверьте номер»');
await page.fill('#brief-phone', '+7 (999) 123-45-67');
check((await errText('phone')) === '', 'корректный телефон — ошибки нет');

// 6. Без услуг / без бюджета
await submit();
check((await errText('services')) !== '' && (await errText('budget')) !== '', 'без услуг и бюджета — ошибки групп');
check(await page.evaluate(() => document.activeElement?.name === 'services'), 'фокус на первой группе с ошибкой');
await page.click('.chip:has(input[value="Стратегия"])');
await page.click('.chip:has(input[value="Сайт"])');
check((await errText('services')) === '', 'ошибка услуг исчезает после выбора');
await page.click('.chip:has(input[value="3 млн ₽ - 6 млн ₽"])');
await page.click('.chip:has(input[value="более 6 млн ₽"])');
check((await page.evaluate(() => document.querySelectorAll('input[name="budget"]:checked').length)) === 1, 'бюджет — ровно один вариант');

// 7. Файлы
const tmp = fs.mkdtempSync(path.join(OUT, 'files-'));
const mk = (name, size) => { const f = path.join(tmp, name); fs.writeFileSync(f, Buffer.alloc(size)); return f; };
await page.setInputFiles('[data-upload-input]', [mk('brief-skoup.pdf', 2.4 * 1024 * 1024), mk('big.pdf', 60 * 1024 * 1024), mk('virus.exe', 100)]);
const items = await page.evaluate(() => [...document.querySelectorAll('.file')].map((f) => `${f.querySelector('.file__name').textContent}|${f.querySelector('.file__meta').textContent}|${f.classList.contains('is-error')}`));
check(items.join() === 'brief-skoup.pdf|2,4 МБ|false,big.pdf|Файл больше 50 МБ|true,virus.exe|Формат не поддерживается|true', `файлы: ${items.join(' / ')}`);
check((await page.textContent('[data-upload-action]')) === 'Прикрепить ещё', 'после первого файла — «Прикрепить ещё»');
await page.click('.file:nth-child(3) [data-file-remove]');
check((await page.evaluate(() => document.querySelectorAll('.file').length)) === 2, 'файл удаляется крестиком');

// 8. Ошибка сети — данные сохраняются
failNext = true;
await page.fill('#brief-task', 'Нужно переделать онбординг');
await page.click('[data-brief-submit]');
check((await page.textContent('[data-brief-submit] .btn__text')) === 'Отправляем…' && (await page.evaluate(() => document.querySelector('[data-brief-submit]').disabled)), 'во время отправки — «Отправляем…», кнопка disabled');
await page.waitForTimeout(600);
check((await page.textContent('[data-brief-send-error]')).startsWith('Не получилось отправить'), 'ошибка сети показана');
check((await page.inputValue('#brief-name')) === 'Анна', 'введённые данные сохранились');

// 9. Успешная отправка
failNext = false;
await page.click('[data-brief-submit]');
await page.waitForSelector('[data-brief-view="success"]:not([hidden])', { timeout: 5000 });
check(true, 'экран успеха показан');
const has = (k, v) => lastBody.includes(`name="${k}"\r\n\r\n${v}`);
check(has('phone', '+79991234567') && has('name', 'Анна') && has('company', 'Банк') && has('contact', 'https://t.me/anna_skoup') && has('contact_type', 'url') && has('budget', 'более 6 млн ₽'), 'в заявке поля, телефон +79991234567, contact с https:// и contact_type=url');
check((lastBody.match(/name="services"/g) || []).length === 2, 'в заявке две услуги');
check(lastBody.includes('filename="brief-skoup.pdf"') && !lastBody.includes('big.pdf'), 'в заявку ушёл только файл без ошибки');
check(lastBody.includes('multipart/form-data') || /^--/.test(lastBody), 'multipart/form-data');

// 10. «На главную» закрывает, повторное открытие — чистая форма
await page.click('[data-brief-view="success"] [data-brief-close]');
await page.waitForTimeout(900);
check(!(await isOpen()) && (await page.evaluate(() => location.hash)) === '', '«На главную» закрывает бриф и убирает #brief');
check(await page.evaluate(() => document.activeElement?.matches('.hero [data-brief-open]')), 'фокус вернулся на кнопку, которой открыли');
await page.click('.hero [data-brief-open]');
await page.waitForTimeout(900);
check((await page.inputValue('#brief-name')) === '' && (await page.evaluate(() => document.querySelector('[data-brief-view="form"]').hidden === false && document.querySelectorAll('.file').length === 0)), 'повторное открытие — чистая форма');

// 11. Esc и «Назад»
await page.keyboard.press('Escape'); await page.waitForTimeout(900);
check(!(await isOpen()) && (await page.evaluate(() => location.hash)) === '', 'Esc закрывает бриф');
await page.click('.hero [data-brief-open]'); await page.waitForTimeout(900);
await page.goBack(); await page.waitForTimeout(900);
check(!(await isOpen()), 'кнопка «Назад» закрывает бриф');

// 12. /#brief открывает сразу
await page.goto(base + '#brief'); await page.waitForTimeout(900);
check(await isOpen(), '/#brief открывает бриф сразу');
await page.click('.brief__close'); await page.waitForTimeout(900);
check(!(await isOpen()) && (await page.evaluate(() => location.hash)) === '', '× закрывает бриф, открытый по прямой ссылке');

// 13. Только клавиатура
await page.goto(base + '#brief'); await page.waitForTimeout(900);
await page.focus('#brief-name');
await page.keyboard.type('Пётр'); await page.keyboard.press('Tab');
await page.keyboard.type('Финтех'); await page.keyboard.press('Tab');
await page.keyboard.type('@petr_fintech'); await page.keyboard.press('Tab');
await page.keyboard.type('+7 912 000 00 00'); await page.keyboard.press('Tab');
await page.keyboard.press('Space'); // первая услуга
const chipFocus = await page.evaluate(() => getComputedStyle(document.activeElement.closest('.chip')).outlineStyle);
check(chipFocus === 'solid', 'фокус на чипсе виден (outline)');
// до бюджета: Tab по услугам → поле задачи → «Прикрепить» → первый вариант бюджета, стрелкой — выбор
for (let i = 0; i < 9; i++) { await page.keyboard.press('Tab'); if (await page.evaluate(() => document.activeElement?.name === 'budget')) break; }
await page.keyboard.press('Space');
await page.keyboard.press('Tab');
check(await page.evaluate(() => document.activeElement?.matches('[data-brief-submit]')), 'Tab доходит до «Отправить заявку»');
await page.keyboard.press('Enter');
await page.waitForSelector('[data-brief-view="success"]:not([hidden])', { timeout: 5000 }).then(() => check(true, 'форма отправлена только с клавиатуры'), () => check(false, 'форма отправлена только с клавиатуры'));

check(errors.length === 0, `ошибок в консоли нет${errors.length ? ': ' + errors.join('; ') : ''}`);
console.log(`\nИтого: ${pass} ок, ${fail} с ошибкой`);
await browser.close();
server.close();
fs.rmSync(OUT, { recursive: true, force: true });
