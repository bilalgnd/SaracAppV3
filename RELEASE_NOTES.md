# 🚀 VANTAGE v6.1.3 — Release Notes

## 📌 Genel Bakış
VANTAGE v6.1.3 sürümü ile birlikte ürüne özel içerik tanımlama, geçmiş siparişlerde garson isim/renk görüntüleme, hızlı içecek çoklu ekleme düzeltmesi ve menü arayüzü iyileştirmeleri getirilmiştir.

---

## ✨ Yenilikler ve Önemli Geliştirmeler

### 🍔 1. Ürüne Özel İçerik Tanımlama
- **Kasa Ayarları → İçerik Yönetimi:** Her ürün için ayrı Malzeme, Ücretsiz Tercih ve Ücretli Ekstra listesi tanımlanabilir.
- **Genel / Ürüne Özel Mod:** İki sekmeli yapı; genel içerikler tüm ürünler için varsayılan olarak çalışırken, ürüne özel içerikler sipariş ekranında otomatik olarak devreye girer.
- **Ürün Tablosu Entegrasyonu:** Her ürünün yanında `★ İçerik` butonu ile hızlıca o ürünün içerik ayarlarına gidilebilir; özel içeriği olan ürünler `★` ile işaretlenir.

### 👤 2. Geçmiş Siparişlerde Garson İsim & Renk Gösterimi
- **App2'den Gelen Siparişler:** Garsonun App2'de girdiği isim ve seçtiği renk, App1 geçmiş siparişler ekranında doğrudan görünür.
- **Renkli Rozet:** Her siparişin üstünde garsonun ismi seçtiği arka plan rengiyle gösterilir.

### 🥤 3. Hızlı İçecek Çoklu Ekleme Düzeltmesi
- Hızlı içecek ekleme alanından aynı anda birden fazla içecek seçildiğinde yalnızca 1 adet eklenen hata giderildi. Artık seçilen tüm içecekler sepete doğru şekilde eklenmektedir.

### 🎨 4. Menü & Arayüz İyileştirmeleri
- QR App ve TV ekranı arayüzlerinde görsel güncellemeler.
- Server route yapısı ve order/public route'ları optimize edildi.
- Gereksiz geliştirici script dosyaları (scratch, scripts) temizlendi.

---

## 🔒 Güvenlik
- Kaynak kod commit öncesi API anahtarı ve şifre taramasından geçirildi; hassas veri tespit edilmedi.
- `.env` dosyası `.gitignore` kapsamında; derlemeye ve commit'e dahil edilmedi.

---

## 📦 Dağıtım Dosyaları
- **Masaüstü (Windows):** `exe-apk dist/VANTAGEv6.1.3.exe` / `exe-apk dist/vantage-6.1.3-setup.exe`
- **Android Eşlikçi:** `exe-apk dist/app2-debug.apk`
- **Otomatik Güncelleme:** `exe-apk dist/latest.yml`
