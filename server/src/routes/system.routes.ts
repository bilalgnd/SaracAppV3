import { Router } from 'express';
import axios from 'axios';
import { getShop, shops, ShopState } from '../models';
import { requireAuth } from '../middleware/auth';
import { requireAdminAuth } from '../middleware/auth';

const router = Router();

// -- Setter'lar: server.ts'den enjekte edilir --
let _notifyUI: ((action: string, data?: any, shop?: any) => void) = () => {};
let _broadcastMessageToPhones: ((msg: any, shop?: any) => void) = () => {};
let _systemLogs: any[] = [];
let _addSystemLog: ((source: string, type: string, message: string) => void) = () => {};
let _getConnectedPhones: (() => any[]) = () => [];

export function setNotifyUI(fn: (action: string, data?: any, shop?: any) => void) { _notifyUI = fn; }
export function setBroadcastMessageToPhones(fn: (msg: any, shop?: any) => void) { _broadcastMessageToPhones = fn; }
export function setSystemLogs(logs: any[]) { _systemLogs = logs; }
export function setAddSystemLog(fn: (source: string, type: string, message: string) => void) { _addSystemLog = fn; }
export function setGetConnectedPhones(fn: () => any[]) { _getConnectedPhones = fn; }

// GET /api/settings
router.get('/settings', requireAuth, (_req, res) => {
  res.json(getShop().systemSettings);
});

// GET /api/logs
router.get('/logs', (_req, res) => {
  res.json(_systemLogs);
});

// POST /api/logs
router.post('/logs', (req, res) => {
  const { source, type, message } = req.body;
  if (source && type && message) {
    _addSystemLog(source, type, message);
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: 'Missing fields' });
  }
});

// POST /api/clean_logs
router.post('/clean_logs', requireAuth, (_req, res) => {
  _notifyUI('clean_logs');
  res.json({ success: true });
});

// POST /api/extension_logs
router.post('/extension_logs', requireAuth, (req: any, res: any) => {
  const { source, type, message } = req.body;
  _addSystemLog(source || 'ElephantGO', type || 'info', message || '');
  res.json({ success: true });
});

// GET /api/daily_report
router.get('/daily_report', (req: any, res: any) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let targetDateOnly = today;
  let isSpecificDate = false;

  const queryDate = req.query.date as string;
  if (queryDate && queryDate.match(/^\d{2} \d{2} \d{4}$/)) {
    isSpecificDate = true;
    const [dd, mm, yyyy] = queryDate.split(' ').map(Number);
    targetDateOnly = new Date(yyyy, mm - 1, dd);
  }

  const boundaryDate = new Date(today);
  boundaryDate.setDate(today.getDate() - 6);

  let bugunkuCiro = 0;
  let haftalikCiro = 0;
  let bugunkuSiparis = 0;
  let haftalikSiparis = 0;
  let bugunkuIptaller = 0;
  let bugunkuEtGrams = 0;
  let bugunkuTavukGrams = 0;

  const urunSatisAdetleri: Record<string, number> = {};
  const dateSet = new Set<string>();
  let etAdet = 0;
  let tavukAdet = 0;

  getShop().pastOrders.forEach(order => {
    if (!order.completedAt) return;
    const orderDate = new Date(order.completedAt);
    const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());

    const dStr = `${orderDate.getDate().toString().padStart(2, '0')} ${(orderDate.getMonth() + 1).toString().padStart(2, '0')} ${orderDate.getFullYear()}`;
    dateSet.add(dStr);

    let isPrimaryDay = false;
    let isWithinRange = false;

    if (isSpecificDate) {
      isPrimaryDay = orderDateOnly.getTime() === targetDateOnly.getTime();
      isWithinRange = isPrimaryDay;
    } else {
      isPrimaryDay = orderDateOnly.getTime() === today.getTime();
      isWithinRange = orderDateOnly >= boundaryDate && orderDateOnly <= today;
    }

    if (isWithinRange) {
      if (order.status && order.status.toLowerCase().includes('iptal')) {
        if (isPrimaryDay) bugunkuIptaller++;
      } else if (order.status && order.status.toLowerCase().includes('tamamlan')) {
        haftalikCiro += order.total_amount || 0;
        haftalikSiparis++;

        if (isPrimaryDay) {
          bugunkuCiro += order.total_amount || 0;
          bugunkuSiparis++;
        }

        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            const qty = item.quantity || 1;
            const name = item.name || 'Bilinmeyen';

            if (isPrimaryDay) {
              urunSatisAdetleri[name] = (urunSatisAdetleri[name] || 0) + qty;
              const iName = name.toLowerCase();
              let g = 0;
              const mP = (item.portion || '').match(/(\d+)gr/i);
              const mN = name.match(/(\d+)gr/i);
              if (mP) g = parseInt(mP[1], 10);
              else if (mN) g = parseInt(mN[1], 10);
              else if (iName.includes('kampy') || iName.includes('biga')) g = 100;
              else if (iName.includes('iskender') || iName.includes('beyti')) g = 150;

              if (iName.includes('tavuk')) {
                bugunkuTavukGrams += g * qty;
                tavukAdet += qty;
              } else if (iName.includes('et') || iName.includes('iskender') || iName.includes('beyti')) {
                bugunkuEtGrams += g * qty;
                etAdet += qty;
              }
            }
          });
        }
      }
    }
  });

  getShop().activeOrders.forEach(order => {
    let isPrimaryDay = false;
    if (isSpecificDate) {
      isPrimaryDay = today.getTime() === targetDateOnly.getTime();
    } else {
      isPrimaryDay = true;
    }

    haftalikCiro += order.total_amount || 0;
    haftalikSiparis++;

    if (isPrimaryDay) {
      bugunkuCiro += order.total_amount || 0;
      bugunkuSiparis++;
    }

    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item: any) => {
        const qty = item.quantity || 1;
        const name = item.name || 'Bilinmeyen';

        if (isPrimaryDay) {
          urunSatisAdetleri[name] = (urunSatisAdetleri[name] || 0) + qty;
          const iName = name.toLowerCase();
          let g = 0;
          const mP = (item.portion || '').match(/(\d+)gr/i);
          const mN = name.match(/(\d+)gr/i);
          if (mP) g = parseInt(mP[1], 10);
          else if (mN) g = parseInt(mN[1], 10);
          else if (iName.includes('kampy') || iName.includes('biga')) g = 100;
          else if (iName.includes('iskender') || iName.includes('beyti')) g = 150;

          if (iName.includes('tavuk')) {
            bugunkuTavukGrams += g * qty;
            tavukAdet += qty;
          } else if (iName.includes('et') || iName.includes('iskender') || iName.includes('beyti')) {
            bugunkuEtGrams += g * qty;
            etAdet += qty;
          }
        }
      });
    }
  });

  let favoriUrun = { ad: 'Veri Yok', satis: 0 };
  for (const [name, qty] of Object.entries(urunSatisAdetleri)) {
    if (qty > favoriUrun.satis) {
      favoriUrun = { ad: name, satis: qty };
    }
  }

  let favoriDoner = { ad: 'Veri Yok', satis: 0 };
  if (etAdet > 0 || tavukAdet > 0) {
    if (etAdet > tavukAdet) favoriDoner = { ad: 'Et Döner', satis: etAdet };
    else if (tavukAdet > etAdet) favoriDoner = { ad: 'Tavuk Döner', satis: tavukAdet };
    else favoriDoner = { ad: 'Et & Tavuk Döner', satis: etAdet };
  }

  if (favoriDoner.satis === 0 && favoriUrun.satis > 0) favoriDoner = favoriUrun;

  const availableDates = Array.from(dateSet).sort((a, b) => {
    const parse = (str: string) => {
      const parts = str.split(' ');
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
    };
    return parse(b) - parse(a);
  });

  const ortalamaSepetTutari = bugunkuSiparis > 0 ? bugunkuCiro / bugunkuSiparis : 0;
  const fireOrani = bugunkuSiparis + bugunkuIptaller > 0
    ? (bugunkuIptaller / (bugunkuSiparis + bugunkuIptaller)) * 100 : 0;

  res.json({
    bugunkuCiro, haftalikCiro, bugunkuSiparis, haftalikSiparis,
    favoriDoner, favoriUrun,
    bugunkuIptaller: { adet: bugunkuIptaller, fireOrani: Math.round(fireOrani) },
    ortalamaSepetTutari: Math.round(ortalamaSepetTutari),
    bugunSatilanEtKg: (bugunkuEtGrams / 1000).toFixed(2),
    bugunSatilanTavukKg: (bugunkuTavukGrams / 1000).toFixed(2),
    availableDates, isSpecificDate,
  });
});

// POST /test_print
router.post('/test_print', requireAuth, (_req, res) => {
  _notifyUI('test_print');
  res.json({ success: true });
});

// GET /test_orders
router.get('/test_orders', (_req, res) => {
  res.json({ orders: getShop().activeOrders.map(a => a.customer_name) });
});

// GET /network_status
router.get('/network_status', (_req, res) => {
  const os = require('os');
  const nets = os.networkInterfaces();
  let localIp = '127.0.0.1';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIp = net.address;
        break;
      }
    }
  }
  const { getConnectedPhones } = require('../services/botService');
  const botStatus = require('../services/botService').currentBotStatus;
  res.json({ ip: localIp, port: 5000, connectedDevices: _getConnectedPhones(), botStatus });
});

// GET /active_devices
router.get('/active_devices', requireAuth, (req: any, res: any) => {
  try {
    const shopId = req.user?.username || req.user?.shopId;
    const targetShop = shops.get(shopId) || getShop();
    const devices: string[] = [];
    targetShop.connectedPhones.forEach((ws: any) => {
      const did = ws.deviceId;
      if (did && !devices.includes(did)) devices.push(did);
    });
    res.json({ devices });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /panic
router.post('/panic', requireAuth, (req: any, res: any) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
    const shopId = req.user?.username || req.user?.shopId;
    const targetShop = shops.get(shopId) || getShop();

    let found = false;
    targetShop.connectedPhones.forEach((ws: any) => {
      if (ws.deviceId === deviceId && ws.readyState === 1 /* OPEN */) {
        ws.send(JSON.stringify({ type: 'server-event', action: 'panic_self_destruct' }));
        found = true;
      }
    });

    if (!found) return res.status(404).json({ error: 'Device not found or not connected' });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /yazdir
router.post('/yazdir', requireAuth, (req: any, res: any) => {
  try {
    const customerName = req.body.customer_name;
    _notifyUI('print_receipt', { customerName });
    res.json({ status: 'basarili' });
  } catch (error: any) {
    res.status(400).json({ status: 'hata', error: error.message });
  }
});

// TV Kontrol endpoints
router.post('/api/set_tv_audio', (req: any, res: any) => {
  const { source, station } = req.body;
  const targetShopId = (req.query.shop as string) || 'sarac';
  if (!shops.has(targetShopId)) shops.set(targetShopId, new ShopState(targetShopId));
  const shop = shops.get(targetShopId)!;

  if (source) shop.systemSettings['TV_AUDIO_SOURCE'] = source;
  if (station) shop.systemSettings['TV_RADIO_STATION'] = station;
  shop.saveSettings();
  _broadcastMessageToPhones({ type: 'server-event', action: 'tv_audio_changed', source, station }, shop);
  _notifyUI('tv_audio_changed', { source, station }, shop);
  res.json({ success: true, source, station });
});

router.post('/api/set_tv_screensaver', (req: any, res: any) => {
  const { mode } = req.body;
  const targetShopId = (req.query.shop as string) || 'sarac';
  if (!shops.has(targetShopId)) shops.set(targetShopId, new ShopState(targetShopId));
  const shop = shops.get(targetShopId)!;

  if (mode) {
    shop.systemSettings['TV_SCREENSAVER'] = mode;
    shop.saveSettings();
    _broadcastMessageToPhones({ type: 'server-event', action: 'tv_screensaver_changed', mode }, shop);
    _notifyUI('tv_screensaver_changed', { mode }, shop);
    res.json({ success: true, mode });
  } else {
    res.status(400).json({ error: 'mode required' });
  }
});

router.post('/api/set_tv_card_scale', (req: any, res: any) => {
  const { scale } = req.body;
  const targetShopId = (req.query.shop as string) || 'sarac';
  if (!shops.has(targetShopId)) shops.set(targetShopId, new ShopState(targetShopId));
  const shop = shops.get(targetShopId)!;

  const numScale = parseInt(scale, 10) || 100;
  shop.systemSettings['TV_CARD_SCALE'] = numScale;
  shop.saveSettings();
  _broadcastMessageToPhones({ type: 'server-event', action: 'tv_card_scale_changed', scale: numScale }, shop);
  _notifyUI('tv_card_scale_changed', { scale: numScale }, shop);
  res.json({ success: true, scale: numScale });
});

// Legacy TV control (requireAuth)
router.post('/set_tv_screensaver', requireAuth, (req: any, res: any) => {
  const mode = req.body.mode;
  if (mode) {
    getShop().systemSettings['TV_SCREENSAVER'] = mode;
    getShop().saveSettings();
    _broadcastMessageToPhones({ type: 'server-event', action: 'tv_screensaver_changed', mode }, getShop());
    _notifyUI('request_update');
    res.json({ success: true, mode });
  } else {
    res.status(400).json({ error: 'mode required' });
  }
});

router.post('/set_tv_audio', requireAuth, (req: any, res: any) => {
  const { source, station } = req.body;
  if (source) getShop().systemSettings['TV_AUDIO_SOURCE'] = source;
  if (station) getShop().systemSettings['TV_RADIO_STATION'] = station;
  getShop().saveSettings();
  _broadcastMessageToPhones({ type: 'server-event', action: 'tv_audio_changed', source, station }, getShop());
  _notifyUI('request_update');
  res.json({ success: true, source, station });
});

// GET /tv_settings
router.get('/tv_settings', (_req, res) => {
  res.json({ youtube_url: getShop().systemSettings['YOUTUBE_LINK'] || '' });
});

// GET /api/portfolio-media + POST
router.get('/portfolio-media', (_req, res) => {
  const type = getShop().systemSettings['PORTFOLIO_MEDIA_TYPE'] || 'image';
  res.json({ type });
});

router.post('/portfolio-media', requireAdminAuth, async (req: any, res: any) => {
  try {
    const { type } = req.body;
    if (type !== 'image' && type !== 'video' && type !== 'video2') {
      return res.status(400).json({ error: 'Geçersiz tip. "image", "video" veya "video2" olmalı.' });
    }
    const { DataModel } = require('../models');
    const shop = getShop();
    shop.systemSettings['PORTFOLIO_MEDIA_TYPE'] = type;
    await DataModel.findOneAndUpdate(
      { key: 'systemSettings' },
      { value: { ...shop.systemSettings } },
      { upsert: true }
    );
    res.json({ success: true, type });
  } catch (e) {
    res.status(500).json({ error: 'DB error' });
  }
});

export default router;
