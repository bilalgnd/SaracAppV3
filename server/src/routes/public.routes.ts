import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { getShop, shops, ShopState } from '../models';
import { requireAuth, requireAdminAuth } from '../middleware/auth';
import { pairRateLimiter } from '../middleware/rateLimiter';
import { getMessaging } from 'firebase-admin/messaging';

const router = express.Router();

export let notifyUI: any = () => {};
export const setNotifyUI = (fn: any) => notifyUI = fn;

export let broadcastUpdateToPhones: any = () => {};
export const setBroadcastUpdateToPhones = (fn: any) => broadcastUpdateToPhones = fn;

// Define shared directory and fcm tokens logic
const sharedFilesDir = path.join(__dirname, '..', '..', 'shared_files');
const fcmTokensFile = path.join(__dirname, '..', '..', 'data', 'fcm_tokens.json');

let fcmTokens: string[] = [];
if (fs.existsSync(fcmTokensFile)) {
    try {
        fcmTokens = JSON.parse(fs.readFileSync(fcmTokensFile, 'utf8'));
    } catch (e) {
        console.error('Error reading FCM tokens file', e);
    }
} else {
    const dataDir = path.dirname(fcmTokensFile);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

const saveFcmTokens = () => {
    fs.writeFileSync(fcmTokensFile, JSON.stringify(fcmTokens));
};

export const getFcmTokens = () => fcmTokens;

// Multer Storage — Safe filename & size limit
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    if (!fs.existsSync(sharedFilesDir)) fs.mkdirSync(sharedFilesDir, { recursive: true });
    cb(null, sharedFilesDir);
  },
  filename: function (_req, file, cb) {
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 } // max 20MB
});

// Shared Files (requireAuth)
router.post('/api/shared/upload', requireAuth, upload.single('file'), (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ message: 'File uploaded successfully', filename: req.file.filename });
});

router.get('/api/shared', requireAuth, (_req, res) => {
  if (!fs.existsSync(sharedFilesDir)) fs.mkdirSync(sharedFilesDir, { recursive: true });
  const files = fs.readdirSync(sharedFilesDir).map(file => {
    const stats = fs.statSync(path.join(sharedFilesDir, file));
    return {
      name: file,
      size: stats.size,
      time: stats.mtime
    };
  });
  files.sort((a, b) => b.time.getTime() - a.time.getTime());
  res.json(files);
});

router.delete('/api/shared/:filename', requireAuth, (req, res) => {
  const safeFilename = path.basename(String(req.params.filename));
  const file = path.join(sharedFilesDir, safeFilename);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    res.json({ message: 'Deleted' });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Admin FCM Tokens (requireAdminAuth)
router.get('/api/admin/fcm_tokens', requireAdminAuth, (_req, res) => res.json({ tokens: fcmTokens }));

router.post('/api/register_fcm_token', requireAuth, (req: any, res: any) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string' || token.trim().length < 50 || token.length > 500) {
    return res.status(400).json({ error: 'Geçersiz FCM token formatı' });
  }

  const cleanToken = token.trim();
  // Alphanumeric + standard token symbols: : - _
  if (!/^[a-zA-Z0-9:_-]+$/.test(cleanToken)) {
    return res.status(400).json({ error: 'FCM token geçersiz karakterler içeriyor' });
  }

  if (!fcmTokens.includes(cleanToken)) {
    // Keep max 50 recent tokens to prevent unbounded memory growth
    if (fcmTokens.length >= 50) {
      fcmTokens.shift();
    }
    fcmTokens.push(cleanToken);
    saveFcmTokens();
    const caller = req.user?.username || req.user?.waiterName || 'authenticated_device';
    console.log(`[FCM] New token registered for ${caller}:`, cleanToken.substring(0, 15) + '...');
  }
  res.json({ success: true });
});

// QR Order Public Endpoints
router.get('/api/public/menu', (req: any, res: any) => {
  let activeShop = getShop();
  const { shops, ShopState } = require('../models');
  
  if (req.query.shop) {
    if (!shops.has(req.query.shop)) shops.set(req.query.shop, new ShopState(req.query.shop));
    activeShop = shops.get(req.query.shop);
  } else {
    if (!shops.has('sarac')) shops.set('sarac', new ShopState('sarac'));
    activeShop = shops.get('sarac');
  }
  
  res.json(activeShop.getFullMenu());
});

// Helper: Menüden ürünün gerçek fiyatını bul
function resolveItemRealPrice(itemName: string, portionName: string, shop: any): number {
  if (!itemName) return 0;
  const cleanName = itemName.trim();
  const cleanPortion = (portionName || '').trim();

  // 1. Price memory kontrolü
  if (shop.priceMemory) {
    const memoryKey = cleanPortion ? `${cleanName} (${cleanPortion})` : cleanName;
    if (typeof shop.priceMemory[memoryKey] === 'number' && shop.priceMemory[memoryKey] > 0) {
      return shop.priceMemory[memoryKey];
    }
    if (typeof shop.priceMemory[cleanName] === 'number' && shop.priceMemory[cleanName] > 0) {
      return shop.priceMemory[cleanName];
    }
  }

  // 2. Menü kategorileri kontrolü
  const fullMenu = shop.getFullMenu?.() || shop.customMenu;
  if (fullMenu && Array.isArray(fullMenu.categories)) {
    for (const cat of fullMenu.categories) {
      if (Array.isArray(cat.items)) {
        for (const item of cat.items) {
          if (item.name && item.name.trim().toLowerCase() === cleanName.toLowerCase()) {
            if (cleanPortion && Array.isArray(item.options)) {
              const opt = item.options.find((o: any) => (o.portion || '').trim().toLowerCase() === cleanPortion.toLowerCase());
              if (opt && typeof opt.price === 'number') return opt.price;
            }
            if (typeof item.price === 'number') return item.price;
          }
        }
      }
    }
  }

  return 0;
}

// POST /api/public/submit_order — Sunucu Tarafı Fiyat Doğrulamalı
router.post('/api/public/submit_order', (req: any, res: any) => {
  const { customerName, items } = req.body;
  
  if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Geçersiz sipariş verisi' });
  }

  let shop = getShop();
  const { shops, ShopState } = require('../models');
  
  if (req.query.shop) {
    if (!shops.has(req.query.shop)) shops.set(req.query.shop, new ShopState(req.query.shop));
    shop = shops.get(req.query.shop);
  } else {
    if (!shops.has('sarac')) shops.set('sarac', new ShopState('sarac'));
    shop = shops.get('sarac');
  }

  let calculatedTotal = 0;
  const expandedItems: any[] = [];

  for (const i of items) {
    if (!i || !i.name || typeof i.name !== 'string') {
      return res.status(400).json({ error: 'Geçersiz ürün bilgisi' });
    }

    const realPrice = resolveItemRealPrice(i.name, i.portion, shop);
    if (realPrice <= 0) {
      return res.status(400).json({ error: `Menüde bulunamayan veya geçersiz ürün: "${i.name}"` });
    }

    const qty = Math.max(1, Math.min(100, parseInt(i.quantity, 10) || 1));

    for (let j = 0; j < qty; j++) {
      expandedItems.push({
        name: String(i.name).trim().substring(0, 200),
        portion: String(i.portion || '').trim().substring(0, 100),
        price: realPrice,
        notes: String(i.notes || '').trim().substring(0, 500)
      });
      calculatedTotal += realPrice;
    }
  }

  if (calculatedTotal <= 0 || expandedItems.length === 0) {
    return res.status(400).json({ error: 'Sipariş tutarı sıfır veya geçersiz' });
  }

  const newOrder = {
    id: Date.now().toString(),
    customer_name: `${String(customerName).trim().substring(0, 100)} (QR)`,
    time: new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }),
    items: expandedItems,
    total_amount: calculatedTotal,
    status: 'waiting'
  };

  shop.activeOrders.push(newOrder);
  shop.saveOrders();
  
  broadcastUpdateToPhones(shop);
  notifyUI('orders_update', null, shop);

  if (fcmTokens.length > 0) {
    const message = {
      notification: {
        title: 'Yeni Sipariş!',
        body: `QR Menüden ${customerName} isimli müşteriden ${calculatedTotal} ₺ tutarında yeni sipariş geldi!`
      },
      android: { priority: 'high' as const },
      tokens: fcmTokens
    };
    try {
      getMessaging().sendEachForMulticast(message)
        .then((response: any) => console.log(response.successCount + ' messages were sent successfully'))
        .catch((error: any) => console.log('Error sending message:', error));
    } catch (e) {
      console.log('FCM error:', e);
    }
  }

  const { ActivityLogModel } = require('../models');
  try {
    ActivityLogModel.create({
      username: 'QR_CUSTOMER',
      shopId: shop.shopId || 'admin',
      action: 'qr_order',
      details: `QR Siparişi alındı: ${customerName} (Doğrulanan Toplam: ${calculatedTotal} ₺)`
    });
  } catch(e) {}

  res.json({ success: true, orderId: newOrder.id, verifiedTotal: calculatedTotal });
});

router.get('/api/public/order_status', (req: any, res: any) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'ID required' });

  let shop = getShop();
  const { shops, ShopState } = require('../models');
  
  if (req.query.shop) {
    if (!shops.has(req.query.shop)) shops.set(req.query.shop, new ShopState(req.query.shop));
    shop = shops.get(req.query.shop);
  } else {
    if (!shops.has('sarac')) shops.set('sarac', new ShopState('sarac'));
    shop = shops.get('sarac');
  }

  // Check active orders
  const active = shop.activeOrders.find((o: any) => o.id === id);
  if (active) {
    return res.json({ status: active.status });
  }

  // Check past orders
  const past = shop.pastOrders.find((o: any) => o.id === id);
  if (past) {
    return res.json({ status: past.status });
  }

  res.status(404).json({ error: 'Order not found' });
});

// POST /api/public/call_waiter — Rate-Limited & Logged
router.post('/api/public/call_waiter', pairRateLimiter, (req: any, res: any) => {
  const { id, customerName, table } = req.body;

  let shop = getShop();
  const { shops, ShopState } = require('../models');
  
  const shopIdParam = req.body.shop || req.query.shop;
  if (shopIdParam) {
    if (!shops.has(shopIdParam)) shops.set(shopIdParam, new ShopState(shopIdParam));
    shop = shops.get(shopIdParam);
  } else {
    if (!shops.has('sarac')) shops.set('sarac', new ShopState('sarac'));
    shop = shops.get('sarac');
  }

  let callerTitle = customerName ? String(customerName).trim() : (table ? `Masa ${table}` : 'Müşteri (QR)');
  if (id) {
    const active = shop.activeOrders.find((o: any) => o.id === id);
    if (active) {
      callerTitle = active.customer_name;
    }
  }

  const callData = {
    id: id || Date.now().toString(),
    customerName: callerTitle,
    table: table || '',
    time: new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' })
  };

  // Broadcast to all UI clients (App1, App2, tv-sarac)
  notifyUI('waiter_call', callData, shop);

  // Send FCM notification to waiter phones if any registered
  if (fcmTokens.length > 0) {
    const message = {
      notification: {
        title: '🔔 Garson Çağrısı!',
        body: `${callerTitle} garson çağırıyor!`
      },
      data: {
        type: 'waiter_call',
        customerName: callerTitle,
        table: String(table || '')
      },
      android: { priority: 'high' as const },
      tokens: fcmTokens
    };
    try {
      getMessaging().sendEachForMulticast(message)
        .then((response: any) => console.log('FCM Waiter call sent:', response.successCount))
        .catch((error: any) => console.log('Error sending FCM waiter call:', error));
    } catch (e) {
      console.log('FCM error:', e);
    }
  }

  const { ActivityLogModel } = require('../models');
  try {
    ActivityLogModel.create({
      username: 'QR_CUSTOMER',
      shopId: shop.shopId || 'sarac',
      action: 'waiter_call',
      details: `Garson Çağrısı: ${callerTitle}`
    });
  } catch(e) {}

  res.json({ success: true, message: 'Garson çağrısı iletildi', callData });
});

export default router;
