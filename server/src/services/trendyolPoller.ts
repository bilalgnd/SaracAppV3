import axios from 'axios';
import { getShop, shops, DataModel } from '../models';
import { addSystemLog } from '../server';

let pollerInterval: NodeJS.Timeout | null = null;
let isPolling = false;

// Callbacks set from server.ts
let notifyUI: any = () => {};
let broadcastUpdateToPhones: any = () => {};
let sendFcmNotification: any = () => {};

export const setPollerNotifyUI = (fn: any) => { notifyUI = fn; };
export const setPollerBroadcastUpdateToPhones = (fn: any) => { broadcastUpdateToPhones = fn; };
export const setPollerSendFcmNotification = (fn: any) => { sendFcmNotification = fn; };

const getTrendyolSupplierId = () => {
  const shop = getShop();
  const settings = shop?.systemSettings || {};
  return settings.trendyolSupplierId || process.env.TRENDYOL_SUPPLIER_ID || '6647850';
};

const getTgoHeaders = () => {
  const shop = getShop();
  const settings = shop?.systemSettings || {};
  
  const supplierId = getTrendyolSupplierId();
  const apiKey = settings.trendyolApiKey || process.env.TRENDYOL_API_KEY || '';
  const apiSecret = settings.trendyolApiSecret || process.env.TRENDYOL_API_SECRET || '';
  const authStr = `${apiKey}:${apiSecret}`;
  const authB64 = Buffer.from(authStr, 'utf-8').toString('base64');
  const executorUser = settings.trendyolExecutorUser || process.env.TRENDYOL_EXECUTOR_USER || '';
  
  return {
    "Authorization": `Basic ${authB64}`,
    "User-Agent": `${supplierId} - SelfIntegration`,
    "x-agentname": `${supplierId} - SelfIntegration`,
    "x-executor-user": executorUser,
    "Content-Type": "application/json"
  };
};

const getTgoBaseUrl = () => {
  const s = getShop()?.systemSettings || {};
  let b = s.trendyolApiEndpoint || 'https://api.tgoapis.com/integrator';
  if (b.endsWith('/')) b = b.slice(0, -1);
  return b;
};

export async function checkTrendyolOrders() {
  if (isPolling) return;
  isPolling = true;

  try {
    const shop = getShop();
    const settings = shop?.systemSettings || {};

    const apiKey = settings.trendyolApiKey || process.env.TRENDYOL_API_KEY;
    const apiSecret = settings.trendyolApiSecret || process.env.TRENDYOL_API_SECRET;
    const supplierId = getTrendyolSupplierId();

    // API bilgileri girilmemişse sorgu atma
    if (!apiKey || !apiSecret || !supplierId) {
      isPolling = false;
      return;
    }

    // Trendyol Yemek API - Created ve Preparing durumundaki aktif siparişler
    const url = `${getTgoBaseUrl()}/order/meal/suppliers/${supplierId}/packages?packageStatuses=Created,Preparing`;
    const res = await axios.get(url, {
      headers: getTgoHeaders(),
      timeout: 10000
    });

    if (!res.data) {
      isPolling = false;
      return;
    }

    let packages: any[] = [];
    if (Array.isArray(res.data)) {
      packages = res.data;
    } else if (Array.isArray(res.data.content)) {
      packages = res.data.content;
    } else if (res.data.data && Array.isArray(res.data.data.content)) {
      packages = res.data.data.content;
    }

    if (packages.length === 0) {
      isPolling = false;
      return;
    }

    let saracShop = shops.get('sarac') || shop;

    // Load processed orders from DB
    const processedDoc = await DataModel.findOne({ key: 'tgoProcessedOrders' });
    const tgoProcessedOrdersArr: string[] = processedDoc?.value || [];
    const tgoProcessedOrdersSet = new Set(tgoProcessedOrdersArr);

    let newOrdersCount = 0;

    for (const rawData of packages) {
      const pId = String(rawData.packageId || rawData.id || rawData.orderNumber || '');
      if (!pId) continue;

      // Zaten işlendiyse atla
      if (tgoProcessedOrdersSet.has(pId)) continue;

      // App1 / TV aktif siparişlerinde var mı kontrol et
      const alreadyInActive = saracShop.activeOrders.some((o: any) => 
        String(o.packageId || o.id || o.orderNumber || o.order_id) === pId ||
        (o.customer_name && o.customer_name.includes(pId))
      );

      if (alreadyInActive) {
        tgoProcessedOrdersSet.add(pId);
        continue;
      }

      // Yeni siparişi formatla
      const formattedItems = (rawData.lines || []).map((l: any) => {
        let notes = '';
        if (l.modifierProducts && l.modifierProducts.length > 0) {
          notes = l.modifierProducts.map((m: any) => m.name).join(', ');
        }
        return {
          name: l.name || l.productName || 'Ürün',
          portion: l.selectedOptions ? l.selectedOptions.join(', ') : '',
          quantity: l.quantity || (l.items ? l.items.length : 1),
          price: l.price || 0,
          notes: notes
        };
      });

      const custName = rawData.customer ? `${rawData.customer.firstName || ''} ${rawData.customer.lastName || ''}`.trim() : 'Trendyol Siparişi';
      const orderNumber = rawData.orderNumber || pId;

      const newOrder = {
        customer_name: `${custName} (TGO #${orderNumber})`,
        masa_no: saracShop.getNextQueueNo().toString(),
        order_note: rawData.customerNote || '',
        order_id: pId,
        packageId: pId,
        id: pId,
        orderNumber: orderNumber,
        time: new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }),
        items: formattedItems,
        total_amount: rawData.totalPrice || 0,
        status: 'waiting',
        packageStatus: rawData.packageStatus || 'Created',
        tgo_status: rawData.packageStatus || 'Created',
        color: '#FF9800',
        platform: 'trendyol'
      };

      saracShop.activeOrders.unshift(newOrder);
      tgoProcessedOrdersSet.add(pId);
      newOrdersCount++;

      // Canlı yayın & Bildirim
      notifyUI('tgo_add_order', rawData, saracShop);
    }

    if (newOrdersCount > 0) {
      saracShop.saveOrders();
      await DataModel.findOneAndUpdate(
        { key: 'tgoProcessedOrders' },
        { value: Array.from(tgoProcessedOrdersSet) },
        { upsert: true }
      );

      broadcastUpdateToPhones(saracShop);
      notifyUI('orders_update', saracShop.activeOrders, saracShop);
      addSystemLog('TrendyolPoller', 'success', `${newOrdersCount} adet yeni Trendyol siparişi alındı ve sisteme aktarıldı.`);
      
      try {
        sendFcmNotification(saracShop, 'Yeni Trendyol Siparişi!', `${newOrdersCount} yeni Trendyol siparişi geldi.`);
      } catch (e) {}
    }

  } catch (error: any) {
    // Sadece önemli bağlantı hatalarını kaydet
    if (error.response?.status !== 404) {
      console.error('[TrendyolPoller Error]:', error.message || error);
    }
  } finally {
    isPolling = false;
  }
}

export function startTrendyolPoller(intervalMs: number = 15000) {
  if (pollerInterval) clearInterval(pollerInterval);
  
  console.log(`[TrendyolPoller] Started (polling every ${intervalMs / 1000}s)`);
  addSystemLog('TrendyolPoller', 'info', `Trendyol otomatik sipariş kontrolü başlatıldı (${intervalMs / 1000}s).`);
  
  // İlk kontrolü 3 saniye sonra yap
  setTimeout(() => {
    checkTrendyolOrders();
  }, 3000);

  pollerInterval = setInterval(() => {
    checkTrendyolOrders();
  }, intervalMs);
}

export function stopTrendyolPoller() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    console.log('[TrendyolPoller] Stopped');
  }
}
