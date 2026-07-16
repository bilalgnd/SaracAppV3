import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { systemSettings } from './models';
import axios from 'axios';
import { sendLogToServer } from './index';

let trendyolInterval: NodeJS.Timeout | null = null;
let isPolling = false;

// Recursively replace empty strings or nulls with "ibo"
function replaceEmptyWithIbo(obj: any): any {
  if (obj === null || obj === undefined || obj === "") {
    return "ibo";
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => replaceEmptyWithIbo(item));
  }
  
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      newObj[key] = replaceEmptyWithIbo(obj[key]);
    }
    return newObj;
  }
  
  return obj;
}

async function pollTrendyol() {
  if (isPolling) return;
  isPolling = true;

  try {
    const isEnabled = systemSettings["ENABLE_TRENDYOL"];
    if (!isEnabled) {
      isPolling = false;
      return;
    }

    const supplierId = systemSettings["TRENDYOL_SUPPLIER_ID"];
    const token = systemSettings["TRENDYOL_TOKEN"];
    let apiUrl = systemSettings["TRENDYOL_API_URL"] || `https://api.trendyol.com/integration/oms/core/t/orders?status=Created`;

    if (!supplierId || !token) {
      isPolling = false;
      return;
    }

    // Attempt to fetch
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Basic ${token}`,
        'User-Agent': `${supplierId} - SaracAppV3`
      }
    });

    const data = response.data;
    
    // Check if there are orders (Usually data.content for Trendyol)
    if (data && (Array.isArray(data.content) && data.content.length > 0) || (Array.isArray(data) && data.length > 0)) {
      
      const processedData = replaceEmptyWithIbo(data);
      
      // Sadece sunucuya gönder, dosyaya kaydetme
      sendLogToServer('info', `[TrendyolService] Trendyol sipariş logu alındı (Dosyaya yazılmıyor).`);

      // Send to server
      try {
         await axios.post('https://bilalgnd.shop/upload_trendyol_log', {
           log_data: processedData,
           supplier_id: supplierId,
           timestamp: Date.now()
         }, {
           headers: {
              'Content-Type': 'application/json'
           }
         });
         sendLogToServer('success', `[TrendyolService] Log sunucuya başarıyla gönderildi.`);
      } catch (err: any) {
         sendLogToServer('error', `[TrendyolService] Sunucuya log gönderim hatası: ${err.message}`);
      }
    }

  } catch (err: any) {
    sendLogToServer('error', `[TrendyolService] Trendyol API bağlantı hatası: ${err.message}`);
  } finally {
    isPolling = false;
  }
}

export function startTrendyolService() {
  if (trendyolInterval) {
    clearInterval(trendyolInterval);
  }
  // Poll every 30 seconds
  trendyolInterval = setInterval(pollTrendyol, 30000);
  sendLogToServer('info', '[TrendyolService] Trendyol dinleme servisi başlatıldı (30 saniyede bir).');
}

export function stopTrendyolService() {
  if (trendyolInterval) {
    clearInterval(trendyolInterval);
    trendyolInterval = null;
    sendLogToServer('warning', '[TrendyolService] Trendyol dinleme servisi durduruldu.');
  }
}
