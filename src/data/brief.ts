// Бриф: варианты чипсов, ограничения файлов, тексты ошибок (по ТЗ брифа)
import { CTA } from './site';

export const TELEGRAM_URL = 'https://t.me/TODO'; // TODO: ссылка на Telegram студии
/** Презентация — та же ссылка, что на главной (Google Диск) */
export const PRESENTATION_URL = CTA.presentation.href;

export const SERVICES = [
  'Продуктовый дизайн',
  'UX-исследование',
  'Дизайн-поддержка',
  'Мобильное приложение',
  'Стратегия',
  'Сайт',
] as const;

/** Предпочтительный способ связи — вместо бюджета (по просьбе), один вариант */
export const CONTACT_METHODS = ['Telegram', 'Email', 'Телефон', 'WhatsApp'] as const;

export const FILES = {
  max: 5,
  maxSize: 50 * 1024 * 1024,
  extensions: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'key', 'xls', 'xlsx', 'png', 'jpg', 'zip'],
} as const;

export const ERRORS = {
  name: { empty: 'Укажите имя', invalid: 'Укажите имя' },
  company: { empty: 'Укажите компанию', invalid: 'Укажите компанию' },
  contact: { empty: 'Укажите почту или другой контакт', invalid: 'Нужна почта, @ник или ссылка' },
  phone: { empty: 'Укажите телефон', invalid: 'Проверьте номер' },
  services: { empty: 'Выберите хотя бы одну услугу' },
  contactMethod: { empty: 'Выберите способ связи' },
  consent: 'Отметьте согласие на обработку данных',
  fileSize: 'Файл больше 50 МБ',
  fileType: 'Формат не поддерживается',
  submit: 'Не получилось отправить. Попробуйте ещё раз или напишите на in@skoup.ru',
} as const;
