import puppeteer, { Page } from 'puppeteer-core';
import { parseTrendyolPayload, parseYemeksepetiPayload, ParsedOrder } from './networkListener';
import { addSystemLog } from '../server';

// Chrome'un uzaktan hata ayıklama portu (Kısayola --remote-debugging-port=9222 eklenecek)
const CHROME_DEBUGGING_URL = 'http://localhost:9222';

export type OrderCallback = (order: ParsedOrder) => void;

/**
 * Puppeteer kullanarak açık olan Chrome'a bağlanır ve ağ trafiğini dinler.
 */
export async function startBotService(onOrderReceived: OrderCallback) {
    try {
        console.log(`[BotService] ${CHROME_DEBUGGING_URL} üzerinden açık olan Chrome'a bağlanılıyor...`);
        addSystemLog('BotService', 'info', `${CHROME_DEBUGGING_URL} üzerinden açık olan Chrome'a bağlanılıyor...`);
        
        // Açık olan Chrome tarayıcısına bağlan
        const browser = await puppeteer.connect({
            browserURL: CHROME_DEBUGGING_URL,
            defaultViewport: null // Orijinal pencere boyutunu koru
        });

        console.log('[BotService] Chrome bağlantısı başarılı!');
        addSystemLog('BotService', 'success', 'Chrome bağlantısı başarılı!');

        // Mevcut açık olan tüm sekmeleri al
        const pages = await browser.pages();
        
        for (const page of pages) {
            setupNetworkListener(page, onOrderReceived);
        }

        // Kullanıcı yeni bir sekme açarsa, onu da dinlemeye başla
        browser.on('targetcreated', async (target) => {
            if (target.type() === 'page') {
                const newPage = await target.page();
                if (newPage) {
                    setupNetworkListener(newPage, onOrderReceived);
                }
            }
        });

        browser.on('disconnected', () => {
            console.log('[BotService] Chrome bağlantısı koptu. (Tarayıcı kapanmış olabilir)');
            addSystemLog('BotService', 'warning', 'Chrome bağlantısı koptu. Tarayıcı kapanmış olabilir.');
            // Opsiyonel: Belli aralıklarla yeniden bağlanmayı deneyebiliriz.
        });

    } catch (error: any) {
        console.error('[BotService] Chrome bağlantı hatası:', error);
        addSystemLog('BotService', 'error', `Chrome bağlantı hatası: ${error.message || 'Bilinmeyen hata'}`);
        console.log('-> Lütfen Chrome\'un --remote-debugging-port=9222 bayrağı ile açık olduğundan emin olun.');
    }
}

/**
 * Verilen sayfanın (sekmenin) ağ trafiğine dinleyici ekler.
 */
function setupNetworkListener(page: Page, onOrderReceived: OrderCallback) {
    page.on('response', async (response) => {
        const request = response.request();
        const url = request.url();
        
        // Sadece XHR veya Fetch türündeki istekleri yakala
        if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
            try {
                // TODO: Yarın test sırasında URL desenlerini belirleyeceğiz (Örn: /api/orders, /orders/new)
                // Şimdilik Trendyol ve Yemeksepeti'nden geldiğini tahmin ettiğimiz istekleri yakalıyoruz.
                
                if (url.includes('trendyol') && url.includes('order')) { // Geçici filtre
                    const jsonPayload = await response.json().catch(() => null);
                    if (jsonPayload) {
                        const parsedOrder = parseTrendyolPayload(jsonPayload);
                        if (parsedOrder) {
                            addSystemLog('BotService', 'success', `Trendyol Siparişi Yakalandı: ${parsedOrder.customer_name}`);
                            onOrderReceived(parsedOrder);
                        }
                    }
                }
                else if (url.includes('yemeksepeti') && url.includes('order')) { // Geçici filtre
                    const jsonPayload = await response.json().catch(() => null);
                    if (jsonPayload) {
                        const parsedOrder = parseYemeksepetiPayload(jsonPayload);
                        if (parsedOrder) {
                            addSystemLog('BotService', 'success', `Yemeksepeti Siparişi Yakalandı: ${parsedOrder.customer_name}`);
                            onOrderReceived(parsedOrder);
                        }
                    }
                }
            } catch (error) {
                // Bazı response'ların body'sini okumak (örneğin CORS veya preflight istekleri) hata verebilir.
                // Bu hataları sessizce geçiştiriyoruz.
            }
        }
    });
}
