import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { getShop, shops, ShopState } from '../models';
import { getMessaging } from 'firebase-admin/messaging'; // Adjust import paths as necessary

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
    // Make sure data directory exists
    const dataDir = path.dirname(fcmTokensFile);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

const saveFcmTokens = () => {
    fs.writeFileSync(fcmTokensFile, JSON.stringify(fcmTokens));
};

export const getFcmTokens = () => fcmTokens;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(sharedFilesDir)) fs.mkdirSync(sharedFilesDir, { recursive: true });
    cb(null, sharedFilesDir)
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})
const upload = multer({ storage: storage })

router.post('/api/shared/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ message: 'File uploaded successfully', filename: req.file.originalname });
});

router.get('/api/shared', (req, res) => {
  if (!fs.existsSync(sharedFilesDir)) fs.mkdirSync(sharedFilesDir, { recursive: true });
  const files = fs.readdirSync(sharedFilesDir).map(file => {
    const stats = fs.statSync(path.join(sharedFilesDir, file));
    return {
      name: file,
      size: stats.size,
      time: stats.mtime
    };
  });
  // Sort by modification time, newest first
  files.sort((a, b) => b.time.getTime() - a.time.getTime());
  res.json(files);
});

router.delete('/api/shared/:filename', (req, res) => {
  const file = path.join(sharedFilesDir, req.params.filename);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    res.json({ message: 'Deleted' });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

router.get('/api/admin/fcm_tokens', (req, res) => res.json({ tokens: fcmTokens }))

router.post('/api/register_fcm_token', (req, res) => {
  const { token } = req.body
  if (token && !fcmTokens.includes(token)) {
    fcmTokens.push(token)
    saveFcmTokens()
    console.log('New FCM token registered:', token)
  }
  res.json({ success: true })
})

// QR Order Public Endpoints
router.get('/api/public/menu', (req: any, res: any) => {
  let activeShop = getShop()
  const { shops, ShopState } = require('../models') // Adjust import path
  
  if (req.query.shop) {
    if (!shops.has(req.query.shop)) shops.set(req.query.shop, new ShopState(req.query.shop))
    activeShop = shops.get(req.query.shop)
  } else {
    if (!shops.has('sarac')) shops.set('sarac', new ShopState('sarac'))
    activeShop = shops.get('sarac')
  }
  
  res.json(activeShop.getFullMenu())
})

router.post('/api/public/submit_order', (req: any, res: any) => {
  const { customerName, items, totalAmount } = req.body
  
  if (!customerName || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Invalid order data' })
  }

  let shop = getShop()
  const { shops, ShopState } = require('../models') // Adjust import path
  
  if (req.query.shop) {
    if (!shops.has(req.query.shop)) shops.set(req.query.shop, new ShopState(req.query.shop))
    shop = shops.get(req.query.shop)
  } else {
    if (!shops.has('sarac')) shops.set('sarac', new ShopState('sarac'))
    shop = shops.get('sarac')
  }

  const expandedItems: any[] = []
  items.forEach((i: any) => {
    const qty = i.quantity || 1
    for (let j = 0; j < qty; j++) {
      expandedItems.push({
        name: i.name,
        portion: i.portion || '',
        price: i.price,
        notes: i.notes || ''
      })
    }
  })

  const newOrder = {
    id: Date.now().toString(),
    customer_name: `${customerName} (QR)`,
    time: new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }),
    items: expandedItems,
    total_amount: totalAmount,
    status: 'waiting'
  }

  shop.activeOrders.push(newOrder)
  shop.saveOrders()
  
  broadcastUpdateToPhones(shop)
  notifyUI('orders_update', null, shop)

  if (fcmTokens.length > 0) {
    const message = {
      notification: {
        title: 'Yeni Sipariş!',
        body: `QR Menüden ${customerName} isimli müşteriden ${totalAmount} ₺ tutarında yeni sipariş geldi!`
      },
      android: { priority: 'high' as const },
      tokens: fcmTokens
    };
    try {
      getMessaging().sendEachForMulticast(message)
        .then((response: any) => console.log(response.successCount + ' messages were sent successfully'))
        .catch((error: any) => console.log('Error sending message:', error));
    } catch (e) {
      console.log('FCM error:', e)
    }
  }

  const { ActivityLogModel, shopContext } = require('../models') // Adjust import path
  try {
    ActivityLogModel.create({
      username: 'QR_CUSTOMER',
      shopId: shop.shopId || 'admin',
      action: 'qr_order',
      details: `QR Siparişi alındı: ${customerName} (Toplam: ${totalAmount} ₺)`
    })
  } catch(e) {}

  res.json({ success: true, orderId: newOrder.id })
})

router.get('/api/public/order_status', (req: any, res: any) => {
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'ID required' })

  let shop = getShop()
  const { shops, ShopState } = require('../models') // Adjust import path
  
  if (req.query.shop) {
    if (!shops.has(req.query.shop)) shops.set(req.query.shop, new ShopState(req.query.shop))
    shop = shops.get(req.query.shop)
  } else {
    if (!shops.has('sarac')) shops.set('sarac', new ShopState('sarac'))
    shop = shops.get('sarac')
  }

  // Check active orders
  const active = shop.activeOrders.find((o: any) => o.id === id)
  if (active) {
    return res.json({ status: active.status })
  }

  // Check past orders
  const past = shop.pastOrders.find((o: any) => o.id === id)
  if (past) {
    return res.json({ status: past.status })
  }

  res.status(404).json({ error: 'Order not found' })
})

router.post('/api/public/call_waiter', (req: any, res: any) => {
  const { id } = req.body
  if (!id) return res.status(400).json({ error: 'ID required' })

  let shop = getShop()
  const { shops, ShopState } = require('../models') // Adjust import path
  
  if (req.body.shop) {
    if (!shops.has(req.body.shop)) shops.set(req.body.shop, new ShopState(req.body.shop))
    shop = shops.get(req.body.shop)
  } else {
    if (!shops.has('sarac')) shops.set('sarac', new ShopState('sarac'))
    shop = shops.get('sarac')
  }

  const active = shop.activeOrders.find((o: any) => o.id === id)
  if (!active) return res.status(404).json({ error: 'Active order not found' })

  if (fcmTokens.length > 0) {
    const message = {
      notification: {
        title: 'Garson Çağrısı!',
        body: `${active.customer_name} masasından garson çağrılıyor!`
      },
      android: { priority: 'high' as const },
      tokens: fcmTokens
    };
    try {
      getMessaging().sendEachForMulticast(message)
    } catch (e) {
      console.log('FCM error:', e)
    }
  }

  res.json({ success: true })
})

export default router;
