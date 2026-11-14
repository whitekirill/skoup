// Письмо о новой заявке на in@skoup.ru через Yandex Cloud Postbox (SMTP, API-ключ сервисного аккаунта).
import nodemailer from 'nodemailer';
import { createHmac } from 'node:crypto';

export function createMailer(mail) {
  if (!mail.user || !mail.pass) return null; // Postbox ещё не настроен — заявки копятся, письма уйдут позже
  return nodemailer.createTransport({
    host: mail.host,
    port: mail.port,
    secure: mail.port === 465,
    requireTLS: mail.port !== 465,
    auth: { user: mail.user, pass: mail.pass },
  });
}

/** Подпись ссылки на файл: id/номер/срок */
export function signFile(secret, id, index, expires) {
  return createHmac('sha256', secret).update(`${id}/${index}/${expires}`).digest('base64url');
}

const moscow = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'long', timeStyle: 'short' });

function size(bytes) {
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.max(1, Math.round(kb))} КБ` : `${(kb / 1024).toFixed(1).replace('.', ',')} МБ`;
}

const CONTACT = { email: 'почта', telegram: 'Telegram', url: 'ссылка' };

export function composeLetter(brief, { env, publicUrl, linkSecret, linkDays, from, to }) {
  const expires = Math.floor(Date.now() / 1000) + linkDays * 86400;
  const fileLines = brief.files.map((file, index) => {
    const t = signFile(linkSecret, brief.id, index, expires);
    return `— ${file.name} (${size(file.size)}): ${publicUrl}/api/brief/files/${brief.id}/${index}?e=${expires}&t=${t}`;
  });
  const prefix = env === 'prod' ? '' : `[${env.toUpperCase()}] `;
  const text = [
    `Имя: ${brief.name}`,
    `Компания: ${brief.company}`,
    `Контакт (${CONTACT[brief.contact_type] ?? brief.contact_type}): ${brief.contact}`,
    `Телефон: ${brief.phone}`,
    `Услуги: ${brief.services.join(', ')}`,
    `Бюджет: ${brief.budget}`,
    '',
    'Задача:',
    brief.task || '—',
    '',
    brief.files.length ? `Файлы (ссылки действуют ${linkDays} дней):` : 'Файлов нет.',
    ...fileLines,
    '',
    `Согласие на обработку данных: да, редакция «${brief.consent_version}».`,
    `Согласие на рассылку: ${brief.marketing ? `да, редакция «${brief.marketing_version}»` : 'нет'}.`,
    `Получено: ${moscow.format(new Date(brief.received_at))} (МСК)`,
    `ID заявки: ${brief.id}`,
  ].join('\n');

  return {
    from,
    to,
    subject: `${prefix}Заявка с сайта: ${brief.company} — ${brief.name}`,
    text,
    // ответ из почты сразу уходит заявителю, если он оставил почту
    ...(brief.contact_type === 'email' ? { replyTo: brief.contact } : {}),
  };
}
