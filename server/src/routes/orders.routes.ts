import { Router } from 'express';
import { getShop } from '../models';
import { requireAuth } from '../middleware/auth';
import { idempotencyMiddleware } from '../middleware/idempotency';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { z } from 'zod';

const SiparisSchema = z.object({
  customer_name: z.string().optional(),
  items: z.array(z.any()).optional(),
  total_amount: z.number().optional(),
  order_note: z.string().optional(),
  time: z.string().optional(),
  status: z.string().optional(),
  color: z.string().optional()
});

export const ordersRouter = Router();

let notifyUI: any = () => {};
export function setNotifyUI(fn: any) {
  notifyUI = fn;
}

let broadcastUpdateToPhones: any = () => {};
export function setBroadcastUpdateToPhones(fn: any) {
  broadcastUpdateToPhones = fn;
}

let sendFcmNotification: any = () => {};
export function setSendFcmNotification(fn: any) {
  sendFcmNotification = fn;
}

let globalDailyTotalValue: number = 0;
export function getGlobalDailyTotal() { return globalDailyTotalValue; }
export function setGlobalDailyTotal(val: number) { globalDailyTotalValue = val; }

let shopContext: any = { getStore: () => 'admin' };
export function setShopContext(ctx: any) { shopContext = ctx; }

ordersRouter.post('/siparis', requireAuth, (req: any, res: any): any => {
  const result = SiparisSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid order data", details: result.error });
  }

  try {
    const data = req.body;
    fs.appendFileSync(path.join(os.tmpdir(), 'kasa_debug.txt'), 'SIPARIS RECEIVED: ' + JSON.stringify(data) + '\n');
    
    if (!data) {
      fs.appendFileSync(path.join(os.tmpdir(), 'kasa_debug.txt'), 'FAILED 400: no data\n');
      return res.status(400).json({ error: 'Invalid order data' });
    }

    let cname = data.customer_name ? data.customer_name.trim() : '';
    if (!cname || cname === 'Yeni Adisyon' || cname === 'YeniSiparis' || cname === 'Yeni Siparis' || cname.startsWith('Sıra ') || cname.startsWith('Sira ')) {
        cname = `Masa ${getShop().getNextMasaNo()}`;
    }
    const idx = getShop().activeOrders.findIndex((o: any) => o.customer_name === cname);
    
    const newOrder = {
      customer_name: cname,
      masa_no: idx > -1 ? getShop().activeOrders[idx].masa_no : getShop().getNextQueueNo().toString(),
      order_note: data.order_note || '',
      items: (data.items || []).map((k: any) => ({
        name: k.name,
        portion: k.portion,
        quantity: k.quantity || 1,
        price: k.price,
        notes: k.notes || ''
      })),
      total_amount: data.total_amount,
      time: data.time || new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }),
      status: data.status || 'waiting',
      color: data.color || (req as any).user?.waiterColor || '',
      createdBy: data.createdBy || (req as any).user?.waiterName || (req as any).user?.username || 'Kasa',
      is_updated: idx > -1
    };

    if (idx > -1) {
      getShop().activeOrders[idx] = newOrder;
    } else {
      getShop().activeOrders.unshift(newOrder);
    }
    
    const currentShop = getShop();
    currentShop.saveOrders();
    broadcastUpdateToPhones(currentShop);
    notifyUI('new_order', newOrder, currentShop);
    
    fs.appendFileSync(path.join(os.tmpdir(), 'kasa_debug.txt'), 'SIPARIS SUCCESS\n');
    return res.json({ success: true });
  } catch (err: any) {
    fs.appendFileSync(path.join(os.tmpdir(), 'kasa_debug.txt'), 'ERROR: ' + err.message + '\n');
    return res.status(500).json({ error: err.message });
  }
})

ordersRouter.post('/close_bill', requireAuth, idempotencyMiddleware, async (req: any, res: any): Promise<any> => {
  const cname = req.body.customer_name
  const shop = getShop()
  const idx = shop.activeOrders.findIndex((o: any) => o.customer_name === cname)
  let amount = 0
  if (idx !== -1) {
    amount = shop.activeOrders[idx].total_amount || 0
    const finishedOrder = shop.activeOrders[idx]
    finishedOrder.status = "Tamamlandı"
    finishedOrder.completedAt = new Date().toISOString()
    shop.pastOrders.unshift(finishedOrder)
    
    if (shop.pastOrders.length > 500) {
      shop.pastOrders.pop()
    }
    
    shop.activeOrders.splice(idx, 1)
    
    let dailyTotal = getGlobalDailyTotal() + amount
    setGlobalDailyTotal(dailyTotal)
    shop.systemSettings['dailyTotal'] = dailyTotal
    
    shop.saveOrders()
    shop.savePastOrders()
    shop.saveSettings()
    broadcastUpdateToPhones(shop)
  }
  
  const { ActivityLogModel } = require('../models')
  try {
    await ActivityLogModel.create({
      username: req.user?.username || 'admin',
      shopId: shopContext.getStore() || 'admin',
      action: 'close_bill',
      details: `${cname} hesabı kapatıldı. Tutar: ${amount} ₺`
    })
  } catch(e) {}

  notifyUI('order_deleted', { customerName: cname, totalAmount: amount, newDailyTotal: getGlobalDailyTotal() })
  res.json({ success: true })
})

ordersRouter.get('/api/orders', (req: any, res: any) => {
  let shop = getShop()
  const { shops, ShopState } = require('../models')
  const targetShop = (req.query.shop as string) || 'sarac'
  if (!shops.has(targetShop)) shops.set(targetShop, new ShopState(targetShop))
  shop = shops.get(targetShop)
  res.json(shop.activeOrders || [])
})

ordersRouter.post('/api/orders', (req: any, res: any) => {
  let shop = getShop()
  const { shops, ShopState } = require('../models')
  const targetShop = (req.query.shop as string) || 'sarac'
  if (!shops.has(targetShop)) shops.set(targetShop, new ShopState(targetShop))
  shop = shops.get(targetShop)

  if (Array.isArray(req.body)) {
    shop.activeOrders.length = 0
    shop.activeOrders.push(...req.body)
    shop.saveOrders()

    broadcastUpdateToPhones(shop)
    notifyUI('orders_update', shop.activeOrders, shop)

    res.json({ success: true, count: shop.activeOrders.length })
  } else {
    res.status(400).json({ error: 'Array required' })
  }
})

ordersRouter.get('/api/active_orders', requireAuth, (req: any, res) => {
  res.json(getShop().activeOrders)
})

ordersRouter.post('/api/sync_orders', requireAuth, idempotencyMiddleware, async (req: any, res: any): Promise<any> => {
  console.log('SYNC_ORDERS CALLED:', req.body ? 'Has body' : 'No body', Array.isArray(req.body) ? 'Array' : 'Object')
  if (Array.isArray(req.body)) {
    const shop = getShop()
    shop.activeOrders.length = 0
    shop.activeOrders.push(...req.body)
    shop.saveOrders()
    broadcastUpdateToPhones(shop)
    notifyUI('orders_update', shop.activeOrders, shop)

    const { ActivityLogModel } = require('../models')
    try {
      await ActivityLogModel.create({
        username: req.user?.username || 'admin',
        shopId: shopContext.getStore() || 'admin',
        action: 'sync_orders',
        details: `Siparişler senkronize edildi (Toplam: ${req.body.length} sipariş)`
      })
    } catch(e) {}

    res.json({ success: true })
  } else {
    res.status(400).json({ error: 'Array required' })
  }
})

ordersRouter.get('/api/past_orders', requireAuth, (_req, res) => {
  res.json(getShop().pastOrders)
})

ordersRouter.post('/api/add_past_order', requireAuth, (req: any, res: any) => {
  getShop().pastOrders.unshift(req.body)
  if (getShop().pastOrders.length > 500) {
    getShop().pastOrders.pop()
  }
  getShop().savePastOrders()
  res.json({ success: true })
})

ordersRouter.post('/api/delete_past_order', requireAuth, (req: any, res: any) => {
  const idx = req.body.index
  if (idx !== undefined && idx >= 0 && idx < getShop().pastOrders.length) {
    getShop().pastOrders.splice(idx, 1)
    getShop().savePastOrders()
  }
  res.json({ success: true })
})

ordersRouter.post('/api/clear_past_orders', requireAuth, (_req, res: any) => {
  getShop().pastOrders.splice(0, getShop().pastOrders.length)
  getShop().savePastOrders()
  res.json({ success: true })
})

ordersRouter.post('/update_status', requireAuth, (req: any, res: any): any => {
  const cname = req.body.customer_name
  const status = req.body.status
  const shop = getShop()
  const idx = shop.activeOrders.findIndex((o: any) => o.customer_name === cname)
  if (idx !== -1) {
    shop.activeOrders[idx].status = status
    shop.saveOrders()
    broadcastUpdateToPhones(shop)
  }
  notifyUI('update_status', req.body, shop)
  res.json({ success: true })
})

ordersRouter.get('/update_status', requireAuth, (req: any, res: any): any => {
  res.status(405).json({ error: "Method not allowed. Use POST." })
})

ordersRouter.post('/update_table_name', requireAuth, (req: any, res: any): any => {
  const { old_name, new_name } = req.body;
  if (!old_name || !new_name) return res.status(400).json({ error: "Missing parameters" });

  const idx = getShop().activeOrders.findIndex((o: any) => o.customer_name === old_name);
  if (idx > -1) {
    getShop().activeOrders[idx].customer_name = new_name;
    getShop().saveOrders();
    notifyUI('orders_update');
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Order not found" });
  }
});

ordersRouter.post('/update_daily_total', requireAuth, (req: any, res: any): any => {
  if (req.body && req.body.total !== undefined) {
    setGlobalDailyTotal(req.body.total)
    getShop().systemSettings['dailyTotal'] = getGlobalDailyTotal()
    getShop().saveSettings()
  }
  res.json({ success: true })
})

ordersRouter.get('/daily_total', (_req, res) => {
  const shop = getShop();
  res.json({ 
    total: shop.systemSettings['dailyTotal'] ?? getGlobalDailyTotal() ?? 0,
    screensaver: shop.systemSettings['TV_SCREENSAVER'] || 'dvd',
    tvAudioSource: shop.systemSettings['TV_AUDIO_SOURCE'] || 'spotify',
    tvRadioStation: shop.systemSettings['TV_RADIO_STATION'] || 'powerturk',
    tvCardScale: shop.systemSettings['TV_CARD_SCALE'] || 100
  })
})

ordersRouter.post('/api/clear_data', (req: any, res) => {
  const shop = getShop()
  shop.pastOrders.length = 0
  shop.savePastOrders()
  res.json({ success: true })
})

export default ordersRouter;
