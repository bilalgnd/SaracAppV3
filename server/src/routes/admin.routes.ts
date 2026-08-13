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

adminRouter.get('/admin/dashboard_stats', requireAdminAuth, async (req: any, res: any) => {
  const platform = (req.query.platform || 'all').toLowerCase()
  const range = (req.query.range || 'daily').toLowerCase()

  const now = new Date()

  let chartStartDate = new Date()
  if (range === 'hourly') {
    chartStartDate.setHours(now.getHours() - 24)
  } else if (range === 'weekly') {
    chartStartDate.setDate(now.getDate() - 7)
  } else if (range === 'monthly') {
    chartStartDate.setDate(now.getDate() - 30)
  } else {
    chartStartDate.setHours(0, 0, 0, 0)
  }

  let todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  let weekStart = new Date(now)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - 7)
  let monthStart = new Date(now)
  monthStart.setHours(0, 0, 0, 0)
  monthStart.setDate(monthStart.getDate() - 30)
  let previousTodayStart = new Date(todayStart)
  previousTodayStart.setDate(previousTodayStart.getDate() - 1)

  let todayRevenue = 0, weekRevenue = 0, monthRevenue = 0, previousTodayRevenue = 0
  let todayOrdersCount = 0, weekOrdersCount = 0, monthOrdersCount = 0

  let todayEtDonerGrams = 0
  let todayTavukDonerGrams = 0
  let rangeEtDonerGrams = 0
  let rangeTavukDonerGrams = 0

  let itemSales: Record<string, number> = {}
  let itemRevenue: Record<string, number> = {}
  let categorySales: Record<string, number> = { 'Et Döner': 0, 'Tavuk Döner': 0, 'İçecekler': 0, 'Tatlı & Yan Ürünler': 0, 'Diğer': 0 }

  const trendDataMap = new Map<string, { label: string, val: number, ts: number }>()

  const shop = getShop()

  const processOrder = (order: any) => {
    const orderPlatform = (order.platform || '').toLowerCase()
    if (platform === 'trendyol' && orderPlatform !== 'trendyol') return
    if (platform === 'yemeksepeti' && orderPlatform !== 'yemeksepeti') return
    if (platform === 'all' && orderPlatform !== 'trendyol' && orderPlatform !== 'yemeksepeti') return

    if (!order.completedAt && order.status !== 'waiting' && order.status !== 'Hazırlanıyor') return
    const oDate = order.completedAt ? new Date(order.completedAt) : new Date()

    const amt = order.total_amount || order.totalPrice || 0;

    if (oDate >= todayStart && oDate <= now) {
      todayRevenue += amt
      todayOrdersCount++
    }
    if (oDate >= previousTodayStart && oDate < todayStart) {
      previousTodayRevenue += amt
    }
    if (oDate >= weekStart && oDate <= now) {
      weekRevenue += amt
      weekOrdersCount++
    }
    if (oDate >= monthStart && oDate <= now) {
      monthRevenue += amt
      monthOrdersCount++
    }

    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item: any) => {
        const qty = item.quantity || 1
        const name = item.name || 'Bilinmeyen'
        const price = item.price || 0
        const iName = name.toLowerCase()

        let meatType = 'none';
        let itemMeatGrams = 0;

        if (iName.includes('et') || iName.includes('iskender') || iName.includes('beyti') || iName.includes('biftek')) {
          meatType = 'et';
          if (iName.includes('duble') || iName.includes('250g')) itemMeatGrams = 250;
          else if (iName.includes('iskender') || iName.includes('beyti') || iName.includes('porsiyon') || iName.includes('pilav üstü') || iName.includes('xl')) itemMeatGrams = 150;
          else itemMeatGrams = 100;
        } else if (iName.includes('tavuk') || iName.includes('biga') || iName.includes('zurna')) {
          meatType = 'tavuk';
          if (iName.includes('xl') || iName.includes('porsiyon') || iName.includes('pilav üstü')) itemMeatGrams = 150;
          else itemMeatGrams = 100;
        }

        if (oDate >= todayStart && oDate <= now) {
          if (meatType === 'et') {
             todayEtDonerGrams += (itemMeatGrams * qty);
          } else if (meatType === 'tavuk') {
             todayTavukDonerGrams += (itemMeatGrams * qty);
          }
        }

        if (oDate >= chartStartDate && oDate <= now) {
          itemSales[name] = (itemSales[name] || 0) + qty
          itemRevenue[name] = (itemRevenue[name] || 0) + (price * qty)

          if (meatType === 'et') {
            categorySales['Et Döner'] += qty
            rangeEtDonerGrams += (itemMeatGrams * qty)
          } else if (meatType === 'tavuk') {
            categorySales['Tavuk Döner'] += qty
            rangeTavukDonerGrams += (itemMeatGrams * qty)
          } else if (iName.includes('ayran') || iName.includes('kola') || iName.includes('coca') || iName.includes('fanta') || iName.includes('sprite') || iName.includes('gazoz') || iName.includes('şalgam') || iName.includes('su') || iName.includes('soda') || iName.includes('fuse') || iName.includes('cappy') || iName.includes('ice tea') || iName.includes('icetea') || iName.includes('meyve')) {
            categorySales['İçecekler'] += qty
          } else if (iName.includes('patates') || iName.includes('künefe') || iName.includes('tatlı') || iName.includes('sütlaç') || iName.includes('baklava') || iName.includes('çorba') || iName.includes('salata') || iName.includes('sos') || iName.includes('nugget') || iName.includes('soğan halka') || iName.includes('menü')) {
            categorySales['Tatlı & Yan Ürünler'] += qty
          } else {
            categorySales['Diğer'] += qty
          }
        }
      })
    }

    if (oDate >= chartStartDate && oDate <= now) {
      let label = ''
      let ts = 0
      if (range === 'hourly') {
        const h = oDate.getHours()
        label = h + ':00'
        ts = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 0, 0).getTime()
        if (ts > now.getTime()) ts -= 24 * 60 * 60 * 1000
      } else {
        label = `${oDate.getDate()} ${['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'][oDate.getMonth()]}`
        ts = new Date(oDate.getFullYear(), oDate.getMonth(), oDate.getDate()).getTime()
      }

      if (!trendDataMap.has(label)) {
        trendDataMap.set(label, { label, val: 0, ts })
      }
      trendDataMap.get(label)!.val += amt
    }
  }

  const allOrdersToProcess: any[] = [];
  shop.pastOrders.forEach(o => allOrdersToProcess.push(o));
  shop.activeOrders.forEach(o => allOrdersToProcess.push(o));

  if (platform === 'all' || platform === 'trendyol') {
    try {
      const supplierId = getTrendyolSupplierId();
      if (supplierId && shop.systemSettings.trendyolApiKey) {
        const tgoRes = await axios.get(`${getTgoBaseUrl()}/order/meal/suppliers/${supplierId}/packages?packageStatuses=Delivered`, { headers: getTgoHeaders() });
        if (tgoRes.data) {
          let contentArray = tgoRes.data.content || (tgoRes.data.data && tgoRes.data.data.content) || [];
          if (!contentArray && Array.isArray(tgoRes.data)) contentArray = tgoRes.data;
          
          if (Array.isArray(contentArray)) {
            contentArray.forEach((o: any) => {
              const items = (o.lines || []).map((l: any) => ({
                name: l.name || 'Bilinmeyen',
                quantity: l.quantity || 1,
                price: l.price || 0
              }));
              
              const existsLocally = allOrdersToProcess.some(lo => lo.order_id === o.id || lo.order_id === String(o.id) || lo.id === o.id || lo.id === String(o.id));
              if (!existsLocally) {
                allOrdersToProcess.push({
                  platform: 'trendyol',
                  status: 'Delivered',
                  completedAt: o.packageCreationDate || o.creationDate || o.deliveredDate || new Date(),
                  total_amount: o.totalPrice || 0,
                  items: items
                });
              }
            });
          }
        }
      }
    } catch(err) {
      console.error('Trendyol API past orders fetch error:', err);
    }
  }

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

  let revenueChange = 0;
  if (previousTodayRevenue === 0 && todayRevenue > 0) revenueChange = 100;
  else if (previousTodayRevenue > 0) revenueChange = ((todayRevenue - previousTodayRevenue) / previousTodayRevenue) * 100;

  res.json({
    todayRevenue,
    weekRevenue,
    monthRevenue,
    revenueChange: revenueChange.toFixed(1),
    todayOrdersCount,
    weekOrdersCount,
    monthOrdersCount,
    averageOrderValue: todayOrdersCount === 0 ? 0 : (todayRevenue / todayOrdersCount).toFixed(2),
    todayEtDonerKg: (todayEtDonerGrams / 1000).toFixed(2),
    todayTavukDonerKg: (todayTavukDonerGrams / 1000).toFixed(2),
    rangeEtDonerKg: (rangeEtDonerGrams / 1000).toFixed(2),
    rangeTavukDonerKg: (rangeTavukDonerGrams / 1000).toFixed(2),
    favoriDoner,
    favoriUrun,
    topProducts: sortedItems.slice(0, 5),
    trendData: { 
      labels: trendArray.map(t => t.label), 
      data: trendArray.map(t => t.val) 
    },
    categoryData: categories
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
