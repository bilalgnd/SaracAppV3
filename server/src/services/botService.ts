import puppeteer, { Page } from 'puppeteer-core';
import { parseTrendyolPayload, parseYemeksepetiPayload, ParsedOrder } from './networkListener';
import { addSystemLog } from '../server';
import { getShop } from '../models';
import axios from 'axios';

// Chrome'un uzaktan hata ayıklama portu (Kısayola --remote-debugging-port=9222 eklenecek)
const CHROME_DEBUGGING_URL = 'http://localhost:9222';

export type OrderCallback = (order: ParsedOrder) => void;

export type BotStatus = 'connected' | 'error' | 'disconnected';
export let currentBotStatus: BotStatus = 'disconnected';

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
        currentBotStatus = 'connected';

        // Mevcut açık olan tüm sekmeleri al
        const pages = await browser.pages();
        
        for (const page of pages) {
            setupPageListeners(page, onOrderReceived);
        }

        // Kullanıcı yeni bir sekme açarsa, onu da dinlemeye başla
        browser.on('targetcreated', async (target) => {
            if (target.type() === 'page') {
                const newPage = await target.page();
                if (newPage) {
                    addSystemLog('BotService', 'info', `Yeni sekme algılandı, sipariş dinleyicisi aktif ediliyor.`);
                    setupPageListeners(newPage, onOrderReceived);
                }
            }
        });

        browser.on('disconnected', () => {
            console.log('[BotService] Chrome bağlantısı koptu. (Tarayıcı kapanmış olabilir)');
            addSystemLog('BotService', 'warning', 'Chrome bağlantısı koptu. Tarayıcı kapanmış olabilir.');
            currentBotStatus = 'disconnected';
            // Opsiyonel: Belli aralıklarla yeniden bağlanmayı deneyebiliriz.
        });

    } catch (error: any) {
        console.error('[BotService] Chrome bağlantı hatası:', error);
        addSystemLog('BotService', 'error', `Chrome bağlantı hatası: ${error.message || 'Bilinmeyen hata'}`);
        console.log('-> Lütfen Chrome\'un --remote-debugging-port=9222 bayrağı ile açık olduğundan emin olun.');
        currentBotStatus = 'error';
    }
}

/**
 * Verilen sayfanın (sekmenin) hem ağ trafiğine hem de Yazdır (Print) butonuna dinleyici ekler.
 */
async function setupPageListeners(page: Page, onOrderReceived: OrderCallback) {
    try {
        const pageUrl = await page.url();
        addSystemLog('BotService', 'info', `Sipariş dinleyicisi (Network & Print) sayfaya entegre edildi: ${pageUrl.substring(0, 60)}`);
    } catch(e) {}
    // 1. Ağ dinleyicisi (XHR/Fetch) - Arka plandan yakalama
    page.on('response', async (response) => {
        const settings = getShop()?.systemSettings || {};
        if (settings['ENABLE_BOT_NETWORK'] === false) return;

        const request = response.request();
        const url = request.url();
        
        // Sadece XHR veya Fetch türündeki istekleri yakala
        if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
            try {
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
                // Sessizce geçiştiriyoruz.
            }
        }
    });

    // 2. Print Interceptor - Kullanıcı Yazdır'a bastığında çalışan kod
    try {
        await page.exposeFunction('sendReceiptData', async (textContent: string) => {
            const settings = getShop()?.systemSettings || {};
            if (settings['ENABLE_BOT_PRINT'] === false) return;

            try {
                // app1'in beklediği 3005 portuna gönder
                await axios.post('http://127.0.0.1:3005/api/manual_parse', { text: textContent });
                console.log('Print interceptor: Sipariş başarıyla app1 (Kasa) gönderildi.');
                addSystemLog('BotService', 'success', 'Yazdırılan fiş metni kasaya aktarıldı.');
            } catch (err: any) {
                console.error('Print interceptor kasaya gönderim hatası:', err.message);
                addSystemLog('BotService', 'error', 'Yazdırılan fiş kasaya iletilemedi (app1 açık mı?).');
            }
        });
    } catch (e) {
        // Fonksiyon zaten eklenmişse hata verir, önemli değil
    }

    try {
        await page.evaluateOnNewDocument(() => {
            const originalPrint = window.print;
            window.print = async function(...args: any[]) {
                try {
                    const receiptText = document.body.innerText || document.documentElement.innerText;
                    if (window.top && (window.top as any).sendReceiptData) {
                        await (window.top as any).sendReceiptData(receiptText);
                    }
                } catch (e) {
                    console.error("Print capture error", e);
                } finally {
                    // Fiziksel yazdırma ekranını her durumda aç
                    originalPrint.apply(window, args as any);
                }
            };
        });

        // Hali hazırda açık sayfaya da enjekte et
        await page.evaluate(() => {
            if (!(window as any).__print_intercepted) {
                (window as any).__print_intercepted = true;
                const originalPrint = window.print;
                window.print = async function(...args: any[]) {
                    try {
                        const receiptText = document.body.innerText || document.documentElement.innerText;
                        if (window.top && (window.top as any).sendReceiptData) {
                            await (window.top as any).sendReceiptData(receiptText);
                        }
                    } catch (e) {
                        console.error("Print capture error", e);
                    } finally {
                        originalPrint.apply(window, args as any);
                    }
                };
            }
        });
    } catch (e) {
        console.error('Print interceptor sayfa içine işlenemedi:', e);
    }
}


