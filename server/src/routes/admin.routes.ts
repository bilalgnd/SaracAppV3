import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import axios from 'axios';
import { UserModel, ActivityLogModel, DataModel, ShopState, shops, getShop } from '../models';
import { requireAdminAuth } from '../middleware/auth';
import { env } from '../config/env';

export const adminRouter = Router();

let wssInstance: any = null;
export function setWss(wss: any) {
  wssInstance = wss;
}

let notifyUI: any = () => {};
export function setNotifyUI(fn: any) {
  notifyUI = fn;
}

const getTrendyolSupplierId = () => {
  const shop = getShop();
  const settings = shop?.systemSettings || {};
  return settings.trendyolSupplierId || env.TRENDYOL_SUPPLIER_ID || '6647850';
};

const getTgoHeaders = () => {
  const shop = getShop();
  const settings = shop?.systemSettings || {};
  
  const supplierId = getTrendyolSupplierId();
  const apiKey = settings.trendyolApiKey || env.TRENDYOL_API_KEY || '';
  const apiSecret = settings.trendyolApiSecret || env.TRENDYOL_API_SECRET || '';
  const authStr = `${apiKey}:${apiSecret}`;
  const authB64 = Buffer.from(authStr, 'utf-8').toString('base64');
  const executorUser = settings.trendyolExecutorUser || env.TRENDYOL_EXECUTOR_USER || '';
  
  return {
    "Authorization": `Basic ${authB64}`,
    "User-Agent": `${supplierId} - SelfIntegration`,
    "x-agentname": `${supplierId} - SelfIntegration`,
    "x-executor-user": executorUser,
    "Content-Type": "application/json"
  };
};

const getTgoBaseUrl = () => { const s = getShop().systemSettings || {}; let b = s.trendyolApiEndpoint || 'https://api.tgoapis.com/integrator'; if(b.endsWith('/')) b=b.slice(0,-1); return b; };

adminRouter.post('/admin/login', (req: any, res: any) => {
  const { password } = req.body
  const adminPassword = env.ADMIN_TOOLS_PASSWORD || 'default_admin'
  if (password === adminPassword) {
    const token = jwt.sign({ role: 'admin' }, env.JWT_SECRET, { expiresIn: '30d' })
    return res.json({ token })
  } else {
    return res.status(401).json({ error: 'Invalid password' })
  }
})

adminRouter.get('/admin/users', requireAdminAuth, async (_req: any, res: any) => {
  const users = await UserModel.find({}, { password_hash: 0 })
  res.json({ users, allowRegistration: getShop().systemSettings['ALLOW_REGISTRATION'] || false })
})

adminRouter.post('/admin/delete_user', requireAdminAuth, async (req: any, res: any) => {
  const { id } = req.body
  await UserModel.findByIdAndDelete(id)
  res.json({ success: true })
})

adminRouter.post('/admin/toggle_registration', requireAdminAuth, async (req: any, res: any) => {
  const { allow } = req.body
  getShop().systemSettings['ALLOW_REGISTRATION'] = allow
  getShop().saveSettings()
  res.json({ success: true, allowRegistration: allow })
})

adminRouter.post('/admin/create_user', requireAdminAuth, async (req: any, res: any) => {
  try {
    const { username, password, role } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' })
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Şifre en az 4 karakter olmalıdır' })
    }
    
    const assignedRole = role || 'garson'

    const salt = await bcrypt.genSalt(10)
    const password_hash = await bcrypt.hash(password, salt)

    const account_id = 'ACC-' + Math.random().toString(36).substring(2, 8).toUpperCase()

    const user = new UserModel({ username, password_hash, plain_password: password, role: assignedRole, account_id })
    await user.save()

    const shop = new ShopState(username)
    await shop.initialize()
    shops.set(username, shop)

    res.json({ success: true, message: 'User registered successfully' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

adminRouter.post('/admin/update_user', requireAdminAuth, async (req: any, res: any) => {
  try {
    const { targetUsername, newPassword, newRole, newStatus } = req.body
    if (!targetUsername) return res.status(400).json({ error: 'targetUsername required' })
    if (targetUsername === 'bilalgnd' && newStatus === 'suspended') return res.status(403).json({ error: 'Cannot suspend main admin' })

    const user = await UserModel.findOne({ username: targetUsername })
    if (!user) return res.status(404).json({ error: 'User not found' })

    if (newPassword && typeof newPassword === 'string' && newPassword.trim().length > 0) {
      if (newPassword.trim().length < 4) {
        return res.status(400).json({ error: 'Şifre en az 4 karakter olmalıdır' })
      }
      const salt = await bcrypt.genSalt(10)
      user.password_hash = await bcrypt.hash(newPassword.trim(), salt)
      user.plain_password = newPassword.trim()
    }
    if (newRole) user.role = newRole
    if (newStatus) user.status = newStatus

    await user.save()

    if (newStatus === 'suspended' && wssInstance) {
      wssInstance.clients.forEach((client: any) => {
        const c = client as any;
        if (c.username === targetUsername || c.shopId === targetUsername) {
          try {
            c.send(JSON.stringify({ type: 'server-event', action: 'force_logout' }));
            c.close();
          } catch(e) {}
        }
      });
    }
    
    await ActivityLogModel.create({
      username: (req as any).user?.username || 'admin',
      shopId: 'admin',
      action: 'update_user',
      details: `Updated user ${targetUsername}: Role=${newRole || user.role}, Status=${newStatus || user.status}`
    })

    res.json({ success: true })
    notifyUI('request_update')
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

adminRouter.post('/admin/kick_user', requireAdminAuth, async (req: any, res: any) => {
  try {
    const { targetUsername } = req.body
    if (!targetUsername) return res.status(400).json({ error: 'targetUsername required' })
    
    let kickedCount = 0;
    if (wssInstance) {
      wssInstance.clients.forEach((client: any) => {
        const c = client as any;
        if (c.username === targetUsername || c.shopId === targetUsername) {
          try {
            c.send(JSON.stringify({ type: 'server-event', action: 'force_logout' }));
            c.close();
          } catch(e) {}
          kickedCount++;
        }
      });
    }

    await ActivityLogModel.create({
      username: (req as any).user?.username || 'admin',
      shopId: 'admin',
      action: 'kick_user',
      details: `Kicked user ${targetUsername} from ${kickedCount} devices`
    })

    res.json({ success: true, kickedCount })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

adminRouter.get('/admin/user_logs/:username', requireAdminAuth, async (req: any, res: any) => {
  try {
    const { username } = req.params
    const logs = await ActivityLogModel.find({ username }).sort({ createdAt: -1 }).limit(100)
    res.json(logs)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

function getTurkeyMidnight(offsetDays: number = 0): Date {
  const now = new Date();
  const trFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
  const parts = trFormatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')!.value);
  const month = parseInt(parts.find(p => p.type === 'month')!.value) - 1;
  const day = parseInt(parts.find(p => p.type === 'day')!.value);

  // Turkey is fixed UTC+3 (3 hours ahead of UTC). Midnight in Turkey (00:00:00 UTC+3) is 21:00:00 UTC of previous day.
  const midnightTurkeyInUtcMs = Date.UTC(year, month, day + offsetDays, -3, 0, 0, 0);
  return new Date(midnightTurkeyInUtcMs);
}

function getTurkeyHour(date: Date): number {
  const trFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    hour: 'numeric',
    hour12: false
  });
  return parseInt(trFormatter.format(date)) % 24;
}

function getTurkeyDayMonth(date: Date): string {
  const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const trFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'numeric'
  });
  const parts = trFormatter.formatToParts(date);
  const day = parts.find(p => p.type === 'day')!.value;
  const month = parseInt(parts.find(p => p.type === 'month')!.value) - 1;
  return `${day} ${monthNames[month]}`;
}

function getOrderDate(order: any): Date | null {
  if (!order) return null;
  // Prioritize authentic order creation timestamp
  if (order.packageCreationDate) {
    const d = new Date(typeof order.packageCreationDate === 'number' ? order.packageCreationDate : String(order.packageCreationDate));
    if (!isNaN(d.getTime())) return d;
  }
  if (order.creationDate) {
    const d = new Date(order.creationDate);
    if (!isNaN(d.getTime())) return d;
  }
  if (order.orderDate) {
    const d = new Date(order.orderDate);
    if (!isNaN(d.getTime())) return d;
  }
  if (order.deliveryDate || order.deliveredDate) {
    const d = new Date(order.deliveryDate || order.deliveredDate);
    if (!isNaN(d.getTime())) return d;
  }
  if (order.createdAt) {
    const d = new Date(order.createdAt);
    if (!isNaN(d.getTime())) return d;
  }
  if (order.timestamp) {
    const d = new Date(order.timestamp);
    if (!isNaN(d.getTime())) return d;
  }
  if (order.date && typeof order.date === 'string') {
    if (order.date.includes('.')) {
      const parts = order.date.split('.');
      if (parts.length === 3) {
        const timeParts = (order.time || '00:00').split(':');
        const d = new Date(
          parseInt(parts[2]),
          parseInt(parts[1]) - 1,
          parseInt(parts[0]),
          parseInt(timeParts[0]) || 0,
          parseInt(timeParts[1]) || 0
        );
        if (!isNaN(d.getTime())) return d;
      }
    }
    const d = new Date(order.date);
    if (!isNaN(d.getTime())) return d;
  }
  if (order.completedAt) {
    const d = new Date(order.completedAt);
    if (!isNaN(d.getTime())) return d;
  }
  if (order.status === 'waiting' || order.status === 'Hazırlanıyor' || order.status === 'Created' || order.status === 'Picking') {
    return new Date();
  }
  return null;
}

adminRouter.get('/admin/dashboard_stats', requireAdminAuth, async (req: any, res: any) => {
  const platform = (req.query.platform || 'all').toLowerCase()
  const range = (req.query.range || 'daily').toLowerCase()

  const now = new Date()

  // Turkey Timezone Boundaries
  const todayStart = getTurkeyMidnight(0)    // 00:00 Turkey time today
  const weekStart = getTurkeyMidnight(-6)   // 7 days ago 00:00 Turkey time
  const monthStart = getTurkeyMidnight(-29) // 30 days ago 00:00 Turkey time

  let rangeStartDate: Date
  let previousRangeStartDate: Date
  let previousRangeEndDate: Date

  if (range === 'hourly') {
    // Son 1 Saat
    rangeStartDate = new Date(now.getTime() - 60 * 60 * 1000)
    previousRangeEndDate = new Date(rangeStartDate.getTime())
    previousRangeStartDate = new Date(now.getTime() - 120 * 60 * 1000)
  } else if (range === 'weekly') {
    // Son 7 Gün (Bugün dahil)
    rangeStartDate = new Date(weekStart)
    previousRangeEndDate = new Date(rangeStartDate.getTime() - 1)
    previousRangeStartDate = new Date(getTurkeyMidnight(-13))
  } else if (range === 'monthly') {
    // Son 30 Gün (Bugün dahil)
    rangeStartDate = new Date(monthStart)
    previousRangeEndDate = new Date(rangeStartDate.getTime() - 1)
    previousRangeStartDate = new Date(getTurkeyMidnight(-59))
  } else {
    // 'daily' -> Bugün (Bugün 00:00 Turkey time - şimdi)
    rangeStartDate = new Date(todayStart)
    previousRangeEndDate = new Date(rangeStartDate.getTime() - 1)
    previousRangeStartDate = new Date(getTurkeyMidnight(-1))
  }

  // Pre-populate Trend Map so the line chart shows full continuous intervals
  const trendDataMap = new Map<string, { label: string, val: number, ts: number }>()

  if (range === 'hourly' || range === 'daily') {
    for (let h = 0; h <= 23; h++) {
      const label = `${String(h).padStart(2, '0')}:00`
      trendDataMap.set(label, { label, val: 0, ts: h })
    }
  } else if (range === 'weekly') {
    for (let i = 6; i >= 0; i--) {
      const d = getTurkeyMidnight(-i)
      const label = getTurkeyDayMonth(d)
      trendDataMap.set(label, { label, val: 0, ts: d.getTime() })
    }
  } else if (range === 'monthly') {
    for (let i = 29; i >= 0; i--) {
      const d = getTurkeyMidnight(-i)
      const label = getTurkeyDayMonth(d)
      trendDataMap.set(label, { label, val: 0, ts: d.getTime() })
    }
  }

  let rangeRevenue = 0
  let rangeOrdersCount = 0
  let previousRangeRevenue = 0
  let rangeEtDonerGrams = 0
  let rangeTavukDonerGrams = 0

  let todayRevenue = 0, todayOrdersCount = 0
  let weekRevenue = 0, weekOrdersCount = 0
  let monthRevenue = 0, monthOrdersCount = 0

  let itemSales: Record<string, number> = {}
  let itemRevenue: Record<string, number> = {}
  let categorySales: Record<string, number> = { 'Et Döner': 0, 'Tavuk Döner': 0, 'İçecekler': 0, 'Tatlı & Yan Ürünler': 0, 'Diğer': 0 }
  let neighborhoodSales: Record<string, number> = {}
  let paymentSales: Record<string, { count: number, total: number }> = {
    'Online': { count: 0, total: 0 },
    'Nakit': { count: 0, total: 0 },
    'POS / Kart': { count: 0, total: 0 },
    'Yemek Kartı': { count: 0, total: 0 }
  }

  const shop = getShop()

  const processOrder = (order: any) => {
    const orderPlatform = (order.platform || '').toLowerCase()
    if (platform === 'trendyol' && orderPlatform !== 'trendyol') return
    if (platform === 'yemeksepeti' && orderPlatform !== 'yemeksepeti') return
    // 'all' on apiorders = only delivery platforms (trendyol + yemeksepeti), NOT pos/salon
    if (platform === 'all' && orderPlatform !== 'trendyol' && orderPlatform !== 'yemeksepeti') return

    const oDate = getOrderDate(order)
    if (!oDate) return

    const amt = parseFloat(order.total_amount || order.totalPrice || order.total || 0) || 0

    // Fixed Periods (Today, Week, Month in Turkey time)
    if (oDate >= todayStart && oDate <= now) {
      todayRevenue += amt
      todayOrdersCount++
    }
    if (oDate >= weekStart && oDate <= now) {
      weekRevenue += amt
      weekOrdersCount++
    }
    if (oDate >= monthStart && oDate <= now) {
      monthRevenue += amt
      monthOrdersCount++
    }

    // Previous Range Comparison (for % change badge)
    if (oDate >= previousRangeStartDate && oDate <= previousRangeEndDate) {
      previousRangeRevenue += amt
    }

    // Selected Range Metrics
    if (oDate >= rangeStartDate && oDate <= now) {
      rangeRevenue += amt
      rangeOrdersCount++
    }

    // Trend Chart Points
    if (range === 'hourly' || range === 'daily') {
      if (oDate >= todayStart && oDate <= now) {
        const h = getTurkeyHour(oDate)
        const label = `${String(h).padStart(2, '0')}:00`
        if (trendDataMap.has(label)) {
          trendDataMap.get(label)!.val += amt
        }
      }
    } else {
      if (oDate >= rangeStartDate && oDate <= now) {
        const label = getTurkeyDayMonth(oDate)
        if (trendDataMap.has(label)) {
          trendDataMap.get(label)!.val += amt
        }
      }
    }

    // Breakdown Candidates (items, döner kg, neighborhoods, payments)
    const isBreakdownCandidate = (range === 'hourly')
      ? (oDate >= (rangeRevenue > 0 ? rangeStartDate : (todayRevenue > 0 ? todayStart : new Date(now.getTime() - 24 * 60 * 60 * 1000))))
      : (oDate >= rangeStartDate && oDate <= now)

    if (isBreakdownCandidate) {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          const qty = parseInt(item.quantity || 1) || 1
          const name = item.name || 'Bilinmeyen Ürün'
          const price = parseFloat(item.price || 0) || 0
          const iName = name.toLowerCase()

          let meatType = 'none'
          let itemMeatGrams = 0

          if (iName.includes('et') || iName.includes('iskender') || iName.includes('beyti') || iName.includes('biftek')) {
            meatType = 'et'
            if (iName.includes('duble') || iName.includes('250g')) itemMeatGrams = 250
            else if (iName.includes('iskender') || iName.includes('beyti') || iName.includes('porsiyon') || iName.includes('pilav üstü') || iName.includes('xl')) itemMeatGrams = 150
            else itemMeatGrams = 100
          } else if (iName.includes('tavuk') || iName.includes('biga') || iName.includes('zurna')) {
            meatType = 'tavuk'
            if (iName.includes('xl') || iName.includes('porsiyon') || iName.includes('pilav üstü')) itemMeatGrams = 150
            else itemMeatGrams = 100
          }

          if (meatType === 'et') {
            rangeEtDonerGrams += (itemMeatGrams * qty)
            categorySales['Et Döner'] = (categorySales['Et Döner'] || 0) + qty
          } else if (meatType === 'tavuk') {
            rangeTavukDonerGrams += (itemMeatGrams * qty)
            categorySales['Tavuk Döner'] = (categorySales['Tavuk Döner'] || 0) + qty
          } else if (iName.includes('ayran') || iName.includes('kola') || iName.includes('coca') || iName.includes('fanta') || iName.includes('sprite') || iName.includes('gazoz') || iName.includes('şalgam') || iName.includes('su') || iName.includes('soda') || iName.includes('fuse') || iName.includes('cappy') || iName.includes('ice tea') || iName.includes('icetea') || iName.includes('meyve')) {
            categorySales['İçecekler'] = (categorySales['İçecekler'] || 0) + qty
          } else if (iName.includes('patates') || iName.includes('künefe') || iName.includes('tatlı') || iName.includes('sütlaç') || iName.includes('baklava') || iName.includes('çorba') || iName.includes('salata') || iName.includes('sos') || iName.includes('nugget') || iName.includes('soğan halka') || iName.includes('menü')) {
            categorySales['Tatlı & Yan Ürünler'] = (categorySales['Tatlı & Yan Ürünler'] || 0) + qty
          } else {
            categorySales['Diğer'] = (categorySales['Diğer'] || 0) + qty
          }

          itemSales[name] = (itemSales[name] || 0) + qty
          itemRevenue[name] = (itemRevenue[name] || 0) + (price * qty)
        })
      }

      // Neighborhood
      let neighborhood = ''
      const rawAddr = order.address || order.deliveryAddress || {}
      if (rawAddr.neighborhood && typeof rawAddr.neighborhood === 'string' && rawAddr.neighborhood.trim()) {
        neighborhood = rawAddr.neighborhood.trim()
      } else if (order.neighborhood && typeof order.neighborhood === 'string' && order.neighborhood.trim()) {
        neighborhood = order.neighborhood.trim()
      } else {
        const fullAddrStr = `${rawAddr.address1 || ''} ${rawAddr.address2 || ''} ${rawAddr.addressDescription || ''} ${order.order_note || ''} ${order.notes || ''} ${typeof order.address === 'string' ? order.address : ''}`
        const match = fullAddrStr.match(/([A-Za-zÇĞİÖŞÜçğıöşü0-9\s]{2,25})\s*(?:Mahallesi|Mah\.|Mah|Mh\.|Mh)\b/i)
        if (match && match[1]) {
          let nName = match[1].trim()
          nName = nName.replace(/^(?:adres|yer|konum|sokak|cadde|cad|sok)\s*:\s*/i, '').trim()
          if (nName.length > 2) {
            neighborhood = `${nName.charAt(0).toUpperCase() + nName.slice(1)}`
          }
        } else if (order.customer_name && (order.customer_name.toLowerCase().includes('masa') || order.customer_name.toLowerCase().includes('salon'))) {
          neighborhood = 'Salon / Masalar'
        }
      }

      if (!neighborhood) {
        neighborhood = (order.platform === 'trendyol' || order.platform === 'yemeksepeti') ? 'Genel Paket Bölgesi' : 'Salon / Masalar'
      }

      if (neighborhood && neighborhood !== 'Salon / Masalar' && neighborhood !== 'Genel Paket Bölgesi' && neighborhood !== 'Belirtilmemiş') {
        if (!neighborhood.toLowerCase().includes('mah')) {
          neighborhood = `${neighborhood} Mah.`
        }
      }

      neighborhoodSales[neighborhood] = (neighborhoodSales[neighborhood] || 0) + 1

      // Payment
      const rawPayment = (order.payment?.paymentType || order.paymentMethod || order.paymentType || order.payment_method || '').toUpperCase()
      const orderNotes = (order.order_note || order.notes || '').toLowerCase()

      let paymentCategory = 'Online'
      if (rawPayment.includes('CASH') || rawPayment.includes('NAKIT') || rawPayment.includes('NAKİT') || orderNotes.includes('ödeme: nakit') || orderNotes.includes('kapıda nakit') || orderNotes.includes('nakit ödeme')) {
        paymentCategory = 'Nakit'
      } else if (rawPayment.includes('DOOR_CARD') || rawPayment.includes('CREDIT') || rawPayment.includes('POS') || orderNotes.includes('ödeme: pos') || orderNotes.includes('kapıda kart') || orderNotes.includes('kapıda pos') || orderNotes.includes('kartla ödeme')) {
        paymentCategory = 'POS / Kart'
      } else if (rawPayment.includes('SODEXO') || rawPayment.includes('MULTINET') || rawPayment.includes('SETCARD') || rawPayment.includes('TICKET') || rawPayment.includes('MEAL') || rawPayment.includes('METROPOL') || rawPayment.includes('EDENRED')) {
        paymentCategory = 'Yemek Kartı'
      } else if (rawPayment.includes('ONLINE') || rawPayment.includes('WALLET') || rawPayment.includes('CARD') || order.platform === 'trendyol' || order.platform === 'yemeksepeti') {
        paymentCategory = 'Online'
      } else {
        paymentCategory = 'Online'
      }

      if (!paymentSales[paymentCategory]) {
        paymentSales[paymentCategory] = { count: 0, total: 0 }
      }
      paymentSales[paymentCategory].count += 1
      paymentSales[paymentCategory].total += amt
    }
  }

  const allOrdersToProcess: any[] = [];
  const processedOrderKeys = new Set<string>();

  // 1. Process Trendyol API packages FIRST (they are the 100% authoritative source for Trendyol orders)
  if (platform === 'all' || platform === 'trendyol') {
    try {
      const supplierId = getTrendyolSupplierId();
      if (supplierId && shop.systemSettings.trendyolApiKey) {
        const tgoRes = await axios.get(`${getTgoBaseUrl()}/order/meal/suppliers/${supplierId}/packages?packageStatuses=Delivered`, { headers: getTgoHeaders() });
        if (tgoRes.data) {
          let contentArray = tgoRes.data.content || (tgoRes.data.data && tgoRes.data.data.content) || [];
          if (!contentArray && Array.isArray(tgoRes.data)) contentArray = tgoRes.data;
          if (Array.isArray(contentArray)) {
            contentArray.forEach((p: any) => {
              const pId = String(p.id || '');
              const pPkgId = String(p.packageId || '');
              const pOrderNum = String(p.orderNumber || '');

              const key = pOrderNum || pPkgId || pId;
              if (key && !processedOrderKeys.has(key)) {
                const items = (p.lines || []).map((l: any) => ({
                  name: l.name || 'Bilinmeyen',
                  quantity: l.quantity || 1,
                  price: l.price || 0
                }));
                const pkgDate = p.packageCreationDate || p.creationDate || p.deliveryDate || p.orderDate || p.modifyDate;
                allOrdersToProcess.push({
                  platform: 'trendyol',
                  status: 'Delivered',
                  id: p.id,
                  packageId: p.packageId,
                  orderNumber: p.orderNumber,
                  packageCreationDate: pkgDate,
                  creationDate: pkgDate,
                  orderDate: pkgDate,
                  completedAt: pkgDate,
                  total_amount: p.totalPrice || 0,
                  items: items,
                  address: p.address,
                  deliveryAddress: p.address,
                  payment: p.payment,
                  paymentMethod: p.payment?.paymentType
                });
                if (pId) processedOrderKeys.add(pId);
                if (pPkgId) processedOrderKeys.add(pPkgId);
                if (pOrderNum) processedOrderKeys.add(pOrderNum);
              }
            });
          }
        }
      }
    } catch(err) {
      console.error('Trendyol API delivered packages fetch error:', err);
    }
  }

  // 2. Process Local Shop Past & Active Orders - ONLY yemeksepeti platform orders
  //    POS/Salon orders from app1 are excluded from apiorders dashboard
  const localOrders = [...(shop.pastOrders || []), ...(shop.activeOrders || [])];
  localOrders.forEach(lo => {
    const loKey = String(lo.orderNumber || lo.order_id || lo.id || lo.packageId || '');
    
    // Skip if already processed via Trendyol API
    if (loKey && processedOrderKeys.has(loKey)) return;

    // Skip Trendyol orders (already handled by API above)
    if (lo.platform === 'trendyol' || (/^\d{10,12}$/.test(loKey) && loKey.startsWith('11'))) return;

    // Only include yemeksepeti local orders - skip POS/salon/empty platform
    const loPlatform = (lo.platform || '').toLowerCase();
    if (loPlatform !== 'yemeksepeti') return;

    if (loKey) {
      if (processedOrderKeys.has(loKey)) return;
      processedOrderKeys.add(loKey);
    }

    // Skip entries without valid amounts
    if ((!lo.items || !Array.isArray(lo.items) || lo.items.length === 0) && !lo.total_amount && !lo.totalPrice && !lo.total) {
      return;
    }

    allOrdersToProcess.push(lo);
  });

  allOrdersToProcess.forEach(processOrder);

  const sortedItems = Object.keys(itemSales).map(name => ({
    name,
    count: itemSales[name],
    revenue: itemRevenue[name]
  })).sort((a, b) => b.count - a.count)

  let favoriDoner = { name: '-', count: 0, revenue: 0 }
  let favoriUrun = { name: '-', count: 0, revenue: 0 }

  const donerItems = sortedItems.filter(i => i.name.toLowerCase().includes('döner') || i.name.toLowerCase().includes('iskender') || i.name.toLowerCase().includes('dürüm'))
  if (donerItems.length > 0) favoriDoner = donerItems[0]
  if (sortedItems.length > 0) favoriUrun = sortedItems[0]

  const trendArray = Array.from(trendDataMap.values()).sort((a, b) => a.ts - b.ts)

  const categories = Object.keys(categorySales).map(name => ({
    name, count: categorySales[name]
  })).filter(c => c.count > 0)

  // Neighborhood Breakdown Formatting
  const totalRangeOrders = Object.values(neighborhoodSales).reduce((a, b) => a + b, 0);
  const sortedNeighborhoods = Object.keys(neighborhoodSales).map(name => {
    const count = neighborhoodSales[name];
    const percent = totalRangeOrders > 0 ? ((count / totalRangeOrders) * 100).toFixed(1) : '0';
    return { name, count, percent };
  }).sort((a, b) => b.count - a.count);

  // Payment Methods Breakdown Formatting
  const totalPaymentOrders = Object.values(paymentSales).reduce((a, b) => a + b.count, 0);
  const paymentColorMap: Record<string, string> = {
    'Online': '#3b82f6',
    'Nakit': '#10b981',
    'POS / Kart': '#f59e0b',
    'Yemek Kartı': '#ec4899',
    'Diğer': '#8b5cf6'
  };

  const formattedPaymentData = Object.keys(paymentSales).map(name => {
    const item = paymentSales[name];
    const percent = totalPaymentOrders > 0 ? ((item.count / totalPaymentOrders) * 100).toFixed(1) : '0';
    return {
      name,
      count: item.count,
      total: item.total,
      percent,
      color: paymentColorMap[name] || '#a855f7'
    };
  }).filter(p => p.count > 0).sort((a, b) => b.count - a.count);

  let rangeRevenueChange = 0;
  if (previousRangeRevenue === 0 && rangeRevenue > 0) rangeRevenueChange = 100;
  else if (previousRangeRevenue > 0) rangeRevenueChange = ((rangeRevenue - previousRangeRevenue) / previousRangeRevenue) * 100;

  const rangeAverageOrderValue = rangeOrdersCount > 0 ? (rangeRevenue / rangeOrdersCount).toFixed(2) : '0.00';

  res.json({
    range,
    rangeRevenue,
    rangeOrdersCount,
    rangeRevenueChange: rangeRevenueChange.toFixed(1),
    rangeAverageOrderValue,
    rangeEtDonerKg: (rangeEtDonerGrams / 1000).toFixed(2),
    rangeTavukDonerKg: (rangeTavukDonerGrams / 1000).toFixed(2),

    todayRevenue,
    weekRevenue,
    monthRevenue,
    todayOrdersCount,
    weekOrdersCount,
    monthOrdersCount,
    todayEtDonerKg: (rangeEtDonerGrams / 1000).toFixed(2),
    todayTavukDonerKg: (rangeTavukDonerGrams / 1000).toFixed(2),
    averageOrderValue: rangeAverageOrderValue,

    favoriDoner,
    favoriUrun,
    topProducts: sortedItems.slice(0, 5),
    trendData: { 
      labels: trendArray.map(t => t.label), 
      data: trendArray.map(t => t.val) 
    },
    categoryData: categories,
    neighborhoodData: sortedNeighborhoods,
    paymentData: formattedPaymentData
  })
})

adminRouter.get('/admin/integration_settings', requireAdminAuth, async (req: any, res: any) => {
  try {
    const doc = await DataModel.findOne({ key: 'systemSettings' });
    const settings = doc?.value || {};
    res.json({
      trendyolSupplierId: settings.trendyolSupplierId || settings.TRENDYOL_SUPPLIER_ID || env.TRENDYOL_SUPPLIER_ID || '',
      trendyolApiKey: settings.trendyolApiKey || settings.TRENDYOL_API_KEY || env.TRENDYOL_API_KEY || '',
      trendyolApiSecret: settings.trendyolApiSecret || settings.TRENDYOL_API_SECRET || env.TRENDYOL_API_SECRET || '',
      trendyolEntgRefCode: settings.trendyolEntgRefCode || '',
      trendyolToken: settings.trendyolToken || '',
      trendyolApiEndpoint: settings.trendyolApiEndpoint || 'https://api.tgoapis.com/integrator',
      ysRestaurantId: settings.ysRestaurantId || '',
      ysApiKey: settings.ysApiKey || '',
      ysApiSecret: settings.ysApiSecret || ''
    });
  } catch(e) {
    res.status(500).json({ error: 'DB error' });
  }
});

adminRouter.post('/admin/integration_settings', requireAdminAuth, async (req: any, res: any) => {
  try {
    const payload = req.body;
    const doc = await DataModel.findOne({ key: 'systemSettings' });
    const current = doc?.value || {};
    const updated = {
      ...current,
      ...(payload.trendyolSupplierId !== undefined && { trendyolSupplierId: payload.trendyolSupplierId }),
      ...(payload.trendyolApiKey !== undefined && { trendyolApiKey: payload.trendyolApiKey }),
      ...(payload.trendyolApiSecret !== undefined && { trendyolApiSecret: payload.trendyolApiSecret }),
      ...(payload.trendyolEntgRefCode !== undefined && { trendyolEntgRefCode: payload.trendyolEntgRefCode }),
      ...(payload.trendyolToken !== undefined && { trendyolToken: payload.trendyolToken }),
      ...(payload.trendyolApiEndpoint !== undefined && { trendyolApiEndpoint: payload.trendyolApiEndpoint }),
      ...(payload.ysRestaurantId !== undefined && { ysRestaurantId: payload.ysRestaurantId }),
      ...(payload.ysApiKey !== undefined && { ysApiKey: payload.ysApiKey }),
      ...(payload.ysApiSecret !== undefined && { ysApiSecret: payload.ysApiSecret }),
      ...(payload.trendyolSupplierId !== undefined && { TRENDYOL_SUPPLIER_ID: payload.trendyolSupplierId }),
      ...(payload.trendyolApiKey !== undefined && { TRENDYOL_API_KEY: payload.trendyolApiKey }),
      ...(payload.trendyolApiSecret !== undefined && { TRENDYOL_API_SECRET: payload.trendyolApiSecret }),
    };
    await DataModel.findOneAndUpdate({ key: 'systemSettings' }, { value: updated }, { upsert: true });
    const shop = getShop();
    if (shop) shop.systemSettings = { ...shop.systemSettings, ...updated };
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: 'DB error' });
  }
});

adminRouter.get('/admin/integration_status', requireAdminAuth, async (req: any, res: any) => {
  const shop = getShop();
  const settings = shop.systemSettings || {};
  const supplierId = settings.trendyolSupplierId || env.TRENDYOL_SUPPLIER_ID || '6647850';
  
  let trendyolStatus = { status: 'not_configured', message: 'Bilgiler eksik' };
  
  if (supplierId && settings.trendyolApiKey && settings.trendyolApiSecret) {
    try {
      const endpoint = `${getTgoBaseUrl()}/order/meal/suppliers/${supplierId}/packages`;
      
      const headers = getTgoHeaders();
      const response = await axios.get(`${endpoint}?packageStatuses=Created&size=1`, { headers });
      
      if (response.status === 200) {
        trendyolStatus = { status: 'connected', message: 'Bağlı' };
      }
    } catch (error: any) {
      if (error.response) {
        if (error.response.status === 401) {
          trendyolStatus = { status: 'error', message: 'Hatalı API Bilgileri (401 Unauthorized)' };
        } else if (error.response.status === 404) {
          trendyolStatus = { status: 'error', message: 'Endpoint Bulunamadı (404 Not Found)' };
        } else if (error.response.status === 400) {
          trendyolStatus = { status: 'error', message: 'Hatalı Parametre (400 Bad Request)' };
        } else {
          trendyolStatus = { status: 'error', message: `Hata: ${error.response.status}` };
        }
      } else {
        trendyolStatus = { status: 'error', message: 'Bağlantı Hatası' };
      }
    }
  }

  res.json({
    trendyol: trendyolStatus,
    yemeksepeti: { status: 'not_configured', message: 'Yapılandırılmadı' }
  });
});

export default adminRouter;
