export function parseOrderText(text: string): any {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let customerName = "Bilinmeyen Müşteri";
    let neighborhood = "";
    let address = "";
    let orderNote = "";
    let totalAmount = 0;
    
    // 1. Müşteri ve Adres Çıkarımı
    // Trendyol
    let sipKoduIdx = lines.findIndex(l => l.includes("Sipariş Kodu:"));
    let ySipNoIdx = lines.findIndex(l => /^#\d+/.test(l));
    
    let addressStartIndex = -1;

    if (sipKoduIdx !== -1) {
        // Trendyol formatı: Sipariş Kodu -> Tarih -> İsim -> Adres
        if (lines.length > sipKoduIdx + 2) {
            customerName = lines[sipKoduIdx + 2];
            addressStartIndex = sipKoduIdx + 3;
        }
    } else if (ySipNoIdx !== -1) {
        // Yemeksepeti formatı: #1234 -> İsim -> Adres
        if (lines.length > ySipNoIdx + 1) {
            customerName = lines[ySipNoIdx + 1];
            addressStartIndex = ySipNoIdx + 2;
        }
    }

    let notesStartIndex = lines.findIndex(l => l.toLowerCase().includes("sipariş notu:") || l.toLowerCase().includes("sipariş notu"));
    let itemsStartIndex = lines.findIndex(l => l.toLowerCase().includes("ürün") && l.toLowerCase().includes("tutar"));
    if (itemsStartIndex === -1) {
        // Yemeksepeti'nde Ürün Adet Tutar başlığı olmayabilir, kredi kartı veya benzeri ödeme bilgisinden sonrasını arayalım
        itemsStartIndex = lines.findIndex(l => l.toLowerCase().includes("banka kartı") || l.toLowerCase().includes("nakit") || l.toLowerCase().includes("online kredi"));
    }
    
    if (addressStartIndex !== -1) {
        let endIdx = notesStartIndex !== -1 ? notesStartIndex : itemsStartIndex;
        if (endIdx === -1) endIdx = lines.length;
        if (endIdx > addressStartIndex) {
            address = lines.slice(addressStartIndex, endIdx).join(' ');
        }
    }
    
    const mahMatch = address.match(/([a-zA-ZçÇğĞıİöÖşŞüÜ]+)\s+(Mah|Mh)\./i);
    if (mahMatch) neighborhood = mahMatch[1].trim() + " Mh.";

    if (notesStartIndex !== -1) {
        orderNote = lines[notesStartIndex].replace(/sipariş notu:/i, '').trim();
    }

    // 2. Tutar Çıkarımı
    const toplamIdx = lines.findIndex(l => l.toLowerCase().includes("toplam") && !l.toLowerCase().includes("ara"));
    if (toplamIdx !== -1) {
        // Tutar bazen aynı satırda, bazen alt satırda
        let totalStr = lines[toplamIdx];
        if (!/\d/.test(totalStr) && lines.length > toplamIdx + 1) {
             totalStr = lines[toplamIdx + 1];
        }
        const amountMatch = totalStr.match(/[\d.,]+/);
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

    console.log("DEBUG: customerName=", customerName, "totalAmount=", totalAmount, "toplamIdx=", toplamIdx);

    if (customerName.length > 35) customerName = customerName.substring(0, 35);
    if (customerName === "Bilinmeyen Müşteri" && totalAmount === 0) {
        console.log("DEBUG: returning null");
        return null;
    }

    // 3. Ürün Çıkarımı
    let extractedItems: any[] = [];
    
    if (itemsStartIndex !== -1 && toplamIdx !== -1) {
        let itemsBlock = lines.slice(itemsStartIndex + 1, toplamIdx).filter(l => !l.includes("-------") && !l.toLowerCase().includes("ara toplam"));
        
        let i = 0;
        const isTrendyol = lines.some(l => l.toLowerCase().includes('trendyol'));
        
        if (isTrendyol) {
            let currentNoteMode = false;
            let inParentheses = false;
            const trendyolV2Regex = /^(.+?)\s+(\d+)\s+([\d.,]+)\s*(?:₺|TL|tl|\u20BA)?\s*$/i;
            
            while (i < itemsBlock.length) {
                let line = itemsBlock[i].replace(/\*\*/g, '').trim();
                if (!line) { i++; continue; }
                
                const lowerLine = line.toLowerCase();
                if (lowerLine.includes('çıkarılacak malzemeler') || 
                    lowerLine.includes('a çıkarılacak malzemeler') || 
                    lowerLine.includes('a karlacak malzemeler') || 
                    lowerLine.includes('ilave malzemeler') || 
                    lowerLine.includes('sipariş notu') ||
                    lowerLine.includes('sipariy notu') ||
                    lowerLine.includes('sipari notu') ||
                    lowerLine.includes('malzemeler') ||
                    lowerLine.includes('notu')) {
                    currentNoteMode = true;
                    i++;
                    continue;
                }
                
                let v2Match = line.match(trendyolV2Regex);
                if (v2Match) {
                    currentNoteMode = false;
                    inParentheses = false;
                    let name = v2Match[1].trim();
                    let qty = parseInt(v2Match[2]);
                    let priceStr = v2Match[3].replace(/\./g, '').replace(',', '.');
                    let price = parseFloat(priceStr);
                    
                    if (/^\d+\s*gr/i.test(name.trim())) {
                        if (extractedItems.length > 0) {
                            extractedItems[extractedItems.length - 1].portion = name.trim();
                        }
                    } else if (!name.toLowerCase().includes('banka kartı') && !name.toLowerCase().includes('nakit') && !name.toLowerCase().includes('kredi')) {
                        extractedItems.push({ name, quantity: qty, price: price / qty, portion: '', notes: [] });
                    }
                    i++;
                    continue;
                }
                
                if (line.startsWith('(')) {
                    inParentheses = true;
                }
                
                if (inParentheses) {
                    if (extractedItems.length > 0) {
                        extractedItems[extractedItems.length - 1].notes.push(line);
                    }
                    if (line.endsWith(')')) {
                        inParentheses = false;
                    }
                    i++;
                    continue;
                }
                
                if (currentNoteMode) {
                    if (extractedItems.length > 0 && line.match(/[a-zA-Z]/)) {
                        extractedItems[extractedItems.length - 1].notes.push(line);
                    }
                    i++;
                    continue;
                }
                
                if (extractedItems.length > 0) {
                    extractedItems[extractedItems.length - 1].name += ' ' + line;
                }
                i++;
            }
        } else {
        let bufferName = "";
        let bufferQty = 1;
        let inNote = false;

        for (let i = 0; i < itemsBlock.length; i++) {
            let line = itemsBlock[i].replace(/\*\*/g, '').replace(/₺|TL|tl/g, '').trim();
            if (!line) continue;
            
            // Yemeksepeti'nde ödeme yöntemi satırı ürün ismine karışabiliyor, temizle
            line = line.replace(/^\/?(banka kartı|banka karti|banka kart|nakit|online kredi|kredi kartı)\/?$/i, '').trim();
            if (!line) continue;
            
            let lower = line.toLowerCase();
            if (lower.includes('ara toplam') || lower === 'toplam' || lower.startsWith('toplam ')) {
                if (bufferName) {
                    if (/^\d+\s*gr/i.test(bufferName.trim()) && extractedItems.length > 0) {
                        extractedItems[extractedItems.length - 1].portion = bufferName.trim();
                    } else if (!inNote) {
                        extractedItems.push({ name: bufferName.trim(), quantity: bufferQty, price: 0, portion: "", notes: [] });
                    }
                }
                break;
            }
            
            if (itemsBlock[i].trim().startsWith('**') || itemsBlock[i].trim().startsWith('- **') || lower.includes('notu:')) {
                inNote = true;
                if (bufferName) {
                    if (/^\d+\s*gr/i.test(bufferName.trim()) && extractedItems.length > 0) {
                        extractedItems[extractedItems.length - 1].portion = bufferName.trim();
                    }
                    bufferName = "";
                    bufferQty = 1;
                }
                
                let noteText = line.replace(/^-/, '').trim();
                if (extractedItems.length > 0 && noteText) {
                    extractedItems[extractedItems.length - 1].notes.push(noteText);
                }
                continue;
            }
            
            let isNewItemStart = false;
            let nextLine = (i + 1 < itemsBlock.length) ? itemsBlock[i+1].replace(/\*\*/g, '').replace(/₺|TL|tl/g, '').trim() : "";
            if (inNote) {
                if (line.match(/([\d]+,\d{2})$/)) isNewItemStart = true;
                else if (line.match(/^\d+$/)) isNewItemStart = true;
                else if (line.match(/^\d+\s+.+/)) isNewItemStart = true;
                else if (line.match(/^\d+\s*gr/i)) isNewItemStart = true;
                else if (nextLine.match(/^\d+$/)) isNewItemStart = true;
                
                if (isNewItemStart) {
                    inNote = false;
                } else {
                    if (extractedItems.length > 0) extractedItems[extractedItems.length - 1].notes.push(line);
                    continue;
                }
            }
            
            let priceMatch = line.match(/([\d]+,\d{2})$/);
            if (priceMatch) {
                let price = parseFloat(priceMatch[1].replace(',', '.'));
                let textPart = line.replace(/[\d]+,\d{2}$/, '').trim();
                
                let qtyMatch = textPart.match(/^(\d+)\s+(.+)$/);
                if (qtyMatch) {
                    bufferQty = parseInt(qtyMatch[1]);
                    bufferName += " " + qtyMatch[2];
                } else if (textPart.match(/^\d+$/)) {
                    bufferQty = parseInt(textPart);
                } else {
                    bufferName += " " + textPart;
                }
                
                let finalName = bufferName.trim();
                if (finalName) {
                    if (/^\d+\s*gr/i.test(finalName) && extractedItems.length > 0) {
                        extractedItems[extractedItems.length - 1].portion = finalName;
                        extractedItems[extractedItems.length - 1].price += (price / extractedItems[extractedItems.length - 1].quantity);
                    } else {
                        extractedItems.push({ name: finalName, quantity: bufferQty, price: price / bufferQty, portion: "", notes: [] });
                    }
                }
                bufferName = "";
                bufferQty = 1;
            } else {
                if (line.match(/^\d+$/)) {
                    bufferQty = parseInt(line);
                } else {
                    let qtyMatch = line.match(/^(\d+)\s+(.+)$/);
                    if (qtyMatch) {
                        bufferQty = parseInt(qtyMatch[1]);
                        bufferName += " " + qtyMatch[2];
                    } else {
                        bufferName += " " + line;
                    }
                }
            }
        }

        // Handle leftovers
        if (bufferName) {
            let bName = bufferName.trim();
            if (/^\d+\s*gr/i.test(bName) && extractedItems.length > 0) {
                extractedItems[extractedItems.length - 1].portion = bName;
            } else if (!inNote) {
                extractedItems.push({ name: bName, quantity: bufferQty, price: 0, portion: "", notes: [] });
            }
        }
    }

    let expandedItems: any[] = [];
        extractedItems.forEach(item => {
            let n = item.name;
            if (n.includes("Pilav Üstü Et Döner")) n = n.replace(/.*Pilav Üstü Et Döner/i, "Et Pilav Üstü");
            else if (n.includes("Et Döner Dürüm")) n = n.replace(/.*Et Döner Dürüm/i, "Et Dürüm");
            
            if (item.portion && !item.portion.includes("Standart")) {
                n += " (" + item.portion.replace("Gram", "gr").trim() + ")";
            }
            
            let finalNotes = item.notes.filter((note: string) => note.length > 0).join(', ');
            
            if (item.quantity > 1) {
                let safeQty = Math.min(item.quantity, 50); // Cap to 50 to prevent huge loops
                for(let k = 0; k < safeQty; k++) {
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
