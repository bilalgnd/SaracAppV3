import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { parseOrderText } from './src/main/textParser';

const files = [
  'C:/Users/bilal/Desktop/1407 debug/tryol logs/2TGO Yemek.html',
  'C:/Users/bilal/Desktop/1407 debug/tryol logs/TGO Yemek.html',
  'C:/Users/bilal/Desktop/1407 debug/ysepeti logs/ysepeti1.html',
  'C:/Users/bilal/Desktop/1407 debug/ysepeti logs/ysepeti2.html',
  'C:/Users/bilal/Desktop/1407 debug/ysepeti logs/ysepeti3.html'
];

for (const file of files) {
  console.log(`\n--- Testing ${file} ---`);
  try {
    const html = readFileSync(file, 'utf-8');
    const dom = new JSDOM(html);
    
    // Remove all script and style elements
    const scripts = dom.window.document.querySelectorAll('script, style');
    scripts.forEach(s => s.remove());
    
    // Get textContent and clean up extra whitespace
    const text = dom.window.document.body.textContent || '';
    const cleanText = text.replace(/\n\s*\n/g, '\n').replace(/ {2,}/g, ' ').trim();
    
    console.log('Text preview (first 150 chars):', cleanText.substring(0, 150).replace(/\n+/g, ' '));
    
    const order = parseOrderText(cleanText);
    if (order) {
      console.log('✅ SUCCESS! Parsed Order:', JSON.stringify(order, null, 2));
    } else {
      console.log('❌ FAILED to parse.');
    }
  } catch(e: any) {
    console.error('Error testing file:', e.message);
  }
}
