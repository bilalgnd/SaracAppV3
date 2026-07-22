import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'
import axios from 'axios'
import { ActivityLogModel, DataModel, ShopState, shops, getShop, shopContext } from './models'
import { initializeApp, cert } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { join, dirname } from 'path'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { startBotService } from './services/botService'
import * as fs from 'fs'
import * as path from 'path'
import multer from 'multer'

import { z } from 'zod'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';


const API_TOKEN = '123456';

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
export const terminalClients: any[] = [];

export function addSystemLog(source: string, type: 'success' | 'error' | 'warning' | 'info', message: string) {
  const log: SystemLog = {
    time: new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    source,
    type,
    message
  };
  systemLogs.unshift(log);
  if (systemLogs.length > 100) systemLogs.pop();
  
  // Broadcast to terminal clients
  const payload = JSON.stringify({ type: 'system_log', data: log });
  terminalClients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
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

// Restrict CORS (Moved to top so it applies to all routes including file uploads)
app.use((req, res, next) => {
  const origin = req.headers.origin
  res.header("Access-Control-Allow-Origin", origin || "*")
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization")
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
    return
  }
  next()
})

const sharedFilesDir = path.join(__dirname, '..', 'shared_files');
if (!fs.existsSync(sharedFilesDir)) fs.mkdirSync(sharedFilesDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, sharedFilesDir)
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})
const upload = multer({ storage: storage })

app.post('/api/shared/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ message: 'File uploaded successfully', filename: req.file.originalname });
});

app.get('/api/shared', (req, res) => {
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

app.delete('/api/shared/:filename', (req, res) => {
  const file = path.join(sharedFilesDir, req.params.filename);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    res.json({ message: 'Deleted' });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

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




app.get('/login', (_req, res) => {
  res.sendFile(join(__dirname, '../public/templates/login.html'))
})

app.get('/admintools', (_req, res) => {
  res.sendFile(join(__dirname, '../public/templates/admintools.html'))
})

app.get('/apiorders', (_req, res) => {
  res.sendFile(join(__dirname, '../public/templates/apiorders.html'))
})

app.get('/apiorders-dev', (_req, res) => {
  res.sendFile(join(__dirname, '../public/templates/apiorders_dev.html'))
})

app.get('/anti', (_req, res) => {
  res.sendFile(join(__dirname, '../public/templates/anti.html'))
})

app.post('/api/anti/chat', async (req: any, res: any) => {
  try {
    const { prompt, selectedFile, googleToken } = req.body
    
    let contextStr = ''
    if (selectedFile && googleToken) {
      try {
        const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${selectedFile.id}?alt=media`, {
          headers: { 'Authorization': `Bearer ${googleToken}` }
        })
        if (driveRes.status === 200) {
          const fileContent = await driveRes.text()
          contextStr = `\n\n[Google Drive Dosyası: ${selectedFile.name}]\n${fileContent.substring(0, 4000)}`
        }
      } catch (e) {
        console.error('Drive file fetch error:', e)
      }
    }

    const reply = `🤖 **Antigravity AI Yanıtı:**\n\n${prompt}${selectedFile ? `\n\n📁 **Bağlanan Dosya:** \`${selectedFile.name}\`` : ''}\n\nİsteğiniz analiz edildi. Google Drive hesabınızla tam senkronize olarak geliştirme adımları yürütüldü.${contextStr ? '\n\n*Dosya içeriği başarıyla okundu ve işlendi.*' : ''}`
    
    res.json({ reply })
  } catch (err: any) {
    console.error('Anti chat error:', err)
    res.status(500).json({ error: err.message || 'Antigravity AI hatası' })
  }
})

const requireAdminAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization']
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const token = authHeader.replace('Bearer ', '')
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    if (decoded.role !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    // Run in shopContext so getShop() returns the correct admin shop with saved DB settings
    shopContext.run('admin', next)
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

app.post('/api/admin/login', (req: any, res: any) => {
  const { password } = req.body
  const adminPassword = process.env.ADMIN_TOOLS_PASSWORD || 'default_admin'
  if (password === adminPassword) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '30d' })
    return res.json({ token })
  } else {
    return res.status(401).json({ error: 'Invalid password' })
  }
})

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

// --- TGO API Endpoints ---
const getTrendyolSupplierId = () => {
  const shop = getShop();
  const settings = shop?.systemSettings || {};
  return settings.trendyolSupplierId || process.env.TRENDYOL_SUPPLIER_ID || '6647850';
};

const getTrendyolStoreId = () => {
  const shop = getShop();
  const settings = shop?.systemSettings || {};
  return settings.trendyolStoreId || process.env.TRENDYOL_STORE_ID || '367376';
};

const getTgoHeaders = () => {
  const shop = getShop();
  const settings = shop?.systemSettings || {};
  
  const supplierId = getTrendyolSupplierId();
  const apiKey = settings.trendyolApiKey || process.env.TRENDYOL_API_KEY || '';
  const apiSecret = settings.trendyolApiSecret || process.env.TRENDYOL_API_SECRET || '';
  const authStr = `${apiKey}:${apiSecret}`;
  const authB64 = Buffer.from(authStr, 'utf-8').toString('base64');
  const executorUser = settings.trendyolExecutorUser || process.env.TRENDYOL_EXECUTOR_USER || '';
  
  return {
    "Authorization": `Basic ${authB64}`,
    "User-Agent": `${supplierId} - SelfIntegration`,
    "x-agentname": `${supplierId} - SelfIntegration`,
    "x-executor-user": executorUser,
    "Content-Type": "application/json"
  };
};

const getTgoBaseUrl = () => { const s = getShop().systemSettings || {}; let b = s.trendyolApiEndpoint || 'https://api.tgoapis.com/integrator'; if(b.endsWith('/')) b=b.slice(0,-1); return b; };

app.get('/api/tgo/orders', requireAdminAuth, async (req: any, res: any) => {
  try {
    const status = req.query.status || 'Created';
    const supplierId = getTrendyolSupplierId();
    const queryStr = status === 'all' ? '' : `?packageStatuses=${status}`;
    const response = await axios.get(`${getTgoBaseUrl()}/order/meal/suppliers/${supplierId}/packages${queryStr}`, {
      headers: getTgoHeaders()
    });

    if (response.data) {
        let contentArray = response.data.content || (response.data.data && response.data.data.content);
        if (!contentArray && Array.isArray(response.data)) {
            contentArray = response.data;
        }

        if (Array.isArray(contentArray)) {
            // Sort orders by creation date ascending to count correctly
            const sorted = [...contentArray].sort((a: any, b: any) => {
                const da = a.packageCreationDate || a.createdAt || 0;
                const db2 = b.packageCreationDate || b.createdAt || 0;
                return da - db2;
            });

            // Count how many times each customer appears (cumulative per order date)
            const customerOrderIndex: Record<string, number> = {};
            const orderCountMap: Record<string, number> = {};
            for (const o of sorted) {
                if (o && o.customer && o.customer.id) {
                    const cid = String(o.customer.id);
                    customerOrderIndex[cid] = (customerOrderIndex[cid] || 0) + 1;
                    orderCountMap[String(o.id)] = customerOrderIndex[cid];
                }
            }

            const modifiedArray = contentArray.map((origOrder: any) => {
                const order = JSON.parse(JSON.stringify(origOrder));
                if (order && order.customer && order.customer.id) {
                    const count = orderCountMap[String(order.id)] || 1;
                    if (!order.customer) order.customer = {};
                    order.customer.orderCount = count;
                    order.orderCount = count;
                }
                return order;
            });

            if (response.data.content !== undefined) {
                response.data.content = modifiedArray;
            } else if (response.data.data && response.data.data.content !== undefined) {
                response.data.data.content = modifiedArray;
            } else if (Array.isArray(response.data)) {
                response.data = modifiedArray;
            }
        }
    }

    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.message, data: error.response?.data });
  }
});

// Mock orders storage for DEV environment (/apiorders-dev)
let mockDevOrders: any[] = [
  {
    "id": 999901,
    "orderNumber": "TG-MOCK-782",
    "packageStatus": "Created",
    "status": "Created",
    "orderDate": Date.now() - 300000,
    "packageCreationDate": Date.now() - 300000,
    "deliveryType": "RESTAURANT",
    "totalPrice": 240.00,
    "customer": {
      "id": 88412,
      "firstName": "Şeyda",
      "lastName": "K.",
      "orderCount": 12
    },
    "address": {
      "address1": "İstiklal Kesenkes Sk. no:10",
      "address2": "",
      "city": "Çanakkale",
      "cityCode": 17,
      "cityId": 116,
      "district": "Biga",
      "districtId": 338,
      "neighborhoodId": 12622,
      "neighborhood": "İstiklal Mah",
      "apartmentNumber": "10",
      "floor": "3",
      "doorNumber": "6",
      "addressDescription": "Parkın yanındaki sarı bina, 3. kat"
    },
    "lines": [
      {
        "productId": 715310,
        "productName": "Tavuk Döner Dürüm",
        "quantity": 1,
        "price": 140.00,
        "extraIngredients": [],
        "removedIngredients": [
          { "id": 715314, "name": "Domates" },
          { "id": 715312, "name": "Soğan" }
        ],
        "notes": "Soğansız ve domatessiz olsun lütfen"
      },
      {
        "productId": 715320,
        "productName": "Tavuk Döner Dürüm",
        "quantity": 2,
        "price": 280.00,
        "extraIngredients": [],
        "removedIngredients": [],
        "notes": "Normal olsun (Servis Istiyorum)"
      },
      {
        "productId": 9982,
        "productName": "Ayran 30cl",
        "quantity": 1,
        "price": 20.00,
        "extraIngredients": [],
        "removedIngredients": []
      }
    ],
    "customerNote": "Soğansız ve domatessiz sipariş hazırlarsanız sevinirim (Servis İstiyorum)",
    "isMock": true
  }
];

app.get('/api/tgo/dev/orders', requireAdminAuth, async (_req: any, res: any) => {
  try {
    res.json({ content: mockDevOrders, totalCount: mockDevOrders.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tgo/dev/mock-order', requireAdminAuth, async (_req: any, res: any) => {
  try {
    const mockOrderNum = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const newOrder = {
      "id": mockOrderNum,
      "packageId": mockOrderNum,
      "supplierId": parseInt(getTrendyolSupplierId()) || 6647850,
      "storeId": parseInt(getTrendyolStoreId()) || 367376,
      "orderCode": "MOCK-" + Math.floor(100 + Math.random() * 900),
      "packageCreationDate": Date.now(),
      "orderId": mockOrderNum,
      "orderNumber": mockOrderNum,
      "totalPrice": 185.00,
      "packageStatus": "Created",
      "status": "Created",
      "customer": {
        "id": Math.floor(100000 + Math.random() * 900000),
        "firstName": "Ahmet",
        "lastName": "Yılmaz",
        "orderCount": Math.floor(1 + Math.random() * 15)
      },
      "address": {
        "address1": "Örnek Mahallesi Test Sk. No:5",
        "address2": "",
        "city": "Çanakkale",
        "district": "Biga",
        "neighborhood": "Cumhuriyet Mah",
        "apartmentNumber": "5",
        "floor": "2",
        "doorNumber": "4",
        "addressDescription": "Dev Test Ortamı Mock Sipariş",
        "latitude": "40.227316",
        "longitude": "27.242766"
      },
      "lines": [
        {
          "productId": 101,
          "productName": "Zurna Tavuk Döner",
          "name": "Zurna Tavuk Döner",
          "quantity": 1,
          "price": 160.00,
          "extraIngredients": [{ "id": 1, "name": "Kaşar Peyniri" }],
          "removedIngredients": [{ "id": 2, "name": "Soğan" }],
          "notes": "Soğansız olsun, kaşar bol olsun"
        },
        {
          "productId": 102,
          "productName": "Kutu Kola 33cl",
          "name": "Kutu Kola 33cl",
          "quantity": 1,
          "price": 25.00,
          "extraIngredients": [],
          "removedIngredients": []
        }
      ],
      "customerNote": "Soğansız kurye hızlı gelsin lütfen (Servis Istiyorum)",
      "isMock": true
    };

    mockDevOrders.unshift(newOrder);
    res.json({ success: true, message: 'Mock sipariş eklendi', order: newOrder });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tgo/dev/mock-orders', requireAdminAuth, async (_req: any, res: any) => {
  try {
    mockDevOrders = [];
    res.json({ success: true, message: 'Tüm test siparişleri temizlendi' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tgo/store/status', requireAdminAuth, async (req: any, res: any) => {
  try {
    const status = req.body.status; // 'OPEN' or 'CLOSED'
    const supplierId = getTrendyolSupplierId();
    const storeId = getTrendyolStoreId();
    const response = await axios.put(`${getTgoBaseUrl()}/store/meal/suppliers/${supplierId}/stores/${storeId}/status`, 
      { status: status },
      { headers: getTgoHeaders() }
    );
    res.json({ success: true, data: response.data, status });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data?.message || error.message, data: error.response?.data });
  }
});

app.get('/api/tgo/store', requireAdminAuth, async (req: any, res: any) => {
  try {
    const supplierId = getTrendyolSupplierId();
    const storeId = getTrendyolStoreId();
    const response = await axios.get(`${getTgoBaseUrl()}/store/meal/suppliers/${supplierId}/stores/${storeId}`, {
      headers: getTgoHeaders()
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.message, data: error.response?.data });
  }
});

app.get('/api/tgo/menu', requireAdminAuth, async (req: any, res: any) => {
  try {
    const supplierId = getTrendyolSupplierId();
    const storeId = getTrendyolStoreId();
    const response = await axios.get(`${getTgoBaseUrl()}/product/meal/suppliers/${supplierId}/stores/${storeId}/products`, {
      headers: getTgoHeaders()
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.message, data: error.response?.data });
  }
});

app.post('/api/tgo/category/status', requireAdminAuth, async (req: any, res: any) => {
  try {
    const { sectionId, status } = req.body;
    const supplierId = getTrendyolSupplierId();
    const storeId = getTrendyolStoreId();
    const response = await axios.put(`${getTgoBaseUrl()}/product/meal/suppliers/${supplierId}/stores/${storeId}/sections/${sectionId}/status`, 
      { status: status },
      { headers: getTgoHeaders() }
    );
    res.json({ success: true, data: response.data, status });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.message, data: error.response?.data });
  }
});

app.post('/api/tgo/order/status', requireAdminAuth, async (req: any, res: any) => {
  try {
    const { packageId, status } = req.body; // status: picked, invoiced, manual-shipped, manual-delivered
    
    if (!packageId) {
      return res.status(400).json({ error: 'packageId zorunludur' });
    }

    const pId = String(packageId);

    // If mock order, update mock status locally
    const mockOrder = mockDevOrders.find(o => String(o.id) === pId || String(o.orderNumber) === pId || String(o.packageId) === pId);
    if (mockOrder) {
      const statusMap: Record<string, string> = { 'picked': 'Picking', 'invoiced': 'Invoiced', 'manual-shipped': 'Shipped', 'manual-delivered': 'Delivered' };
      mockOrder.status = statusMap[status] || status;
      mockOrder.packageStatus = mockOrder.status;
      return res.json({ success: true, isMock: true, data: mockOrder });
    }

    const supplierId = getTrendyolSupplierId();
    const baseUrl = getTgoBaseUrl();
    let url = '';
    let payload: any = {};

    if (status === 'picked') {
      // order1.pdf: PUT /order/meal/suppliers/{supplierid}/packages/picked
      url = `${baseUrl}/order/meal/suppliers/${supplierId}/packages/picked`;
      const prepTime = req.body.preparationTime ? parseInt(req.body.preparationTime) : 30;
      payload = { packageId: pId, preparationTime: prepTime };
    } else if (status === 'invoiced') {
      // order2.pdf: PUT /order/meal/suppliers/{supplierid}/packages/invoiced
      url = `${baseUrl}/order/meal/suppliers/${supplierId}/packages/invoiced`;
      payload = { packageId: pId, actualDate: Date.now() };
    } else if (status === 'manual-shipped') {
      // order3.pdf: PUT /order/meal/suppliers/{supplierid}/packages/{packageId}/manual-shipped
      url = `${baseUrl}/order/meal/suppliers/${supplierId}/packages/${pId}/manual-shipped`;
      payload = { actualDate: Date.now() };
    } else if (status === 'manual-delivered') {
      // order4.pdf: PUT /order/meal/suppliers/{supplierid}/packages/{packageId}/manual-delivered
      url = `${baseUrl}/order/meal/suppliers/${supplierId}/packages/${pId}/manual-delivered`;
      payload = { actualDate: Date.now() };
    } else {
      return res.status(400).json({ error: 'Geçersiz durum tipi' });
    }

    const response = await axios.put(url, payload, { headers: getTgoHeaders() });
    res.json({ success: true, data: response.data });
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
    res.status(error.response?.status || 500).json({ error: errorMsg, data: error.response?.data });
  }
});

app.post('/api/tgo/send_to_app1', requireAdminAuth, async (req: any, res: any) => {
  try {
    const { parsedOrderText, rawData } = req.body;
    
    const shop = getShop();
    let saracShop = shops.get('sarac');
    if (!saracShop) {
        saracShop = shop; // Fallback to current shop if sarac is not connected yet
    }

    if (rawData && rawData.id && rawData.customer && rawData.customer.id) {
        const orderId = String(rawData.id);
        const customerId = String(rawData.customer.id);
        
        // Read directly from MongoDB
        const [statsDoc, processedDoc] = await Promise.all([
          DataModel.findOne({ key: 'tgoCustomerStats' }),
          DataModel.findOne({ key: 'tgoProcessedOrders' })
        ]);
        const tgoCustomerStats: Record<string, number> = statsDoc?.value || {};
        const tgoProcessedOrdersArr: string[] = processedDoc?.value || [];
        const tgoProcessedOrdersSet = new Set(tgoProcessedOrdersArr);

        if (!tgoProcessedOrdersSet.has(orderId)) {
            tgoProcessedOrdersSet.add(orderId);
            tgoCustomerStats[customerId] = (tgoCustomerStats[customerId] || 0) + 1;
            // Write back to MongoDB
            await Promise.all([
              DataModel.findOneAndUpdate({ key: 'tgoCustomerStats' }, { value: tgoCustomerStats }, { upsert: true }),
              DataModel.findOneAndUpdate({ key: 'tgoProcessedOrders' }, { value: Array.from(tgoProcessedOrdersSet) }, { upsert: true })
            ]);
            // Also update in-memory shop if available
            if (saracShop) {
              saracShop.tgoCustomerStats = tgoCustomerStats;
              saracShop.tgoProcessedOrders = tgoProcessedOrdersSet;
            }
        }
    }

    // 1. Siparişi Kasa'ya (App1) işlemesi için event olarak gönder
    notifyUI('tgo_add_order', rawData, saracShop);
    res.json({ success: true });
  } catch (error: any) {
    console.error('SEND_TO_APP1 ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settings', requireAuth, (_req, res) => {
  res.json(getShop().systemSettings)
})

app.get('/api/logs', (_req, res) => {
  res.json(systemLogs)
})

app.post('/api/logs', express.json(), (req, res) => {
  const { source, type, message } = req.body;
  if (source && type && message) {
    addSystemLog(source, type, message);
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: 'Missing fields' });
  }
})


const webDir = path.join(__dirname, '..', 'public')

app.use('/shared_files', express.static(path.join(__dirname, '..', 'shared_files')))
app.use('/static', express.static(join(webDir, 'static')))
app.use('/trendyol-mock', express.static(join(webDir, 'trendyol-mock')))

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
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(join(webDir, 'templates/tv.html'))
})

app.get('/tv-:shopId', (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
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

export function getConnectedPhones(): any[] {
  const devicesMap = new Map<string, any>()
  
  getShop().connectedPhones.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      const username = (ws as any).username
      const deviceId = (ws as any).deviceId
      const isTv = (ws as any).isTv
      const ip = (ws as any)._socket?.remoteAddress?.replace('::ffff:', '') || 'Bilinmeyen IP'
      const connectedAt = (ws as any).connectedAt || Date.now()

      let type = 'Bilinmeyen Cihaz'
      if (isTv) type = 'TV Ekranı'
      else if (deviceId && deviceId.startsWith('PC-')) type = 'Masaüstü (Kasa)'
      else if (deviceId && deviceId.startsWith('MOB-')) type = 'Garson Uygulaması'
      else if (username) type = 'Garson Uygulaması'
      else type = 'Harici Bağlantı'

      let id = deviceId || username || ip

      // Deduplicate by ID, keeping the most recent connection
      const existing = devicesMap.get(id)
      if (!existing || connectedAt > existing.connectedAt) {
        devicesMap.set(id, { id, type, ip, connectedAt })
      }
    }
  })
  
  return Array.from(devicesMap.values()).sort((a, b) => b.connectedAt - a.connectedAt)
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
  const isTerminal = urlParams.get('isTerminal') === 'true'
  
  let shopId: string | null = null;
  let jwtDecoded: any = null;
  const deviceId = urlParams.get('deviceId');

  // If it's a terminal client, bypass shop logic
  if (isTerminal) {
    terminalClients.push(ws);
    ws.on('close', () => {
      const index = terminalClients.indexOf(ws);
      if (index > -1) terminalClients.splice(index, 1);
    });
    // Send initial log history
    ws.send(JSON.stringify({ type: 'system_log_history', data: systemLogs }));
    return;
  }

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
  (ws as any).isTv = isTv;
  (ws as any).connectedAt = Date.now();
  
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
      const appName = isTv ? 'TV_EKRAN' : (jwtDecoded ? (jwtDecoded.role === 'kasa' ? 'App1' : 'App2') : 'App1');
      addSystemLog(appName, 'success', 'Sunucuya başarıyla bağlandı.');
      ws.send(JSON.stringify(getShop().activeOrders)) // Send initial state to phone
      notifyUI('request_update')
      
      ;(ws as any).isAlive = true;
      ws.on('pong', () => {
        shopContext.run(shopId, () => {
          ;(ws as any).isAlive = true;
        });
      });
      
      ws.on('message', (messageRaw) => {
        shopContext.run(shopId, () => {
          ;(ws as any).isAlive = true;
          try {
            const msgStr = messageRaw.toString()
            if (msgStr === 'ping' || msgStr === 'pong') return;
            const data = JSON.parse(msgStr)
            
            // Remote Management (C2) Routing
            if (data.type === 'remote_command' || data.type === 'remote_response' || data.type.startsWith('remote_fs_')) {
               // Only allow authenticated users/devices to use this
               // Admin/app2 sending command -> app1 (Shop PC)
               // app1 sending response -> app2 (Admin)
               const targetShop = getShop()
               const targetId = data.targetDeviceId
               let targetWs: any = null
               
               // Find target device
               for (const client of targetShop.connectedPhones) {
                 const cDeviceId = (client as any).deviceId;
                 if (cDeviceId === targetId || (client as any).username === targetId) {
                   targetWs = client;
                   break;
                 }
                 if (targetId === 'KASA' && cDeviceId && cDeviceId.startsWith('PC-')) {
                   targetWs = client;
                   break;
                 }
               }
               
               console.log(`[C2] type=${data.type} from=${(ws as any).deviceId||(ws as any).username} to=${targetId} (Found: ${!!targetWs})`);

               if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                 // Inject sender's deviceId so the target knows who to reply to
                 data.senderId = (ws as any).deviceId || (ws as any).username;
                 targetWs.send(JSON.stringify(data));
               } else {
                 if (data.type === 'remote_command') {
                   ws.send(JSON.stringify({
                     type: 'remote_response',
                     commandId: data.commandId,
                     output: `HATA: Hedef cihaz (${targetId}) çevrimdışı veya bulunamadı.`
                   }))
                 }
               }
            }
          } catch (e) {
             // Ignored
          }
        });
      })

      ws.on('close', () => {
        shopContext.run(shopId, () => {
          console.log('Phone disconnected')
          addSystemLog(appName, 'warning', 'WebSocket bağlantısı koptu (Uygulama kapanmış veya ağ gitmiş olabilir).');
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
    screensaver: getShop().systemSettings['TV_SCREENSAVER'] || 'dvd',
    tvAudioSource: getShop().systemSettings['TV_AUDIO_SOURCE'] || 'spotify',
    tvRadioStation: getShop().systemSettings['TV_RADIO_STATION'] || 'powerturk'
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

app.get('/api/admin/dashboard_stats', requireAdminAuth, async (req: any, res: any) => {
  const platform = (req.query.platform || 'all').toLowerCase()
  const range = (req.query.range || 'daily').toLowerCase()

  const now = new Date()

  // For charts
  let chartStartDate = new Date()
  if (range === 'hourly') {
    chartStartDate.setHours(now.getHours() - 24)
  } else if (range === 'weekly') {
    chartStartDate.setDate(now.getDate() - 7)
  } else if (range === 'monthly') {
    chartStartDate.setDate(now.getDate() - 30)
  } else { // daily
    chartStartDate.setHours(0, 0, 0, 0)
  }

  // Fixed top metrics dates
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

  let todayEtDonerQty = 0
  let todayTavukDonerQty = 0

  let itemSales: Record<string, number> = {}
  let itemRevenue: Record<string, number> = {}
  let categorySales: Record<string, number> = { 'Et Döner': 0, 'Tavuk Döner': 0, 'İçecekler': 0, 'Diğer': 0 }

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

    // Fixed Top Stats
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

    // Process items for charts AND today's kg calculation
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item: any) => {
        const qty = item.quantity || 1
        const name = item.name || 'Bilinmeyen'
        const price = item.price || 0
        const iName = name.toLowerCase()

        // For "Bugün Satılan Döner" fixed stats
        if (oDate >= todayStart && oDate <= now) {
          if (iName.includes('et') || iName.includes('iskender') || iName.includes('beyti')) {
             todayEtDonerQty += qty
          } else if (iName.includes('tavuk')) {
             todayTavukDonerQty += qty
          }
        }

        // For Chart Data (Depends on 'range' query param or just general top products)
        if (oDate >= chartStartDate && oDate <= now) {
          itemSales[name] = (itemSales[name] || 0) + qty
          itemRevenue[name] = (itemRevenue[name] || 0) + (price * qty)

          if (iName.includes('et') || iName.includes('iskender') || iName.includes('beyti')) {
            categorySales['Et Döner'] += qty
          } else if (iName.includes('tavuk')) {
            categorySales['Tavuk Döner'] += qty
          } else if (iName.includes('ayran') || iName.includes('kola') || iName.includes('şalgam') || iName.includes('su') || iName.includes('fanta') || iName.includes('sprite')) {
            categorySales['İçecekler'] += qty
          } else {
            categorySales['Diğer'] += qty
          }
        }
      })
    }

    // Trend chart processing
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
    todayEtDonerKg: (todayEtDonerQty * 0.1).toFixed(2),
    todayTavukDonerKg: (todayTavukDonerQty * 0.1).toFixed(2),
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
app.get('/api/admin/integration_settings', requireAdminAuth, async (req: any, res: any) => {
  try {
    // Read directly from MongoDB - most reliable, no dependency on in-memory state
    const doc = await DataModel.findOne({ key: 'systemSettings' });
    const settings = doc?.value || {};
    res.json({
      trendyolSupplierId: settings.trendyolSupplierId || settings.TRENDYOL_SUPPLIER_ID || process.env.TRENDYOL_SUPPLIER_ID || '',
      trendyolApiKey: settings.trendyolApiKey || settings.TRENDYOL_API_KEY || process.env.TRENDYOL_API_KEY || '',
      trendyolApiSecret: settings.trendyolApiSecret || settings.TRENDYOL_API_SECRET || process.env.TRENDYOL_API_SECRET || '',
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

app.post('/api/admin/integration_settings', requireAdminAuth, async (req: any, res: any) => {
  try {
    const payload = req.body;
    // Read current settings from DB first
    const doc = await DataModel.findOne({ key: 'systemSettings' });
    const current = doc?.value || {};
    const updated = {
      ...current,
      // camelCase (used by this UI)
      ...(payload.trendyolSupplierId !== undefined && { trendyolSupplierId: payload.trendyolSupplierId }),
      ...(payload.trendyolApiKey !== undefined && { trendyolApiKey: payload.trendyolApiKey }),
      ...(payload.trendyolApiSecret !== undefined && { trendyolApiSecret: payload.trendyolApiSecret }),
      ...(payload.trendyolEntgRefCode !== undefined && { trendyolEntgRefCode: payload.trendyolEntgRefCode }),
      ...(payload.trendyolToken !== undefined && { trendyolToken: payload.trendyolToken }),
      ...(payload.trendyolApiEndpoint !== undefined && { trendyolApiEndpoint: payload.trendyolApiEndpoint }),
      ...(payload.ysRestaurantId !== undefined && { ysRestaurantId: payload.ysRestaurantId }),
      ...(payload.ysApiKey !== undefined && { ysApiKey: payload.ysApiKey }),
      ...(payload.ysApiSecret !== undefined && { ysApiSecret: payload.ysApiSecret }),
      // UPPER_CASE (used by getTgoHeaders, getTgoBaseUrl, etc. — survive restart)
      ...(payload.trendyolSupplierId !== undefined && { TRENDYOL_SUPPLIER_ID: payload.trendyolSupplierId }),
      ...(payload.trendyolApiKey !== undefined && { TRENDYOL_API_KEY: payload.trendyolApiKey }),
      ...(payload.trendyolApiSecret !== undefined && { TRENDYOL_API_SECRET: payload.trendyolApiSecret }),
    };
    // Write directly to MongoDB AND update in-memory shop (both formats)
    await DataModel.findOneAndUpdate({ key: 'systemSettings' }, { value: updated }, { upsert: true });
    const shop = getShop();
    if (shop) shop.systemSettings = { ...shop.systemSettings, ...updated };
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/admin/integration_status', requireAdminAuth, async (req: any, res: any) => {
  const shop = getShop();
  const settings = shop.systemSettings || {};
  const supplierId = settings.trendyolSupplierId || process.env.TRENDYOL_SUPPLIER_ID || '6647850';
  
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

app.get('/api/ys/orders', requireAdminAuth, (req: any, res: any) => {
  // Mockup for Yemeksepeti Orders as it's in test phase
  res.json([]);
});

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

app.post('/upload_trendyol_log', (req: any, res: any): any => {
    res.header("Access-Control-Allow-Origin", "*");
    try {
        console.log('[TRENDYOL LOG SERVER] Received log data:', JSON.stringify(req.body).slice(0, 200) + '...');
        // Here we could save it to DB, but for now we just acknowledge receipt
        res.json({ success: true, message: 'Log received' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false });
    }
});

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
            time: new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }),
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
            time: new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }),
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
      time: data.time || new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }),
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

app.get('/active_devices', requireAuth, (req: any, res: any) => {
  try {
    const shopId = req.user?.username || req.user?.shopId;
    const targetShop = shops.get(shopId) || getShop();
    const devices: string[] = [];
    targetShop.connectedPhones.forEach(ws => {
      const did = (ws as any).deviceId;
      if (did && !devices.includes(did)) {
        devices.push(did);
      }
    });
    res.json({ devices });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/panic', requireAuth, (req: any, res: any): any => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
    const shopId = req.user?.username || req.user?.shopId;
    const targetShop = shops.get(shopId) || getShop();
    
    let found = false;
    targetShop.connectedPhones.forEach(ws => {
      if ((ws as any).deviceId === deviceId && ws.readyState === WebSocket.OPEN) {
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
  const { currentBotStatus } = require('./services/botService');
  res.json({
    ip: localIp,
    port: 5000,
    connectedDevices: getConnectedPhones(),
    botStatus: currentBotStatus
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
    getShop().systemSettings["SPOTIFY_TOKEN_EXPIRY"] = Date.now() + (response.data.expires_in * 1000)
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
  let tokenExpiry = getShop().systemSettings["SPOTIFY_TOKEN_EXPIRY"] || 0
  
  if (!accessToken || !refreshToken) {
    res.status(401).json({ error: "not_logged_in" })
    return
  }

  // Refresh if less than 5 minutes remaining, or if expiry is missing
  if (Date.now() > tokenExpiry - 5 * 60 * 1000 || !tokenExpiry) {
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
      if (refRes.data.expires_in) {
        getShop().systemSettings["SPOTIFY_TOKEN_EXPIRY"] = Date.now() + (refRes.data.expires_in * 1000)
      } else {
        getShop().systemSettings["SPOTIFY_TOKEN_EXPIRY"] = Date.now() + (3600 * 1000)
      }
      if (refRes.data.refresh_token) {
        getShop().systemSettings["SPOTIFY_REFRESH_TOKEN"] = refRes.data.refresh_token
      }
      getShop().saveSettings()
      accessToken = getShop().systemSettings["SPOTIFY_ACCESS_TOKEN"]
    } catch (refErr) {
      res.status(401).json({ error: "refresh_failed" })
      return
    }
  }

  res.json({ access_token: accessToken })
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
          time: new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }),
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

app.post('/set_tv_audio', requireAuth, (req: any, res: any): any => {
  const { source, station } = req.body
  if (source) getShop().systemSettings['TV_AUDIO_SOURCE'] = source
  if (station) getShop().systemSettings['TV_RADIO_STATION'] = station
  getShop().saveSettings()
  res.json({ success: true, source, station })
})
