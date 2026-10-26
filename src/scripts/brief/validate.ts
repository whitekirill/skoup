// Проверка полей брифа. Чистые функции — без DOM, чтобы их можно было прогнать отдельно.
import { FILES } from '../../data/brief';

export type ContactType = 'email' | 'telegram' | 'url';

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

/** Телефон в международном формате: «+» и 10–15 цифр; пробелы, скобки и дефисы игнорируем */
export function isPhone(raw: string): boolean {
  return /^\+\d{10,15}$/.test(raw.replace(/[\s()-]/g, ''));
}

export const isName = (raw: string) => raw.trim().length >= 2;

export type FileProblem = 'size' | 'type' | null;

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
