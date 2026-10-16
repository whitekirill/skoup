// Отладка: координаты элементов/слов по селектору. node tests/measure.mjs <width> "<js expression returning data>"
import { chromium } from '@playwright/test';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const T={'.woff2':'font/woff2','.svg':'image/svg+xml','.html':'text/html'};
const s=http.createServer((q,r)=>{let f=path.join('dist',q.url.split('?')[0]);if(f.endsWith('/'))f+='index.html';if(!fs.existsSync(f))return r.writeHead(404).end();r.writeHead(200,{'content-type':T[path.extname(f)]??'text/plain'});fs.createReadStream(f).pipe(r)}).listen(0);
const [w, expr] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:+w,height:900}});
await p.goto(`http://localhost:${s.address().port}/`); await p.evaluate(()=>document.fonts.ready);
console.log(JSON.stringify(await p.evaluate(expr)));
await b.close(); s.close();
