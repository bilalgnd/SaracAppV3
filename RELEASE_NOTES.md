# 🚀 VANTAGE v6.1.5 — Release Notes

## 📌 Genel Bakış
VANTAGE v6.1.5 sürümü ile birlikte Kasa (App1) ve Garson (App2) için tam **Çevrimdışı (Offline) Mod**, **Yerel POS Hub (LAN)** desteği, **Çift Fiş Yazdırma Koruması** ve **Gelişmiş Fiş Tasarımcısı** eklenmiştir.

---

## ✨ Yenilikler ve Önemli Geliştirmeler

### ⚡ 1. Çevrimdışı (Offline) Mod & Yerel POS Hub (App1 - Masaüstü)
- **Local-First Veri Mimarisi:** Aktif masalar, sipariş geçmişi ve menü yerel JSON dosyalarında saklanır. İnternet ve bulut sunucu kapalıyken bile uygulama saniyeler içinde açılır ve kesintisiz çalışır.
- **Dahili Yerel POS Sunucusu & WebSocket:** Port `3005` üzerinden çalışan Express ve WebSocket sunucusu ile aynı Wi-Fi ağındaki garson cihazları bulut olmadan doğrudan kasaya bağlanabilir.
- **Kullanıcı Arayüzü:** İnternet kopma ekranı kaldırıldı, *"⚡ Çevrimdışı Modda Aç"* butonu ve TitleBar'a canlı bağlantı durumu (🟢 Bulut / 🟠 Yerel Mod) eklendi.

### 📱 2. Android 3 Kademeli Bağlantı & Çevrimdışı Kuyruk (App2 - Garson)
- **3 Kademeli Failover:** Bulut Sunucu (`bilalgnd.shop`) ➔ Yerel Kasa LAN IP (`http://<Kasa_IP>:3005`) ➔ Tam Çevrimdışı Cihaz Önbelleği.
- **Çevrimdışı İşlem Kuyruğu (`OfflineAction`):** Çevrimdışıyken alınan tüm siparişler, masa kapatma ve yazdırma işlemleri kuyruğa kaydedilir; bağlantı sağlandığında anında senkronize edilir.
- **Kullanıcı Arayüzü:** Giriş ekranına *"⚡ Çevrimdışı Modda Başlat"* butonu ve üst bara canlı durum rozeti (🟢 Bulut / 🟠 Yerel Ağ / 🔴 Çevrimdışı • ⏳ X Bekleyen) eklendi.

### 🖨️ 3. Çift Fiş Yazdırma Koruması (Printer)
- **İmza Bazlı Tekilleştirme (Deduplication):** 3 saniye içinde peş peşe gelen veya çift tıklamayla tetiklenen mükerrer yazdırma istekleri otomatik engellenir.
- **Sıralı FIFO Yazdırma Kuyruğu:** Eşzamanlı gelen yazdırma taleplerinin çakışması mutex ile önlenmiştir.

### 🎨 4. Gelişmiş Fiş Tasarımı & Özelleştirme Alanları (App1)
- **Başlık & Metinler:** Fiş Başlığı / İşletme İsmi, Alt Başlık / Telefon / Adres, Kapanış Mesajı (Footer), Wi-Fi Bilgisi, Instagram hesabı.
- **Kağıt & Boyut:** 58mm (Dar) / 80mm (Geniş) kağıt seçimi, Küçük / Normal / Büyük yazı boyutu, 1 veya 2 Nüsha kopya seçimi.
- **Operasyonel:** Garson İsmi ve Günlük Fiş Sıra Numarası (#001) gösterimi.
- **QR Kod:** Google Yorum veya Dijital Menü linki girildiğinde fişin altına otomatik taranabilir QR kod basımı.
- **Test:** Ayarlar panelinde tek tıkla *"🖨️ Kaydet & Örnek Fiş Yazdır"* butonu.

---

## 🔒 Güvenlik
- Kaynak kodlar public repoya uygunluk açısından tarandı; API anahtarı, şifre ve hassas ortam değişkenleri `.env` ve yerel depolama koruması altında tutuldu.

---

## 📦 Dağıtım Dosyaları
- **Masaüstü (Windows):** `exe-apk dist/VANTAGEv6.1.5.exe` / `exe-apk dist/vantage-6.1.5-setup.exe`
- **Android Eşlikçi:** `exe-apk dist/SaracApp-v6.1.5.apk` / `exe-apk dist/app2-release.apk`
- **Otomatik Güncelleme:** `exe-apk dist/latest.yml`

