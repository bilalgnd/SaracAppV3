import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
// import pdfParse from 'pdf-parse'; // Ileride PDF icin eklenebilir

let watcher: fs.FSWatcher | null = null;
let isWatching = false;

const CLOUD_URL = 'https://bilalgnd.shop';
const logsDir = path.join(os.homedir(), 'Documents', 'logs');
const processedFiles = new Set<string>();

export function startFileWatcher() {
    if (isWatching) return;
    
    if (!fs.existsSync(logsDir)) {
        try {
            fs.mkdirSync(logsDir, { recursive: true });
        } catch(e) {
            console.error("[FileWatcher] Klasör oluşturulamadı:", e);
            return;
        }
    }

    console.log(`[FileWatcher] Dinleniyor: ${logsDir}`);
    isWatching = true;

    try {
        watcher = fs.watch(logsDir, (eventType, filename) => {
            if (!filename) return;
            const ext = path.extname(filename).toLowerCase();
            const filePath = path.join(logsDir, filename);
            
            // Aynı dosyayı tekrar tekrar okumamak için
            if (processedFiles.has(filePath)) return;

            if (eventType === 'change' || eventType === 'rename') {
                if (fs.existsSync(filePath)) {
                    // Dosyanın yazılmasının bitmesini beklemek için ufak bir gecikme
                    setTimeout(() => processFile(filePath, ext), 1000);
                }
            }
        });
    } catch (e) {
        console.error("[FileWatcher] Hata:", e);
    }
}

async function processFile(filePath: string, ext: string) {
    if (processedFiles.has(filePath)) return;
    processedFiles.add(filePath);

    try {
        let content = '';
        if (ext === '.txt' || ext === '.json' || ext === '.js') {
            content = fs.readFileSync(filePath, 'utf-8');
        } else if (ext === '.pdf') {
            // İleride pdf-parse kütüphanesi eklenerek PDF'ten metin çıkarılabilir.
            content = "[PDF Dosyası Algılandı, henüz metin çıkarma desteklenmiyor]";
        } else {
            return; // Desteklenmeyen format
        }

        console.log(`[FileWatcher] Yeni dosya okundu: ${filePath}`);
        
        // Okunan veriyi incelemek ve buluta göndermek için geçici çözüm:
        // Şimdilik sipariş detaylarını bilmiyoruz, bu yüzden ham içeriği sunucuya "log" olarak atabiliriz
        // veya burada JSON parse etmeyi deneyebiliriz.
        
        try {
            const data = JSON.parse(content);
            // Eğer geçerli bir JSON ise Trendyol veya Yemeksepeti endpoint'ine atılabilir
            if (data && data.customerName) {
                await axios.post(`${CLOUD_URL}/trendyol_web_siparis`, data);
            }
        } catch (e) {
            // JSON değilse düz metindir. İleride Regex ile müşteri adı ve ürünler ayıklanabilir.
            const dumpPath = path.join(os.homedir(), 'Documents', 'bot_payloads.txt');
            fs.appendFileSync(dumpPath, `\n=== FILE WATCHER: ${path.basename(filePath)} ===\n${content}\n`, 'utf8');
        }

    } catch (error) {
        console.error(`[FileWatcher] Dosya okuma hatası (${filePath}):`, error);
    }
    
    // Test amaçlı olduğu için seti 1 dakika sonra temizle ki aynı isimli dosya gelirse okusun
    setTimeout(() => {
        processedFiles.delete(filePath);
    }, 60000);
}

export function stopFileWatcher() {
    if (!isWatching) return;
    console.log('[FileWatcher] Durduruluyor...');
    isWatching = false;
    if (watcher) {
        watcher.close();
        watcher = null;
    }
    processedFiles.clear();
}
