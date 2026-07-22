/// <reference types="vite/client" />

interface Api {
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
    exitApp: () => void
    sendUpdateToPhones: (url: string) => void
    updateDailyTotal: (total: number) => void
    savePastOrder: (order: any) => void
    deletePastOrder: (index: number) => void
    clearPastOrders: () => void
    getNetworkStatus: () => Promise<any>
    getPastOrders: () => Promise<any[]>
    saveMenu: (menu: any) => void
    importApiKeys: () => Promise<{success: boolean, settings?: any, error?: string}>
    exportApiKeys: (settings: any) => Promise<{success: boolean, error?: string}>
    login: (credentials: any) => Promise<any>
    register: (credentials: any) => Promise<any>
    exportMenu: () => Promise<any>
    importMenu: (data: any) => Promise<any>
    onServerEvent: (callback: (action: string, data?: any) => void) => any
    offServerEvent: (subscription: any) => void
    updatePrice: (productName: string, portion: string, price: number) => Promise<void>
    checkForUpdates: () => Promise<any>
    downloadUpdate: () => Promise<any>
    installUpdate: () => Promise<any>
    onUpdaterEvent: (callback: (action: string, data?: any) => void) => any
    offUpdaterEvent: (subscription: any) => void
    logSystemEvent: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
    updateTgoOrderStatus: (packageId: string, statusType: string) => Promise<{success: boolean, error?: string}>
}

interface Window {
    api: Api
}
