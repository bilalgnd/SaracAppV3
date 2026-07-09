import fs from 'fs';
import path from 'path';
import os from 'os';
import { addSystemLog } from '../server';

export interface ParsedOrder {
    order_id: string;
    customer_name: string;
    total_amount: number;
    order_note: string;
    items: Array<{
        name: string;
        options?: string[];
        quantity: number;
        price: number;
    }>;
    platform: 'trendyol' | 'yemeksepeti';
}

const dumpPath = path.join(os.homedir(), 'Documents', 'bot_payloads.txt');

/**
 * Trendyol ağ trafiğinden gelen JSON paketini ayrıştırır.
 * Yarın dükkandaki canlı test sırasında bu fonksiyonun içi doldurulacak.
 */
export function parseTrendyolPayload(payload: any): ParsedOrder | null {
    try {
        console.log("Trendyol JSON paketi alındı, yapı inceleniyor...");
        const dumpData = "\n============== TRENDYOL HAM VERİ ==============\n" + 
                         new Date().toLocaleString() + "\n" +
                         JSON.stringify(payload, null, 2) + "\n===============================================\n";
        console.log(dumpData);
        try { fs.appendFileSync(dumpPath, dumpData, 'utf8'); } catch(e) {}
        addSystemLog('BotService', 'info', `Trendyol paketi yakalandı ve Belgelerim'e kaydedildi. Uzunluk: ${JSON.stringify(payload).length}`);
        // TODO: Yarın gerçek JSON yapısı buraya gelince alanları (field) eşleştireceğiz.
        return null;
    } catch (error) {
        console.error("Trendyol verisi ayrıştırılırken hata:", error);
        return null;
    }
}

/**
 * Yemeksepeti ağ trafiğinden gelen JSON paketini ayrıştırır.
 * Yarın dükkandaki canlı test sırasında bu fonksiyonun içi doldurulacak.
 */
export function parseYemeksepetiPayload(payload: any): ParsedOrder | null {
    try {
        console.log("Yemeksepeti JSON paketi alındı, yapı inceleniyor...");
        const dumpData = "\n============ YEMEKSEPETİ HAM VERİ =============" + 
                         new Date().toLocaleString() + "\n" +
                         JSON.stringify(payload, null, 2) + "\n===============================================\n";
        console.log(dumpData);
        try { fs.appendFileSync(dumpPath, dumpData, 'utf8'); } catch(e) {}
        addSystemLog('BotService', 'info', `Yemeksepeti paketi yakalandı ve Belgelerim'e kaydedildi. Uzunluk: ${JSON.stringify(payload).length}`);
        // TODO: Yarın gerçek JSON yapısı buraya gelince alanları eşleştireceğiz.
        return null;
    } catch (error) {
        console.error("Yemeksepeti verisi ayrıştırılırken hata:", error);
        return null;
    }
}
