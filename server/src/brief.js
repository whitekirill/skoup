// Разбор multipart-формы брифа (файлы пишутся на диск потоком) и проверка полей.
import Busboy from 'busboy';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { LIMITS } from './config.js';

/** Разбирает запрос; файлы складывает в tmpDir под номерами 0..4 */
export function parseBrief(req, tmpDir) {
  return new Promise((resolve, reject) => {
    const fields = { services: [] };
    const files = [];
    const problems = [];
    const writes = [];
    let bb;
    try {
      bb = Busboy({
        headers: req.headers,
        defParamCharset: 'utf8', // кириллица в именах файлов
        limits: { files: LIMITS.files, fileSize: LIMITS.fileSize, fields: 40, fieldSize: 20000, parts: 50 },
      });
    } catch (error) {
      reject(error);
      return;
    }

    bb.on('field', (name, value) => {
      if (name === 'services') fields.services.push(value);
      else fields[name] = value;
    });

    bb.on('file', (name, stream, info) => {
      const original = cleanName(info.filename);
      const ext = original.split('.').pop()?.toLowerCase() ?? '';
      if (name !== 'files' || !LIMITS.extensions.includes(ext)) {
        problems.push('file_type');
        stream.resume();
        return;
      }
      const index = files.length;
      const entry = { name: original, size: 0 };
      files.push(entry);
      const out = createWriteStream(join(tmpDir, String(index)));
      stream.on('data', (chunk) => (entry.size += chunk.length));
      stream.on('limit', () => problems.push('file_size'));
      writes.push(
        new Promise((done, fail) => {
          out.on('finish', done);
          out.on('error', fail);
        }),
      );
      stream.pipe(out);
    });

    bb.on('filesLimit', () => problems.push('files_count'));
    bb.on('partsLimit', () => problems.push('too_many_parts'));
    bb.on('error', reject);
    bb.on('close', () => {
      Promise.all(writes).then(() => resolve({ fields, files, problems }), reject);
    });
    req.pipe(bb);
  });
}

/** Имя файла без путей и управляющих символов, не длиннее 200 знаков */
function cleanName(raw = '') {
  const base = String(raw).split(/[\\/]/).pop() ?? '';
  const name = base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(-200);
  return name || 'file';
}

/** Предпочтительный способ связи — те же варианты, что CONTACT_METHODS в src/data/brief.ts */
const CONTACT_METHODS = ['Telegram', 'Email', 'Телефон', 'WhatsApp'];

const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** Проверка полей. Возвращает { spam } | { error } | { brief } */
export function validateBrief({ fields, files, problems }) {
  // поле-ловушка: человек его не видит и не заполняет
  if (str(fields.website)) return { spam: true };
  if (problems.length) return { error: problems[0] };

  const name = str(fields.name);
  const company = str(fields.company);
  const contact = str(fields.contact);
  const contactType = str(fields.contact_type);
  const phone = str(fields.phone);
  const contactMethod = str(fields.contact_method);
  const task = str(fields.task);
  const services = fields.services.map(str).filter(Boolean);
  const consentVersion = str(fields.consent_version);
  const marketing = str(fields.marketing) === 'yes';

  if (str(fields.consent) !== 'yes' || !consentVersion) return { error: 'consent' };
  if (!name || !company || !contact || !phone || !contactMethod || !services.length) return { error: 'required' };
  if ([name, company, contact, consentVersion, ...services].some((v) => v.length > LIMITS.text)) {
    return { error: 'too_long' };
  }
  if (task.length > LIMITS.task || services.length > LIMITS.services) return { error: 'too_long' };
  if (!['email', 'telegram', 'url'].includes(contactType)) return { error: 'contact' };
  // телефон любой страны: «+», если был, и 7–15 цифр (сайт присылает уже без пробелов и скобок)
  if (!/^\+?\d{7,15}$/.test(phone)) return { error: 'phone' };
  if (!CONTACT_METHODS.includes(contactMethod)) return { error: 'contact_method' };

  return {
    brief: {
      name,
      company,
      contact,
      contactType,
      phone,
      contactMethod,
      task,
      services,
      files,
      consentVersion,
      marketing,
      marketingVersion: marketing ? str(fields.marketing_version).slice(0, LIMITS.text) || consentVersion : null,
    },
  };
}
