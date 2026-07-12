import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getOrders: () => ipcRenderer.invoke('get-orders'),
  getMenu: () => ipcRenderer.invoke('get-menu'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  getNextQueueNo: () => ipcRenderer.invoke('get-next-queue-no'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getTvLink: () => ipcRenderer.invoke('get-tv-link'),
  getSpotifyLoginLink: () => ipcRenderer.invoke('get-spotify-login-link'),
  restartTvTunnel: () => ipcRenderer.invoke('restart-tv-tunnel'),
  saveOrders: (orders: any[]) => ipcRenderer.send('save-orders', orders),
  saveSettings: (settings: any) => ipcRenderer.send('save-settings', settings),
  printReceipt: (data: any) => ipcRenderer.send('print-receipt', data),
  exitApp: () => ipcRenderer.send('exit-app'),
  sendUpdateToPhones: (url: string) => ipcRenderer.send('send-update-to-phones', url),
  updateDailyTotal: (total: number) => ipcRenderer.send('update-daily-total', total),
  savePastOrder: (order: any) => ipcRenderer.send('save-past-order', order),
  deletePastOrder: (index: number) => ipcRenderer.send('delete-past-order', index),
  clearPastOrders: () => ipcRenderer.send('clear-past-orders'),
  dumpOcrLog: (text: string) => ipcRenderer.send('dump-ocr-log', text),
  logSystemEvent: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => ipcRenderer.send('log-system-event', { message, type }),
  getNetworkStatus: () => ipcRenderer.invoke('get-network-status'),
  getPastOrders: () => ipcRenderer.invoke('get-past-orders'),
  saveMenu: (menu: any) => ipcRenderer.send('save-menu', menu),
  importApiKeys: () => ipcRenderer.invoke('import-api-keys'),
  exportApiKeys: (settings: any) => ipcRenderer.invoke('export-api-keys', settings),
  login: (credentials: any) => ipcRenderer.invoke('login', credentials),
  register: (credentials: any) => ipcRenderer.invoke('register', credentials),
  exportMenu: (token?: string) => ipcRenderer.invoke('export-menu', token),
  importMenu: (token: string, data: any) => ipcRenderer.invoke('import-menu', { token, data }),
  
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  
  onUpdaterEvent: (callback: (action: string, data?: any) => void) => {
    const subscription = (_event: any, args: any) => callback(args.action, args.data)
    ipcRenderer.on('updater-event', subscription)
    return subscription
  },
  offUpdaterEvent: (subscription: any) => {
    ipcRenderer.removeListener('updater-event', subscription)
  },

  onServerEvent: (callback: (action: string, data?: any) => void) => {
    const subscription = (_event: any, args: any) => callback(args.action, args.data)
    ipcRenderer.on('server-event', subscription)
    return subscription
  },
  offServerEvent: (subscription: any) => {
    ipcRenderer.removeListener('server-event', subscription)
  },
  onProcessPdf: (callback: (data: any) => void) => {
    const subscription = (_event: any, args: any) => {
      console.log('IPC process-pdf tetiklendi, callback çağrılıyor...');
      callback(args);
    };
    ipcRenderer.on('process-pdf', subscription)
    return subscription
  },
  offProcessPdf: (subscription: any) => {
    ipcRenderer.removeListener('process-pdf', subscription)
  },
  updatePrice: (productName: string, portion: string, price: number) => ipcRenderer.invoke('update-price', { productName, portion, price }),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

