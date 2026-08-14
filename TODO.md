# 📋 Güncel Yapılacaklar (TODO Listesi)

---

### 1. 🔔 QR Menü: "Garson Çağır" Özelliği (✅ Tamamlandı)
- [x] **QR Sayfası UI (`qr-app`):** Kullanıcı isimle giriş yaptıktan sonra menü başlığında (ve sipariş takip ekranında) şık ve dikkat çekici **"🔔 Garson Çağır"** butonu entegre edildi.
- [x] **Kademeli Cooldown (Anti-Abuse Koruması):** 
  - 1. çağrışta: **20 saniye**
  - 2. çağrışta: **40 saniye**
  - 3. çağrışta: **50 saniye**
  - 4. ve sonraki çağrışlarda: **60 saniye**
  - Sayfa yenilense bile `localStorage` üzerinden kalan süre korunur ve canlı geri sayım (`🔔 Garson Çağrıldı (18s)`) yapılır.
- [x] **Backend & Bildirim Akışı:** `POST /api/public/call_waiter` üzerinden `notifyUI('waiter_call')` ile WebSocket yayını ve FCM Multicast bildirimleri sağlandı.
- [x] **TV Ekranı Entegrasyonu (`tv-sarac`):** TV ekranında çağrı anında sesli bildirim (Web Audio Chime) ve üstte parlayan **"🔔 GARSON ÇAĞRISI: {İsim / Masa}"** banner uyarısı gösterilmesi sağlandı.
- [x] **Dağıtım:** `qr-app` derlenerek `server/public/qr_app` ve `server/public/qr` dizinlerine aktarıldı.

---

### 2. 🔐 Şifre Yönetimi (✅ Tamamlandı / Korundu)
- [x] Admin Tools (`admintools.html`) üzerinde `plain_password` yöneticinin kolayca görebilmesi için maskeli/göz butonlu olarak korunmaktadır.
- [x] Şifre güncellemelerinde hem `bcrypt` hash hem de `plain_password` eşzamanlı güncellenmektedir.

---

### 3. 📦 QR Menü: Ürün Kartı Tıklama Kolaylığı (✅ Tamamlandı)
- [x] Ürün kartının herhangi bir yerine basıldığında porsiyon/özelleştirme penceresinin açılması sağlandı. Sadece `+` butonuna basma zorunluluğu kaldırıldı.
- [x] Hover ve dokunmatik geri bildirim animasyonları eklendi.

---

### 4. 🛡️ MongoDB Atlas Otomatik Backup Sistemi (✅ Tamamlandı)
- [x] Sunucu üzerinde çalışan bağımsız, gzip sıkıştırmalı otomatik MongoDB yedekleme scripti (`auto_backup.js`) kuruldu.
- [x] Veritabanındaki tüm koleksiyonlar (users, datas, activitylogs, healthrecords vb.) eksiksiz dışa aktarılıyor.
- [x] **Crontab:** Her gece 04:00'te otomatik çalışma ayarlandı.
- [x] **30 Günlük Saklama Politikası:** 30 günden eski yedekler disk dolmaması için otomatik temizleniyor.
- [x] **Geri Yükleme (Restore):** Gerektiğinde tek komutla (`restore_db.js`) yedekten dönme altyapısı hazırlandı.

---
