import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'
import axios from 'axios'
import { ActivityLogModel, ShopState, shops, getShop, shopContext } from './models'
import { initializeApp, cert } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { join, dirname } from 'path'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { startBotService } from './services/botService'
import * as fs from 'fs'
import * as path from 'path'

import { z } from 'zod'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';


if (!getShop().systemSettings['API_TOKEN']) {
  getShop().systemSettings['API_TOKEN'] = '123456'
  getShop().saveSettings()
}
const API_TOKEN = getShop().systemSettings['API_TOKEN']

export function getActiveShop(req: any) {
  if (req && req.user && req.user.shopId) {
    const { ShopState } = require('./models');
    if (!shops.has(req.user.shopId)) shops.set(req.user.shopId, new ShopState(req.user.shopId));
    return shops.get(req.user.shopId) || getShop();
  }
  return getShop();
}
export interface SystemLog {
  time: string;
  source: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}
export const systemLogs: SystemLog[] = [];

export function addSystemLog(source: string, type: 'success' | 'error' | 'warning' | 'info', message: string) {
  systemLogs.unshift({
    time: new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    source,
    type,
    message
  });
  if (systemLogs.length > 100) systemLogs.pop();
}


let fcmTokens: string[] = []
try {
  fcmTokens = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'fcm_tokens.json'), 'utf-8'))
} catch (e) {
  fcmTokens = []
}

function saveFcmTokens() {
  try {
    if (!fs.existsSync(path.join(__dirname, '..', 'data'))) {
      fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true })
    }
    fs.writeFileSync(path.join(__dirname, '..', 'data', 'fcm_tokens.json'), JSON.stringify(fcmTokens))
  } catch (e) { }
}

try {
  const serviceAccount = require('../firebase-adminsdk.json')
  initializeApp({
    credential: cert(serviceAccount)
  })
  console.log('Firebase Admin initialized.')
} catch (e: any) {
  console.log('Firebase Admin init failed (missing firebase-adminsdk.json maybe?)', e.message)
}

const app = express()
app.use(express.json())

app.get('/api/admin/fcm_tokens', (req, res) => res.json({ tokens: fcmTokens }))

app.post('/api/register_fcm_token', (req, res) => {
  const { token } = req.body
  if (token && !fcmTokens.includes(token)) {
    fcmTokens.push(token)
    saveFcmTokens()
    console.log('New FCM token registered:', token)
  }
  res.json({ success: true })
})

app.use((req, res, next) => {
  let shopId = 'admin';
  const authHeader = req.headers['authorization'];
  let tokenToVerify = null;

  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      tokenToVerify = authHeader.split(' ')[1];
    } else {
      shopId = authHeader; // legacy API_TOKEN or explicit shopId
    }
  } else if (req.query.token) {
    tokenToVerify = req.query.token as string;
  } else if (req.query.shopId) {
    shopId = req.query.shopId as string;
  } else if (req.query.state) {
    shopId = req.query.state as string;
  }

  if (tokenToVerify) {
    if (tokenToVerify.length > 20) {
      try {
        const decoded: any = jwt.verify(tokenToVerify, JWT_SECRET);
        shopId = decoded.username || 'admin';
      } catch (e) {}
    } else {
      shopId = tokenToVerify;
    }
  }

  shopContext.run(shopId, () => next());
})


// Restrict CORS
app.use((req, res, next) => {
  const origin = req.headers.origin
  // In a local network, Origin might be null or match local IPs
  res.header("Access-Control-Allow-Origin", origin || "*")
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization")
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
    return
  }
  next()
})

app.get('/admintools', (_req, res) => {
  res.sendFile(join(__dirname, '../public/templates/admintools.html'))
})

const requireAdminAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization']
  const adminPassword = process.env.ADMIN_TOOLS_PASSWORD || 'default_admin';
  if (!authHeader || authHeader !== adminPassword) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

app.get('/api/admin/users', requireAdminAuth, async (_req: any, res: any) => {
  const { UserModel } = require('./models')
  const users = await UserModel.find({}, { password_hash: 0 })
  res.json({ users, allowRegistration: getShop().systemSettings['ALLOW_REGISTRATION'] || false })
})

app.post('/api/admin/delete_user', requireAdminAuth, async (req: any, res: any) => {
  const { id } = req.body
  const { UserModel } = require('./models')
  await UserModel.findByIdAndDelete(id)
  res.json({ success: true })
})

app.post('/api/admin/toggle_registration', requireAdminAuth, async (req: any, res: any) => {
  const { allow } = req.body
  getShop().systemSettings['ALLOW_REGISTRATION'] = allow
  getShop().saveSettings()
  res.json({ success: true, allowRegistration: allow })
})


app.get('/api/boss-token', (req: any, res: any): any => {
  const secret = req.headers['x-boss-secret']
  if (secret === (process.env.BOSS_SECRET || 'boss')) {
    res.json({ token: getShop().systemSettings.API_TOKEN })
  } else {
    res.status(401).json({ error: 'Unauthorized' })
  }
})

app.get('/api/export_menu', requireAuth, (req: any, res: any) => {
  res.json({
    customMenu: getShop().customMenu,
    priceMemory: getShop().priceMemory
  })
})

app.post('/api/import_menu', requireAuth, (req: any, res: any) => {
  const { customMenu, priceMemory } = req.body
  const shop = getShop()
  if (customMenu) shop.customMenu = customMenu
  if (priceMemory) shop.priceMemory = priceMemory
  shop.saveToDB('customMenu', shop.customMenu)
  shop.saveToDB('priceMemory', shop.priceMemory)
  
  res.json({ success: true })
  notifyUI('request_update')
})

app.post('/api/admin/create_user', requireAdminAuth, async (req: any, res: any) => {
  try {
    const { username, password, role } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' })
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Şifre en az 8 karakter olmalıdır' })
    }

    const { UserModel } = require('./models')
    
    const assignedRole = role || 'garson'

    const salt = await bcrypt.genSalt(10)
    const password_hash = await bcrypt.hash(password, salt)

    const account_id = 'ACC-' + Math.random().toString(36).substring(2, 8).toUpperCase()

    const user = new UserModel({ username, password_hash, role: assignedRole, account_id })
    await user.save()

    const { ShopState, shops } = require('./models')
    const shop = new ShopState(username)
    await shop.initialize()
    shops.set(username, shop)

    res.json({ success: true, message: 'User registered successfully' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/admin/update_user', requireAdminAuth, async (req: any, res: any) => {
  try {
    const { targetUsername, newPassword, newRole, newStatus } = req.body
    if (!targetUsername) return res.status(400).json({ error: 'targetUsername required' })
    if (targetUsername === 'bilalgnd' && newStatus === 'suspended') return res.status(403).json({ error: 'Cannot suspend main admin' })

    const { UserModel, ActivityLogModel } = require('./models')
    const user = await UserModel.findOne({ username: targetUsername })
    if (!user) return res.status(404).json({ error: 'User not found' })

    if (newPassword && newPassword.length >= 8) {
      const salt = await bcrypt.genSalt(10)
      user.password_hash = await bcrypt.hash(newPassword, salt)
    }
    if (newRole) user.role = newRole
    if (newStatus) user.status = newStatus

    await user.save()
    
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

app.post('/api/admin/kick_user', requireAdminAuth, async (req: any, res: any) => {
  try {
    const { targetUsername } = req.body
    if (!targetUsername) return res.status(400).json({ error: 'targetUsername required' })
    
    let kickedCount = 0;
    wss.clients.forEach(client => {
      const c = client as any;
      if (c.username === targetUsername) {
        c.send(JSON.stringify({ type: 'server-event', action: 'force_logout' }));
        c.close();
        kickedCount++;
      }
    });

    const { ActivityLogModel } = require('./models')
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

app.get('/api/admin/user_logs/:username', requireAdminAuth, async (req: any, res: any) => {
  try {
    const { username } = req.params
    const { ActivityLogModel } = require('./models')
    const logs = await ActivityLogModel.find({ username }).sort({ createdAt: -1 }).limit(100)
    res.json(logs)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/login', async (req: any, res: any) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' })
    }

    const { UserModel } = require('./models')
    const user = await UserModel.findOne({ username })
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Hesabınız yönetici tarafından askıya alınmıştır.' })
    }

    const isMatch = await bcrypt.compare(password, user.password_hash)
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    user.lastSeen = new Date()
    await user.save()

    const token = jwt.sign({ id: user._id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '30d' })
    res.json({ success: true, token, role: user.role, username: user.username })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/auth/refresh', requireAuth, async (req: any, res: any) => {
  try {
    const shopId = shopContext.getStore() || 'admin';
    const user = (req as any).user;
    
    if (user && user.username) {
      const { UserModel } = require('./models');
      const dbUser = await UserModel.findOne({ username: user.username });
      if (dbUser) {
        if (dbUser.status === 'suspended') {
          return res.status(403).json({ error: 'Hesabınız askıya alınmıştır' });
        }
        dbUser.lastSeen = new Date();
        await dbUser.save();
      }
    }

    // If authenticated via JWT, issue a new one
    if (user && user.id) {
      const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
      res.json({ success: true, token, role: user.role, username: user.username });
    } else {
      // Authenticated via API_TOKEN, just return success
      res.json({ success: true, token: getShop().systemSettings['API_TOKEN'], role: 'admin', username: shopId });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization']
  if (!authHeader) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  
  const token = authHeader.split(' ')[1] || authHeader

  // JWT Verification
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET)
    ;(req as any).user = decoded
    return shopContext.run(decoded.username, () => {
      next()
    })
  } catch (err) {
    // Fallback: Check if token matches any shop's API_TOKEN
    const { shops, getShop } = require('./models')
    if (token === getShop().systemSettings.API_TOKEN) {
      return shopContext.run('admin', () => next())
    }
    for (const [sId, shop] of shops.entries()) {
      if (shop.systemSettings && shop.systemSettings['API_TOKEN'] === token) {
        return shopContext.run(sId, () => {
          next()
        })
      }
    }
    res.status(401).json({ error: 'Invalid token' })
  }
}

function idempotencyMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const idempotencyKey = req.headers['x-idempotency-key'] as string;
  if (!idempotencyKey) {
    return next();
  }
  
  const shop = getShop();
  if (shop.processedIdempotencyKeys.has(idempotencyKey)) {
    return res.status(200).json({ success: true, duplicate: true, message: 'Already processed' });
  }
  
  shop.processedIdempotencyKeys.add(idempotencyKey);
  if (shop.processedIdempotencyKeys.size > 1000) {
    const firstKey = shop.processedIdempotencyKeys.values().next().value;
    if (firstKey) shop.processedIdempotencyKeys.delete(firstKey);
  }
  
  next();
}

app.get('/api/settings', requireAuth, (_req, res) => {
  res.json(getShop().systemSettings)
})

app.get('/api/logs', (_req, res) => {
  res.json(systemLogs)
})

const webDir = join(__dirname, '../public')

app.use('/static', express.static(join(webDir, 'static')))

app.use('/pos', express.static(join(webDir, 'pos_app'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
    }
  }
}))
app.get(/^\/pos(\/.*)?$/, (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.sendFile(join(webDir, 'pos_app', 'index.html'))
})

app.use('/qr', express.static(join(webDir, 'qr_app'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
    }
  }
}))
app.get(/^\/qr(\/.*)?$/, (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.sendFile(join(webDir, 'qr_app', 'index.html'))
})

app.get('/', (_req, res) => {
  res.sendFile(join(webDir, 'templates/portfolio.html'))
})

app.get('/tv', (_req, res) => {
  res.sendFile(join(webDir, 'templates/tv.html'))
})

app.get('/tv-:shopId', (_req, res) => {
  res.sendFile(join(webDir, 'templates/tv.html'))
})

app.get('/tv_settings', (_req, res) => {
  res.json({ youtube_url: getShop().systemSettings["YOUTUBE_LINK"] || "" })
})

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })


export function broadcastUpdateToPhones(shop?: any) {
  const targetShop = shop || getShop()
  const data = JSON.stringify(targetShop.activeOrders)
  targetShop.connectedPhones.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    } else {
      targetShop.connectedPhones.delete(ws)
    }
  })
}

export function getConnectedPhones(): string[] {
  const counts: Record<string, number> = {}
  getShop().connectedPhones.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      const username = (ws as any).username
      let id = ''
      if (username) {
        id = username
      } else {
        const deviceId = (ws as any).deviceId
        if (deviceId) {
          id = deviceId
        } else {
          const ip = (ws as any)._socket?.remoteAddress || 'Bilinmeyen IP'
          id = ip.replace('::ffff:', '')
        }
      }
      counts[id] = (counts[id] || 0) + 1
    }
  })
  
  return Object.entries(counts).map(([id, count]) => count > 1 ? `${id} (${count} aktif bağlantı)` : id)
}

export function broadcastMessageToPhones(messageObj: any, shop?: any) {
  const targetShop = shop || getShop()
  const data = JSON.stringify(messageObj)
  targetShop.connectedPhones.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  })
}

export function notifyUI(action: string, data?: any, shop?: any) {
  broadcastMessageToPhones({ type: 'server-event', action, data }, shop)
}

wss.on('connection', (ws, req) => {
  const urlParams = new URLSearchParams(req.url?.split('?')[1] || '')
  const token = urlParams.get('token')
  const explicitShopId = urlParams.get('shopId')
  const isTv = urlParams.get('tv') === 'true'
  
  let shopId: string | null = null;
  let jwtDecoded: any = null;
  const deviceId = urlParams.get('deviceId');

  if (token) {
    if (token.length > 20) {
      try {
        jwtDecoded = jwt.verify(token, JWT_SECRET);
        shopId = jwtDecoded.username;
      } catch (e) {}
    }
    if (!jwtDecoded) {
      for (const [sId, shop] of shops.entries()) {
        if (shop.systemSettings['API_TOKEN'] === token) {
          shopId = sId;
          break;
        }
      }
    }
  } else if (explicitShopId) {
    shopId = explicitShopId;
  } else if (isTv && req.url?.includes('admin')) {
      shopId = 'admin';
  }

  if (!shopId) {
    ws.close(1008, 'Unauthorized');
    return;
  }
  
  (ws as any).deviceId = deviceId;
  
  shopContext.run(shopId, () => {
      if (!isTv) {
        if (!jwtDecoded && token !== getShop().systemSettings.API_TOKEN) {
          console.log('Phone rejected (Invalid Token)', 'received:', token)
          ws.close(1008, 'Unauthorized')
          return
        }
        if (jwtDecoded) {
          ;(ws as any).username = jwtDecoded.username
        }
      }

      console.log('Phone connected')
      getShop().connectedPhones.add(ws)
      addSystemLog(isTv ? 'TV_EKRAN' : (jwtDecoded ? 'KULLANICI_MOBIL' : 'POS_APP'), 'success', 'Sunucuya başarıyla bağlandı.');
      ws.send(JSON.stringify(getShop().activeOrders)) // Send initial state to phone
      notifyUI('request_update')
      
      ;(ws as any).isAlive = true;
      ws.on('pong', () => {
        shopContext.run(shopId, () => {
          ;(ws as any).isAlive = true;
        });
      });
      
      ws.on('message', () => {
        // Heartbeat or incoming message from ws
      })

      ws.on('close', () => {
        shopContext.run(shopId, () => {
          console.log('Phone disconnected')
          addSystemLog(isTv ? 'TV_EKRAN' : (jwtDecoded ? 'KULLANICI_MOBIL' : 'POS_APP'), 'warning', 'Sunucu ba\u011Flant\u0131s\u0131 koptu.');
          getShop().connectedPhones.delete(ws)
        });
      })
    });
})

setInterval(() => {
  for (const shop of shops.values()) {
    shop.connectedPhones.forEach((ws) => {
      if ((ws as any).isAlive === false) {
        shop.connectedPhones.delete(ws);
        return ws.terminate();
      }
      (ws as any).isAlive = false;
      ws.ping();
    });
  }
}, 30000);

// --- Global Daily Total State ---
let globalDailyTotal = getShop().systemSettings['dailyTotal'] || 0

export function setGlobalDailyTotal(total: number) {
  globalDailyTotal = total
  getShop().systemSettings['dailyTotal'] = total
  getShop().saveSettings()
}

app.post('/update_daily_total', requireAuth, (req: any, res: any): any => {
  if (req.body && req.body.total !== undefined) {
    globalDailyTotal = req.body.total
    getShop().systemSettings['dailyTotal'] = globalDailyTotal
    getShop().saveSettings()
  }
  res.json({ success: true })
})

app.get('/daily_total', (_req, res) => {
  res.json({ 
    total: globalDailyTotal,
    screensaver: getShop().systemSettings['TV_SCREENSAVER'] || 'dvd'
  })
})

app.post('/api/clear_data', (req: any, res) => {
  const shop = getActiveShop(req)
  shop.pastOrders.length = 0
  shop.savePastOrders()
  res.json({ success: true })
})

app.post('/api/clean_logs', requireAuth, (req: any, res: any) => {
  notifyUI('clean_logs')
  res.json({ success: true })
})

app.get('/api/past_orders', requireAuth, (req: any, res) => {
  // Return the last 500 past orders
  res.json(getActiveShop(req).pastOrders.slice(0, 500))
})

app.get('/menu', requireAuth, (req: any, res) => {
  res.json(getActiveShop(req).getFullMenu())
})

app.post('/menu', requireAuth, (req: any, res: any): any => {
  if (req.body) {
    getActiveShop(req).updateCustomMenu(req.body)
    res.json({ success: true })
  } else {
    res.status(400).json({ error: 'Body required' })
  }
})

app.get('/api/active_orders', requireAuth, (req: any, res) => {
  res.json(getActiveShop(req).activeOrders)
})

app.post('/api/sync_orders', requireAuth, idempotencyMiddleware, async (req: any, res: any): Promise<any> => {
  console.log('SYNC_ORDERS CALLED:', req.body ? 'Has body' : 'No body', Array.isArray(req.body) ? 'Array' : 'Object')
  if (Array.isArray(req.body)) {
    const shop = getActiveShop(req)
    shop.activeOrders.length = 0
    shop.activeOrders.push(...req.body)
    shop.saveOrders()
    broadcastUpdateToPhones(shop)
    notifyUI('orders_update', null, shop)

    const { ActivityLogModel } = require('./models')
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

// QR Order Public Endpoints
app.get('/api/public/menu', (req: any, res: any) => {
  let activeShop = getShop()
  const { shops, ShopState } = require('./models')
  
  if (req.query.shop) {
    if (!shops.has(req.query.shop)) shops.set(req.query.shop, new ShopState(req.query.shop))
    activeShop = shops.get(req.query.shop)
  } else {
    if (!shops.has('sarac')) shops.set('sarac', new ShopState('sarac'))
    activeShop = shops.get('sarac')
  }
  
  res.json(activeShop.getFullMenu())
})

app.post('/api/public/submit_order', (req: any, res: any) => {
  const { customerName, items, totalAmount } = req.body
  
  if (!customerName || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Invalid order data' })
  }

  let shop = getShop()
  const { shops, ShopState } = require('./models')
  
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
    time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
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

  const { ActivityLogModel, shopContext } = require('./models')
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

app.get('/api/public/order_status', (req: any, res: any) => {
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'ID required' })

  let shop = getShop()
  const { shops, ShopState } = require('./models')
  
  if (req.query.shop) {
    if (!shops.has(req.query.shop)) shops.set(req.query.shop, new ShopState(req.query.shop))
    shop = shops.get(req.query.shop)
  } else {
    if (!shops.has('sarac')) shops.set('sarac', new ShopState('sarac'))
    shop = shops.get('sarac')
  }

  // Check active orders
  const active = shop.activeOrders.find(o => o.id === id)
  if (active) {
    return res.json({ status: active.status })
  }

  // Check past orders
  const past = shop.pastOrders.find(o => o.id === id)
  if (past) {
    return res.json({ status: past.status })
  }

  res.status(404).json({ error: 'Order not found' })
})

app.post('/api/public/call_waiter', (req: any, res: any) => {
  const { id } = req.body
  if (!id) return res.status(400).json({ error: 'ID required' })

  let shop = getShop()
  const { shops, ShopState } = require('./models')
  
  if (req.body.shop) {
    if (!shops.has(req.body.shop)) shops.set(req.body.shop, new ShopState(req.body.shop))
    shop = shops.get(req.body.shop)
  } else {
    if (!shops.has('sarac')) shops.set('sarac', new ShopState('sarac'))
    shop = shops.get('sarac')
  }

  const active = shop.activeOrders.find(o => o.id === id)
  if (!active) return res.status(404).json({ error: 'Active order not found' })

  if (fcmTokens.length > 0) {
    const message = {
      notification: {
        title: 'Garson Çağrısı!',
        body: `${active.customer_name} masasından garson çağrılıyor!`
      },
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

app.get('/api/daily_report', (req: any, res: any): any => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  let targetDateOnly = today
  let isSpecificDate = false

  const queryDate = req.query.date as string
  if (queryDate && queryDate.match(/^\d{2} \d{2} \d{4}$/)) {
    isSpecificDate = true
    const [dd, mm, yyyy] = queryDate.split(' ').map(Number)
    targetDateOnly = new Date(yyyy, mm - 1, dd)
  }

  const boundaryDate = new Date(today)
  boundaryDate.setDate(today.getDate() - 6)

  let bugunkuCiro = 0
  let haftalikCiro = 0
  let bugunkuSiparis = 0
  let haftalikSiparis = 0
  let bugunkuIptaller = 0
  let bugunkuEtGrams = 0
  let bugunkuTavukGrams = 0

  const urunSatisAdetleri: Record<string, number> = {}
  const dateSet = new Set<string>()

  let etAdet = 0
  let tavukAdet = 0

  getShop().pastOrders.forEach(order => {
    if (!order.completedAt) return
    const orderDate = new Date(order.completedAt)
    const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate())
    
    // Add to available dates
    const dStr = `${orderDate.getDate().toString().padStart(2, '0')} ${(orderDate.getMonth() + 1).toString().padStart(2, '0')} ${orderDate.getFullYear()}`
    dateSet.add(dStr)

    let isPrimaryDay = false
    let isWithinRange = false
    
    if (isSpecificDate) {
      isPrimaryDay = orderDateOnly.getTime() === targetDateOnly.getTime()
      isWithinRange = isPrimaryDay
    } else {
      isPrimaryDay = orderDateOnly.getTime() === today.getTime()
      isWithinRange = orderDateOnly >= boundaryDate && orderDateOnly <= today
    }

    if (isWithinRange) {
      if (order.status && order.status.toLowerCase().includes('iptal')) {
        if (isPrimaryDay) bugunkuIptaller++
      } else if (order.status && order.status.toLowerCase().includes('tamamlan')) {
        haftalikCiro += order.total_amount || 0
        haftalikSiparis++
        
        if (isPrimaryDay) {
          bugunkuCiro += order.total_amount || 0
          bugunkuSiparis++
        }

        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            const qty = item.quantity || 1
            const name = item.name || 'Bilinmeyen'

            if (isPrimaryDay) {
              urunSatisAdetleri[name] = (urunSatisAdetleri[name] || 0) + qty
              const iName = name.toLowerCase()
              let g = 0
              const mP = (item.portion || '').match(/(\d+)gr/i)
              const mN = name.match(/(\d+)gr/i)
              if (mP) g = parseInt(mP[1], 10)
              else if (mN) g = parseInt(mN[1], 10)
              else if (iName.includes('kampy') || iName.includes('biga')) g = 100
              else if (iName.includes('iskender') || iName.includes('beyti')) g = 150

              if (iName.includes('tavuk')) {
                bugunkuTavukGrams += g * qty
                tavukAdet += qty
              } else if (iName.includes('et') || iName.includes('iskender') || iName.includes('beyti')) {
                bugunkuEtGrams += g * qty
                etAdet += qty
              }
            }
          })
        }
      }
    }
  })

  getShop().activeOrders.forEach(order => {
      let isPrimaryDay = false
      if (isSpecificDate) {
        // active orders are today
        isPrimaryDay = today.getTime() === targetDateOnly.getTime()
      } else {
        isPrimaryDay = true
      }

      haftalikCiro += order.total_amount || 0
      haftalikSiparis++
      
      if (isPrimaryDay) {
        bugunkuCiro += order.total_amount || 0
        bugunkuSiparis++
      }
      
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          const qty = item.quantity || 1
          const name = item.name || 'Bilinmeyen'

          if (isPrimaryDay) {
            urunSatisAdetleri[name] = (urunSatisAdetleri[name] || 0) + qty
            const iName = name.toLowerCase()
            let g = 0
            const mP = (item.portion || '').match(/(\d+)gr/i)
            const mN = name.match(/(\d+)gr/i)
            if (mP) g = parseInt(mP[1], 10)
            else if (mN) g = parseInt(mN[1], 10)
            else if (iName.includes('kampy') || iName.includes('biga')) g = 100
            else if (iName.includes('iskender') || iName.includes('beyti')) g = 150

            if (iName.includes('tavuk')) {
              bugunkuTavukGrams += g * qty
              tavukAdet += qty
            } else if (iName.includes('et') || iName.includes('iskender') || iName.includes('beyti')) {
              bugunkuEtGrams += g * qty
              etAdet += qty
            }
          }
        })
      }
  })

  let favoriUrun = { ad: "Veri Yok", satis: 0 }

  for (const [name, qty] of Object.entries(urunSatisAdetleri)) {
    if (qty > favoriUrun.satis) {
      favoriUrun = { ad: name, satis: qty }
    }
  }

  let favoriDoner = { ad: "Veri Yok", satis: 0 }
  if (etAdet > 0 || tavukAdet > 0) {
    if (etAdet > tavukAdet) {
      favoriDoner = { ad: "Et Döner", satis: etAdet }
    } else if (tavukAdet > etAdet) {
      favoriDoner = { ad: "Tavuk Döner", satis: tavukAdet }
    } else {
      favoriDoner = { ad: "Et & Tavuk Döner", satis: etAdet }
    }
  }

  if (favoriDoner.satis === 0 && favoriUrun.satis > 0) {
     favoriDoner = favoriUrun
  }

  const availableDates = Array.from(dateSet).sort((a, b) => {
    const parse = (str: string) => { const parts = str.split(' '); return new Date(Number(parts[2]), Number(parts[1])-1, Number(parts[0])).getTime() }
    return parse(b) - parse(a)
  })

  const ortalamaSepetTutari = bugunkuSiparis > 0 ? bugunkuCiro / bugunkuSiparis : 0
  const fireOrani = bugunkuSiparis + bugunkuIptaller > 0 ? (bugunkuIptaller / (bugunkuSiparis + bugunkuIptaller)) * 100 : 0

  res.json({
    bugunkuCiro,
    haftalikCiro,
    bugunkuSiparis,
    haftalikSiparis,
    favoriDoner,
    favoriUrun,
    bugunkuIptaller: { adet: bugunkuIptaller, fireOrani: Math.round(fireOrani) },
    ortalamaSepetTutari: Math.round(ortalamaSepetTutari),
    bugunSatilanEtKg: (bugunkuEtGrams / 1000).toFixed(2),
    bugunSatilanTavukKg: (bugunkuTavukGrams / 1000).toFixed(2),
    availableDates,
    isSpecificDate
  })
})

app.post('/test_print', requireAuth, (_req, res) => {
  notifyUI('test_print')
  res.json({ success: true })
})

// tv_link and restart_tunnel removed

app.post('/close_bill', requireAuth, idempotencyMiddleware, async (req: any, res: any): Promise<any> => {
  const cname = req.body.customer_name
  const shop = getActiveShop(req)
  const idx = shop.activeOrders.findIndex(o => o.customer_name === cname)
  let amount = 0
  if (idx !== -1) {
    amount = shop.activeOrders[idx].total_amount || 0
    const finishedOrder = shop.activeOrders[idx]
    finishedOrder.status = "Tamamlandı"
    finishedOrder.completedAt = new Date().toISOString()
    shop.pastOrders.unshift(finishedOrder)
    
    // Keep past orders reasonable (e.g. max 500)
    if (shop.pastOrders.length > 500) {
      shop.pastOrders.pop()
    }
    
    shop.activeOrders.splice(idx, 1)
    
    globalDailyTotal += amount
    shop.systemSettings['dailyTotal'] = globalDailyTotal
    
    shop.saveOrders()
    shop.savePastOrders()
    shop.saveSettings()
    broadcastUpdateToPhones(shop)
  }
  
  const { ActivityLogModel } = require('./models')
  try {
    await ActivityLogModel.create({
      username: req.user?.username || 'admin',
      shopId: shopContext.getStore() || 'admin',
      action: 'close_bill',
      details: `${cname} hesabı kapatıldı. Tutar: ${amount} ₺`
    })
  } catch(e) {}

  notifyUI('order_deleted', { customerName: cname, totalAmount: amount, newDailyTotal: globalDailyTotal })
  res.json({ success: true })
})


app.post('/api/extension_logs', requireAuth, (req: any, res: any): any => {
  const { source, type, message } = req.body;
  addSystemLog(source || 'ElephantGO', type || 'info', message || '');
  res.json({ success: true });
});

function fuzzyMatchProduct(platformName) {
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

app.post('/trendyol_web_siparis', requireAuth, idempotencyMiddleware, (req: any, res: any): any => {
    // Restrict CORS purely for extension
    res.header("Access-Control-Allow-Origin", "*");
    try {
        const data = req.body;
        if (!data || !data.order_id) return res.status(400).json({ error: 'Missing order_id' });

        const exists = getShop().activeOrders.some(o => o.order_id === data.order_id);
        if (exists) return res.json({ success: true, duplicate: true });

        const formattedItems = (data.items || []).map(i => {
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
            customer_name: data.customer_name || 'Trendyol Siparişi',
            masa_no: getShop().getNextQueueNo().toString(),
            order_note: data.order_note || '',
            order_id: data.order_id,
            time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            items: formattedItems,
            total_amount: data.total_amount || 0,
            status: 'waiting',
            color: '#FF9800'
        };

        getShop().activeOrders.unshift(newOrder);
        getShop().saveOrders();
        broadcastUpdateToPhones();
        notifyUI('order_received', newOrder);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/yemeksepeti_siparis', requireAuth, idempotencyMiddleware, (req: any, res: any): any => {
    res.header("Access-Control-Allow-Origin", "*");
    try {
        const data = req.body;
        if (!data || !data.order_id) return res.status(400).json({ error: 'Missing order_id' });

        const exists = getShop().activeOrders.some(o => o.order_id === data.order_id);
        if (exists) return res.json({ success: true, duplicate: true });

        const formattedItems = (data.items || []).map(i => {
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
            masa_no: getShop().getNextQueueNo().toString(),
            order_note: data.order_note || '',
            order_id: data.order_id,
            time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            items: formattedItems,
            total_amount: data.total_amount || 0,
            status: 'waiting',
            color: '#E00034'
        };

        getShop().activeOrders.unshift(newOrder);
        getShop().saveOrders();
        broadcastUpdateToPhones();
        notifyUI('order_received', newOrder);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/update_status', requireAuth, (req: any, res: any): any => {
  const cname = req.body.customer_name
  const status = req.body.status
  const shop = getActiveShop(req)
  const idx = shop.activeOrders.findIndex(o => o.customer_name === cname)
  if (idx !== -1) {
    shop.activeOrders[idx].status = status
    shop.saveOrders()
    broadcastUpdateToPhones(shop)
  }
  notifyUI('update_status', req.body, shop)
  res.json({ success: true })
})

const SiparisSchema = z.object({
  customer_name: z.string(),
  items: z.array(z.any()),
  total_amount: z.number().optional(),
  color: z.string().optional()
}).passthrough();


app.post('/update_table_name', requireAuth, (req: any, res: any): any => {
  const { old_name, new_name } = req.body;
  if (!old_name || !new_name) return res.status(400).json({ error: "Missing parameters" });

  const idx = getShop().activeOrders.findIndex(o => o.customer_name === old_name);
  if (idx > -1) {
    getShop().activeOrders[idx].customer_name = new_name;
    getShop().saveOrders();
    notifyUI('orders_update');
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Order not found" });
  }
});

app.post('/siparis', requireAuth, (req: any, res: any): any => {
  const result = SiparisSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid order data", details: result.error });
  }

  try {
    const data = req.body;
    require('fs').appendFileSync(require('path').join(require('os').tmpdir(), 'kasa_debug.txt'), 'SIPARIS RECEIVED: ' + JSON.stringify(data) + '\n');
    
    if (!data) {
      require('fs').appendFileSync(require('path').join(require('os').tmpdir(), 'kasa_debug.txt'), 'FAILED 400: no data\n');
      return res.status(400).json({ error: 'Invalid order data' });
    }

    let cname = data.customer_name ? data.customer_name.trim() : '';
    if (!cname || cname === 'Yeni Adisyon' || cname === 'YeniSiparis' || cname === 'Yeni Siparis' || cname.startsWith('Sıra ') || cname.startsWith('Sira ')) {
        cname = `Masa ${getShop().getNextMasaNo()}`;
    }
    const idx = getShop().activeOrders.findIndex(o => o.customer_name === cname);
    
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
      time: data.time || new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      status: data.status || 'waiting',
      color: data.color || '',
      createdBy: (req as any).user?.username || 'Kasa',
      is_updated: idx > -1
    };

    if (idx > -1) {
      getShop().activeOrders[idx] = newOrder;
    } else {
      getShop().activeOrders.unshift(newOrder);
    }
    
    getShop().saveOrders();
    broadcastUpdateToPhones();
    notifyUI('new_order', newOrder);
    
    require('fs').appendFileSync(require('path').join(require('os').tmpdir(), 'kasa_debug.txt'), 'SIPARIS SUCCESS\n');
    return res.json({ success: true });
  } catch (err: any) {
    require('fs').appendFileSync(require('path').join(require('os').tmpdir(), 'kasa_debug.txt'), 'ERROR: ' + err.message + '\n');
    return res.status(500).json({ error: err.message });
  }
})

// Panic route removed

app.post('/yazdir', requireAuth, (req: any, res: any): any => {
  try {
    const customerName = req.body.customer_name
    notifyUI('print_receipt', { customerName })
    res.json({ status: 'basarili' })
  } catch (error: any) {
    res.status(400).json({ status: 'hata', error: error.message })
  }
})

app.get('/test_orders', (_req, res) => {
  res.json({ orders: getShop().activeOrders.map(a => a.customer_name) })
})

app.get('/menu', requireAuth, (_req, res) => {
  res.json(getShop().getFullMenu())
})

app.post('/menu', (req: any, res: any): any => {
  try {
    getShop().updateCustomMenu(req.body);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to update menu' });
  }
})

app.get('/network_status', (_req, res) => {
  const os = require('os')
  const nets = os.networkInterfaces()
  let localIp = '127.0.0.1'
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIp = net.address
        break
      }
    }
  }
  res.json({
    ip: localIp,
    port: 5000,
    connectedDevices: getConnectedPhones()
  })
})

app.get('/api/past_orders', requireAuth, (_req, res) => {
  res.json(getShop().pastOrders)
})

app.post('/api/add_past_order', requireAuth, (req: any, res: any) => {
  getShop().pastOrders.unshift(req.body)
  if (getShop().pastOrders.length > 500) {
    getShop().pastOrders.pop()
  }
  getShop().savePastOrders()
  res.json({ success: true })
})

app.post('/api/delete_past_order', requireAuth, (req: any, res: any) => {
  const idx = req.body.index
  if (idx !== undefined && idx >= 0 && idx < getShop().pastOrders.length) {
    getShop().pastOrders.splice(idx, 1)
    getShop().savePastOrders()
  }
  res.json({ success: true })
})

app.post('/api/clear_past_orders', requireAuth, (_req, res: any) => {
  getShop().pastOrders.splice(0, getShop().pastOrders.length)
  getShop().savePastOrders()
  res.json({ success: true })
})

app.get('/spotify/login', (_req, res) => {
  const SPOTIFY_CLIENT_ID = getShop().systemSettings["SPOTIFY_CLIENT_ID"] || ""
  if (!SPOTIFY_CLIENT_ID) {
    res.send("Spotify Client ID ayarlarda yok!")
    return
  }
  const scope = "streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-read-currently-playing"
  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${SPOTIFY_CLIENT_ID}&scope=${encodeURIComponent(scope)}&redirect_uri=https://bilalgnd.shop/spotify/callback&state=${encodeURIComponent(getShop().shopId)}`
  res.redirect(authUrl)
})

app.get('/spotify/callback', async (req: any, res: any) => {
  const code = req.query.code as string
  if (!code) {
    res.send("Spotify baglantisi reddedildi.")
    return
  }

  const SPOTIFY_CLIENT_ID = getShop().systemSettings["SPOTIFY_CLIENT_ID"] || ""
  const SPOTIFY_CLIENT_SECRET = getShop().systemSettings["SPOTIFY_CLIENT_SECRET"] || ""
  const authHeader = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')

  try {
    const response = await axios.post("https://accounts.spotify.com/api/token", 
      new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: "https://bilalgnd.shop/spotify/callback"
      }).toString(),
      {
        headers: {
          "Authorization": `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    )

    getShop().systemSettings["SPOTIFY_ACCESS_TOKEN"] = response.data.access_token
    getShop().systemSettings["SPOTIFY_REFRESH_TOKEN"] = response.data.refresh_token
    getShop().saveSettings()
    res.send("Spotify basariyla baglandi! Kasa uygulamasina donebilirsiniz. Bu pencereyi kapatabilirsiniz.")
  } catch (error: any) {
    res.send(`Hata: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`)
  }
})

app.get('/spotify/token', async (_req, res) => {
  let accessToken = getShop().systemSettings["SPOTIFY_ACCESS_TOKEN"] || ""
  let refreshToken = getShop().systemSettings["SPOTIFY_REFRESH_TOKEN"] || ""
  
  if (!accessToken || !refreshToken) {
    res.status(401).json({ error: "not_logged_in" })
    return
  }

  try {
    await axios.get("https://api.spotify.com/v1/me", {
      headers: { "Authorization": `Bearer ${accessToken}` }
    })
    res.json({ access_token: accessToken })
  } catch (err: any) {
    if (err.response && err.response.status === 401) {
      const SPOTIFY_CLIENT_ID = getShop().systemSettings["SPOTIFY_CLIENT_ID"] || ""
      const SPOTIFY_CLIENT_SECRET = getShop().systemSettings["SPOTIFY_CLIENT_SECRET"] || ""
      const authHeader = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')

      try {
        const refRes = await axios.post("https://accounts.spotify.com/api/token", 
          new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken
          }).toString(),
          {
            headers: {
              "Authorization": `Basic ${authHeader}`,
              "Content-Type": "application/x-www-form-urlencoded"
            }
          }
        )
        getShop().systemSettings["SPOTIFY_ACCESS_TOKEN"] = refRes.data.access_token
        if (refRes.data.refresh_token) {
          getShop().systemSettings["SPOTIFY_REFRESH_TOKEN"] = refRes.data.refresh_token
        }
        getShop().saveSettings()
        res.json({ access_token: getShop().systemSettings["SPOTIFY_ACCESS_TOKEN"] })
      } catch (refErr) {
        res.status(401).json({ error: "refresh_failed" })
      }
    } else {
      res.status(500).json({ error: err.message })
    }
  }
})

const PORT = process.env.PORT || 5000;
import { initializeModels } from './models';

initializeModels().then(() => {
  server.listen(5000, '0.0.0.0', () => {
    console.log('Server is running on port 5000')
    
    // Bot servisini başlat
    startBotService((newOrder) => {
      const exists = getShop().activeOrders.some(o => o.order_id === newOrder.order_id);
      if (exists) return; // Zaten varsa ekleme
      
      const formattedOrder = {
          ...newOrder,
          masa_no: getShop().getNextQueueNo().toString(),
          time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          status: 'waiting',
          color: newOrder.platform === 'trendyol' ? '#FF9800' : '#E00034'
      };

      getShop().activeOrders.unshift(formattedOrder);
      getShop().saveOrders();
      broadcastUpdateToPhones();
      notifyUI('order_received', formattedOrder);
    });
  })
}).catch(console.error);

app.post('/set_tv_screensaver', requireAuth, (req: any, res: any): any => {
  const mode = req.body.mode
  if (mode) {
    getShop().systemSettings['TV_SCREENSAVER'] = mode
    getShop().saveSettings()
    res.json({ success: true, mode })
  } else {
    res.status(400).json({ error: 'mode required' })
  }
})
