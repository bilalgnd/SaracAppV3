import { loadJson, saveJson, storePaths } from './store'

export let systemSettings: Record<string, any> = { "YAZICI_ADI": "", "API_TOKEN": "123456" }
export let priceMemory: Record<string, number> = {}

export async function initializeModels() {
  systemSettings = await loadJson(storePaths.settings, { "YAZICI_ADI": "", "API_TOKEN": "123456" })
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
  // Trendyol Settings
  if (systemSettings["ENABLE_TRENDYOL"] === undefined) {
    systemSettings["ENABLE_TRENDYOL"] = false;
    changed = true;
  }
  if (!systemSettings["TRENDYOL_SUPPLIER_ID"]) {
    systemSettings["TRENDYOL_SUPPLIER_ID"] = "";
    changed = true;
  }
  if (!systemSettings["TRENDYOL_API_KEY"]) {
    systemSettings["TRENDYOL_API_KEY"] = "";
    changed = true;
  }
  if (!systemSettings["TRENDYOL_API_SECRET"]) {
    systemSettings["TRENDYOL_API_SECRET"] = "";
    changed = true;
  }
  if (!systemSettings["TRENDYOL_REF_CODE"]) {
    systemSettings["TRENDYOL_REF_CODE"] = "";
    changed = true;
  }
  if (!systemSettings["TRENDYOL_TOKEN"]) {
    systemSettings["TRENDYOL_TOKEN"] = "";
    changed = true;
  }
  if (!systemSettings["TRENDYOL_API_URL"]) {
    systemSettings["TRENDYOL_API_URL"] = "https://api.trendyol.com/integration/oms/core/t/orders?status=Created";
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
