// Check the actual encoded file resolution, not density-adjusted naturalWidth.
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('dist');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.avif':'image/avif','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{let f=path.join(root,new URL(req.url,'http://x').pathname);if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f))return res.writeHead(404).end();res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);}).listen(0);
const browser=await chromium.launch();
try {
  for(const [width,dpr] of [[1440,1],[1440,2],[393,2],[393,3],[360,3],[768,2]]) {
    const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:dpr,reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.locator('#cases').scrollIntoViewIfNeeded();
    await page.evaluate(async()=>{document.querySelectorAll('#cases img').forEach(i=>i.loading='eager');await document.fonts.ready;await Promise.all([...document.querySelectorAll('#cases img')].map(i=>i.decode()));document.querySelector('.sticky-brief')?.remove();});
    const data=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,cards:[...document.querySelectorAll('.case__media img')].map(i=>({src:i.currentSrc,w:i.clientWidth,h:i.clientHeight})),sources:[...document.querySelectorAll('.case__media source')].map(s=>s.srcset)}));
    assert.equal(data.overflow,0);assert.equal(data.cards.length,7);assert.deepEqual(errors,[]);
    for(const srcset of data.sources)for(const entry of srcset.split(', ')){const [src,descriptor]=entry.split(' ');const m=await sharp(path.join(root,new URL(src,'http://x').pathname)).metadata();assert.equal(m.width,Number(descriptor.replace('w','')),'srcset must describe the encoded width');}
    const details=[];
    for(const card of data.cards){const m=await sharp(path.join(root,new URL(card.src).pathname)).metadata();const density=Math.min(m.width/card.w,m.height/card.h);assert.ok(density>=Math.min(dpr,2)*.98,`${card.src}: density ${density} below ${dpr}x`);details.push({file:path.basename(card.src),width:m.width,height:m.height,density:Number(density.toFixed(2))});}
    console.log(JSON.stringify({viewport:width,dpr,cards:details}));
    if((width===1440&&dpr===2)||(width===393&&dpr===3)){fs.mkdirSync('../../outputs',{recursive:true});await page.locator('#cases').screenshot({path:`../../outputs/cases-hq-${width}.png`});}
    await page.close();
  }
} finally {await browser.close();server.close();}
