import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { AsyncLocalStorage } from 'async_hooks';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI || '')
  .then(() => console.log('MongoDB Atlas Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

const DataSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed }
});

const DataModel = mongoose.model('Data', DataSchema);

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'kasa', 'garson'], default: 'garson' },
  account_id: { type: String },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  lastSeen: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

const UserModel = mongoose.model('User', UserSchema);

const ActivityLogSchema = new mongoose.Schema({
  username: { type: String, required: true },
  shopId: { type: String },
  action: { type: String, required: true },
  details: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const ActivityLogModel = mongoose.model('ActivityLog', ActivityLogSchema);

export { DataModel, UserModel, ActivityLogModel };

export const PAID_EXTRAS = { Cheddar: 70, Kasarli: 70 }

export const shopContext = new AsyncLocalStorage<string>();

export class ShopState {
  shopId: string;
  priceMemory: Record<string, number> = {};
  systemSettings: Record<string, any> = { YAZICI_ADI: "" };
 activeOrders: any[] = [];
 pastOrders: any[] = [];
 customMenu: any = null;
 dailyQueueNo = 1;
  dailyMasaNo = 1;
  spotifyAuthNeeded = false;
  connectedPhones: Set<any> = new Set();
  processedIdempotencyKeys: Set<string> = new Set();
  tgoCustomerStats: Record<string, number> = {};
  tgoProcessedOrders: Set<string> = new Set();

  constructor(shopId: string) {
 this.shopId = shopId;
 }

 getDbKey(key: string) {
 if (this.shopId === 'admin') return key;
 return this.shopId + '_' + key;
 }

 async loadFromDB(key: string, defaultVal: any) {
 try {
 const doc = await DataModel.findOne({ key: this.getDbKey(key) });
 return doc ? doc.value : defaultVal;
 } catch (err) {
 return defaultVal;
 }
 }

 async saveToDB(key: string, value: any) {
 try {
 await DataModel.findOneAndUpdate({ key: this.getDbKey(key) }, { value }, { upsert: true });
 } catch (err) { }
 }

  isInitialized: boolean = false;

  async initialize() {
    this.priceMemory = await this.loadFromDB('priceMemory', {});
    const loadedSettings = await this.loadFromDB('systemSettings', null);
    if (loadedSettings && typeof loadedSettings === 'object') {
      this.systemSettings = { ...this.systemSettings, ...loadedSettings };
    }
    this.activeOrders = await this.loadFromDB('activeOrders', []);
    this.pastOrders = await this.loadFromDB('pastOrders', []);
    this.customMenu = await this.loadFromDB('customMenu', null);
    this.tgoCustomerStats = await this.loadFromDB('tgoCustomerStats', {});
    const savedTgoOrders = await this.loadFromDB('tgoProcessedOrders', []);
    this.tgoProcessedOrders = new Set(savedTgoOrders);
  
    let changed = false;
    if (!this.systemSettings['SPOTIFY_CLIENT_ID'] && process.env.SPOTIFY_CLIENT_ID) {
      this.systemSettings['SPOTIFY_CLIENT_ID'] = process.env.SPOTIFY_CLIENT_ID;
      changed = true;
      this.spotifyAuthNeeded = true;
    }
    if (!this.systemSettings['SPOTIFY_CLIENT_SECRET'] && process.env.SPOTIFY_CLIENT_SECRET) {
      this.systemSettings['SPOTIFY_CLIENT_SECRET'] = process.env.SPOTIFY_CLIENT_SECRET;
      changed = true;
    }

    // Preserve & sync Trendyol Keys across camelCase and UPPERCASE formats without overwriting with empty env values
    const existingSupplierId = this.systemSettings.trendyolSupplierId || this.systemSettings.TRENDYOL_SUPPLIER_ID;
    if (existingSupplierId) {
      this.systemSettings.trendyolSupplierId = existingSupplierId;
      this.systemSettings.TRENDYOL_SUPPLIER_ID = existingSupplierId;
    } else if (process.env.TRENDYOL_SUPPLIER_ID) {
      this.systemSettings.trendyolSupplierId = process.env.TRENDYOL_SUPPLIER_ID;
      this.systemSettings.TRENDYOL_SUPPLIER_ID = process.env.TRENDYOL_SUPPLIER_ID;
      changed = true;
    }

    const existingApiKey = this.systemSettings.trendyolApiKey || this.systemSettings.TRENDYOL_API_KEY;
    if (existingApiKey) {
      this.systemSettings.trendyolApiKey = existingApiKey;
      this.systemSettings.TRENDYOL_API_KEY = existingApiKey;
    } else if (process.env.TRENDYOL_API_KEY) {
      this.systemSettings.trendyolApiKey = process.env.TRENDYOL_API_KEY;
      this.systemSettings.TRENDYOL_API_KEY = process.env.TRENDYOL_API_KEY;
      changed = true;
    }

    const existingApiSecret = this.systemSettings.trendyolApiSecret || this.systemSettings.TRENDYOL_API_SECRET;
    if (existingApiSecret) {
      this.systemSettings.trendyolApiSecret = existingApiSecret;
      this.systemSettings.TRENDYOL_API_SECRET = existingApiSecret;
    } else if (process.env.TRENDYOL_API_SECRET) {
      this.systemSettings.trendyolApiSecret = process.env.TRENDYOL_API_SECRET;
      this.systemSettings.TRENDYOL_API_SECRET = process.env.TRENDYOL_API_SECRET;
      changed = true;
    }

    const existingStoreId = this.systemSettings.trendyolStoreId || this.systemSettings.TRENDYOL_STORE_ID;
    if (existingStoreId) {
      this.systemSettings.trendyolStoreId = existingStoreId;
      this.systemSettings.TRENDYOL_STORE_ID = existingStoreId;
    } else if (process.env.TRENDYOL_STORE_ID) {
      this.systemSettings.trendyolStoreId = process.env.TRENDYOL_STORE_ID;
      this.systemSettings.TRENDYOL_STORE_ID = process.env.TRENDYOL_STORE_ID;
      changed = true;
    }

    if (!this.systemSettings['API_TOKEN']) {
      this.systemSettings['API_TOKEN'] = '123456';
      changed = true;
    }

    this.isInitialized = true;

    if (changed) {
      this.saveSettings();
    }
    if (this.systemSettings.dailyQueueNo) this.dailyQueueNo = this.systemSettings.dailyQueueNo;
    if (this.systemSettings.dailyMasaNo) this.dailyMasaNo = this.systemSettings.dailyMasaNo;
  }

  saveOrders() { this.saveToDB('activeOrders', this.activeOrders); }
  savePastOrders() { this.saveToDB('pastOrders', this.pastOrders); }
  saveMenu() { this.saveToDB('customMenu', this.customMenu); }
  saveSettings() { 
    if (!this.isInitialized) {
      console.warn(`[ShopState] Blocked premature saveSettings call for ${this.shopId}!`);
      return;
    }
    this.saveToDB('systemSettings', this.systemSettings); 
  }
  savePrices() { this.saveToDB('priceMemory', this.priceMemory); }
  saveTgoStats() { 
    this.saveToDB('tgoCustomerStats', this.tgoCustomerStats); 
    this.saveToDB('tgoProcessedOrders', Array.from(this.tgoProcessedOrders)); 
  }
 
 updateCustomMenu(newMenu: any) {
 this.customMenu = newMenu;
 this.saveMenu();
 }

 getNextQueueNo() {
 const current = this.dailyQueueNo;
 this.dailyQueueNo++;
 this.systemSettings.dailyQueueNo = this.dailyQueueNo;
 this.saveSettings();
 return current;
 }

 getNextMasaNo() {
 const current = this.dailyMasaNo;
 this.dailyMasaNo++;
 this.systemSettings.dailyMasaNo = this.dailyMasaNo;
 this.saveSettings();
 return current;
 }

 getFullMenu() {
 if (this.customMenu) return this.customMenu;
 return {
 meat: [],
 chicken: [],
 drinks: [],
 categories: []
 };
 }
}

export const shops = new Map<string, ShopState>();

export function getShop(): ShopState {
 let shopId = shopContext.getStore() || 'admin';
 if (shopId === 'bilalgnd') {
   shopId = 'admin';
 }
 if (!shops.has(shopId)) {
 const shop = new ShopState(shopId);
 shops.set(shopId, shop);
 shop.initialize();
 }
 return shops.get(shopId)!;
}
export async function initializeModels() {
  const adminShop = new ShopState('admin');
  await adminShop.initialize();
  shops.set('admin', adminShop);

  const users = await UserModel.find({});
  for (const user of users) {
    if (user.username !== 'admin') {
      const shop = new ShopState(user.username);
      await shop.initialize();
      shops.set(user.username, shop);
    }
  }
}
