// Бриф: варианты чипсов, ограничения файлов, тексты ошибок (по ТЗ брифа)

export const TELEGRAM_URL = 'https://t.me/TODO'; // TODO: ссылка на Telegram студии
export const PRESENTATION_URL = '/skoup-presentation.pdf'; // TODO: файл презентации

export const SERVICES = [
  'Продуктовый дизайн',
  'UX-исследование',
  'Дизайн-поддержка',
  'Мобильное приложение',
  'Стратегия',
  'Сайт',
] as const;

// Тексты — как в макете (451:5845)
export const BUDGETS = [
  'Менее 500 тыс ₽',
  '500 тыс ₽ - 1 млн ₽',
  '1,5 млн ₽ - 3 млн ₽',
  '3 млн ₽ - 6 млн ₽',
  'более 6 млн ₽',
] as const;

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
  budget: { empty: 'Выберите бюджет' },
  fileSize: 'Файл больше 50 МБ',
  fileType: 'Формат не поддерживается',
  submit: 'Не получилось отправить. Попробуйте ещё раз или напишите на in@skoup.ru',
} as const;
