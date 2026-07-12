const puppeteer = require('puppeteer-core');
const axios = require('axios');

async function initIsolatedPrint() {
  try {
    const { data } = await axios.get('http://127.0.0.1:9222/json/version');
    const browser = await puppeteer.connect({
      browserWSEndpoint: data.webSocketDebuggerUrl,
      defaultViewport: null
    });
    
    const pages = await browser.pages();
    const targetPage = pages.find(p => 
      p.url().includes('yemeksepeti.com') || 
      p.url().includes('trendyol.com') || 
      p.url().includes('file://')
    );
    
    if (!targetPage) {
      console.log('Chrome bağlandı. Yemeksepeti veya Trendyol sekmesi bekleniyor...');
      setTimeout(initIsolatedPrint, 5000);
      return;
    }
    
    // Uygulama içine metni gönderecek fonksiyonu sayfaya enjekte et
    await targetPage.exposeFunction('sendReceiptData', async (textContent) => {
      try {
        await axios.post('http://127.0.0.1:3005/api/manual_parse', { text: textContent });
        console.log('Sipariş başarıyla kasaya gönderildi.');
      } catch (err) {
        console.error('Kasaya gönderim hatası:', err.message);
      }
    });

    await targetPage.evaluateOnNewDocument(() => {
      const originalPrint = window.print;
      window.print = async () => {
        try {
          // Sayfadaki tüm görünür metni al (OCR benzeri sonuç üretir)
          const receiptText = document.body.innerText || document.documentElement.innerText;
          
          if (window.top && window.top.sendReceiptData) {
            await window.top.sendReceiptData(receiptText);
          }
        } finally {
          // Her durumda fiziksel yazdırma penceresini aç
          originalPrint.apply(window);
        }
      };
    });

    // Halihazırda açık olan sayfa için de aynı override işlemini uygula
    await targetPage.evaluate(() => {
      if (!window.__print_intercepted) {
        window.__print_intercepted = true;
        const originalPrint = window.print;
        window.print = async () => {
          try {
            const receiptText = document.body.innerText || document.documentElement.innerText;
            if (window.top && window.top.sendReceiptData) {
              await window.top.sendReceiptData(receiptText);
            }
          } finally {
            originalPrint.apply(window);
          }
        };
      }
    });
    
    console.log('Print Interceptor başarıyla çalışıyor ve Yazdır butonunu dinliyor...');
    
  } catch (error) {
    console.log('Chrome aranıyor (Port 9222)...');
    setTimeout(initIsolatedPrint, 5000);
  }
}

initIsolatedPrint();
