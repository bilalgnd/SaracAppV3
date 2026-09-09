# 🚀 VANTAGE v6.5.0 — Release Notes

## 📌 Genel Bakış
VANTAGE v6.5.0 sürümü ile birlikte Kasa (App1) ve Garson (App2) için **Çevrimdışı/Çevrimiçi Geçişlerinde Sıfır Veri Kaybı (Atomic Order Reconciliation)**, **Gelişmiş LAN HTTP Desteği**, **Hata Korumalı Çevrimdışı Kuyruk** ve sistem kararlılığı iyileştirmeleri getirilmiştir.

---

## ✨ Yenilikler ve Önemli Geliştirmeler

### 📱 1. Android Çevrimdışı Modda Alınan Siparişlerin Korunması (App2 - Garson)
- **Akıllı Liste Uzlaştırma (Reconciliation):** Sunucuya bağlanıldığında WebSocket üzerinden gelen sipariş listesi artık yereldeki çevrimdışı siparişleri ezmez (`birlestirAktifSiparisler`).
- **Garantili Çevrimdışı Kuyruk:** Masaya sipariş ekleme, adisyona ilave, durum güncelleme ve fiş yazdırma işlemleri anında yerel hafızaya (`SharedPreferences`) yazılır. Yalnızca sunucudan başarılı HTTP 200/2xx cevabı alındığında kuyruktan düşürülür.
- **Yerel Ağ (LAN) IP Desteği:** `192.168.x.x` yerel IP formatları için HTTPS zorlaması kaldırıldı, yerel ağda SSL hatası olmadan doğrudan `http://` protokolü ile haberleşme sağlandı.
- **Failover İyileştirmesi:** Yerel ağ ile bulut arasında geçiş yaparken sonsuz çevrimdışı bekleme döngüsü giderildi.

### ⚡ 2. Masaüstü Kasa & Ağ Dayanıklılığı (App1)
- Yerel POS sunucusu ve başlık çubuğu (TitleBar) bağlantı durum algılamaları optimize edildi.
- Çift fiş yazdırma koruması ve arka plan senkronizasyonu sürdürüldü.

---

## 📦 Dağıtım Dosyaları
- **Masaüstü (Windows):** `exe-apk dist/VANTAGEv6.5.0.exe` / `exe-apk dist/vantage-6.5.0-setup.exe`
- **Android Eşlikçi:** `exe-apk dist/SaracApp-v6.5.0.apk` / `exe-apk dist/app2-release.apk`
- **Otomatik Güncelleme:** `exe-apk dist/latest.yml`

