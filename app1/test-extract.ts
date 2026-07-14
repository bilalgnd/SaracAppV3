import { readFileSync, writeFileSync } from 'fs';
import { JSDOM } from 'jsdom';

const file = 'C:/Users/bilal/Desktop/1407 debug/tryol logs/TGO Yemek.html';

const html = readFileSync(file, 'utf-8');
const dom = new JSDOM(html);
const scripts = dom.window.document.querySelectorAll('script, style');
scripts.forEach(s => s.remove());

const text = dom.window.document.body.textContent || '';
const cleanText = text.replace(/\n\s*\n/g, '\n').replace(/ {2,}/g, ' ').trim();
writeFileSync('scratch/tgo_text.txt', cleanText, 'utf-8');

const file2 = 'C:/Users/bilal/Desktop/1407 debug/ysepeti logs/ysepeti1.html';
const html2 = readFileSync(file2, 'utf-8');
const dom2 = new JSDOM(html2);
const scripts2 = dom2.window.document.querySelectorAll('script, style');
scripts2.forEach(s => s.remove());
writeFileSync('scratch/ys_text.txt', dom2.window.document.body.textContent?.replace(/\n\s*\n/g, '\n').replace(/ {2,}/g, ' ').trim() || '', 'utf-8');

console.log('Saved to scratch/tgo_text.txt and scratch/ys_text.txt');
