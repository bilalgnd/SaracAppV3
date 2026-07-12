export function parseOrderText(text: string): any {
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
            let notes: string[] = [];

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
                if (fallback) qty = parseInt(fallback[1]);
            }

            let portionMatch = fullText.match(/(\d+)\s*(?:Gram|6ram|gr)/i);
            if (portionMatch) portion = `(${portionMatch[1]}gr)`;

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
      status: 'waiting',
      createdAt: new Date().toISOString(),
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      order_note: finalNote
    };

    return newOrder;
}
