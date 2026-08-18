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

    // Trendyol Yemek API - Tüm aktif durumdaki siparişleri ve durum güncellemelerini sorgula
    const url = `${getTgoBaseUrl()}/order/meal/suppliers/${supplierId}/packages?packageStatuses=Created,Approved,Preparing,Picking,Invoiced,Shipped,Delivered,Cancelled&size=50`;
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

    let updatedCount = 0;

    for (const rawData of packages) {
      const packageId = String(rawData.packageId || rawData.id || '');
      const orderNumber = String(rawData.orderNumber || rawData.id || '');
      const pId = packageId || orderNumber;
      if (!pId) continue;

      const rawPkgStatus = rawData.packageStatus || 'Created';

      // App1 / TV aktif siparişlerinde var mı kontrol et
      const existingIdx = saracShop.activeOrders.findIndex((o: any) => {
        const oId = String(o.id || '');
        const oPkgId = String(o.packageId || '');
        const oOrderNum = String(o.orderNumber || o.order_id || '');
        const oCust = String(o.customer_name || '');

        if (orderNumber && (oId === orderNumber || oOrderNum === orderNumber || oPkgId === orderNumber || oCust.includes(orderNumber))) return true;
        if (packageId && (oId === packageId || oPkgId === packageId || oOrderNum === packageId || oCust.includes(packageId))) return true;
        if (pId && (oId === pId || oOrderNum === pId || oPkgId === pId)) return true;
        return false;
      });

      // Eğer sipariş zaten aktif listede varsa -> Durumu güncellendi mi kontrol et
      if (existingIdx >= 0) {
        const existing = saracShop.activeOrders[existingIdx];
        const oldStatus = existing.packageStatus || existing.tgo_status || existing.status;
        const statusChanged = rawPkgStatus && rawPkgStatus !== oldStatus;
        
        let finalNote = rawData.customerNote || '';
        if (rawData.address) {
          const a = rawData.address;
          const addrParts: string[] = [];
          if (a.neighborhood) addrParts.push(a.neighborhood);
          if (a.address1) addrParts.push(a.address1.trim());
          if (a.address2) addrParts.push(a.address2.trim());
          if (a.apartmentNumber) addrParts.push(`Apt: ${a.apartmentNumber}`);
          if (a.doorNumber) addrParts.push(`No: ${a.doorNumber.trim()}`);
          if (a.floor) addrParts.push(`Kat: ${a.floor}`);
          if (a.addressDescription) addrParts.push(`Tarif: ${a.addressDescription}`);
          if (a.phone) addrParts.push(`Tel: ${a.phone}`);
          const addressStr = addrParts.filter(Boolean).join(', ');
          finalNote = finalNote ? `${finalNote}\n[Adres: ${addressStr}]` : `[Adres: ${addressStr}]`;
        }

        const hasBetterDetails = finalNote && (!existing.order_note || existing.order_note.length < finalNote.length);

        if (statusChanged || hasBetterDetails || (existing.customer_name && existing.customer_name.includes('#'))) {
          const custName = rawData.customer ? `${rawData.customer.firstName || ''} ${rawData.customer.lastName || ''}`.trim() : (existing.customer_name || 'Trendyol Siparişi');
          saracShop.activeOrders[existingIdx] = {
            ...existing,
            customer_name: `${custName.replace(/\(TGO.*?\)/gi, '').trim()} (TGO)`,
            order_note: hasBetterDetails ? finalNote : existing.order_note,
            packageStatus: rawPkgStatus,
            tgo_status: rawPkgStatus,
            trendyol_status: rawPkgStatus,
            status: rawPkgStatus
          };
          updatedCount++;
        }
        if (pId) tgoProcessedOrdersSet.add(pId);
        if (orderNumber) tgoProcessedOrdersSet.add(orderNumber);
        if (packageId) tgoProcessedOrdersSet.add(packageId);
        continue;
      }

      // Daha önce tamamen işlenip kapatılmış veya teslim edilmişse ve listede yoksa atla
      if (tgoProcessedOrdersSet.has(pId) || (orderNumber && tgoProcessedOrdersSet.has(orderNumber)) || (packageId && tgoProcessedOrdersSet.has(packageId))) {
        continue;
      }

      // Format items with modifierProducts, extraIngredients, removedIngredients, and notes
      const formattedItems = (rawData.lines || []).flatMap((l: any) => {
        const qty = l.items ? l.items.length : (l.quantity || 1);
        let notes = '';
        if (l.modifierProducts && l.modifierProducts.length > 0) {
          notes = l.modifierProducts.map((m: any) => m.name).join(', ');
        }
        if (l.extraIngredients && l.extraIngredients.length > 0) {
          const extras = l.extraIngredients.map((e: any) => `+${e.name}`).join(', ');
          notes = notes ? `${notes}, ${extras}` : extras;
        }
        if (l.removedIngredients && l.removedIngredients.length > 0) {
          const removed = l.removedIngredients.map((r: any) => `❌${r.name}`).join(', ');
          notes = notes ? `${notes} | ${removed}` : removed;
        }
        if (l.note || l.notes) {
          const itemNote = l.note || l.notes;
          notes = notes ? `${notes} | ${itemNote}` : itemNote;
        }

        const resItems: any[] = [];
        for (let j = 0; j < qty; j++) {
          resItems.push({
            name: l.name || l.productName || 'Ürün',
            portion: l.selectedOptions ? l.selectedOptions.join(', ') : '',
            price: l.unitSellingPrice || l.price || 0,
            notes: notes
          });
        }
        return resItems;
      });

      // Format address and note
      let finalNote = rawData.customerNote || '';
      if (rawData.address) {
        const a = rawData.address;
        const addrParts: string[] = [];
        if (a.neighborhood) addrParts.push(a.neighborhood);
        if (a.address1) addrParts.push(a.address1.trim());
        if (a.address2) addrParts.push(a.address2.trim());
        if (a.apartmentNumber) addrParts.push(`Apt: ${a.apartmentNumber}`);
        if (a.doorNumber) addrParts.push(`No: ${a.doorNumber.trim()}`);
        if (a.floor) addrParts.push(`Kat: ${a.floor}`);
        if (a.addressDescription) addrParts.push(`Tarif: ${a.addressDescription}`);
        if (a.phone) addrParts.push(`Tel: ${a.phone}`);

        const addressStr = addrParts.filter(Boolean).join(', ');
        finalNote = finalNote ? `${finalNote}\n[Adres: ${addressStr}]` : `[Adres: ${addressStr}]`;
      }

      const custName = rawData.customer ? `${rawData.customer.firstName || ''} ${rawData.customer.lastName || ''}`.trim() : 'Trendyol Siparişi';

      const newOrder = {
        customer_name: `${custName} (TGO)`,
        masa_no: saracShop.getNextQueueNo().toString(),
        order_note: finalNote,
        order_id: orderNumber || pId,
        packageId: packageId || pId,
        id: orderNumber || pId,
        orderNumber: orderNumber || pId,
        time: new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }),
        items: formattedItems,
        total_amount: rawData.totalPrice || 0,
        status: rawPkgStatus,
        packageStatus: rawPkgStatus,
        tgo_status: rawPkgStatus,
        color: '#FF9800',
        platform: 'trendyol'
      };

      saracShop.activeOrders.unshift(newOrder);
      if (pId) tgoProcessedOrdersSet.add(pId);
      if (orderNumber) tgoProcessedOrdersSet.add(orderNumber);
      if (packageId) tgoProcessedOrdersSet.add(packageId);
      updatedCount++;

      // Canlı yayın & Bildirim
      notifyUI('tgo_add_order', rawData, saracShop);
    }

    if (updatedCount > 0) {
      saracShop.saveOrders();
      await DataModel.findOneAndUpdate(
        { key: 'tgoProcessedOrders' },
        { value: Array.from(tgoProcessedOrdersSet) },
        { upsert: true }
      );

      broadcastUpdateToPhones(saracShop);
      notifyUI('orders_update', saracShop.activeOrders, saracShop);
      addSystemLog('TrendyolPoller', 'info', `Trendyol siparişleri ve durumları güncellendi (${updatedCount} adet).`);
      
      try {
        sendFcmNotification(saracShop, 'Trendyol Sipariş Güncellemesi', `${updatedCount} adet Trendyol sipariş/durum güncellemesi işlendi.`);
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
