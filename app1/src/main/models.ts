import { loadJson, saveJson, storePaths } from './store'

export let systemSettings: Record<string, any> = { "YAZICI_ADI": "", "API_TOKEN": "123456" }
export let priceMemory: Record<string, number> = {}

export async function initializeModels() {
  console.log('[MODELS INIT] Loading settings from:', storePaths.settings);
  systemSettings = await loadJson(storePaths.settings, { "YAZICI_ADI": "", "API_TOKEN": "123456" })
  console.log('[MODELS INIT] Loaded systemSettings:', JSON.stringify(systemSettings));
  priceMemory = await loadJson(storePaths.prices, {})

  let changed = false;

  // Defaults if they don't exist
  if (!systemSettings["SPOTIFY_CLIENT_ID"]) {
    systemSettings["SPOTIFY_CLIENT_ID"] = "";
    changed = true;
  }
  if (!systemSettings["SPOTIFY_CLIENT_SECRET"]) {
    systemSettings["SPOTIFY_CLIENT_SECRET"] = "";
    changed = true;
  }
  
  // API_TOKEN is preserved across sessions
  if (!systemSettings["API_TOKEN"]) {
    systemSettings["API_TOKEN"] = "123456";
    changed = true;
  }
  



  // Deprecated settings removed  
  if (systemSettings["ENABLE_TRENDYOL"] === undefined) {
    systemSettings["ENABLE_TRENDYOL"] = false;
    changed = true;
  }
  if (systemSettings["TRENDYOL_SUPPLIER_ID"] === undefined) { systemSettings["TRENDYOL_SUPPLIER_ID"] = ""; changed = true; }
  if (systemSettings["TRENDYOL_API_KEY"] === undefined) { systemSettings["TRENDYOL_API_KEY"] = ""; changed = true; }
  if (systemSettings["TRENDYOL_API_SECRET"] === undefined) { systemSettings["TRENDYOL_API_SECRET"] = ""; changed = true; }
  if (systemSettings["TRENDYOL_REF_CODE"] === undefined) { systemSettings["TRENDYOL_REF_CODE"] = ""; changed = true; }
  if (systemSettings["TRENDYOL_TOKEN"] === undefined) { systemSettings["TRENDYOL_TOKEN"] = ""; changed = true; }
  // TRENDYOL_API_URL removed — endpoint is now constructed from supplier ID

  // Yemeksepeti Settings
  if (systemSettings["ENABLE_YEMEKSEPETI"] === undefined) {
    systemSettings["ENABLE_YEMEKSEPETI"] = false;
    changed = true;
  }
  if (!systemSettings["YEMEKSEPETI_CLIENT_ID"]) {
    systemSettings["YEMEKSEPETI_CLIENT_ID"] = "";
    changed = true;
  }
  if (!systemSettings["YEMEKSEPETI_CLIENT_SECRET"]) {
    systemSettings["YEMEKSEPETI_CLIENT_SECRET"] = "";
    changed = true;
  }
  if (!systemSettings["YEMEKSEPETI_ACCESS_TOKEN"]) {
    systemSettings["YEMEKSEPETI_ACCESS_TOKEN"] = "";
    changed = true;
  }
  if (!systemSettings["YEMEKSEPETI_TOKEN_EXPIRES"]) {
    systemSettings["YEMEKSEPETI_TOKEN_EXPIRES"] = 0;
    changed = true;
  }

  if (changed) {
    saveSettings();
  }
}

export function saveSettings() {
  saveJson(storePaths.settings, systemSettings)
}

export function savePrices() {
  saveJson(storePaths.prices, priceMemory)
}
