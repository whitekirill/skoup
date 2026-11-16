// Проверка полей брифа. Чистые функции — без DOM, чтобы их можно было прогнать отдельно.
import { FILES } from '../../data/brief';

type ContactType = 'email' | 'telegram' | 'url';

/** Тип контакта и нормализованное значение; null — не похоже ни на почту, ни на ник, ни на ссылку */
export function parseContact(raw: string): { type: ContactType; value: string } | null {
  const value = raw.trim();
  if (!value) return null;
  // почта: есть @ и домен после него
  if (/^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(value)) return { type: 'email', value };
  // ник в Telegram: @ и 5–32 символа из латиницы, цифр и _
  if (/^@[A-Za-z0-9_]{5,32}$/.test(value)) return { type: 'telegram', value };
  // ссылка: с протоколом или в виде домен.зона/…
  if (/^https?:\/\/[^\s/]+\.[^\s/]{2,}(\/\S*)?$/i.test(value)) return { type: 'url', value };
  if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?$/i.test(value)) return { type: 'url', value: `https://${value}` };
  return null;
}

// Телефон: любой страны, без маски (пишут и из России, и из Узбекистана, и из других стран).
// Можно «+», цифры, пробелы, скобки, дефисы и точки; цифр — от 7 до 15 (предел международного формата E.164).

const PHONE_CHARS = /^\+?[\d\s().-]+$/;

/** Нормализованный номер: «+», если был, и цифры — так он уходит на сервер */
export function normalizePhone(raw: string): string {
  const value = raw.trim();
  return (value.startsWith('+') ? '+' : '') + value.replace(/\D/g, '');
}

export function isPhone(raw: string): boolean {
  const value = raw.trim();
  const digits = value.replace(/\D/g, '').length;
  return PHONE_CHARS.test(value) && digits >= 7 && digits <= 15;
}

export const isName = (raw: string) => raw.trim().length >= 2;

type FileProblem = 'size' | 'type' | null;

export function checkFile(file: { name: string; size: number }): FileProblem {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!(FILES.extensions as readonly string[]).includes(ext)) return 'type';
  if (file.size > FILES.maxSize) return 'size';
  return null;
}

/** 2,4 МБ / 860 КБ — как в макете */
export function formatSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} КБ`;
  return `${(kb / 1024).toFixed(1).replace('.', ',')} МБ`;
}
