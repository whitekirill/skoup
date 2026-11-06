// Типограф при сборке: во всех HTML из dist короткие слова (предлоги, союзы, частицы — 1–2 буквы
// и «для / без / при / про / под / над») привязываются неразрывным пробелом к следующему слову,
// а тире — к предыдущему. Трогаем только текст между тегами: не атрибуты, не <script>, <style>, <svg>.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NBSP = ' ';
const SHORT = /(^|[\s(«„"—>])([а-яёА-ЯЁ]{1,2}|[A-Za-z]|[Дд]ля|[Бб]ез|[Пп]ри|[Пп]ро|[Пп]од|[Нн]ад)[ \t\n]+(?=[^\s<])/g;
const DASH = /[ \t\n]+—/g;

function typographText(text) {
  // два прохода — для цепочек коротких слов («и в банке»)
  return text.replace(SHORT, `$1$2${NBSP}`).replace(SHORT, `$1$2${NBSP}`).replace(DASH, `${NBSP}—`);
}

// блоки, внутри которых текст не трогаем: вырезаются целиком, остальное — текст между тегами
const RAW = /<(script|style|svg|textarea|pre|code)\b[\s\S]*?<\/\1>/gi;

function typographHtml(html) {
  let out = '';
  let last = 0;
  for (const m of html.matchAll(RAW)) {
    out += typographPlain(html.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + typographPlain(html.slice(last));
}

function typographPlain(html) {
  return html.replace(/(<[^>]*>)|([^<]+)/g, (m, tag, text) => (tag ? tag : typographText(text)));
}

export default function typograph() {
  return {
    name: 'skoup-typograph',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const walk = (d) => {
          for (const f of fs.readdirSync(d)) {
            const p = path.join(d, f);
            if (fs.statSync(p).isDirectory()) walk(p);
            else if (p.endsWith('.html')) fs.writeFileSync(p, typographHtml(fs.readFileSync(p, 'utf8')));
          }
        };
        walk(root);
        logger.info('неразрывные пробелы расставлены');
      },
    },
  };
}
