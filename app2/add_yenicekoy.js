const fs = require('fs');

const file = 'src/renderer/src/utils/addresses.json';
let data = JSON.parse(fs.readFileSync(file, 'utf8'));

const yenicekoyList = [
  "YENİCEKÖY MAH.",
  "AÇELYA SKK.", "ADNAN MENDERES CAD.", "AHLAT SKK.", "AKSU SKK.", "ALTIN SKK.", "ARSLAN SKK.", 
  "ASIR SKK.", "ATEŞ SKK.", "BAYIR SKK.", "BEGONVİL SKK.", "BEGONYA SKK.", "BESTE SKK.", 
  "BEYAZ SKK.", "BİLLUR SKK.", "ÇAĞLA SKK.", "ÇAM SKK.", "CANAN SKK.", "ÇİFTLİK CAD.", 
  "ÇİĞDEM SKK.", "ÇİMEN SKK.", "DEMET SKK.", "DESTAN SKK.", "DESTE SKK.", "DİLEK SKK.", 
  "DİYAR SKK.", "DÖNER SKK.", "DURU SKK.", "EMİR SKK.", "EREN SKK.", "EZGİ SKK.", 
  "FATİH SULTAN MEHMET BULVARI", "FAZİLET SKK.", "FERAH SKK.", "FESLEĞEN SKK.", "FULYA SKK.", 
  "GAZİ SKK.", "GEÇİT SKK.", "GÖKNAR SKK.", "GÜNEŞ SKK.", "GÜVEN CAD.", "HANIMELİ SKK.", 
  "HASRET SKK.", "HERCAİ SKK.", "HIZIR SKK.", "İPEK SKK.", "KADİFE SKK.", "KINALI SKK.", 
  "KIZIL SKK.", "KOCATEPE CAD.", "LADİN SKK.", "LİMON SKK.", "LODOS SKK.", "MELTEM SKK.", 
  "MENEKŞE SKK.", "NAR SKK.", "NERGİS SKK.", "ORKİDE SKK.", "PALMİYE SKK.", "PELİN SKK.", 
  "PELİT SKK.", "RAHMET SKK.", "RAVZA SKK.", "REFET SEZGİN CAD.", "SAADET SKK.", 
  "ŞEHİT NURETTİN YEL CAD.", "SEMA SKK.", "SUSAM SKK.", "TİRFİL SKK.", "TUBA SKK.", 
  "TURNA SKK.", "TURUNÇ SKK.", "UZUNSU SKK.", "YAKUT SKK.", "YASEMİN SKK.", "YILMAZ SKK.", 
  "YONCA SKK.", "YÜCE SKK.", "YUNUS EMRE CAD.", "ZARİF SKK."
];

// Add if not already present
yenicekoyList.forEach(item => {
  if (!data.includes(item)) {
    data.push(item);
  }
});

fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('Added Yenicekoy elements');
