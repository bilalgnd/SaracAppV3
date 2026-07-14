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
      
      // Save locally
      const logsDir = systemSettings["PDF_LOGS_DIR"] || path.join(app.getPath('documents'), 'logs');
      const trendyolDir = path.join(logsDir, 'trendyol_logs');
      if (!fs.existsSync(trendyolDir)) {
        fs.mkdirSync(trendyolDir, { recursive: true });
      }
      
      const fileName = `trendyol_log_${Date.now()}.json`;
      const filePath = path.join(trendyolDir, fileName);
      fs.writeFileSync(filePath, JSON.stringify(processedData, null, 2), 'utf-8');
      console.log(`[TrendyolService] Log saved to ${filePath}`);

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
         console.log(`[TrendyolService] Log sent to server successfully.`);
      } catch (err: any) {
         console.error(`[TrendyolService] Error sending log to server:`, err.message);
      }
    }

  } catch (err: any) {
    console.error('[TrendyolService] Polling error:', err.message);
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
  console.log('[TrendyolService] Started polling every 30 seconds');
}

export function stopTrendyolService() {
  if (trendyolInterval) {
    clearInterval(trendyolInterval);
    trendyolInterval = null;
    console.log('[TrendyolService] Stopped polling');
  }
}
