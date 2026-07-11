import { useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import Swal from 'sweetalert2';
import { useStore } from '../store';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.js?worker';

// Vite Worker entegrasyonu (Sahte işçiyi devre dışı bırakıp doğrudan gerçek işçiyi bağlar)
pdfjsLib.GlobalWorkerOptions.workerPort = new pdfWorker();

export default function OcrProcessor() {
  const isProcessing = useRef(false);

  useEffect(() => {
    console.log("OcrProcessor Bileşeni Yüklendi! IPC dinleniyor...");
    const handlePdf = async (payload: any) => {
      Swal.fire({ title: 'OCR Başladı', text: 'PDF Algılandı, okunuyor...', timer: 2000, position: 'top-end', toast: true, showConfirmButton: false });
      
      if (isProcessing.current) {
        console.log("OCR meşgul, bekliyor...");
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      isProcessing.current = true;
      try {
        const { filePath, data } = payload;
        console.log("OCR Başlıyor:", filePath);
        
        // Base64 to Uint8Array
        const binaryString = atob(data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        // Görüntü PDF'i veya özel fontlu (CMap eksik) PDF olduğu için OCR kullanmak zorundayız
        console.log("OCR motoru (Tesseract) başlatılıyor...");
        const scale = 2.0; 
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error("Canvas context alınamadı");
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        const imgData = canvas.toDataURL("image/png");
        
        const worker = await Tesseract.createWorker('tur');
        await worker.setParameters({
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
          preserve_interword_spaces: '1'
        });
        const { data: ocrData } = await worker.recognize(imgData);
        await worker.terminate();
        
        let text = ocrData.text;
        console.log("OCR Sonucu:\n", text);
        
        // 3. Ayrıştır ve Kaydet
        parseAndSaveOrder(text, filePath);
        Swal.fire({ title: 'OCR Tamamlandı', text: 'Sipariş okundu!', timer: 2000, position: 'top-end', toast: true, showConfirmButton: false, icon: 'success' });
      } catch (err: any) {
        console.error("OCR Hatası:", err);
        Swal.fire({ title: 'OCR Hatası', text: err.message || 'Bilinmeyen hata', position: 'top-end', toast: true, showConfirmButton: false, icon: 'error' });
      } finally {
        isProcessing.current = false;
      }
    };

    const unsub = (window as any).api.onProcessPdf(handlePdf);
    return () => (window as any).api.offProcessPdf(unsub);
  }, []);

  const parseAndSaveOrder = (text: string, _filePath?: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let customerName = "Bilinmeyen Müşteri";
    let neighborhood = "";
    let address = "";
    let orderNote = "";
    let totalAmount = 0;
    
    // 1. Müşteri ve Adres Çıkarımı
    const dateRegex = /\d{2}\/\d{2}\/\d{4}/;
    let dateLineIdx = lines.findIndex(l => dateRegex.test(l));
    
    let itemsStartIndex = lines.findIndex(l => l.toLowerCase().includes("ürün") && l.toLowerCase().includes("tutar"));
    let notesStartIndex = lines.findIndex(l => l.toLowerCase().includes("sipariş notu:"));
    
    if (dateLineIdx !== -1 && dateLineIdx + 1 < lines.length) {
        customerName = lines[dateLineIdx + 1];
        
        let endIdx = notesStartIndex !== -1 ? notesStartIndex : itemsStartIndex;
        if (endIdx !== -1 && endIdx > dateLineIdx + 2) {
            address = lines.slice(dateLineIdx + 2, endIdx).join(' ');
        }
    } else if (text.includes("Sipariş Kodu:")) {
      const idx = lines.findIndex(l => l.includes("Sipariş Kodu:"));
      if (idx !== -1 && lines.length > idx + 2) customerName = lines[idx + 2];
    }
    
    const mahMatch = address.match(/([a-zA-ZçÇğĞıİöÖşŞüÜ]+)\s+(Mah|Mh)\b/i);
    if (mahMatch) neighborhood = mahMatch[1].trim() + " Mh.";

    if (notesStartIndex !== -1) orderNote = lines[notesStartIndex].replace(/sipariş notu:/i, '').trim();

    // 2. Tutar Çıkarımı
    const toplamLine = lines.find(l => l.toLowerCase().includes("toplam") && /\d/.test(l));
    if (toplamLine) {
       const amountMatch = toplamLine.match(/[\d.,]+/);
       if (amountMatch) {
         let amountStr = amountMatch[0];
         if (amountStr.includes(',') && amountStr.indexOf(',') > amountStr.lastIndexOf('.')) {
            amountStr = amountStr.replace(/\./g, '').replace(',', '.');
         } else if (amountStr.includes('.') && amountStr.indexOf('.') > amountStr.lastIndexOf(',')) {
            amountStr = amountStr.replace(/,/g, '');
         }
         // Eğer OCR 1.750,00 ₺ yerine 1750.006 okuduysa son haneyi kırp
         amountStr = amountStr.replace(/(\.\d{2})\d+$/, '$1');
         totalAmount = parseFloat(amountStr);
       }
    }
    
    if (customerName.length > 35) customerName = customerName.substring(0, 35);
    if (customerName === "Bilinmeyen Müşteri" && totalAmount === 0) return;

    // 3. Ürün Çıkarımı
    let extractedItems: any[] = [];
    let toplamIdx = lines.findIndex(l => l.toLowerCase().includes("toplam"));
    
    if (itemsStartIndex !== -1 && toplamIdx !== -1) {
        let itemsBlock = lines.slice(itemsStartIndex + 1, toplamIdx).filter(l => !l.includes("-------"));
        
        const isItemName = (str: string) => {
            return /döner|dürüm|pilav|et|tavuk|pide|lahmacun|iskender|çorba|kola|ayran|su|şalgam|fanta|sprite|ice tea|soda|tatlı|künefe|kadayıf/i.test(str);
        };

        let blocks: string[][] = [];
        let currentBlock: string[] = [];
        let inParenthesis = false;
        let inNotes = false;

        // 1. Satırları Ait Oldukları Ürüne Göre Bloklara Ayır
        for (let line of itemsBlock) {
            line = line.trim();
            if (!line) continue;

            let isItemStart = false;

            if (inParenthesis) {
                if (line.includes(')')) inParenthesis = false;
            } else if (line.startsWith('(')) {
                inParenthesis = true;
                if (line.includes(')')) inParenthesis = false;
            } else if (line.toLowerCase().includes('çıkarılacak')) {
                inNotes = true;
            } else if (inNotes) {
                if (isItemName(line)) isItemStart = true;
            } else {
                if (isItemName(line) || blocks.length === 0) isItemStart = true;
            }

            if (isItemStart) {
                if (currentBlock.length > 0) blocks.push(currentBlock);
                currentBlock = [line];
                inParenthesis = line.startsWith('(') && !line.includes(')');
                inNotes = line.toLowerCase().includes('çıkarılacak');
            } else {
                currentBlock.push(line);
            }
        }
        if (currentBlock.length > 0) blocks.push(currentBlock);

        // 2. Her Bloğun İçinden (Satır sırası fark etmeksizin) Değerleri Süz
        for (let block of blocks) {
            let name = block[0]; 
            let price = 0;
            let qty = 1;
            let portion = "";
            let notes: string[] = [];

            let fullText = block.join(" ");

            // Fiyatı Bul
            let priceMatches = fullText.match(/\b\d{1,3}(?:[.,]\d{3})*[.,]\d{2,3}\b/g);
            if (priceMatches) {
                for (let pm of priceMatches) {
                    let clean = pm.replace(/([.,]\d{2})\d+$/, '$1'); 
                    if (clean.includes(',') && clean.indexOf(',') > clean.lastIndexOf('.')) {
                        clean = clean.replace(/\./g, '').replace(',', '.');
                    } else if (clean.includes('.') && clean.indexOf('.') > clean.lastIndexOf(',')) {
                        clean = clean.replace(/,/g, '');
                    }
                    let p = parseFloat(clean);
                    if (p > 0) price = p; // Sıfır olmayan fiyat asıl fiyattır
                }
            }

            // Adedi Bul (Fiyatın veya Gramın yanındaki tekil rakam)
            let qtyPriceMatch = fullText.match(/\b([1-9])\s*[A-Za-z]?\s*(?:\d{1,3}(?:[.,]\d{3})*[.,]\d{2,3})\b/g);
            if (qtyPriceMatch) {
                let m = qtyPriceMatch[0].match(/\b([1-9])\b/);
                if (m) qty = parseInt(m[1]);
            } else {
                let fallback = fullText.match(/\b([1-9])\b/);
                if (fallback) qty = parseInt(fallback[1]);
            }

            // Gramajı Bul
            let portionMatch = fullText.match(/(\d+)\s*(?:Gram|6ram|gr)/i);
            if (portionMatch) portion = `(${portionMatch[1]}gr)`;

            // Çıkarılacak Malzemeleri Bul
            let notesMatch = fullText.match(/çıkarılacak malzemeler:(.*)/i);
            if (notesMatch) {
                let n = notesMatch[1].trim();
                let splits = n.split(',').map(s => s.trim()).filter(s => s && s.length > 1);
                notes = splits.map(s => "- " + s);
            }

            // İsim düzeltmeleri
            if (name.includes("Pilav Üstü Et Döner")) name = "Et Pilav Üstü";
            else if (name.includes("Et Döner Dürüm")) name = "Et Dürüm";

            extractedItems.push({
                name: name,
                quantity: qty,
                price: price / qty,
                portion: portion,
                notes: notes
            });
        }

        let expandedItems: any[] = [];
        extractedItems.forEach(item => {
            let n = item.name;
            if (n.includes("Pilav Üstü Et Döner")) n = "Et Pilav Üstü";
            else if (n.includes("Et Döner Dürüm")) n = "Et Dürüm";
            
            if (item.portion) n += " " + item.portion;
            
            let finalNotes = item.notes.filter((note: string) => note.length > 0).join(', ');
            
            if (item.quantity > 1) {
                for(let k = 0; k < item.quantity; k++) {
                    expandedItems.push({ name: n, quantity: 1, price: item.price, notes: finalNotes });
                }
            } else {
                expandedItems.push({ name: n, quantity: 1, price: item.price, notes: finalNotes });
            }
        });
        extractedItems = expandedItems;
    } else {
        extractedItems = [{ name: "Sipariş: " + customerName, quantity: 1, price: totalAmount, portion: "Standart" }];
    }

    const finalCustomerName = customerName + (neighborhood ? " - " + neighborhood : "");
    const finalNote = (address ? address.toUpperCase() + "\n" : "") + (orderNote ? "Sipariş Notu: " + orderNote : "");

    const newOrder = {
      id: Date.now().toString() + Math.floor(Math.random() * 1000),
      items: extractedItems,
      customer_name: finalCustomerName,
      total_amount: totalAmount,
      status: 'waiting' as const,
      createdAt: new Date().toISOString(),
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      order_note: finalNote
    };

    // DEBUG İÇİN DOSYAYA YAZ (Windows'ta kolay erişim için)
    try {
        const debugStr = `--- ORIGINAL OCR TEXT ---\n${text}\n\n--- PARSED ITEMS ---\n${JSON.stringify(extractedItems, null, 2)}\n\n`;
        if ((window as any).api.dumpOcrLog) {
            (window as any).api.dumpOcrLog(debugStr);
        }
    } catch(e) { console.error("Log yazılamadı", e); }

    const store = useStore.getState();
    const updatedOrders = [newOrder, ...store.orders];
    store.setOrders(updatedOrders);
    
    if ((window as any).api.saveOrders) {
      (window as any).api.saveOrders(updatedOrders);
    }
    
    if ((window as any).api.printReceipt) {
      (window as any).api.printReceipt(newOrder);
    }
  };

  return null;
}
