import { app, shell, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import express from 'express'
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
import { startBotService, stopBotService } from './botService'
import { startFileWatcher, stopFileWatcher } from './fileWatcher'
import { printReceipt } from './printer'
import axios from 'axios'
import WebSocket from 'ws'

let mainWindow: BrowserWindow
let isQuitting = false

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

const localApp = express()
localApp.use(express.json())

localApp.post('/trendyol_web_siparis', async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  if (!systemSettings.ENABLE_EXTENSION) {
    return res.status(403).json({ error: "Extension listener is disabled" });
  }
  try {
    const response = await axios.post(`${CLOUD_URL}/trendyol_web_siparis`, req.body)
    res.json(response.data)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

localApp.post('/yemeksepeti_siparis', async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  if (!systemSettings.ENABLE_EXTENSION) {
    return res.status(403).json({ error: "Extension listener is disabled" });
  }
  try {
    const response = await axios.post(`${CLOUD_URL}/yemeksepeti_siparis`, req.body)
    res.json(response.data)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

localApp.post('/api/extension_logs', async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  try {
    const response = await axios.post(`${CLOUD_URL}/api/extension_logs`, req.body)
    res.json(response.data)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

localApp.listen(5000, () => {
  console.log('Local extension bridge listening on port 5000')
})

function connectWebSocket() {
  const token = systemSettings.API_TOKEN || ''
  console.log('Connecting to WS with token:', token)
  wsClient = new WebSocket(`${WS_URL}?token=${token}`)

  wsClient.on('open', () => {
    console.log('Connected to Cloud WebSocket')
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-event', { action: 'network_status', status: 'online' })
    }
  })

  wsClient.on('message', (data: any) => {
    try {
      const parsed = JSON.parse(data.toString())
      if (parsed.type === 'server-event') {
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
    console.log('Cloud WS disconnected. Reconnecting in 3s...')
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

  if (systemSettings.ENABLE_LOCAL_BOT) {
    startBotService()
  }

  if (systemSettings.ENABLE_FILE_WATCHER) {
    startFileWatcher()
  }

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
      sandbox: false
    }
  })

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
  ipcMain.handle('restart-tv-tunnel', getTvUrlWithShop)
  
  ipcMain.handle('get-settings', () => systemSettings)
  ipcMain.on('save-settings', async (_, settings) => {
    Object.assign(systemSettings, settings)
    saveSettings()
    axios.defaults.headers.common['Authorization'] = systemSettings.API_TOKEN
    wsClient?.close() // Force reconnect with new token
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

    // Handle bot toggle
    if (settings.ENABLE_LOCAL_BOT) {
      startBotService();
    } else {
      stopBotService();
    }

    // Handle file watcher toggle
    if (settings.ENABLE_FILE_WATCHER) {
      startFileWatcher();
    } else {
      stopFileWatcher();
    }
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
      return res.data
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
    await printReceipt(custName, new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }), data.items || [], total, data.order_note || "")
  })

  ipcMain.on('send-update-to-phones', () => {})

  // --- Auto Updater ---
  autoUpdater.autoDownload = false

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('updater-event', { action: 'checking' })
  })
  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater-event', { action: 'update-available', data: info })
  })
  autoUpdater.on('update-not-available', (info) => {
    mainWindow?.webContents.send('updater-event', { action: 'update-not-available', data: info })
  })
  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('updater-event', { action: 'error', data: err.message })
  })
  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow?.webContents.send('updater-event', { action: 'download-progress', data: progressObj })
  })
  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updater-event', { action: 'update-downloaded', data: info })
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

  ipcMain.on('exit-app', () => {
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
