import { app } from 'electron';
import { systemSettings } from './models';
import axios from 'axios';
import { sendLogToServer } from './index';

let yemeksepetiInterval: NodeJS.Timeout | null = null;
let isPolling = false;

// Token saklamak için değişkenler
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0; // timestamp (ms)

// Yemeksepeti API Base URL'i
const YEMEKSEPETI_BASE_URL = 'https://partner-api.deliveryhero.com'; // Varsayılan/Örnek

async function getAccessToken(): Promise<string | null> {
  // Eğer tokenımız varsa ve süresi dolmadıysa (10 saniye tolerans payı ile)
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 10000) {
    return cachedAccessToken;
  }

  const clientId = systemSettings["YEMEKSEPETI_CLIENT_ID"];
  const clientSecret = systemSettings["YEMEKSEPETI_CLIENT_SECRET"];

  if (!clientId || !clientSecret) {
    sendLogToServer('error', '[YemeksepetiService] Client ID veya Client Secret eksik.');
    return null;
  }

  try {
    // Generate Access Token endpoint'ine istek atılıyor
    const response = await axios.post(`${YEMEKSEPETI_BASE_URL}/token`, 
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      }).toString(), 
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const data = response.data;
    if (data && data.access_token) {
      cachedAccessToken = data.access_token;
      // expires_in genellikle saniye cinsindendir
      const expiresInMs = (data.expires_in || 3600) * 1000;
      tokenExpiresAt = Date.now() + expiresInMs;
      
      // İsteğe bağlı: systemSettings'e de kaydedebiliriz
      systemSettings["YEMEKSEPETI_ACCESS_TOKEN"] = cachedAccessToken;
      systemSettings["YEMEKSEPETI_TOKEN_EXPIRES"] = tokenExpiresAt;
      
      sendLogToServer('success', `[YemeksepetiService] Yeni Access Token alındı. Geçerlilik: ${data.expires_in} sn.`);
      return cachedAccessToken;
    } else {
      sendLogToServer('error', '[YemeksepetiService] Token yanıtı geçersiz.');
      return null;
    }
  } catch (err: any) {
    sendLogToServer('error', `[YemeksepetiService] Access Token alınamadı: ${err.message}`);
    return null;
  }
}

async function pollYemeksepeti() {
  if (isPolling) return;
  isPolling = true;

  try {
    const isEnabled = systemSettings["ENABLE_YEMEKSEPETI"];
    if (!isEnabled) {
      isPolling = false;
      return;
    }

    // Token al veya önbellekteki tokenı kullan
    const token = await getAccessToken();
    if (!token) {
      isPolling = false;
      return;
    }

    // Siparişleri çekmek için API Endpoint
    // const ordersUrl = `${YEMEKSEPETI_BASE_URL}/api/v1/orders`;
    const ordersUrl = `https://mock.yemeksepeti.api/orders`; // Geçici mock URL

    /* 
    const response = await axios.get(ordersUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = response.data;
    // ... data işleme işlemleri ...
    */

  } catch (err: any) {
    if (err.response && err.response.status === 401) {
       sendLogToServer('error', '[YemeksepetiService] 401 Unauthorized hatası alındı. Token geçersiz olabilir.');
       // Token'ı sıfırlayıp bir sonraki döngüde yeniden almasını sağlayabiliriz
       cachedAccessToken = null;
    } else if (err.response && err.response.status === 429) {
       sendLogToServer('warning', '[YemeksepetiService] 429 Too Many Requests (Rate Limit aşıldı).');
    } else {
       sendLogToServer('error', `[YemeksepetiService] Bağlantı hatası: ${err.message}`);
    }
  } finally {
    isPolling = false;
  }
}

export function startYemeksepetiService() {
  if (yemeksepetiInterval) {
    clearInterval(yemeksepetiInterval);
  }
  // Rate limit: 50 requests per minute per client ID
  yemeksepetiInterval = setInterval(pollYemeksepeti, 30000);
  sendLogToServer('info', '[YemeksepetiService] Dinleme servisi başlatıldı (30 saniyede bir).');
}

export function stopYemeksepetiService() {
  if (yemeksepetiInterval) {
    clearInterval(yemeksepetiInterval);
    yemeksepetiInterval = null;
    sendLogToServer('warning', '[YemeksepetiService] Dinleme servisi durduruldu.');
  }
}
