import { systemSettings } from './models';
import axios from 'axios';

let trendyolInterval: NodeJS.Timeout | null = null;
let isPolling = false;
const processedOrderIds = new Set<string>();

export interface TrendyolStatusState {
  isEnabled: boolean;
  status: 'connected' | 'error' | 'disabled' | 'unconfigured' | 'checking';
  lastCheckTime: string | null;
  lastSuccessTime: string | null;
  lastError: string | null;
  lastStatusCode: number | null;
  totalOrdersReceived: number;
  todayOrdersCount: number;
  lastOrderId: string | null;
  lastOrderTime: string | null;
  supplierId: string | null;
  storeId: string | number | null;
  storeName: string | null;
  storeStatus: 'OPEN' | 'CLOSED' | 'UNKNOWN';
}

let statusState: TrendyolStatusState = {
  isEnabled: false,
  status: 'unconfigured',
  lastCheckTime: null,
  lastSuccessTime: null,
  lastError: null,
  lastStatusCode: null,
  totalOrdersReceived: 0,
  todayOrdersCount: 0,
  lastOrderId: null,
  lastOrderTime: null,
  supplierId: null,
  storeId: null,
  storeName: null,
  storeStatus: 'UNKNOWN'
};

let lastResetDateStr: string = new Date().toLocaleDateString('tr-TR');

function checkDayReset() {
  const currentDateStr = new Date().toLocaleDateString('tr-TR');
  if (currentDateStr !== lastResetDateStr) {
    statusState.todayOrdersCount = 0;
    lastResetDateStr = currentDateStr;
  }
}

// Callbacks set by the main process to avoid circular imports
let _addOrderFn: ((order: any) => Promise<boolean>) | null = null;
let _logFn: ((type: 'error' | 'success' | 'info' | 'warning', msg: string) => void) | null = null;

export function setTrendyolCallbacks(
  addOrderFn: (order: any) => Promise<boolean>,
  logFn: (type: 'error' | 'success' | 'info' | 'warning', msg: string) => void
) {
  _addOrderFn = addOrderFn;
  _logFn = logFn;
}

function log(type: 'error' | 'success' | 'info' | 'warning', msg: string) {
  if (_logFn) _logFn(type, msg);
}

export function getEffectiveTrendyolToken(): string | null {
  const token = systemSettings["TRENDYOL_TOKEN"];
  if (token && typeof token === 'string' && token.trim()) {
    return token.trim().replace(/\s+/g, '');
  }
  const apiKey = systemSettings["TRENDYOL_API_KEY"];
  const apiSecret = systemSettings["TRENDYOL_API_SECRET"];
  if (apiKey && apiSecret && typeof apiKey === 'string' && typeof apiSecret === 'string') {
    const cleanKey = apiKey.trim().replace(/\s+/g, '');
    const cleanSecret = apiSecret.trim().replace(/\s+/g, '');
    if (cleanKey && cleanSecret) {
      return Buffer.from(`${cleanKey}:${cleanSecret}`).toString('base64');
    }
  }
  return null;
}

export function getTrendyolApiUrl(supplierId: string): string {
  const customUrl = systemSettings["TRENDYOL_API_URL"];
  if (customUrl && typeof customUrl === 'string' && customUrl.trim()) {
    let url = customUrl.trim();
    // If user mistakenly entered the E-Commerce (OMS) URL instead of Trendyol Yemek (TGO) API:
    if (url.includes('api.trendyol.com/integration')) {
      return `https://api.tgoapis.com/integrator/order/meal/suppliers/${supplierId}/packages?packageStatuses=Created`;
    }
    if (url.includes('{supplierId}')) {
      url = url.replace('{supplierId}', supplierId);
    }
    return url;
  }
  return `https://api.tgoapis.com/integrator/order/meal/suppliers/${supplierId}/packages?packageStatuses=Created`;
}

function transformTrendyolOrder(rawData: any): any {
  // Transform lines → items (same logic as processTgoRawData in MainPanel.tsx)
  const items: any[] = [];
  if (rawData && rawData.lines) {
    rawData.lines.forEach((l: any) => {
      const qty = l.items ? l.items.length : (l.quantity || 1);
      
      // Build notes from modifiers, extra/removed ingredients
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
      // Item-level note
      if (l.note || l.notes) {
        const itemNote = l.note || l.notes;
        notes = notes ? `${notes} | ${itemNote}` : itemNote;
      }

      for (let j = 0; j < qty; j++) {
        items.push({
          name: l.name || l.productName || 'Ürün',
          portion: '',
          price: l.unitSellingPrice || l.price || 0,
          notes: notes
        });
      }
    });
  }

  // Build order note with customer note + address
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

  const customerName = rawData.customer
    ? `${rawData.customer.firstName || ''} ${rawData.customer.lastName || ''} (TGO)`.trim()
    : 'Trendyol Siparişi (TGO)';

  return {
    id: rawData.orderNumber ? rawData.orderNumber.toString() : Date.now().toString(),
    packageId: String(rawData.id || rawData.packageId || rawData.orderNumber || ''),
    customer_name: customerName,
    time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    items: items,
    total_amount: rawData.totalPrice || 0,
    status: 'waiting' as const,
    order_note: finalNote,
    color: '#FF9800' // Trendyol turuncu
  };
}

async function pollTrendyol() {
  if (isPolling) return;
  isPolling = true;

  try {
    checkDayReset();
    const isEnabled = systemSettings["ENABLE_TRENDYOL"];
    statusState.isEnabled = !!isEnabled;
    statusState.supplierId = systemSettings["TRENDYOL_SUPPLIER_ID"] || null;

    if (!isEnabled) {
      statusState.status = 'disabled';
      statusState.lastError = 'Trendyol servisi pasif (Ayarlardan kapalı)';
      isPolling = false;
      return;
    }

    const supplierId = systemSettings["TRENDYOL_SUPPLIER_ID"];
    const token = getEffectiveTrendyolToken();
    const apiUrl = getTrendyolApiUrl(supplierId);

    if (!supplierId || !token) {
      statusState.status = 'unconfigured';
      statusState.lastError = 'Satıcı ID veya API Token / Key - Secret bilgisi eksik!';
      isPolling = false;
      return;
    }

    const nowStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    statusState.lastCheckTime = nowStr;

    // Fetch orders
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Basic ${token}`,
        'User-Agent': `${supplierId} - SelfIntegration`,
        'x-agentname': `${supplierId} - SelfIntegration`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    statusState.status = 'connected';
    statusState.lastSuccessTime = nowStr;
    statusState.lastError = null;
    statusState.lastStatusCode = response.status;

    // Also update store status in background if available
    getTrendyolStoreStatus().catch(() => {});

    const data = response.data;
    
    // Extract orders array from response
    let orders: any[] = [];
    if (data && Array.isArray(data.content) && data.content.length > 0) {
      orders = data.content;
    } else if (Array.isArray(data) && data.length > 0) {
      orders = data;
    }

    if (orders.length === 0) {
      isPolling = false;
      return;
    }

    let addedCount = 0;
    for (const rawOrder of orders) {
      const orderId = String(rawOrder.orderNumber || rawOrder.id || '');
      
      // Skip if already processed
      if (!orderId || processedOrderIds.has(orderId)) continue;

      if (!_addOrderFn) {
        log('error', '[Trendyol] addOrder fonksiyonu ayarlanmamış!');
        break;
      }

      // Transform to app1 format and add
      const app1Order = transformTrendyolOrder(rawOrder);
      const success = await _addOrderFn(app1Order);
      
      if (success) {
        processedOrderIds.add(orderId);
        addedCount++;
        statusState.totalOrdersReceived++;
        statusState.todayOrdersCount++;
        statusState.lastOrderId = orderId;
        statusState.lastOrderTime = app1Order.time;
        log('success', `[Trendyol] Yeni sipariş eklendi: #${orderId}`);
      }
    }

    if (addedCount > 0) {
      log('info', `[Trendyol] ${addedCount} yeni sipariş alındı.`);
    }

  } catch (err: any) {
    const nowStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    statusState.lastCheckTime = nowStr;
    statusState.status = 'error';
    statusState.lastStatusCode = err.response?.status || null;
    
    const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Bilinmeyen hata';
    statusState.lastError = `HTTP ${err.response?.status || 'Hata'}: ${errMsg}`;
    log('error', `[Trendyol] API bağlantı hatası: ${errMsg}`);
  } finally {
    isPolling = false;
  }
}

export function getTrendyolStatus(): TrendyolStatusState {
  return {
    ...statusState,
    isEnabled: !!systemSettings["ENABLE_TRENDYOL"],
    supplierId: systemSettings["TRENDYOL_SUPPLIER_ID"] || null
  };
}

export async function testTrendyolConnection(): Promise<{ success: boolean; message: string; statusCode?: number; ordersCount?: number }> {
  const supplierId = systemSettings["TRENDYOL_SUPPLIER_ID"];
  const token = getEffectiveTrendyolToken();
  const nowStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (!systemSettings["ENABLE_TRENDYOL"]) {
    return { success: false, message: 'Trendyol Sipariş Servisi ayarlardan KAPALI duruma getirilmiş.' };
  }

  if (!supplierId || !token) {
    statusState.status = 'unconfigured';
    statusState.lastError = 'Satıcı ID veya API Anahtarı eksik!';
    return { success: false, message: 'Satıcı ID veya API Token / Key - Secret eksik! Lütfen bilgileri kontrol edin.' };
  }

  const apiUrl = getTrendyolApiUrl(supplierId);

  try {
    statusState.status = 'checking';
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Basic ${token}`,
        'User-Agent': `${supplierId} - SelfIntegration`,
        'x-agentname': `${supplierId} - SelfIntegration`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    statusState.status = 'connected';
    statusState.lastCheckTime = nowStr;
    statusState.lastSuccessTime = nowStr;
    statusState.lastError = null;
    statusState.lastStatusCode = response.status;

    // Fetch store status during connection test
    getTrendyolStoreStatus().catch(() => {});

    let count = 0;
    if (response.data && Array.isArray(response.data.content)) {
      count = response.data.content.length;
    } else if (Array.isArray(response.data)) {
      count = response.data.length;
    }

    log('success', `[Trendyol Test] Bağlantı başarılı! (HTTP ${response.status}) - ${count} bekleyen paket var.`);
    return {
      success: true,
      message: `Bağlantı Başarılı! (HTTP ${response.status}) Trendyol API sorunsuz yanıt veriyor.`,
      statusCode: response.status,
      ordersCount: count
    };
  } catch (err: any) {
    statusState.status = 'error';
    statusState.lastCheckTime = nowStr;
    const statusCode = err.response?.status;
    statusState.lastStatusCode = statusCode || null;
    const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Sunucuya ulaşılamadı';
    statusState.lastError = `HTTP ${statusCode || 'Hata'}: ${errMsg}`;

    log('error', `[Trendyol Test] Bağlantı başarısız! HTTP ${statusCode || '?'}: ${errMsg}`);
    return {
      success: false,
      message: `Bağlantı Başarısız! (HTTP ${statusCode || 'Hata'}): ${errMsg}`,
      statusCode: statusCode
    };
  }
}

export async function triggerTrendyolPoll(): Promise<TrendyolStatusState> {
  await pollTrendyol();
  return getTrendyolStatus();
}

export async function getTrendyolStoreStatus(): Promise<{ success: boolean; status?: 'OPEN' | 'CLOSED' | string; storeId?: string | number; storeName?: string; message?: string }> {
  const supplierId = systemSettings["TRENDYOL_SUPPLIER_ID"];
  const token = getEffectiveTrendyolToken();

  if (!systemSettings["ENABLE_TRENDYOL"] || !supplierId || !token) {
    return { success: false, message: 'Trendyol servisi kapalı veya yapılandırma eksik.' };
  }

  const url = `https://api.tgoapis.com/integrator/store/meal/suppliers/${supplierId}/stores`;

  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Basic ${token}`,
        'User-Agent': `${supplierId} - SelfIntegration`,
        'x-agentname': `${supplierId} - SelfIntegration`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const restaurants = response.data?.restaurants;
    if (Array.isArray(restaurants) && restaurants.length > 0) {
      const mainStore = restaurants[0];
      const foundStatus = mainStore.workingStatus === 'OPEN' ? 'OPEN' : 'CLOSED';
      statusState.storeStatus = foundStatus;
      statusState.storeId = mainStore.id;
      statusState.storeName = mainStore.name;
      systemSettings["TRENDYOL_STORE_ID"] = String(mainStore.id);

      return {
        success: true,
        status: foundStatus,
        storeId: mainStore.id,
        storeName: mainStore.name
      };
    }

    return { success: false, message: 'Restoran bulunamadı' };
  } catch (err: any) {
    const errMsg = err.response?.data?.message || err.response?.data?.errorDescription || err.message || 'Durum alınamadı';
    return { success: false, message: errMsg };
  }
}

export async function updateTrendyolStoreStatus(newStatus: 'OPEN' | 'CLOSED'): Promise<{ success: boolean; message: string; status?: 'OPEN' | 'CLOSED' }> {
  const supplierId = systemSettings["TRENDYOL_SUPPLIER_ID"];
  let storeId = (systemSettings["TRENDYOL_STORE_ID"] && String(systemSettings["TRENDYOL_STORE_ID"]).trim()) || statusState.storeId;
  const token = getEffectiveTrendyolToken();

  if (!systemSettings["ENABLE_TRENDYOL"]) {
    return { success: false, message: 'Trendyol servisi pasif!' };
  }
  if (!supplierId || !token) {
    return { success: false, message: 'Satıcı ID veya API Token / Key - Secret eksik!' };
  }

  // If storeId is missing, resolve storeId dynamically via GET stores
  if (!storeId) {
    const storeInfo = await getTrendyolStoreStatus();
    if (storeInfo.success && storeInfo.storeId) {
      storeId = storeInfo.storeId;
    } else {
      storeId = supplierId; // Fallback
    }
  }

  const url = `https://api.tgoapis.com/integrator/store/meal/suppliers/${supplierId}/stores/${storeId}/status`;

  try {
    const response = await axios.put(url, { status: newStatus }, {
      headers: {
        'Authorization': `Basic ${token}`,
        'User-Agent': `${supplierId} - SelfIntegration`,
        'x-agentname': `${supplierId} - SelfIntegration`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    statusState.storeStatus = newStatus;
    const storeNameStr = statusState.storeName ? ` (${statusState.storeName})` : '';
    log('success', `[Trendyol] Restoran çalışma durumu güncellendi: ${newStatus === 'OPEN' ? 'AÇIK (OPEN)' : 'KAPALI (CLOSED)'}`);
    return {
      success: true,
      message: `Restoran durumu Trendyol'da${storeNameStr} ${newStatus === 'OPEN' ? 'AÇIK (OPEN)' : 'KAPALI (CLOSED)'} olarak güncellendi.`,
      status: newStatus
    };
  } catch (err: any) {
    const statusCode = err.response?.status;
    const errDesc = err.response?.data?.errors?.errorDescription || err.response?.data?.message || err.response?.data?.errorDescription || err.message || 'Güncellenemedi';
    log('error', `[Trendyol] Restoran durumu güncellenemedi! HTTP ${statusCode || '?'}: ${errDesc}`);
    return {
      success: false,
      message: `Güncelleme Başarısız! (HTTP ${statusCode || 'Hata'}): ${errDesc}`
    };
  }
}

export function startTrendyolService() {
  if (trendyolInterval) {
    clearInterval(trendyolInterval);
  }
  // Poll every 30 seconds
  trendyolInterval = setInterval(pollTrendyol, 30000);
  // Also poll immediately on start
  pollTrendyol();
  log('info', '[Trendyol] Sipariş dinleme servisi başlatıldı (30 saniyede bir).');
}

export function stopTrendyolService() {
  if (trendyolInterval) {
    clearInterval(trendyolInterval);
    trendyolInterval = null;
    log('warning', '[Trendyol] Sipariş dinleme servisi durduruldu.');
  }
}
