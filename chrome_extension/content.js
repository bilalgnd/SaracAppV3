// Bu script web sayfasının izole edilmiş ortamında çalışır.
// Gerçek web sayfasının içine inject.js'i enjekte eder ki XHR ve Fetch'i dinleyebilelim.

const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

// inject.js'ten gelen sipariş mesajlarını dinle
window.addEventListener('message', function(event) {
    // Sadece kendi penceremizden gelen mesajları kabul et
    if (event.source !== window) return;

    if (event.data && event.data.type) {
        if (event.data.type === 'TRENDYOL_ORDER' || event.data.type === 'YEMEKSEPETI_ORDER') {
            console.log("SaracApp Eklentisi:", event.data.type, "yakalandı. Sunucuya gönderiliyor...");
            
            // Hangi adrese gönderileceği
            let endpoint = event.data.type === 'TRENDYOL_ORDER' 
                ? 'http://localhost:5000/trendyol_web_siparis' 
                : 'http://localhost:5000/yemeksepeti_siparis';
                
            // Siparişi doğrudan ana bulut sunucusuna POST et
            fetch(endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(event.data.payload)
            }).then(res => {
                console.log("SaracApp Eklentisi: Sunucuya başarıyla iletildi.", res.status);
            }).catch(err => {
                console.error("SaracApp Eklentisi: Sunucuya iletirken hata oluştu!", err);
            });
        }
    }
});
