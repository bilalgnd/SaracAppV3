const { parseOrderText } = require('./out/main/textParser.js');
const text1 = `PAKET SERVİS ONLİNE ÖDENMİŞTİR
TESLİM ZAMANI
19:39
Müşteri konumunu görmek için telefonunuz ile
kodu okutabilirsiniz
#1203
Mert Ocak
Özler sitesi ,
C-blok, Şehit
Alper Tunga
Akan
Caddesi, 50B
3, Kat 1
Şirintepe Çanakkale,
17200, Çanakkale
TEL: +9054669
21769
3
- ** ÇATAL-BIÇAK
GÖNDERMEYİN Online Kredi
/Banka Kartı
1 
Tavuk Döner Hatay
Usulü Dürüm
₺
270,00
200Gr 
₺
100,00
1 Fanta (33 cl.) 
₺
100,00
1 Ayran (17 cl.) ₺ 40,00
Ara toplam ₺ 510,00
Toplam ₺ 510,00
KDV (Dahil) ₺ 46,36
13 Temmuz 2026 Pazartesi
Sipariş No.:
vt7h-2629-qyfv
Saraçoğlu
Döner
Siparişiniz için
teşekkür ederiz`;

const text2 = `Sipariş Kodu:  001
 13/07/2026 18:21
 Selma A.
 sakarya mah. 314 sok no:27/29 daire:5 Beyaz Köşk, Biga, Sakarya Mah, Bina No: 27/29, Kat: 3, Daire: 5. Açıklama: Sakarya mah
314 sok no27/29 daire 5 beyazkosk
 Sipariş Notu: Servis İstiyorum
 Ürün  Adet  Tutar
 Tavuk Döner Hatay Usulü Dürüm
 (100 gr tavuk döner, özel sos, patates ve sarımsaklı mayonez.) 
2  500,00 ₺
 100 Gram  2  0,00 ₺
 Et Döner Dürüm
 (100 gr. et döner, domates, patates kızartması, soğan) 
1  450,00 ₺
 100 Gram  1  0,00 ₺
 Toplam:  950,00 ₺
 Restoran Destek Hattı:  +90 850 210 7555 / 6647850
 Müşteri İletişim:  0212 365 34 03 / 11409732804
 Siparişle ilgili kullanıcıyla iletişime geçmek için 0212 365 34 03 numarasını arayarak, 11409732804 no’lu sipariş numarasını tuşlayabilirsiniz.
 Müşteri adresine erişim için QR kodu okutabilirsiniz.`;

console.log('T1', JSON.stringify(parseOrderText(text1), null, 2));
console.log('T2', JSON.stringify(parseOrderText(text2), null, 2));
