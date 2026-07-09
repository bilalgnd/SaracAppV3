import type { Browser, Page } from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import os from 'os';

let isBotRunning = false;
let browser: Browser | null = null;
let retryInterval: NodeJS.Timeout | null = null;

const dumpPath = path.join(os.homedir(), 'Documents', 'bot_payloads.txt');

function savePayload(platform: string, payload: any) {
    try {
        const dumpData = `\n============== ${platform} HAM VERİ ==============\n` + 
                         new Date().toLocaleString() + "\n" +
                         JSON.stringify(payload, null, 2) + "\n===============================================\n";
        fs.appendFileSync(dumpPath, dumpData, 'utf8');
        console.log(`[BotService] ${platform} siparişi yakalandı ve Belgelerim'e kaydedildi.`);
    } catch(e) {
        console.error("[BotService] Dosyaya yazma hatası:", e);
    }
}

async function attachToChrome() {
    if (!isBotRunning) return;
    
    try {
        if (!browser) {
            const puppeteer = (await import('puppeteer-core')).default;
            browser = await puppeteer.connect({
                browserURL: 'http://127.0.0.1:9222',
                defaultViewport: null
            });
            console.log('[BotService] Chrome\'a başarıyla bağlanıldı (Port: 9222)');
            
            browser.on('disconnected', () => {
                console.log('[BotService] Chrome bağlantısı koptu.');
                browser = null;
                if (isBotRunning) scheduleRetry();
            });
            
            setupInterceptors();
        }
    } catch (error) {
        console.log('[BotService] Chrome bağlantı hatası (9222 portu kapalı veya Chrome çalışmıyor). Yeniden denenecek...');
        browser = null;
        if (isBotRunning) scheduleRetry();
    }
}

function scheduleRetry() {
    if (!isBotRunning) return;
    if (retryInterval) clearTimeout(retryInterval);
    retryInterval = setTimeout(() => {
        attachToChrome();
    }, 5000);
}

async function setupInterceptors() {
    if (!browser) return;
    
    try {
        const targets = await browser.targets();
        for (const target of targets) {
            if (target.type() === 'page') {
                const page = await target.page();
                if (page) {
                    await setupPageInterceptor(page);
                }
            }
        }

        browser.on('targetcreated', async (target) => {
            if (target.type() === 'page') {
                const page = await target.page();
                if (page) await setupPageInterceptor(page);
            }
        });
    } catch (error) {
        console.error('[BotService] Interceptor kurulamadı:', error);
    }
}

async function setupPageInterceptor(page: Page) {
    try {
        const url = page.url();
        if (url.includes('trendyol') || url.includes('yemeksepeti')) {
            console.log(`[BotService] İlgili sekme bulundu ve dinleniyor: ${url}`);
            
            page.on('response', async (response) => {
                const reqUrl = response.url();
                
                if (reqUrl.includes('trendyol') && reqUrl.includes('order')) {
                    try {
                        const json = await response.json();
                        savePayload('TRENDYOL', json);
                    } catch (e) { }
                } else if (reqUrl.includes('yemeksepeti') && reqUrl.includes('order')) {
                    try {
                        const json = await response.json();
                        savePayload('YEMEKSEPETI', json);
                    } catch (e) { }
                }
            });
        }
    } catch (error) { }
}

export function startBotService() {
    if (isBotRunning) return;
    console.log('[BotService] Bot başlatılıyor...');
    isBotRunning = true;
    attachToChrome();
}

export function stopBotService() {
    console.log('[BotService] Bot durduruluyor...');
    isBotRunning = false;
    if (retryInterval) clearTimeout(retryInterval);
    if (browser) {
        browser.disconnect();
        browser = null;
    }
}
