import { readFileSync, writeFileSync } from 'fs';
import { JSDOM } from 'jsdom';

const files = [
  'C:/Users/bilal/Desktop/1407 debug/tryol logs/TGO Yemek.html',
  'C:/Users/bilal/Desktop/1407 debug/ysepeti logs/ysepeti1.html'
];

for (const file of files) {
  let html = readFileSync(file, 'utf-8');
  // Replace br and div/p with newlines to simulate innerText
  html = html.replace(/<br\s*\/?>/gi, '\n');
  html = html.replace(/<\/div>/gi, '\n');
  html = html.replace(/<\/p>/gi, '\n');
  html = html.replace(/<\/li>/gi, '\n');
  html = html.replace(/<\/tr>/gi, '\n');
  
  const dom = new JSDOM(html);
  const scripts = dom.window.document.querySelectorAll('script, style, noscript');
  scripts.forEach(s => s.remove());

  const text = dom.window.document.body.textContent || '';
  const cleanText = text.replace(/\n\s*\n/g, '\n').trim();
  
  const outPath = file.includes('TGO') ? 'scratch/tgo_inner.txt' : 'scratch/ys_inner.txt';
  writeFileSync(outPath, cleanText, 'utf-8');
}
console.log('Done converting to pseudo-innerText');
