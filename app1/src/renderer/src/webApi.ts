import axios from 'axios';

let listeners: { [event: string]: Function[] } = {};
let wsClient: WebSocket | null = null;
let reconnectTimer: any = null;

const getToken = () => localStorage.getItem('pos_token') || '';

const getBaseUrl = () => {
  return window.location.origin;
};

const getWsUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
};

// Setup axios defaults
axios.defaults.headers.common['Authorization'] = `Bearer ${getToken()}`;

function notifyListeners(event: string, action: string, data?: any) {
  if (listeners[event]) {
    listeners[event].forEach(cb => cb(action, data));
  }
}

export function connectWebSocket() {
  if (wsClient) {
    wsClient.close();
  }
  
  const token = getToken();
  if (!token) return;

  console.log('Connecting to Web WS...');
  wsClient = new WebSocket(`${getWsUrl()}?token=${token}`);

  wsClient.onopen = () => {
    console.log('Connected to Web WebSocket');
    notifyListeners('server-event', 'network_status', 'online');
  };

  wsClient.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (Array.isArray(msg)) {
        // It's the activeOrders array from the server
        notifyListeners('server-event', 'request_update');
      } else {
        if (msg.type === 'new_order') notifyListeners('server-event', 'new_order', msg.order);
        if (msg.type === 'update_order') notifyListeners('server-event', 'update_order', msg.order);
        if (msg.type === 'delete_order') notifyListeners('server-event', 'delete_order', msg.id);
        if (msg.type === 'settings_update') notifyListeners('server-event', 'settings_update', msg.settings);
        if (msg.type === 'menu_update') notifyListeners('server-event', 'menu_update', msg.menu);
        if (msg.type === 'daily_total_update') notifyListeners('server-event', 'daily_total_update', msg.total);
        if (msg.type === 'clear_past_orders') notifyListeners('server-event', 'clear_past_orders');
      }
    } catch (err) {
      console.error('WS parse err', err);
    }
  };

  wsClient.onclose = () => {
    console.log('Disconnected from WS. Reconnecting in 3s...');
    notifyListeners('server-event', 'network_status', 'offline');
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectWebSocket, 3000);
  };

  wsClient.onerror = () => {
    wsClient?.close();
  };
}

if (getToken()) {
  connectWebSocket();
}

export const webApi = {
  getOrders: async () => {
    try {
      const res = await axios.get(`${getBaseUrl()}/api/active_orders`);
      return res.data || [];
    } catch (e) {
      return [];
    }
  },
  getMenu: async () => {
    try {
      const res = await axios.get(`${getBaseUrl()}/menu`);
      return res.data;
    } catch (e) {
      return {};
    }
  },
  getSettings: async () => {
    try {
      const res = await axios.get(`${getBaseUrl()}/api/settings`);
      return res.data;
    } catch (e) {
      return {};
    }
  },
  getPrinters: async () => [],
  getNextQueueNo: async () => Date.now().toString().slice(-4),
  getTvLink: async () => `${getBaseUrl()}/tv`,
  getSpotifyLoginLink: async () => `${getBaseUrl()}/spotify/login`,
  restartTvTunnel: async () => `${getBaseUrl()}/tv`,
  
  saveOrders: async (orders: any[]) => {
    try {
      await axios.post(`${getBaseUrl()}/api/sync_orders`, orders);
    } catch (e) {}
  },
  saveSettings: async (_settings: any) => {},
  printReceipt: async (data: any) => {
    try {
      await axios.post(`${getBaseUrl()}/yazdir`, data);
    } catch (e) {}
  },
  exitApp: () => {
    localStorage.removeItem('pos_token');
    window.location.href = '/';
  },
  sendUpdateToPhones: async (_url: string) => {},
  updateDailyTotal: async (total: number) => {
    try {
      await axios.post(`${getBaseUrl()}/update_daily_total`, { dailyTotal: total });
    } catch (e) {}
  },
  savePastOrder: async (order: any) => {
    try {
      await axios.post(`${getBaseUrl()}/api/add_past_order`, { order });
    } catch (e) {}
  },
  deletePastOrder: async (index: number) => {
    try {
      await axios.post(`${getBaseUrl()}/api/delete_past_order`, { index });
    } catch (e) {}
  },
  clearPastOrders: async () => {
    try {
      await axios.post(`${getBaseUrl()}/api/clear_past_orders`);
    } catch (e) {}
  },
  getNetworkStatus: async () => 'online',
  getPastOrders: async () => {
    try {
      const res = await axios.get(`${getBaseUrl()}/api/past_orders`);
      return res.data;
    } catch (e) {
      return [];
    }
  },
  saveMenu: async (menu: any) => {
    try {
      await axios.post(`${getBaseUrl()}/menu`, menu);
    } catch (e) {}
  },
  importApiKeys: async () => ({}),
  exportApiKeys: async (_settings: any) => ({}),
  login: async (credentials: any) => {
    try {
      const res = await axios.post(`${getBaseUrl()}/api/login`, credentials);
      if (res.data.success && res.data.token) {
        localStorage.setItem('pos_token', res.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
        connectWebSocket();
        return res.data;
      }
      return { error: 'Giriş başarısız' };
    } catch (e: any) {
      return { error: e.response?.data?.error || e.message };
    }
  },
  register: async (credentials: any) => {
    try {
      const res = await axios.post(`${getBaseUrl()}/api/register`, credentials);
      return res.data;
    } catch (e: any) {
      return { error: e.response?.data?.error || e.message };
    }
  },
  exportMenu: async (_token?: string) => {
    try {
      const res = await axios.get(`${getBaseUrl()}/api/export_menu`);
      return res.data;
    } catch (e) {
      return null;
    }
  },
  importMenu: async ({ data }: any) => {
    try {
      const res = await axios.post(`${getBaseUrl()}/api/import_menu`, data);
      return res.data;
    } catch (e) {
      return null;
    }
  },
  
  checkForUpdates: async () => {},
  downloadUpdate: async () => {},
  installUpdate: async () => {},
  
  onUpdaterEvent: (callback: (action: string, data?: any) => void) => {
    if (!listeners['updater-event']) listeners['updater-event'] = [];
    listeners['updater-event'].push(callback);
    return callback;
  },
  offUpdaterEvent: (subscription: any) => {
    if (listeners['updater-event']) {
      listeners['updater-event'] = listeners['updater-event'].filter(cb => cb !== subscription);
    }
  },

  onServerEvent: (callback: (action: string, data?: any) => void) => {
    if (!listeners['server-event']) listeners['server-event'] = [];
    listeners['server-event'].push(callback);
    return callback;
  },
  offServerEvent: (subscription: any) => {
    if (listeners['server-event']) {
      listeners['server-event'] = listeners['server-event'].filter(cb => cb !== subscription);
    }
  },
  updatePrice: async (_obj: any) => {},
  minimizeWindow: () => {},
  maximizeWindow: () => {},
  closeWindow: () => {},
  
  onProcessPdf: (callback: (data: any) => void) => {
    if (!listeners['process-pdf']) listeners['process-pdf'] = [];
    listeners['process-pdf'].push(callback);
    return callback;
  },
  offProcessPdf: (subscription: any) => {
    if (listeners['process-pdf']) {
      listeners['process-pdf'] = listeners['process-pdf'].filter(cb => cb !== subscription);
    }
  },
  logSystemEvent: (message: string, type?: string) => {
    console.log(`[SystemEvent] [${type || 'info'}] ${message}`);
  }
};
