# SaracApp - Restoran POS ve Sipariş Yönetim Sistemi

SaracApp, restoranlar ve paket servis işletmeleri için tasarlanmış, çok platformlu (Masaüstü, Web, Mobil) kapsamlı bir POS (Point of Sale) ve sipariş yönetim sistemidir.

Proje, kurye takibinden Yemeksepeti/Trendyol entegrasyonlarına kadar restoranın günlük operasyonlarını dijitalleştirmeyi hedeflemektedir.

## 🚀 Proje Bileşenleri (Monorepo Yapısı)

Proje 4 ana modülden oluşmaktadır:

### 1. Kasa Sunucusu (`\server\`)
- **Açıklama:** Node.js, Express ve TypeScript ile geliştirilmiş sunucu.
- **Görevleri:** Veritabanı yönetimini (yerel JSON/SQLite) sağlar, mobil ve masaüstü uygulamalar için REST API sunar. Müşterilere açık olan QR uygulamasını statik olarak sunar. Firebase Cloud Messaging (FCM) entegrasyonuyla bildirim gönderimlerini yönetir.

### 2. POS Masaüstü Uygulaması (`\app1\`)
- **Açıklama:** Electron, React, Vite ve TypeScript kullanılarak geliştirilmiş Windows Kasa uygulaması.
- **Görevleri:** Restoran içindeki siparişlerin girilmesi, masa takibi, adisyon fişlerinin yazdırılması (Termal yazıcı entegrasyonu) ve günlük ciro işlemlerinin yapıldığı ana işletim ekranıdır.
- **Not:** GitHub Releases üzerinden kendini otomatik güncelleyebilecek (`electron-updater`) şekilde yapılandırılmıştır.

### 3. Android Kurye/Garson Uygulaması (`\app2\`)
- **Açıklama:** Kotlin ve Jetpack Compose kullanılarak geliştirilmiş mobil uygulama.
- **Görevleri:** Personelin mobil cihazlar üzerinden sipariş girmesini veya paket servis kuryelerinin sipariş durumlarını güncellemesini sağlar. Kasa sunucusuna ağ üzerinden doğrudan bağlanır. Firebase Push Notifications (FCM) altyapısı sayesinde Müşteri "Garson Çağır" dediğinde anlık bildirim alır.

### 4. Müşteri QR Sipariş Menüsü (`\qr-app\`)
- **Açıklama:** React, Vite ve Vanilla CSS ile geliştirilmiş, müşteri odaklı QR web uygulaması.
- **Görevleri:** Müşterilerin masalarındaki QR kodu okutarak sipariş verebildikleri, verdikleri siparişin aşamalarını canlı izleyebildikleri arayüzdür. Tekrar sipariş verilmesini engelleme ve "Garson Çağır" özellikleri barındırır.

## 🔧 Kurulum ve Çalıştırma

### Gereksinimler
- Node.js (v18+)
- Java JDK 11+ (Android derlemesi için)
- Android SDK (Mobil uygulama için)
- npm veya yarn

### 1. Sunucuyu Başlatmak (Server)
```bash
cd server
npm install
npm run start
```

### 2. POS Uygulamasını Çalıştırmak (Masaüstü)
```bash
cd app1
npm install
npm run dev
```

### 3. Derleme Çıktıları (Release)
- **Windows (EXE):** `\app1\` dizininde `npm run build:win` komutu ile derlenir.
- **Android (APK):** `\app2\` dizininde `./gradlew assembleDebug` (veya assembleRelease) ile derlenir.

## 📱 Mobil Uyumluluk
Projenin web modülleri (Kasa girişleri, Admin Araçları, TV Ekranı) Vanilla CSS ile tamamen responsive (mobil uyumlu) olacak şekilde tasarlanmıştır.

## 📄 Lisans
Bu proje özel bir işletme yazılımı olarak geliştirilmiştir.
