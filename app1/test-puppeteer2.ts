import puppeteer from 'puppeteer-core';
import { parseOrderText } from './src/main/textParser';
import path from 'path';

const files = [
  'C:/Users/bilal/Desktop/1407%20debug/tryol%20logs/TGO%20Yemek.html',
  'C:/Users/bilal/Desktop/1407 debug/ysepeti logs/ysepeti1.html'
];

async function runTest() {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', // Windows typical Chrome path
    headless: true
  });
  
  for (const file of files) {
    try {
      const page = await browser.newPage();
      await page.goto(`file://${file}`);
      const innerText = await page.evaluate(() => document.body.innerText);
      console.log(`\n=== InnerText for ${path.basename(file)} ===`);
      console.log(innerText);
      console.log(`\n=== End InnerText ===\n`);
      
      const order = parseOrderText(innerText);
      console.log('Parsed Order:', JSON.stringify(order, null, 2));
    } catch (e: any) {
      console.error('Error on file', file, e.message);
    }
  }
  
  await browser.close();
}
runTest();
