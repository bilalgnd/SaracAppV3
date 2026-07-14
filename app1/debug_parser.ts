function parseOrderText(text: string): any {
    const lines = text.split('\\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let customerName = "Bilinmeyen Müşteri";
    let neighborhood = "";
    let address = "";
    let orderNote = "";
    let totalAmount = 0;
    
    // 1. Müşteri ve Adres Çıkarımı
    // Trendyol
    let sipKoduIdx = lines.findIndex(l => l.includes("Sipariş Kodu:"));
    let ySipNoIdx = lines.findIndex(l => /^#\\d+/.test(l));
    
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
    
    const mahMatch = address.match(/([a-zA-ZçÇğĞıİöÖşŞüÜ]+)\\s+(Mah|Mh)\\b/i);
    if (mahMatch) neighborhood = mahMatch[1].trim() + " Mh.";

    if (notesStartIndex !== -1) {
        orderNote = lines[notesStartIndex].replace(/sipariş notu:/i, '').trim();
    }

    // 2. Tutar Çıkarımı
    const toplamIdx = lines.findIndex(l => l.toLowerCase().includes("toplam") && !l.toLowerCase().includes("ara"));
    if (toplamIdx !== -1) {
        // Tutar bazen aynı satırda, bazen alt satırda
        let totalStr = lines[toplamIdx];
        if (!/\\d/.test(totalStr) && lines.length > toplamIdx + 1) {
             totalStr = lines[toplamIdx + 1];
        }
        const amountMatch = totalStr.match(/[\\d.,]+/);
        if (amountMatch) {
            let amountStr = amountMatch[0];
            if (amountStr.includes(',') && amountStr.indexOf(',') > amountStr.lastIndexOf('.')) {
                amountStr = amountStr.replace(/\\./g, '').replace(',', '.');
            } else if (amountStr.includes('.') && amountStr.indexOf('.') > amountStr.lastIndexOf(',')) {
                amountStr = amountStr.replace(/,/g, '');
            }
            amountStr = amountStr.replace(/(\\.\\d{2})\\d+$/, '$1');
            totalAmount = parseFloat(amountStr);
        }
    }

    if (customerName.length > 35) customerName = customerName.substring(0, 35);
    if (customerName === "Bilinmeyen Müşteri" && totalAmount === 0) return null;

    // 3. Ürün Çıkarımı
    let extractedItems: any[] = [];
    
    if (itemsStartIndex !== -1 && toplamIdx !== -1) {
        let itemsBlock = lines.slice(itemsStartIndex + 1, toplamIdx).filter(l => !l.includes("-------") && !l.toLowerCase().includes("ara toplam"));
        
        let i = 0;
        while (i < itemsBlock.length) {
            let line = itemsBlock[i];
            
            // Yemeksepeti miktar satırı "1 " veya sadece "1" gibi olabilir.
            let qty = 1;
            let qtyMatch = line.match(/^(\\d+)$/);
            
            let name = "";
            let price = 0;
            let portion = "";
            let notes: string[] = [];

            if (qtyMatch) {
                // Yemeksepeti formatı:
                // 1
                // Tavuk Döner...
                // ₺
                // 270,00
                qty = parseInt(qtyMatch[1]);
                i++;
                if (i >= itemsBlock.length) break;
                
                name = itemsBlock[i];
                i++;
                // 2 satıra taşmış isim olabilir
                if (i < itemsBlock.length && !itemsBlock[i].includes('₺') && !/\\d/.test(itemsBlock[i])) {
                    name += " " + itemsBlock[i];
                    i++;
                }

                // ₺ satırı
                if (i < itemsBlock.length && itemsBlock[i].includes('₺')) {
                    if (itemsBlock[i] === '₺') {
                        i++;
                        price = parseFloat(itemsBlock[i].replace(',', '.'));
                        i++;
                    } else {
                        let m = itemsBlock[i].match(/[\\d.,]+/);
                        if (m) price = parseFloat(m[0].replace(',', '.'));
                        i++;
                    }
                }
                
                // Portion veya yan ürün
                if (i < itemsBlock.length && (itemsBlock[i].toLowerCase().includes('gr') || /\\d+/.test(itemsBlock[i]))) {
                    if (!itemsBlock[i].includes('₺')) {
                        portion = itemsBlock[i];
                        i++;
                        // Eğer porsiyonun da fiyatı varsa
                        if (i < itemsBlock.length && itemsBlock[i] === '₺') {
                            i += 2; // Fiyatı atla
                        }
                    }
                }
                
                extractedItems.push({ name, quantity: qty, price: price / qty, portion, notes });
                
            } else if (line.match(/[a-zA-ZçÇğĞıİöÖşŞüÜ]/) && !line.includes('(') && !line.includes('Gram') && !/\\d+\\s+[\\d.,]+\\s+₺/.test(line)) {
                // Trendyol formatı:
                // İsim
                // (içerik)
                // 2  500,00 ₺
                name = line;
                i++;
                
                if (i < itemsBlock.length && itemsBlock[i].startsWith('(')) {
                    // İçerik, görmezden gelebiliriz veya notes yapabiliriz
                    i++;
                }
                
                if (i < itemsBlock.length && /\\d+\\s+[\\d.,]+\\s*₺?/.test(itemsBlock[i])) {
                    let parts = itemsBlock[i].match(/(\\d+)\\s+([\\d.,]+)/);
                    if (parts) {
                        qty = parseInt(parts[1]);
                        price = parseFloat(parts[2].replace(',', '.'));
                    }
                    i++;
                }
                
                // Seçimler / Portion
                if (i < itemsBlock.length && itemsBlock[i].toLowerCase().includes('gram')) {
                    portion = itemsBlock[i].split(' ')[0] + "gr";
                    i++;
                }
                
                extractedItems.push({ name, quantity: qty, price: price / qty, portion, notes });
            } else {
                i++; // Atla
            }
        }

        let expandedItems: any[] = [];
        extractedItems.forEach(item => {
            let n = item.name;
            if (n.includes("Pilav Üstü Et Döner")) n = "Et Pilav Üstü";
            else if (n.includes("Et Döner Dürüm")) n = "Et Dürüm";
            
            if (item.portion && !item.portion.includes("Standart")) {
                n += " (" + item.portion.replace("Gram", "gr").trim() + ")";
            }
            
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
    const finalNote = (address ? address.toUpperCase() + "\\n" : "") + (orderNote ? "Sipariş Notu: " + orderNote : "");

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


import { parseOrderText } from './src/main/textParser';
const text1 = `PAKET SERVİS ONLİNE ÖDENMİŞTİR
TESLİM ZAMANI
19:39
Müşteri konumunu görmek için telefonunuz ile
kodu okutabilirsiniz
#1203
Mert Ocak
Özler sitesi ,
C-blok, Şehit
Alper Tunga
Akan
Caddesi, 50B
3, Kat 1
Şirintepe Çanakkale,
17200, Çanakkale
TEL: +9054669
21769
3
- ** ÇATAL-BIÇAK
GÖNDERMEYİN Online Kredi
/Banka Kartı
1 
Tavuk Döner Hatay
Usulü Dürüm
₺
270,00
200Gr 
₺
100,00
1 Fanta (33 cl.) 
₺
100,00
1 Ayran (17 cl.) ₺ 40,00
Ara toplam ₺ 510,00
Toplam ₺ 510,00
KDV (Dahil) ₺ 46,36
13 Temmuz 2026 Pazartesi
Sipariş No.:
vt7h-2629-qyfv
Saraçoğlu
Döner
Siparişiniz için
teşekkür ederiz`;

const text2 = `Sipariş Kodu:  001
 13/07/2026 18:21
 Selma A.
 sakarya mah. 314 sok no:27/29 daire:5 Beyaz Köşk, Biga, Sakarya Mah, Bina No: 27/29, Kat: 3, Daire: 5. Açıklama: Sakarya mah
314 sok no27/29 daire 5 beyazkosk
 Sipariş Notu: Servis İstiyorum
 Ürün  Adet  Tutar
 Tavuk Döner Hatay Usulü Dürüm
 (100 gr tavuk döner, özel sos, patates ve sarımsaklı mayonez.) 
2  500,00 ₺
 100 Gram  2  0,00 ₺
 Et Döner Dürüm
 (100 gr. et döner, domates, patates kızartması, soğan) 
1  450,00 ₺
 100 Gram  1  0,00 ₺
 Toplam:  950,00 ₺
 Restoran Destek Hattı:  +90 850 210 7555 / 6647850
 Müşteri İletişim:  0212 365 34 03 / 11409732804
 Siparişle ilgili kullanıcıyla iletişime geçmek için 0212 365 34 03 numarasını arayarak, 11409732804 no’lu sipariş numarasını tuşlayabilirsiniz.
 Müşteri adresine erişim için QR kodu okutabilirsiniz.`;

console.log('T1', JSON.stringify(parseOrderText(text1), null, 2));
console.log('T2', JSON.stringify(parseOrderText(text2), null, 2));
