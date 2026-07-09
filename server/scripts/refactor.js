const fs = require('fs');
let code = fs.readFileSync('src/server.ts', 'utf8');

const globals = ['activeOrders', 'pastOrders', 'systemSettings', 'customMenu', 'dailyQueueNo', 'dailyMasaNo', 'priceMemory', 'spotifyAuthNeeded', 'saveOrders', 'savePastOrders', 'saveMenu', 'saveSettings', 'savePrices', 'updateCustomMenu', 'getNextQueueNo', 'getNextMasaNo', 'getFullMenu'];

// Replace imports from models
code = code.replace(/import\s+\{([^}]+)\}\s+from\s+'\.\/models'/g, "import { getShop, shopContext } from './models'");

// Replace global usages
globals.forEach(g => {
  const regex = new RegExp('\\b' + g + '\\b', 'g');
  code = code.replace(regex, 'getShop().' + g);
});

fs.writeFileSync('src/server_new.ts', code);
console.log('Saved to server_new.ts');
