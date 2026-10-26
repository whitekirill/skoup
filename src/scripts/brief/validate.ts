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

// Телефон: маска +7 (999) 123-45-67

export const PHONE_PREFIX = '+7 ';

/** Цифры номера без кода страны (до 10). Ведущие 7/8 в 11-значном номере — код страны. */
export function phoneDigits(raw: string): string {
  const value = raw.trim();
  let digits = value.replace(/\D/g, '');
  if (value.startsWith('+7')) digits = digits.slice(1);
  else if (digits.length === 11 && /^[78]/.test(digits)) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/** 10 цифр → «+7 (999) 123-45-67»; неполный номер — сколько набрано */
export function formatPhone(digits: string): string {
  const d = digits.slice(0, 10);
  let out = PHONE_PREFIX;
  if (d.length) out += `(${d.slice(0, 3)}`;
  if (d.length >= 3) out += ')';
  if (d.length > 3) out += ` ${d.slice(3, 6)}`;
  if (d.length > 6) out += `-${d.slice(6, 8)}`;
  if (d.length > 8) out += `-${d.slice(8, 10)}`;
  return out;
}

/** Полный российский номер: +7 и 10 цифр */
export const isPhone = (raw: string) => phoneDigits(raw).length === 10;

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
