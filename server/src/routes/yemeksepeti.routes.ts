import express from 'express';
import { requireAdminAuth, requireAuth } from '../middleware/auth'; // Adjust import paths as necessary
import { idempotencyMiddleware } from '../middleware/idempotency'; // Adjust import paths as necessary
import { YemeksepetiCatalogService } from '../services/yemeksepetiCatalogService'; // Adjust import paths as necessary
import { getShop, shops, ShopState } from '../models';
// mockDevOrders: trendyol.routes.ts'den import yerine burada yerel kullan

// Yerel dev sipariş listesi (Yemeksepeti webhook simülasyonu için)
const mockDevOrders: any[] = [];

const router = express.Router();

export let notifyUI: any = () => {};
export const setNotifyUI = (fn: any) => notifyUI = fn;

export let broadcastUpdateToPhones: any = () => {};
export const setBroadcastUpdateToPhones = (fn: any) => broadcastUpdateToPhones = fn;

router.post('/api/dev/yemeksepeti-webhook', requireAdminAuth, async (req: any, res: any) => {
  try {
    const payload = req.body || {};
    const orderData = payload.order || payload;
    const orderId = orderData.order_id || ("YS-HOOK-" + Math.floor(100000 + Math.random() * 900000));
    const status = orderData.status || "RECEIVED";

    const mappedStatus = status === "RECEIVED" ? "Created" :
                        status === "READY_FOR_PICKUP" ? "Picking" :
                        status === "DISPATCHED" ? "Shipped" :
                        status === "DELIVERED" ? "Delivered" :
                        status === "CANCELLED" ? "Cancelled" : "Created";

    const webhookOrder = {
      "id": orderId,
      "packageId": orderId,
      "orderId": orderId,
      "orderNumber": orderId,
      "orderCode": orderId,
      "platform": "yemeksepeti",
      "_platform": "yemeksepeti",
      "packageCreationDate": Date.now(),
      "totalPrice": orderData.total_amount || 235.00,
      "packageStatus": mappedStatus,
      "status": mappedStatus,
      "deliveryType": orderData.delivery_type || "RESTAURANT",
      "paymentMethod": "ONLINE",
      "customer": {
        "id": 88100,
        "firstName": orderData.customer_name || "Yemeksepeti Müşterisi",
        "lastName": "",
        "orderCount": 3
      },
      "address": {
        "address1": "İnönü Cad. No:88 (Webhook Test)",
        "city": "Çanakkale",
        "district": "Biga",
        "neighborhood": "Gazi Mah"
      },
      "lines": (orderData.items || [
        { name: "Et Döner Dürüm", quantity: 1, price: 210.00 },
        { name: "Şalgam 330ml", quantity: 1, price: 25.00 }
      ]).map((it: any, idx: number) => ({
        "productId": 300 + idx,
        "productName": it.name || "Ürün",
        "quantity": it.quantity || 1,
        "price": it.price || 0,
        "extraIngredients": (it.options || []).map((opt: string, oi: number) => ({ id: oi, name: opt })),
        "removedIngredients": []
      })),
      "customerNote": orderData.order_note || "Webhook Simülasyon Siparişi",
      "isMock": true,
      "isWebhookSimulated": true
    };

    // Mevcut dev siparişi varsa durumunu güncelle, yoksa yeni ekle
    const existingIndex = mockDevOrders.findIndex(o => String(o.id) === String(orderId) || String(o.orderNumber) === String(orderId));
    if (existingIndex >= 0) {
      mockDevOrders[existingIndex].packageStatus = mappedStatus;
      mockDevOrders[existingIndex].status = mappedStatus;
    } else {
      mockDevOrders.unshift(webhookOrder);
    }

    res.json({ success: true, message: `Yemeksepeti Webhook işlendi (${status})`, order: webhookOrder });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== YEMEKSEPETI CATALOG API ENDPOINTS ==================== //
router.get('/api/yemeksepeti/catalog/categories', requireAuth, async (req: any, res: any) => {
  try {
    const chainId = (req.query.chainId as string) || process.env.YEMEKSEPETI_CHAIN_ID || 'chain_default';
    const storeId = (req.query.storeId as string) || process.env.YEMEKSEPETI_STORE_ID || 'store_default';
    const result = await YemeksepetiCatalogService.getCategories(chainId, storeId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/yemeksepeti/catalog/products', requireAuth, async (req: any, res: any) => {
  try {
    const chainId = (req.query.chainId as string) || process.env.YEMEKSEPETI_CHAIN_ID || 'chain_default';
    const storeId = (req.query.storeId as string) || process.env.YEMEKSEPETI_STORE_ID || 'store_default';
    const result = await YemeksepetiCatalogService.getProducts(chainId, storeId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/api/yemeksepeti/catalog/product-status', requireAuth, async (req: any, res: any) => {
  try {
    const chainId = req.body.chainId || process.env.YEMEKSEPETI_CHAIN_ID || 'chain_default';
    const storeId = req.body.storeId || process.env.YEMEKSEPETI_STORE_ID || 'store_default';
    const updates = req.body.updates || [];

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Güncellenecek ürün listesi (updates) boş olamaz.' });
    }

    const result = await YemeksepetiCatalogService.updateProductStatusAndPrice(chainId, storeId, updates);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/api/yemeksepeti/catalog/export', requireAuth, async (req: any, res: any) => {
  try {
    const chainId = req.body.chainId || process.env.YEMEKSEPETI_CHAIN_ID || 'chain_default';
    const storeId = req.body.storeId || process.env.YEMEKSEPETI_STORE_ID || 'store_default';
    const result = await YemeksepetiCatalogService.exportAssortment(chainId, storeId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/api/yemeksepeti/catalog-webhook', async (req: any, res: any) => {
  try {
    const result = YemeksepetiCatalogService.handleCatalogWebhook(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/ys/orders', requireAdminAuth, (req: any, res: any) => {
  // Mockup for Yemeksepeti Orders as it's in test phase
  res.json([]);
});

function fuzzyMatchProduct(platformName: string) {
    const lower = (platformName || '').toLowerCase();
    let name = platformName;
    let color = '#757575'; 

    if (lower.includes('et') || lower.includes('beyti') || lower.includes('iskender')) {
        color = '#8B0000'; 
        if (lower.includes('dürüm')) name = 'Et Dürüm';
        if (lower.includes('tombik')) name = 'Et Tombik';
        if (lower.includes('porsiyon')) name = 'Et Porsiyon';
    } else if (lower.includes('tavuk')) {
        color = '#D84315'; 
        if (lower.includes('dürüm')) name = 'Tavuk Dürüm';
        if (lower.includes('tombik')) name = 'Tavuk Tombik';
        if (lower.includes('porsiyon')) name = 'Tavuk Porsiyon';
        if (lower.includes('hatay')) name = 'Hatay Usulü';
    } else if (lower.includes('ayran') || lower.includes('kola') || lower.includes('su') || lower.includes('fanta') || lower.includes('sprite')) {
        color = '#1565C0'; 
    }

    if (name !== platformName && !platformName.includes(name)) {
        name = `${name} (${platformName})`;
    }

    return { name, color };
}

router.post('/yemeksepeti_siparis', requireAuth, idempotencyMiddleware, (req: any, res: any): any => {
    res.header("Access-Control-Allow-Origin", "*");
    try {
        const data = req.body;
        if (!data || !data.order_id) return res.status(400).json({ error: 'Missing order_id' });

        const shop = getShop();
        const exists = shop.activeOrders.some((o: any) => o.order_id === data.order_id);
        if (exists) return res.json({ success: true, duplicate: true });

        const formattedItems = (data.items || []).map((i: any) => {
            const match = fuzzyMatchProduct(i.name);
            return {
                name: match.name,
                portion: i.options ? i.options.join(', ') : '',
                quantity: i.quantity || 1,
                price: i.price || 0,
                notes: ''
            };
        });

        const newOrder = {
            customer_name: data.customer_name || 'Yemeksepeti Siparişi',
            masa_no: shop.getNextQueueNo().toString(),
            order_note: data.order_note || '',
            order_id: data.order_id,
            time: new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }),
            items: formattedItems,
            total_amount: data.total_amount || 0,
            status: 'waiting',
            color: '#E00034'
        };

        shop.activeOrders.unshift(newOrder);
        shop.saveOrders();
        broadcastUpdateToPhones(shop);
        notifyUI('order_received', newOrder, shop);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
