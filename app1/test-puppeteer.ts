import puppeteer from 'puppeteer-core';
import { parseOrderText } from './src/main/textParser';
import path from 'path';

const files = [
  'C:/Users/bilal/Desktop/1407 debug/tryol logs/2TGO Yemek.html',
  'C:/Users/bilal/Desktop/1407 debug/ysepeti logs/ysepeti1.html'
];

async function runTest() {
  // Use a local Chrome path (adjust if needed) or just standard puppeteer if it was installed.
  // We can just install standard puppeteer to get a browser for testing
  console.log('Testing with puppeteer...');
}
runTest();
