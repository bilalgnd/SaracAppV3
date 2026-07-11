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
  



  if (systemSettings["ENABLE_FILE_WATCHER"] === undefined) {
    systemSettings["ENABLE_FILE_WATCHER"] = false;
    changed = true;
  }

  if (systemSettings["PDF_LOGS_DIR"] === undefined) {
    systemSettings["PDF_LOGS_DIR"] = "";
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
