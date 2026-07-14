const supplierId = 'BURAYA_YENI_SATICI_ID_GELECEK';
const apiKey = 'BURAYA_YENI_API_KEY_GELECEK';
const apiSecret = 'BURAYA_YENI_API_SECRET_GELECEK';

const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

async function getTrendyolOrders() {
    try {
        console.log("Trendyol API'sine istek atılıyor...");
        // Sadece en son 2 siparişi getirmesi için parametre ekledik (size=2)
        const url = `https://api.trendyol.com/sapigw/suppliers/${supplierId}/orders?size=2`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${auth}`,
                'User-Agent': `${supplierId} - SaracAppV3 Test`
            }
        });
        
        if (!response.ok) {
            console.error(`API Hatası! HTTP Status: ${response.status}`);
            const errorText = await response.text();
            console.error("Hata Detayı:", errorText);
            return;
        }

        const data = await response.json();
        
        // Veriyi dosyaya yazalım ki sonradan rahatça inceleyebilelim
        const fs = require('fs');
        fs.writeFileSync('trendyol_ornek_siparis_verisi.json', JSON.stringify(data, null, 2), 'utf8');
        
        console.log("Sipariş verisi başarıyla çekildi!");
        console.log(`Toplam bulunan sipariş sayısı (totalElements): ${data.totalElements}`);
        console.log("Dönen yapının tam hali 'trendyol_ornek_siparis_verisi.json' dosyasına kaydedildi.");
        
        // İlk siparişin kısa bir özetini ekrana basalım
        if (data.content && data.content.length > 0) {
            console.log("\n--- ÖRNEK SİPARİŞ ÖZETİ ---");
            const order = data.content[0];
            console.log(`Sipariş No (orderNumber): ${order.orderNumber}`);
            console.log(`Sipariş Durumu (status): ${order.status}`);
            console.log(`Müşteri Adı: ${order.customerFirstName} ${order.customerLastName}`);
            console.log(`Toplam Tutar: ${order.totalPrice}`);
            console.log("İçindeki Ürünler:");
            order.lines.forEach(line => {
                console.log(`  - ${line.productName} (Adet: ${line.quantity}, Fiyat: ${line.price})`);
            });
            console.log("----------------------------");
        } else {
            console.log("Şu anda hiç sipariş kaydı bulunamadı.");
        }

    } catch (error) {
        console.error("Bir hata oluştu:", error.message);
    }
}

getTrendyolOrders();
