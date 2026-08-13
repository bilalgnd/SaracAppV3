# 🚀 VANTAGE v6.1.2 — Release Notes

## 📌 Genel Bakış
VANTAGE v6.1.2 sürümü ile birlikte Kasa (`app1`), Garson Uygulaması (`app2`), TV Ekranı (`tv-sarac`) ve Backend (`server`) katmanları arasında tam zamanlı canlı senkronizasyon, dinamik menü özelleştirmeleri ve uzaktan ekran yönetim yetenekleri getirilmiştir.

---

## ✨ Yenilikler ve Önemli Geliştirmeler

### 🍔 1. Dinamik Menü & Adisyon Özelleştirme Yönetimi
- **Kasa Menü Yönetimi:** Kasa programı ayarlarından Malzemeler (`-suz` / `-lu`), Ücretsiz Tercihler ve Ücretli Ekstralar (`+ ₺ fiyat`) dinamik olarak tanımlanıp yönetilebilir.
- **Canlı Senkronizasyon:** Kasa üzerinden yapılan içerik değişiklikleri sunucu üzerinden anında Garson (`app2`) uygulamasına ve web arayüzlerine yansıtılır.
- **Akıllı Çip Seçimi:** Sipariş penceresinde malzemeler dinamik çiplere dönüştürülerek adisyona hızlı ve hatasız eklenmesi sağlanır.

### 📱 2. Android Garson & TV Uzaktan Kontrolü
- **Uzaktan TV Kart Büyüteci (Pill Slider):** Garson uygulamasından TV ekranındaki (`tv-sarac`) sipariş kartlarının boyutu canlı olarak (%50 — %180) ölçeklendirilebilir (`POST /api/set_tv_card_scale`).
- **Modern & Minimalist Arayüz:** TV kart ölçekleyicisi modern ve kompakt bir kapsül (Pill Slider) olarak ayarlar menüsüne entegre edildi.
- **Ürün Kartı Tasarımı:** Menü ürün kartları orijinal ortalanmış başlık ve yarı saydam tek fiyat hapı stiline getirildi.
- **Görsel Kimlik:** Sol üst başlık kurumsal **VANTAGE** tipografisi ile güncellendi.
- **Güvenli Eşleşme:** QR ve 6 haneli doğrulama kodu (`/api/auth/pair`) ile güvenli oturum akışı sağlandı.

### 🛠️ 3. Backend ve Sistem Mimarisi
- **Modüler Route Mimarisi:** `server.ts` temizlenerek modüler route yapısına kavuşturuldu (`admin`, `menu`, `orders`, `trendyol`, `yemeksepeti`, `public`, `system`, `anti`).
- **WebSocket Senkronizasyonu:** `wss://bilalgnd.shop/ws` canlı odasında `sarac` hesabı üzerinden kesintisiz veri iletişimi.
- **Windows Derleme Kararlılığı:** Gradle ve dosya kilitleme engelleri optimize edildi.

---

## 📦 Dağıtım Dosyaları
- **Masaüstü (Windows):** `exe-apk dist/VANTAGEv6.1.2.exe` / `exe-apk dist/vantage-6.1.2-setup.exe`
- **Android Eşlikçi:** `exe-apk dist/app2-debug.apk`
- **Otomatik Güncelleme:** `exe-apk dist/latest.yml`
