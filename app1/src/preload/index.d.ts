import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getOrders: () => Promise<any[]>
      getMenu: () => Promise<any>
      getSettings: () => Promise<any>
      getPrinters: () => Promise<any[]>
      getNextQueueNo: () => Promise<number>
      getTvLink: () => Promise<string>
      restartTvTunnel: () => Promise<string>
      openTrendyolLogs: () => Promise<void>
      saveOrders: (orders: any[]) => void
      saveSettings: (settings: any) => void
      printReceipt: (data: any) => void
      onServerEvent: (callback: (action: string, data?: any) => void) => any
      offServerEvent: (subscription: any) => void
      exitApp: () => void
      sendUpdateToPhones: (url: string) => void
      updateDailyTotal: (total: number) => void
      updatePrice: (productName: string, portion: string, price: number) => Promise<boolean>
      savePastOrder: (order: any) => void
      deletePastOrder: (index: number) => void
      clearPastOrders: () => void
      getNetworkStatus: () => Promise<any>
      getPastOrders: () => Promise<any[]>
      saveMenu: (menu: any) => void
      importApiKeys: () => Promise<{success: boolean, settings?: any, error?: string}>
      exportApiKeys: (settings: any) => Promise<{success: boolean, error?: string}>
      exportMenu: () => Promise<any>
      importMenu: (data: any) => Promise<any>
      checkForUpdates: () => Promise<void>
      downloadUpdate: () => Promise<void>
      installUpdate: () => Promise<void>
      onUpdaterEvent: (callback: (action: string, data?: any) => void) => any
      offUpdaterEvent: (subscription: any) => void
      minimizeWindow: () => void
      maximizeWindow: () => void
      closeWindow: () => void
    }
  }
}
