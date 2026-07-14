function parseOrderText(text) {
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
         amountStr = amountStr.replace(/(\.\d{2})\d+$/, '$1');
         totalAmount = parseFloat(amountStr);
       }
    }
    
    if (customerName.length > 35) customerName = customerName.substring(0, 35);
    if (customerName === "Bilinmeyen Müşteri" && totalAmount === 0) return null;

    // 3. Ürün Çıkarımı
    let extractedItems = [];
    let toplamIdx = lines.findIndex(l => l.toLowerCase().includes("toplam"));
    
    if (itemsStartIndex !== -1 && toplamIdx !== -1) {
        let itemsBlock = lines.slice(itemsStartIndex + 1, toplamIdx).filter(l => !l.includes("-------"));
        
        const isItemName = (str) => {
            return /döner|dürüm|pilav|et|tavuk|pide|lahmacun|iskender|çorba|kola|ayran|su|şalgam|fanta|sprite|ice tea|soda|tatlı|künefe|kadayıf/i.test(str);
        };

        let blocks = [];
        let currentBlock = [];
        let inParenthesis = false;
        let inNotes = false;

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

        for (let block of blocks) {
            let name = block[0]; 
            let price = 0;
            let qty = 1;
            let portion = "";
            let notes = [];

            let fullText = block.join(" ");

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
                    if (p > 0) price = p; 
                }
            }

            let qtyPriceMatch = fullText.match(/\b([1-9])\s*[A-Za-z]?\s*(?:\d{1,3}(?:[.,]\d{3})*[.,]\d{2,3})\b/g);
            if (qtyPriceMatch) {
                let m = qtyPriceMatch[0].match(/\b([1-9])\b/);
                if (m) qty = parseInt(m[1]);
            } else {
                let fallback = fullText.match(/\b([1-9])\b/);
                if (fallback) fallback ? qty = parseInt(fallback[1]) : qty = 1;
            }

            let portionMatch = fullText.match(/(\d+)\s*(?:Gram|6ram|gr)/i);
            if (portionMatch) portion = \`(\${portionMatch[1]}gr)\`;

            let notesMatch = fullText.match(/çıkarılacak malzemeler:(.*)/i);
            if (notesMatch) {
                let n = notesMatch[1].trim();
                let splits = n.split(',').map(s => s.trim()).filter(s => s && s.length > 1);
                notes = splits.map(s => "- " + s);
            }

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

        let expandedItems = [];
        extractedItems.forEach(item => {
            let n = item.name;
            if (n.includes("Pilav Üstü Et Döner")) n = "Et Pilav Üstü";
            else if (n.includes("Et Döner Dürüm")) n = "Et Dürüm";
            
            if (item.portion) n += " " + item.portion;
            
            let finalNotes = item.notes.filter((note) => note.length > 0).join(', ');
            
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
    const finalNote = (address ? address.toUpperCase() + "\\n" : "") + (orderNote ? "Sipariş Notu: " + orderNote : "");

    const newOrder = {
      items: extractedItems,
      customer_name: finalCustomerName,
      total_amount: totalAmount,
      status: 'waiting',
      order_note: finalNote
    };

    return newOrder;
}

const text1 = \`PAKET SERVİS   ONLİNE ÖDENMİŞTİR TESLİM ZAMANI  19:39  Müşteri konumunu görmek için telefonunuz ile kodu okutabilirsiniz  #1203   Mert Ocak  Özler sitesi , C-blok, Şehit Alper Tunga Akan Caddesi, 50B  3, Kat 1 Şirintepe Çanakkale, 17200, Çanakkale  TEL: +9054669 21769  3  - ** ÇATAL-BIÇAK GÖNDERMEYİN Online Kredi /Banka Kartı  1  Tavuk Döner Hatay Usulü Dürüm ₺ 270,00 200Gr   ₺ 100,00 1 Fanta (33 cl.)   ₺ 100,00 1 Ayran (17 cl.)   ₺ 40,00 Ara toplam   ₺ 510,00  Toplam   ₺ 510,00  KDV (Dahil)   ₺ 46,36  13 Temmuz 2026 Pazartesi Sipariş No.: vt7h-2629-qyfv  Saraçoğlu Döner Siparişiniz için teşekkür ederiz\`;
const text2 = \`Sipariş Kodu:   001  13/07/2026 18:21  Selma A.  sakarya mah. 314 sok no:27/29 daire:5 Beyaz Köşk, Biga, Sakarya Mah, Bina No: 27/29, Kat: 3, Daire: 5. Açıklama: Sakarya mah 314 sok no27/29 daire 5 beyazkosk  Sipariş Notu: Servis İstiyorum  Ürün   Adet   Tutar  Tavuk Döner Hatay Usulü Dürüm  (100 gr tavuk döner, özel sos, patates ve sarımsaklı mayonez.)   2   500,00 ₺  100 Gram   2   0,00 ₺  Et Döner Dürüm  (100 gr. et döner, domates, patates kızartması, soğan)   1   450,00 ₺  100 Gram   1   0,00 ₺  Toplam:   950,00 ₺  Restoran Destek Hattı:   +90 850 210 7555 / 6647850  Müşteri İletişim:   0212 365 34 03 / 11409732804  Siparişle ilgili kullanıcıyla iletişime geçmek için 0212 365 34 03 numarasını arayarak, 11409732804 no’lu sipariş numarasını tuşlayabilirsiniz.  Müşteri adresine erişim için QR kodu okutabilirsiniz.\`;

console.log('--- TEST 1 ---');
console.log(JSON.stringify(parseOrderText(text1), null, 2));
console.log('--- TEST 2 ---');
console.log(JSON.stringify(parseOrderText(text2), null, 2));
