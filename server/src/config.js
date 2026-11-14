// Настройки сервиса брифа: из переменных окружения, секреты — из файлов Docker secrets (<ИМЯ>_FILE).
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// «-» — пустой секрет: Docker не создаёт секрет без содержимого, а ключа Postbox может ещё не быть
function secret(name) {
  const file = process.env[`${name}_FILE`];
  let value = process.env[name] ?? '';
  if (file) {
    try {
      value = readFileSync(file, 'utf8').trim();
    } catch {
      value = '';
    }
  }
  return value === '-' ? '' : value;
}

let linkSecret = secret('LINK_SECRET');
if (!linkSecret) {
  // без постоянного ключа ссылки на файлы из писем перестанут работать после перезапуска
  console.warn(JSON.stringify({ event: 'config', warning: 'LINK_SECRET не задан — ключ ссылок временный' }));
  linkSecret = randomBytes(32).toString('hex');
}

export const config = {
  port: Number(process.env.PORT ?? 3200),
  /** test | prod | dev — в теме письма у не-боевых окружений будет пометка */
  env: process.env.APP_ENV ?? 'dev',
  dataDir: process.env.DATA_DIR ?? '/data',
  /** адрес сайта для ссылок на файлы в письме */
  publicUrl: (process.env.PUBLIC_URL ?? 'http://localhost:3200').replace(/\/$/, ''),
  mail: {
    to: process.env.MAIL_TO ?? 'in@skoup.ru',
    from: process.env.MAIL_FROM ?? 'Скоуп <noreply@skoup.ru>',
    host: process.env.SMTP_HOST ?? 'postbox.cloud.yandex.net',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: secret('SMTP_USER'),
    pass: secret('SMTP_PASS'),
  },
  linkSecret,
  /** сколько дней действуют ссылки на файлы в письме */
  linkDays: 30,
  /** сроки хранения из политики (src/pages/privacy.astro, RETENTION в src/data/site.ts) */
  retention: { briefDays: 3 * 365, filesDays: 365 },
};

/**
 * Ограничения формы — те же, что на сайте (FILES в src/data/brief.ts).
 * Меняете там — поменяйте и здесь.
 */
export const LIMITS = {
  files: 5,
  fileSize: 50 * 1024 * 1024,
  extensions: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'key', 'xls', 'xlsx', 'png', 'jpg', 'zip'],
  text: 200,
  task: 10000,
  services: 10,
};
