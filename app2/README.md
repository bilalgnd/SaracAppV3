# SaraçApp - Restoran POS & Sipariş Yönetim Sistemi

SaraçApp, restoranlar (Örn: Saraçoğlu Döner) için geliştirilmiş, cihazlar arası anlık senkronizasyon yeteneğine sahip, çok platformlu bir POS (Satış Noktası) ve Sipariş Yönetim sistemidir.

## 🌟 Temel Özellikler

- **🖥️ Kasa Uygulaması (App1 - Windows):** Electron.js, React ve TypeScript ile geliştirilmiş ana kasa ekranı. Siparişleri yönetme, hesap kapatma, yazdırılabilir adisyon oluşturma işlevleri.
- **📱 Garson Terminali (App2 - Android):** Kotlin ve Jetpack Compose ile yazılmış, garsonların masalardan sipariş alması için tasarlanmış Native Android uygulaması.
- **🌐 Web Arayüzü:** Kasa uygulamasının yerel ağda sunduğu web sunucusu üzerinden çalışan cihaz bağımsız web sipariş arayüzü.
- **⚡ Anlık Senkronizasyon:** Kasa, Android tabletler ve Web arayüzü arasında WebSocket üzerinden **gecikmesiz (real-time)** sipariş güncellemeleri.
- **🤖 Otonom Sipariş Entegrasyonu:** Yemeksepeti ve Trendyol Yemek siparişlerini otomatik olarak dinler ve sisteme kendi kendine düşürür.
- **🖨️ Adisyon Yazdırma:** Termal yazıcılara doğrudan yazdırma entegrasyonu.
- **🔄 Otomatik Güncelleme (Auto-Update):** GitHub Releases üzerinden otomatik versiyon kontrolü ve sessiz güncelleme mimarisi.

## 🛠️ Mimari ve Teknolojiler

- **Backend / Sunucu (Kasa İçinde):** Node.js, Express.js, Socket.io
- **Frontend (Kasa & Web):** React, TypeScript, Vite
- **Masaüstü (Desktop):** Electron.js, electron-builder, electron-updater
- **Mobil (Android):** Kotlin, Jetpack Compose, Retrofit, OkHttp

## 🚀 Kurulum ve Geliştirme (Windows Kasa İçin)

Projeyi yerel bilgisayarınızda çalıştırmak için **Node.js** yüklü olmalıdır.

### 1. Bağımlılıkları Yükleme
```bash
npm install
```

### 2. Geliştirme (Development) Modunda Başlatma
```bash
npm run dev
```
Bu komut, Electron uygulamasını geliştirme modunda (Hot-Reloading aktif) başlatır.

### 3. Windows İçin Derleme (Build & Package)
```bash
npm run build:win
```
Oluşturulan `.exe` formatındaki kurulum dosyaları `dist/` klasörünün içerisine çıkartılacaktır.

---

*Bu proje, iş süreçlerini dijitalleştirmek, hızlandırmak ve paket sipariş süreçlerini tek bir merkezden yönetmek amacıyla geliştirilmiştir.*
