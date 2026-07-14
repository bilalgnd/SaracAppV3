import * as dotenv from 'dotenv';
dotenv.config();
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import { parseOrderText } from './src/main/textParser';

async function testJpg(fileName: string) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  
  const imagePath = 'C:\\\\Users\\\\bilal\\\\Desktop\\\\receipts\\\\' + fileName;
  const imageData = fs.readFileSync(imagePath);
  
  const image = {
    inlineData: {
      data: Buffer.from(imageData).toString('base64'),
      mimeType: 'image/jpeg'
    }
  };
  
  const result = await model.generateContent([
    'Extract all the text from this receipt exactly as it appears, line by line. Output the raw text only. No markdown, no explanations.',
    image
  ]);
  
  const text = result.response.text();
  console.log('--- ' + fileName + ' TEXT ---');
  console.log(text);
  console.log('--- ' + fileName + ' PARSED ---');
  console.log(JSON.stringify(parseOrderText(text), null, 2));
}

async function run() {
  await testJpg('alican.jpg');
  await testJpg('elif.jpg');
}
run().catch(console.error);
