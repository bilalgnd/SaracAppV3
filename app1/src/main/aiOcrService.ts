import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { addAndSyncOrder } from './index';
import { systemSettings } from './models';
import { parseOrderText } from './textParser';

// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
// Suppress warnings from pdfjs about workers and DOMMatrix
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

// Çevresel değişkenleri yükle (.env dosyasından)
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function extractTextFromPdf(pdfPath: string): Promise<string> {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjsLib.getDocument({ data: data });
    const pdf = await loadingTask.promise;
    
    let fullText = "";
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        let lastY = -1;
        let pageText = '';
        textContent.items.forEach((item: any) => {
            if (lastY !== -1 && Math.abs(lastY - item.transform[5]) > 4) {
                pageText += '\\n';
            } else if (lastY !== -1) {
                pageText += ' ';
            }
            pageText += (item.str || '').trim();
            lastY = item.transform[5];
        });
        
        fullText += pageText.replace(/\\n\\s+/g, '\\n').replace(/\\s+\\n/g, '\\n') + "\\n";
    }
    return fullText;
}

export async function processTextOrderWithAI(text: string): Promise<boolean> {
    try {
        if (!GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY bulunamadı. Lütfen .env dosyanızı kontrol edin.");
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1
            }
        });

        const prompt = `
Sen bir yemek siparişi (Getir, Yemeksepeti, Trendyol Yemek vb.) fişi okuyan gelişmiş bir uzmansın.
Sana METİN formatında bir sipariş fişi veriliyor. Fişteki tüm verileri eksiksiz analiz et ve aşağıdaki JSON şemasına uygun olarak çıktıyı ver.
Hiçbir ürünü, müşteri notunu veya adresi atlama!

KURALLAR:
1. 'customer_name': Müşteri adını ve soyadını tam al. Eğer adreste mahalle/semt bilgisi varsa sonuna tire ile ekle (Örn: Şira Taşar - Gazikemal Mah.).
2. 'order_note': Müşterinin tam açık adresini, telefon numarasını, yol tarifini (Açıklama) ve Sipariş Notu'nu BÜYÜK HARFLERLE ve alt alta satırlar halinde birleştirerek yaz. (DİKKAT: 'ÇATAL-BIÇAK GÖNDERMEYİN', 'TEMASSIZ TESLİMAT' gibi platform notlarını KESİNLİKLE SİL.)
3. 'items': Fişteki HER BİR ÜRÜNÜ eksiksiz olarak diziye (array) ekle.
4. 'price': Ürünün BİRİM FİYATINI sayı (number) olarak yaz. Trendyol fişlerinde ana ürün satırındaki Tutar toplam fiyattır, eğer adet 1'den büyükse Tutarı adede bölerek birim fiyatı ('price') bul! (Örn: Adet 2, Tutar 1.300,00 ₺ ise price: 650 olmalıdır). Alt seçimlerin (Örn: 120 Gram) fiyatı 0 ise dikkate alma, fiyatı varsa ana fiyata ekle.
5. 'portion': Ürünün gramajını veya porsiyonunu yaz. Trendyol fişlerinde ürünün hemen alt satırında gramaj/seçim yazar (Örn: '120 Gram' veya '100 Gram'). Bu alt satırı YENİ BİR ÜRÜN GİBİ EKLEME, ana ürünün portion alanına yaz!
6. 'notes': Ürünün hemen altındaki "Çıkarılacak Malzemeler: ...", "İlave: ..." gibi ürün içerik eklerini yaz. Yoksa boş bırak.
7. 'total_amount': Fişin en altındaki 'Toplam' tutarı (Örn: 1750) yaz.
8. SADECE GEÇERLİ BİR JSON DÖNDÜR. Başka hiçbir açıklama metni ekleme.

ŞEMA ÖRNEĞİ:
{
  "customer_name": "Belkıs B. - Gazikemal Mah",
  "order_note": "GAZİKEMAL MÜCTEBA ŞALLI SK. NO:27-31 ELA APT A BLOK KAT 4 DAIRE 13, BİGA, GAZİKEMAL MAH, BİNA NO: 27-31, KAT: 4, DAIRE: 13.\\nAÇIKLAMA: SAKARYA İLKOKULU KÖFTECİ AKİF YOKUŞUNDA\\nSİPARİŞ NOTU: SERVİS İSTİYORUM",
  "items": [
    {
      "name": "Pilav Üstü Et Döner",
      "quantity": 2,
      "portion": "120 Gram",
      "price": 650,
      "notes": ""
    },
    {
      "name": "Et Döner Dürüm",
      "quantity": 1,
      "portion": "100 Gram",
      "price": 450,
      "notes": "Çıkarılacak Malzemeler: Domates, Soğan"
    }
  ],
  "total_amount": 1750,
  "status": "Hazırlanıyor"
}

Sipariş Metni:
${text}
`;

        let result: any = null;
        let retries = 3;
        while (retries > 0) {
            try {
                result = await model.generateContent(prompt);
                break;
            } catch (err: any) {
                if (err.message && (err.message.includes('503') || err.message.includes('429'))) {
                    retries--;
                    if (retries === 0) throw new Error("Google AI sunucuları şu anda aşırı yoğun veya hız sınırına ulaşıldı.");
                    console.log(`[aiOcrService] 503/429 Sunucu Yoğunluğu, 2 saniye sonra tekrar deneniyor... Kalan deneme: ${retries}`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    throw err;
                }
            }
        }

        if (!result) throw new Error("Cevap alınamadı.");
        const responseText = result.response.text();
        
        let cleanText = responseText.trim();
        const startIdx = cleanText.indexOf('{');
        const endIdx = cleanText.lastIndexOf('}');
        
        if (startIdx !== -1 && endIdx !== -1) {
            cleanText = cleanText.substring(startIdx, endIdx + 1);
        }

        const orderData = JSON.parse(cleanText);

        if (!orderData || !orderData.items || orderData.items.length === 0) {
            throw new Error("Geçerli bir sipariş verisi ayrıştırılamadı.");
        }

        let expandedItems: any[] = [];
        orderData.items.forEach((item: any) => {
            const qty = item.quantity || 1;
            const finalName = item.name + (item.portion && item.portion !== "Standart" ? " (" + item.portion + ")" : "");
            for (let i = 0; i < qty; i++) {
                expandedItems.push({
                    name: finalName,
                    quantity: 1,
                    price: item.price,
                    notes: item.notes || ""
                });
            }
        });
        orderData.items = expandedItems;

        orderData.id = Date.now().toString() + Math.floor(Math.random() * 1000);
        orderData.createdAt = new Date().toISOString();
        if (!orderData.status) orderData.status = 'Hazırlanıyor';

        const success = await addAndSyncOrder(orderData);
        return success;

    } catch (error: any) {
        console.error("[aiOcrService] AI Parsing Hata:", error.message || error);
        return false;
    }
}

export async function processPdfOrder(pdfPath: string): Promise<boolean> {
    try {
        if (!fs.existsSync(pdfPath)) {
            throw new Error("Dosya bulunamadı.");
        }

        const ext = path.extname(pdfPath).toLowerCase();
        
        if (ext === '.pdf') {
            console.log(`[aiOcrService] PDF metne çevriliyor: ${pdfPath}`);
            const textContent = await extractTextFromPdf(pdfPath);
            
            if (systemSettings["ENABLE_AI_PARSING"]) {
                console.log(`[aiOcrService] AI Modu AÇIK. Önce yerel ayrıştırma deneniyor...`);
                let orderData = parseOrderText(textContent);
                if (orderData) {
                    console.log(`[aiOcrService] Yerel ayrıştırma BAŞARILI (AI devredeyken).`);
                    return await addAndSyncOrder(orderData);
                } else {
                    console.log(`[aiOcrService] Yerel ayrıştırma BAŞARISIZ. Gemini AI'a düşülüyor (Fallback)...`);
                    return await processTextOrderWithAI(textContent);
                }
            } else {
                console.log(`[aiOcrService] AI Modu KAPALI, metin yerel olarak (regex) ayrıştırılıyor...`);
                const orderData = parseOrderText(textContent);
                if (orderData) {
                    return await addAndSyncOrder(orderData);
                } else {
                    console.log(`[aiOcrService] Yerel ayrıştırma başarısız oldu ve AI devre dışı.`);
                    return false;
                }
            }
        } else {
            console.log(`[aiOcrService] Desteklenmeyen dosya türü: ${ext}`);
            return false; // Visual OCR is dropped for now to favor PDF text
        }
    } catch (error: any) {
        console.error("[aiOcrService] Genel Hata:", error.message || error);
        return false;
    }
}
