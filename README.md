# SaracApp - Restoran POS ve Siparis Yönetim Sistemi

SaracApp, restoranlar ve paket servis isletmeleri için tasarlanmis, çok platformlu (Masaüstü, Web, Mobil) kapsamli bir POS (Point of Sale) ve siparis yönetim sistemidir.

Proje, kurye takibinden Yemeksepeti/Trendyol entegrasyonlarina kadar restoranin günlük operasyonlarini dijitallestirmeyi hedeflemektedir.

## ?? Proje Bilesenleri (Monorepo Yapisi)

Proje 4 ana modülden olusmaktadir:

### 1. Kasa Sunucusu (\server\)
- **Açiklama:** Node.js, Express ve TypeScript ile gelistirilmis yerel (local) sunucu.
- **Görevleri:** Veritabani yönetimini (yerel JSON/SQLite) saglar, mobil ve masaüstü uygulamalar için REST API sunar. Ayni zamanda Mutfak TV ekrani, Yönetici paneli ve public arayüzler için HTML sablonlarini (\	emplates\) ayaga kaldirir.

### 2. POS Masaüstü Uygulamasi (\App1\)
- **Açiklama:** Electron, React, Vite ve TypeScript kullanilarak gelistirilmis Windows Kasa uygulamasi.
- **Görevleri:** Restoran içindeki siparislerin girilmesi, masa takibi, adisyon fislerinin yazdirilmasi (Termal yazici entegrasyonu) ve günlük ciro/hesap islemlerinin yapildigi ana isletim ekranidir.

### 3. Android Kurye/Garson Uygulamasi (\App2\)
- **Açiklama:** Kotlin ve Jetpack Compose kullanilarak gelistirilmis mobil uygulama.
- **Görevleri:** Restoran içindeki personelin mobil cihazlar üzerinden siparis girmesini veya paket servis kuryelerinin siparis durumlarini güncellemesini saglar. Kasa sunucusuna ag üzerinden dogrudan baglanir.

.

## ?? Kurulum ve Çalistirma

### Gereksinimler
- Node.js (v18+)
- Java JDK 11+ (Android derlemesi için)
- Android SDK (Mobil uygulama için)
- npm veya yarn

### 1. Sunucuyu Baslatmak (Server)
\\\Bash
cd server
npm install
npm run start
\\\
*(Sunucu varsayilan olarak http://127.0.0.1:5000 adresinde çalisir.)*

### 2. POS Uygulamasini Çalistirmak (Masaüstü)
\\\Bash
cd app1
npm install
npm run dev
\\\



### 4. Derleme Çiktilari (Release)
- **Windows (EXE):** \App1\ dizininde \
pm run build:win\ komutu ile derlenir.
- **Android (APK):** \App2\ dizininde \.\gradlew assembleDebug\ (veya assembleRelease) ile derlenir.

## ?? Mobil Uyumluluk
Projenin web modülleri (Kasa girisleri, Admin Araçlari, TV Ekrani) Vanilla CSS ve Tailwind CSS ile tamamen responsive (mobil uyumlu) olacak sekilde tasarlanmistir.

## ?? Lisans
Bu proje özel bir isletme yazilimi olarak gelistirilmistir.
