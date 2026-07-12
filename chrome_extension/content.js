// Yazdırma penceresi açılmadan hemen önce tetiklenir
window.addEventListener("beforeprint", () => {
    // Sayfadaki metni çek (OCR mantığının No-OCR versiyonu)
    const receiptText = document.body.innerText || document.documentElement.innerText;
    
    // Metni yerel API'ye gönder (App1 kasası)
    fetch("http://127.0.0.1:3005/api/manual_parse", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: receiptText })
    }).then(response => {
        if (response.ok) {
            console.log("SaracApp Eklentisi: Sipariş başarıyla kasaya gönderildi!");
        } else {
            console.error("SaracApp Eklentisi: Kasa reddetti.", response.status);
        }
    }).catch(err => {
        console.error("SaracApp Eklentisi: Kasaya bağlanılamadı. App1 açık mı?", err);
    });
});
