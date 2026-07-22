import { systemSettings } from './models';
import axios from 'axios';

let trendyolInterval: NodeJS.Timeout | null = null;
let isPolling = false;
const processedOrderIds = new Set<string>();

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
        notes = notes ? `${notes}, ${removed}` : removed;
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
    const isEnabled = systemSettings["ENABLE_TRENDYOL"];
    if (!isEnabled) {
      isPolling = false;
      return;
    }

    const supplierId = systemSettings["TRENDYOL_SUPPLIER_ID"];
    const token = systemSettings["TRENDYOL_TOKEN"];
    const apiUrl = `https://api.tgoapis.com/integrator/order/meal/suppliers/${supplierId}/packages?packageStatuses=Created`;

    if (!supplierId || !token) {
      isPolling = false;
      return;
    }

    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Basic ${token}`,
        'User-Agent': `${supplierId} - SelfIntegration`,
        'x-agentname': `${supplierId} - SelfIntegration`,
        'Content-Type': 'application/json'
      }
    });

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
        log('success', `[Trendyol] Yeni sipariş eklendi: #${orderId}`);
      }
    }

    if (addedCount > 0) {
      log('info', `[Trendyol] ${addedCount} yeni sipariş alındı.`);
    }

    // Legacy upload_trendyol_log post removed as it is no longer used

  } catch (err: any) {
    log('error', `[Trendyol] API bağlantı hatası: ${err.message}`);
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
