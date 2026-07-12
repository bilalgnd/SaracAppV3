import fs from 'fs';
import path from 'path';
import { BrowserWindow, app } from 'electron';
import { systemSettings } from './models';
import { processPdfOrder } from './aiOcrService';
import { sendLogToServer } from './index';

let watcher: fs.FSWatcher | null = null;
let isWatching = false;

const processedFiles = new Set<string>();

export function startFileWatcher(mainWindow?: BrowserWindow) {
    if (isWatching) return;
    
    const logsDir = systemSettings.PDF_LOGS_DIR || path.join(app.getPath('documents'), 'logs');

    if (!fs.existsSync(logsDir)) {
        try {
            fs.mkdirSync(logsDir, { recursive: true });
        } catch(e) {
            console.error("[FileWatcher] Klasor olusturulamadi:", e);
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
            
            // Ignore .trash folder and anything inside it
            if (filename === '.trash' || filePath.includes('.trash')) return;
            
            if (processedFiles.has(filePath)) return;

            if (eventType === 'change' || eventType === 'rename') {
                if (fs.existsSync(filePath)) {
                    // Dosyanın tamamen yazılmasını beklemek için çok kısa bir süre bekle (2 saniye yerine 300ms)
                    setTimeout(() => processFile(filePath, ext, mainWindow), 300);
                }
            }
        });
    } catch (e) {
        console.error("[FileWatcher] Hata:", e);
    }
}

async function processFile(filePath: string, ext: string, mainWindow?: BrowserWindow) {
    if (processedFiles.has(filePath)) return;
    processedFiles.add(filePath);

    try {
        if (['.pdf', '.png', '.jpg', '.jpeg'].includes(ext)) {
            console.log(`[FileWatcher] Yeni siparis dosyasi bulundu: ${filePath}`);
            // AI OCR Servisi ile işlemi başlat (IPC yerine arka planda yapıyoruz)
            console.log(`[FileWatcher] AI OCR Basliyor: ${filePath}`);
            const success = await processPdfOrder(filePath);
            
            if (success) {
                console.log(`[FileWatcher] Basarili: Siparis sisteme eklendi.`);
                sendLogToServer('success', `Dosya dinleme: Yeni sipariş algılandı`);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    // Kullanıcıya bilgi vermek için basit bir IPC gönderebiliriz
                    mainWindow.webContents.send('ocr-success', { message: 'Sipariş başarıyla ayrıştırıldı ve kaydedildi.' });
                }
            } else {
                console.error(`[FileWatcher] AI OCR Basarisiz, yerel Tesseract OCR'a dusuluyor...`);
                sendLogToServer('warning', `Dosya dinleme: OCR başarısız, manuel işleme bekleniyor.`);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    try {
                        const fileBuffer = fs.readFileSync(filePath);
                        const base64Data = fileBuffer.toString('base64');
                        mainWindow.webContents.send('process-pdf', { filePath, data: base64Data });
                    } catch (e) {
                        console.error('[FileWatcher] Tesseract fallback sirasinda dosya okuma hatasi:', e);
                    }
                }
            }
        }
    } catch (error) {
        console.error(`[FileWatcher] Dosya okuma hatası (${filePath}):`, error);
    }
    
    // Test amaçlı aynı isimli dosya tekrar gelirse diye listeyi temizle
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
