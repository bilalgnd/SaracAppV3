import 'dotenv/config';
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { join } from 'path';
import { readFileSync } from 'fs';
import * as fs from 'fs';
import * as path from 'path';
import jwt from 'jsonwebtoken';
import { initializeApp, cert } from 'firebase-admin/app';

import { env } from './config/env';
import { initializeDB } from './config/db';
import { corsMiddleware } from './middleware/cors';
import { loginRateLimiter, apiRateLimiter } from './middleware/rateLimiter';
import { getShop, shops, shopContext } from './models';

// ── Route imports ────────────────────────────────────────────────────────────
import authRouter from './routes/auth.routes';
import { adminRouter, setWss as setAdminWss, setNotifyUI as setAdminNotifyUI } from './routes/admin.routes';
import { menuApiRouter, menuRootRouter, setNotifyUI as setMenuNotifyUI } from './routes/menu.routes';
import { ordersRouter, setNotifyUI as setOrdersNotifyUI, setBroadcastUpdateToPhones as setOrdersBUTP, setGlobalDailyTotal } from './routes/orders.routes';
import trendyolRouter, { setNotifyUI as setTgoNotifyUI, setBroadcastUpdateToPhones as setTgoBUTP } from './routes/trendyol.routes';
import { startTrendyolPoller, setPollerNotifyUI, setPollerBroadcastUpdateToPhones, setPollerSendFcmNotification } from './services/trendyolPoller';
import yemeksepetiRouter, { setNotifyUI as setYsNotifyUI, setBroadcastUpdateToPhones as setYsBUTP } from './routes/yemeksepeti.routes';
import publicRouter, { setNotifyUI as setPublicNotifyUI, setBroadcastUpdateToPhones as setPublicBUTP } from './routes/public.routes';
import systemRouter, {
  setNotifyUI as setSystemNotifyUI,
  setBroadcastMessageToPhones as setSystemBMP,
  setSystemLogs,
  setAddSystemLog,
  setGetConnectedPhones,
} from './routes/system.routes';
import spotifyRouter from './routes/spotify.routes';

// ── Firebase Admin ───────────────────────────────────────────────────────────
try {
  const possiblePaths = [
    path.join(__dirname, '../firebase-adminsdk.json'),
    path.join(__dirname, '../../firebase-adminsdk.json'),
    path.join(__dirname, './firebase-adminsdk.json'),
    path.join(process.cwd(), 'firebase-adminsdk.json'),
    path.join(process.cwd(), 'server', 'firebase-adminsdk.json')
  ];
  const foundPath = possiblePaths.find(p => fs.existsSync(p));
  if (foundPath) {
    const serviceAccount = require(foundPath);
    initializeApp({ credential: cert(serviceAccount) });
    console.log('[firebase] Admin initialized successfully from:', foundPath);
  } else {
    console.log('[firebase] Init failed: firebase-adminsdk.json not found in paths.');
  }
} catch (e: any) {
  console.log('[firebase] Init failed:', e.message);
}

// ── System Logs ──────────────────────────────────────────────────────────────
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
    source, type, message,
  };
  systemLogs.unshift(log);
  if (systemLogs.length > 100) systemLogs.pop();
  const payload = JSON.stringify({ type: 'system_log', data: log });
  terminalClients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  });
}

// ── Express App ──────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(corsMiddleware);
app.use(apiRateLimiter);

// ── Shop context middleware (legacy token/shopId support) ────────────────────
app.use((req, res, next) => {
  let shopId = 'admin';
  const authHeader = req.headers['authorization'];
  let tokenToVerify = null;

  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      tokenToVerify = authHeader.split(' ')[1];
    } else {
      shopId = authHeader;
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
        const decoded: any = jwt.verify(tokenToVerify, env.JWT_SECRET);
        shopId = decoded.username || 'admin';
      } catch (e) {}
    } else {
      shopId = tokenToVerify;
    }
  }

  shopContext.run(shopId, () => next());
});

// ── Helper: getActiveShop (for routes that need req-based shop resolution) ──
export function getActiveShop(req: any) {
  let targetId = req?.query?.shop || req?.query?.shopId || req?.user?.username || req?.user?.shopId || shopContext.getStore();
  if (!targetId || targetId === 'admin' || targetId === 'bilalgnd' || targetId === 'default') targetId = 'sarac';
  const { ShopState, shops, getShop } = require('./models');
  if (!shops.has(targetId)) { const s = new ShopState(targetId); s.initialize(); shops.set(targetId, s); }
  return shops.get(targetId) || getShop();
}

// ── Static pages ─────────────────────────────────────────────────────────────
const webDir = path.join(__dirname, '..', 'public');

app.get('/login', (_req, res) => res.sendFile(join(__dirname, '../public/templates/login.html')));
app.get('/admintools', (_req, res) => res.sendFile(join(__dirname, '../public/templates/admintools.html')));
app.get('/apiorders', (_req, res) => res.sendFile(join(__dirname, '../public/templates/apiorders.html')));

app.use('/shared_files', express.static(path.join(__dirname, '..', 'shared_files')));
app.use('/static', express.static(join(webDir, 'static')));

// SPA Serving
app.get(['/pos', '/pos/'], (req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  if (/mobile|iphone|ipad|android|blackberry|opera mini|iemobile|wpdesktop/i.test(ua) && req.query.desktop !== '1') {
    return res.redirect('/pos-mobil');
  }
  next();
});
app.use('/pos', express.static(join(webDir, 'pos_app'), { setHeaders: (res) => { res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); } }));
app.get(/^\/pos(\/.*)?$/, (_req, res) => { res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); res.sendFile(join(webDir, 'pos_app', 'index.html')); });
app.use('/pos-mobil', express.static(join(webDir, 'pos_mobil'), { setHeaders: (res) => { res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); } }));
app.get(/^\/pos-mobil(\/.*)?$/, (_req, res) => { res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); res.sendFile(join(webDir, 'pos_mobil', 'index.html')); });
app.use('/qr', express.static(join(webDir, 'qr_app')));
app.get(/^\/qr(\/.*)?$/, (_req, res) => { res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); res.sendFile(join(webDir, 'qr_app', 'index.html')); });

app.get('/', (_req, res) => {
  try {
    const type = getShop().systemSettings['PORTFOLIO_MEDIA_TYPE'] || 'image';
    let html = readFileSync(join(webDir, 'templates/portfolio.html'), 'utf8');
    let mediaClass = '';
    if (type === 'video') mediaClass = 'show-video';
    else if (type === 'video2') mediaClass = 'show-video2';
    html = html.replace('id="rightPanel"', `id="rightPanel" class="${mediaClass}"`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) { res.sendFile(join(webDir, 'templates/portfolio.html')); }
});

app.get('/preview-3d', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(join(webDir, 'templates/portfolio_3d_preview.html'));
});

app.get(['/tv', '/tv-:shopId', '/tv/:shopId', /^\/tv(-[^\/]+)?\/?$/], (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(join(webDir, 'templates/tv.html'));
});

// ── API Routes ───────────────────────────────────────────────────────────────
// Rate limit login endpoints specifically
app.use('/api/login', loginRateLimiter);
app.use('/api/admin/login', loginRateLimiter);

app.use('/api', authRouter);
app.use('/api', adminRouter);
app.use('/api', menuApiRouter);
app.use('/', menuRootRouter);
app.use('/', ordersRouter);
app.use('/', trendyolRouter);
app.use('/', yemeksepetiRouter);
app.use('/', publicRouter);
app.use('/', systemRouter);
app.use('/spotify', spotifyRouter);

// ── HTTP Server + WebSocket ───────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// ── Broadcast helpers (exported for route use via setters) ───────────────────
export function broadcastUpdateToPhones(shop?: any) {
  const targetShop = shop || getShop();
  const data = JSON.stringify(targetShop.activeOrders);
  targetShop.connectedPhones.forEach((ws: any) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
    else targetShop.connectedPhones.delete(ws);
  });
}

export function getConnectedPhones(): any[] {
  const devicesMap = new Map<string, any>();
  getShop().connectedPhones.forEach((ws: any) => {
    if (ws.readyState === WebSocket.OPEN) {
      const username = ws.username;
      const deviceId = ws.deviceId;
      const isTv = ws.isTv;
      const ip = ws._socket?.remoteAddress?.replace('::ffff:', '') || 'Bilinmeyen IP';
      const connectedAt = ws.connectedAt || Date.now();
      let type = 'Bilinmeyen Cihaz';
      if (isTv) type = 'TV Ekranı';
      else if (deviceId?.startsWith('PC-')) type = 'Masaüstü (Kasa)';
      else if (deviceId?.startsWith('MOB-')) type = 'Garson Uygulaması';
      else if (username) type = 'Garson Uygulaması';
      const id = deviceId || username || ip;
      const existing = devicesMap.get(id);
      if (!existing || connectedAt > existing.connectedAt) devicesMap.set(id, { id, type, ip, connectedAt });
    }
  });
  return Array.from(devicesMap.values()).sort((a, b) => b.connectedAt - a.connectedAt);
}

export function broadcastMessageToPhones(messageObj: any, shop?: any) {
  const targetShop = shop || getShop();
  const data = JSON.stringify(messageObj);
  targetShop.connectedPhones.forEach((ws: any) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });
}

export function notifyUI(action: string, data?: any, shop?: any) {
  broadcastMessageToPhones({ type: 'server-event', action, data }, shop);
}

// ── Wire setters (inject server functions into route modules) ─────────────────
setAdminWss(wss);
setAdminNotifyUI(notifyUI);
setMenuNotifyUI(notifyUI);
setOrdersNotifyUI(notifyUI);
setOrdersBUTP(broadcastUpdateToPhones);
setTgoNotifyUI(notifyUI);
setTgoBUTP(broadcastUpdateToPhones);
setPollerNotifyUI(notifyUI);
setPollerBroadcastUpdateToPhones(broadcastUpdateToPhones);
setYsNotifyUI(notifyUI);
setYsBUTP(broadcastUpdateToPhones);
setPublicNotifyUI(notifyUI);
setPublicBUTP(broadcastUpdateToPhones);
setSystemNotifyUI(notifyUI);
setSystemBMP(broadcastMessageToPhones);
setSystemLogs(systemLogs);
setAddSystemLog(addSystemLog);
setGetConnectedPhones(getConnectedPhones);

// ── WebSocket Handler ─────────────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
  const token = urlParams.get('token');
  const explicitShopId = urlParams.get('shopId');
  const isTv = urlParams.get('tv') === 'true';
  const isTerminal = urlParams.get('isTerminal') === 'true';
  const deviceId = urlParams.get('deviceId');

  let shopId: string | null = null;
  let jwtDecoded: any = null;

  if (isTerminal) {
    terminalClients.push(ws);
    ws.on('close', () => {
      const index = terminalClients.indexOf(ws);
      if (index > -1) terminalClients.splice(index, 1);
    });
    ws.send(JSON.stringify({ type: 'system_log_history', data: systemLogs }));
    return;
  }

  if (token) {
    if (token.length > 20) {
      try { jwtDecoded = jwt.verify(token, env.JWT_SECRET); shopId = (jwtDecoded as any).username; } catch (e) {}
    }
    if (!jwtDecoded) {
      for (const [sId, shop] of shops.entries()) {
        if (shop.systemSettings['API_TOKEN'] === token) { shopId = sId; break; }
      }
    }
  } else if (explicitShopId) {
    shopId = (explicitShopId === 'admin' || explicitShopId === 'bilalgnd') ? 'sarac' : explicitShopId;
  } else if (isTv) {
    shopId = 'sarac';
  }

  if (!shopId || shopId === 'admin' || shopId === 'bilalgnd') shopId = 'sarac';
  if (!shopId) { ws.close(1008, 'Unauthorized'); return; }

  (ws as any).deviceId = deviceId;
  (ws as any).isTv = isTv;
  (ws as any).shopId = shopId;
  (ws as any).username = jwtDecoded ? (jwtDecoded as any).username : shopId;
  (ws as any).connectedAt = Date.now();

  shopContext.run(shopId, () => {
    if (!isTv) {
      if (!jwtDecoded && token !== getShop().systemSettings.API_TOKEN) {
        console.log('Phone rejected (Invalid Token)');
        ws.close(1008, 'Unauthorized');
        return;
      }
      if (jwtDecoded) (ws as any).username = (jwtDecoded as any).username;
    }

    console.log('Phone connected');
    getShop().connectedPhones.add(ws);
    const appName = isTv ? 'TV_EKRAN' : (jwtDecoded ? ((jwtDecoded as any).role === 'kasa' ? 'App1' : 'App2') : 'App1');
    addSystemLog(appName, 'success', 'Sunucuya başarıyla bağlandı.');
    ws.send(JSON.stringify(getShop().activeOrders));
    notifyUI('request_update');

    (ws as any).isAlive = true;
    ws.on('pong', () => shopContext.run(shopId, () => { (ws as any).isAlive = true; }));

    ws.on('message', (messageRaw) => {
      shopContext.run(shopId, () => {
        (ws as any).isAlive = true;
        try {
          const msgStr = messageRaw.toString();
          if (msgStr === 'ping' || msgStr === 'pong') return;
          const data = JSON.parse(msgStr);
          if (data.type === 'remote_command' || data.type === 'remote_response' || data.type.startsWith('remote_fs_')) {
            const targetShop = getShop();
            const targetId = data.targetDeviceId;
            let targetWs: any = null;
            for (const client of targetShop.connectedPhones) {
              const cDeviceId = (client as any).deviceId;
              if (cDeviceId === targetId || (client as any).username === targetId) { targetWs = client; break; }
              if (targetId === 'KASA' && cDeviceId?.startsWith('PC-')) { targetWs = client; break; }
            }
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              data.senderId = (ws as any).deviceId || (ws as any).username;
              targetWs.send(JSON.stringify(data));
            } else if (data.type === 'remote_command') {
              ws.send(JSON.stringify({ type: 'remote_response', commandId: data.commandId, output: `HATA: Hedef cihaz (${targetId}) çevrimdışı.` }));
            }
          }
        } catch (e) {}
      });
    });

    ws.on('close', () => {
      shopContext.run(shopId, () => {
        console.log('Phone disconnected');
        addSystemLog(appName, 'warning', 'WebSocket bağlantısı koptu.');
        getShop().connectedPhones.delete(ws);
      });
    });
  });
});

// Heartbeat interval
setInterval(() => {
  for (const shop of shops.values()) {
    shop.checkDailyReset();
    shop.connectedPhones.forEach((ws: any) => {
      if (ws.isAlive === false) { shop.connectedPhones.delete(ws); return ws.terminate(); }
      ws.isAlive = false;
      ws.ping();
    });
  }
}, 30000);

// ── Global Daily Total (for orders.routes) ────────────────────────────────────
let globalDailyTotal = getShop().systemSettings['dailyTotal'] || 0;
setGlobalDailyTotal(globalDailyTotal);

export function setGlobalDailyTotalState(total: number) {
  globalDailyTotal = total;
  getShop().systemSettings['dailyTotal'] = total;
  getShop().saveSettings();
}

// ── Start Server ──────────────────────────────────────────────────────────────
initializeDB().then(() => {
  server.listen(env.PORT, '0.0.0.0', () => {
    console.log(`[server] Running on port ${env.PORT}`);
    startTrendyolPoller(15000);
  });
}).catch((err) => {
  console.error('[server] Startup failed:', err);
  process.exit(1);
});
