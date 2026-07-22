const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://bilalgnd00_db_user:nXYAd9YjvcDWfDCr@bilalshop.usdvvvn.mongodb.net/saracapp?retryWrites=true&w=majority&appName=BILALshop";

const DataSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed }
});

const DataModel = mongoose.model('Data', DataSchema);

async function main() {
  try {
    console.log('MongoDB Atlas\'a bağlanılıyor...');
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB Bağlandı.');

    const sysDoc = await DataModel.findOne({ key: 'systemSettings' });
    const settings = sysDoc?.value || {};
    
    const supplierId = settings.trendyolSupplierId || settings.TRENDYOL_SUPPLIER_ID || '6647850';
    const apiKey = settings.trendyolApiKey || settings.TRENDYOL_API_KEY || '';
    const apiSecret = settings.trendyolApiSecret || settings.TRENDYOL_API_SECRET || '';
    const apiEndpoint = settings.trendyolApiEndpoint || 'https://api.tgoapis.com/integrator';

    console.log(`Trendyol Supplier ID: ${supplierId}`);
    console.log(`Trendyol API Key Var mı?: ${apiKey ? 'EVET' : 'HAYIR'}`);

    let apiOrders = [];
    if (apiKey && apiSecret) {
      const authStr = `${apiKey}:${apiSecret}`;
      const authB64 = Buffer.from(authStr, 'utf-8').toString('base64');
      const headers = {
        "Authorization": `Basic ${authB64}`,
        "User-Agent": `${supplierId} - SelfIntegration`,
        "x-agentname": `${supplierId} - SelfIntegration`,
        "Content-Type": "application/json"
      };

      console.log('Trendyol API\'den tüm siparişler çekiliyor...');
      const statuses = ['Created', 'Picking', 'Invoiced', 'Shipped', 'Delivered', 'Cancelled', 'UnDelivered'];
      for (const st of statuses) {
        try {
          const res = await axios.get(`${apiEndpoint.replace(/\/$/, '')}/order/meal/suppliers/${supplierId}/packages?packageStatuses=${st}`, { headers });
          let contentArray = res.data?.content || res.data?.data?.content || [];
          if (Array.isArray(contentArray) && contentArray.length > 0) {
            console.log(`[${st}] ${contentArray.length} sipariş çekildi.`);
            apiOrders = apiOrders.concat(contentArray);
          }
        } catch(e) {
          console.log(`[${st}] Çekilemedi: ${e.message}`);
        }
      }
    } else {
      console.log('UYARI: Trendyol API Key/Secret bulunamadı, veritabanından çekiliyor.');
    }

    // Also load active and past orders from DB
    const activeDoc = await DataModel.findOne({ key: 'activeOrders' });
    const pastDoc = await DataModel.findOne({ key: 'pastOrders' });

    const activeOrders = activeDoc?.value || [];
    const pastOrders = pastDoc?.value || [];

    const dbTrendyolOrders = [...activeOrders, ...pastOrders].filter(o => 
      (o.platform || '').toLowerCase() === 'trendyol' || o._platform === 'trendyol' || o.packageNumber || o.supplierId
    );

    console.log(`Veritabanındaki Trendyol Sipariş Sayısı: ${dbTrendyolOrders.length}`);

    // Merge both sources and deduplicate by ID / orderNumber
    const orderMap = new Map();
    apiOrders.forEach(o => {
      const id = o.id || o.orderNumber || o.packageNumber;
      if (id) orderMap.set(String(id), o);
    });
    dbTrendyolOrders.forEach(o => {
      const id = o.id || o.orderNumber || o.packageNumber || o.order_id;
      if (id && !orderMap.has(String(id))) {
        orderMap.set(String(id), o);
      }
    });

    const allTrendyolOrders = Array.from(orderMap.values());
    console.log(`Toplam Benzersiz Trendyol Sipariş Sayısı: ${allTrendyolOrders.length}`);

    const desktopPath = path.join(process.env.USERPROFILE || 'C:\\Users\\bilal', 'Desktop', 'trendyol_siparisleri.json');
    fs.writeFileSync(desktopPath, JSON.stringify(allTrendyolOrders, null, 2), 'utf-8');

    console.log(`BAŞARILI: Tüm Trendyol siparişleri JSON olarak yazıldı -> ${desktopPath}`);
    process.exit(0);
  } catch(err) {
    console.error('Hata oluştu:', err);
    process.exit(1);
  }
}

main();
