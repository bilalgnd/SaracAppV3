import express from 'express';
import axios from 'axios';
import { requireAdminAuth, requireAuth } from '../middleware/auth'; // Adjust import paths as necessary
import { idempotencyMiddleware } from '../middleware/idempotency'; // Adjust import paths as necessary
import { getShop } from '../models'; // Düzeltildi: models'dan import
import { DataModel } from '../models'; // Adjust import paths as necessary

const router = express.Router();

export let notifyUI: any = () => {};
export const setNotifyUI = (fn: any) => notifyUI = fn;

export let broadcastUpdateToPhones: any = () => {};
export const setBroadcastUpdateToPhones = (fn: any) => broadcastUpdateToPhones = fn;

export let sendFcmNotification: any = () => {};
export const setSendFcmNotification = (fn: any) => sendFcmNotification = fn;

const getTrendyolSupplierId = () => {
  const shop = getShop();
  const settings = shop?.systemSettings || {};
  return settings.trendyolSupplierId || process.env.TRENDYOL_SUPPLIER_ID || '6647850';
};

const getTrendyolStoreId = () => {
  const shop = getShop();
  const settings = shop?.systemSettings || {};
  return settings.trendyolStoreId || settings.TRENDYOL_STORE_ID || process.env.TRENDYOL_STORE_ID || '367376';
};

const resolveTrendyolStoreId = async () => {
  const shop = getShop();
  const settings = shop?.systemSettings || {};
  if (settings.trendyolStoreId || settings.TRENDYOL_STORE_ID) {
    return settings.trendyolStoreId || settings.TRENDYOL_STORE_ID;
  }
  if (process.env.TRENDYOL_STORE_ID) {
    return process.env.TRENDYOL_STORE_ID;
  }
  try {
    const supplierId = getTrendyolSupplierId();
    const response = await axios.get(`${getTgoBaseUrl()}/store/meal/suppliers/${supplierId}/stores`, {
      headers: getTgoHeaders()
    });
    if (response.data) {
      const stores = response.data.restaurants || response.data.stores || response.data;
      if (Array.isArray(stores) && stores.length > 0 && stores[0].id) {
        return String(stores[0].id);
      }
    }
  } catch (e: any) {
    console.error('Failed to auto-discover Trendyol storeId:', e.message);
  }
  return '367376';
};

const getTgoHeaders = () => {
  const shop = getShop();
  const settings = shop?.systemSettings || {};
  
  const supplierId = getTrendyolSupplierId();
  const apiKey = settings.trendyolApiKey || process.env.TRENDYOL_API_KEY || '';
  const apiSecret = settings.trendyolApiSecret || process.env.TRENDYOL_API_SECRET || '';
  const authStr = `${apiKey}:${apiSecret}`;
  const authB64 = Buffer.from(authStr, 'utf-8').toString('base64');
  const executorUser = settings.trendyolExecutorUser || process.env.TRENDYOL_EXECUTOR_USER || '';
  
  return {
    "Authorization": `Basic ${authB64}`,
    "User-Agent": `${supplierId} - SelfIntegration`,
    "x-agentname": `${supplierId} - SelfIntegration`,
    "x-executor-user": executorUser,
    "Content-Type": "application/json"
  };
};

const getTgoBaseUrl = () => { const s = getShop().systemSettings || {}; let b = s.trendyolApiEndpoint || 'https://api.tgoapis.com/integrator'; if(b.endsWith('/')) b=b.slice(0,-1); return b; };

router.get('/api/tgo/orders', requireAdminAuth, async (req: any, res: any) => {
  try {
    const status = req.query.status || 'Created';
    const supplierId = getTrendyolSupplierId();
    const queryStr = status === 'all' ? '' : `?packageStatuses=${status}`;
    const response = await axios.get(`${getTgoBaseUrl()}/order/meal/suppliers/${supplierId}/packages${queryStr}`, {
      headers: getTgoHeaders()
    });

    if (response.data) {
        let contentArray = response.data.content || (response.data.data && response.data.data.content);
        if (!contentArray && Array.isArray(response.data)) {
            contentArray = response.data;
        }

        if (Array.isArray(contentArray)) {
            // Sort orders by creation date ascending to count correctly
            const sorted = [...contentArray].sort((a: any, b: any) => {
                const da = a.packageCreationDate || a.createdAt || 0;
                const db2 = b.packageCreationDate || b.createdAt || 0;
                return da - db2;
            });

            // Count how many times each customer appears (cumulative per order date)
            const customerOrderIndex: Record<string, number> = {};
            const orderCountMap: Record<string, number> = {};
            for (const o of sorted) {
                if (o && o.customer && o.customer.id) {
                    const cid = String(o.customer.id);
                    customerOrderIndex[cid] = (customerOrderIndex[cid] || 0) + 1;
                    orderCountMap[String(o.id)] = customerOrderIndex[cid];
                }
            }

            const modifiedArray = contentArray.map((origOrder: any) => {
                const order = JSON.parse(JSON.stringify(origOrder));
                if (order && order.customer && order.customer.id) {
                    const count = orderCountMap[String(order.id)] || 1;
                    if (!order.customer) order.customer = {};
                    order.customer.orderCount = count;
                    order.orderCount = count;
                }
                return order;
            });

            if (response.data.content !== undefined) {
                response.data.content = modifiedArray;
            } else if (response.data.data && response.data.data.content !== undefined) {
                response.data.data.content = modifiedArray;
            } else if (Array.isArray(response.data)) {
                response.data = modifiedArray;
            }
        }
    }

    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.message, data: error.response?.data });
  }
});

// Mock orders storage for DEV environment (/apiorders-dev)
export let mockDevOrders: any[] = [
  {
    "id": 999901,
    "orderNumber": "TG-MOCK-782",
    "platform": "trendyol",
    "_platform": "trendyol",
    "packageStatus": "Created",
    "status": "Created",
    "orderDate": Date.now() - 300000,
    "packageCreationDate": Date.now() - 300000,
    "deliveryType": "RESTAURANT",
    "totalPrice": 240.00,
    "customer": {
      "id": 88412,
      "firstName": "Şeyda",
      "lastName": "K.",
      "orderCount": 12
    },
    "address": {
      "address1": "İstiklal Kesenkes Sk. no:10",
      "address2": "",
      "city": "Çanakkale",
      "cityCode": 17,
      "cityId": 116,
      "district": "Biga",
      "districtId": 338,
      "neighborhoodId": 12622,
      "neighborhood": "İstiklal Mah",
      "apartmentNumber": "10",
      "floor": "3",
      "doorNumber": "6",
      "addressDescription": "Parkın yanındaki sarı bina, 3. kat"
    },
    "lines": [
      {
        "productId": 715310,
        "productName": "Tavuk Döner Dürüm",
        "quantity": 1,
        "price": 140.00,
        "extraIngredients": [],
        "removedIngredients": [
          { "id": 715314, "name": "Domates" },
          { "id": 715312, "name": "Soğan" }
        ],
        "notes": "Soğansız ve domatessiz olsun lütfen"
      },
      {
        "productId": 715320,
        "productName": "Tavuk Döner Dürüm",
        "quantity": 2,
        "price": 280.00,
        "extraIngredients": [],
        "removedIngredients": [],
        "notes": "Normal olsun (Servis Istiyorum)"
      },
      {
        "productId": 9982,
        "productName": "Ayran 30cl",
        "quantity": 1,
        "price": 20.00,
        "extraIngredients": [],
        "removedIngredients": []
      }
    ],
    "customerNote": "Soğansız ve domatessiz sipariş hazırlarsanız sevinirim (Servis İstiyorum)",
    "isMock": true
  },
  {
    "id": 999902,
    "orderNumber": "YS-MOCK-304",
    "platform": "yemeksepeti",
    "_platform": "yemeksepeti",
    "packageStatus": "Created",
    "status": "Created",
    "orderDate": Date.now() - 120000,
    "packageCreationDate": Date.now() - 120000,
    "deliveryType": "RESTAURANT",
    "paymentMethod": "ONLINE",
    "totalPrice": 215.00,
    "customer": {
      "id": 99312,
      "firstName": "Caner",
      "lastName": "D.",
      "orderCount": 8
    },
    "address": {
      "address1": "Sakarya Mah. Kıbrıs Şehitleri Cad. No:42",
      "address2": "",
      "city": "Çanakkale",
      "cityCode": 17,
      "district": "Biga",
      "neighborhood": "Sakarya Mah",
      "apartmentNumber": "42",
      "floor": "1",
      "doorNumber": "2",
      "addressDescription": "Yemeksepeti Dev Mock Siparişi (Zil Çalmayın)"
    },
    "lines": [
      {
        "productId": 801,
        "productName": "Yemeksepeti Özel Dürüm Menü (Tavuk Döner + Patates + İçecek)",
        "quantity": 1,
        "price": 190.00,
        "extraIngredients": [
          { "id": 810, "name": "Sarımsaklı Mayonez" }
        ],
        "removedIngredients": [
          { "id": 812, "name": "Turşu" }
        ],
        "notes": "Sos bol olsun, turşusuz"
      },
      {
        "productId": 802,
        "productName": "Kutu Ayran 290ml",
        "quantity": 1,
        "price": 25.00,
        "extraIngredients": [],
        "removedIngredients": []
      }
    ],
    "customerNote": "Zili çalmayın lütfen, bebek uyuyor. (Servis İstiyorum)",
    "isMock": true
  }
];

router.get('/api/tgo/dev/orders', requireAdminAuth, async (_req: any, res: any) => {
  try {
    res.json({ content: mockDevOrders, totalCount: mockDevOrders.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/tgo/dev/mock-order', requireAdminAuth, async (req: any, res: any) => {
  try {
    const isYemeksepeti = (req.body?.platform || '').toLowerCase() === 'yemeksepeti';
    const mockOrderNum = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    
    const newOrder = isYemeksepeti ? {
      "id": mockOrderNum,
      "packageId": mockOrderNum,
      "orderId": mockOrderNum,
      "orderNumber": "YS-" + Math.floor(100000 + Math.random() * 900000),
      "orderCode": "YS-" + Math.floor(100 + Math.random() * 900),
      "platform": "yemeksepeti",
      "_platform": "yemeksepeti",
      "supplierId": 88120,
      "storeId": 99401,
      "packageCreationDate": Date.now(),
      "orderDate": Date.now(),
      "totalPrice": 215.00,
      "packageStatus": "Created",
      "status": "Created",
      "deliveryType": "RESTAURANT",
      "paymentMethod": "ONLINE",
      "customer": {
        "id": Math.floor(100000 + Math.random() * 900000),
        "firstName": "Ayşe",
        "lastName": "Demir",
        "orderCount": Math.floor(1 + Math.random() * 20)
      },
      "address": {
        "address1": "Sakarya Mah. Kıbrıs Şehitleri Cad. No:42",
        "address2": "",
        "city": "Çanakkale",
        "district": "Biga",
        "neighborhood": "Sakarya Mah",
        "apartmentNumber": "42",
        "floor": "1",
        "doorNumber": "2",
        "addressDescription": "Yemeksepeti Dev Mock Siparişi (Zil Çalmayın)",
        "latitude": "40.228000",
        "longitude": "27.243000"
      },
      "lines": [
        {
          "productId": 201,
          "productName": "Yemeksepeti Dürüm Menü (Tavuk Döner + Patates + İçecek)",
          "name": "Yemeksepeti Dürüm Menü",
          "quantity": 1,
          "price": 190.00,
          "extraIngredients": [{ "id": 10, "name": "Sarımsaklı Mayonez" }, { "id": 11, "name": "Cheddar Sos" }],
          "removedIngredients": [{ "id": 12, "name": "Turşu" }],
          "notes": "Sos bol olsun, turşusuz hazırlansın lütfen"
        },
        {
          "productId": 202,
          "productName": "Kutu Ayran 290ml",
          "name": "Kutu Ayran 290ml",
          "quantity": 1,
          "price": 25.00,
          "extraIngredients": [],
          "removedIngredients": []
        }
      ],
      "customerNote": "Zili çalmayın lütfen bebeğimiz uyuyor. (Servis İstiyorum)",
      "isMock": true
    } : {
      "id": mockOrderNum,
      "packageId": mockOrderNum,
      "supplierId": parseInt(getTrendyolSupplierId()) || 6647850,
      "storeId": parseInt(getTrendyolStoreId()) || 367376,
      "platform": "trendyol",
      "_platform": "trendyol",
      "orderCode": "MOCK-" + Math.floor(100 + Math.random() * 900),
      "packageCreationDate": Date.now(),
      "orderId": mockOrderNum,
      "orderNumber": mockOrderNum,
      "totalPrice": 185.00,
      "packageStatus": "Created",
      "status": "Created",
      "customer": {
        "id": Math.floor(100000 + Math.random() * 900000),
        "firstName": "Ahmet",
        "lastName": "Yılmaz",
        "orderCount": Math.floor(1 + Math.random() * 15)
      },
      "address": {
        "address1": "Örnek Mahallesi Test Sk. No:5",
        "address2": "",
        "city": "Çanakkale",
        "district": "Biga",
        "neighborhood": "Cumhuriyet Mah",
        "apartmentNumber": "5",
        "floor": "2",
        "doorNumber": "4",
        "addressDescription": "Dev Test Ortamı Mock Sipariş",
        "latitude": "40.227316",
        "longitude": "27.242766"
      },
      "lines": [
        {
          "productId": 101,
          "productName": "Zurna Tavuk Döner",
          "name": "Zurna Tavuk Döner",
          "quantity": 1,
          "price": 160.00,
          "extraIngredients": [{ "id": 1, "name": "Kaşar Peyniri" }],
          "removedIngredients": [{ "id": 2, "name": "Soğan" }],
          "notes": "Soğansız olsun, kaşar bol olsun"
        },
        {
          "productId": 102,
          "productName": "Kutu Kola 33cl",
          "name": "Kutu Kola 33cl",
          "quantity": 1,
          "price": 25.00,
          "extraIngredients": [],
          "removedIngredients": []
        }
      ],
      "customerNote": "Soğansız kurye hızlı gelsin lütfen (Servis Istiyorum)",
      "isMock": true
    };

    mockDevOrders.unshift(newOrder);
    res.json({ success: true, message: `${isYemeksepeti ? 'Yemeksepeti' : 'Trendyol'} Mock siparişi eklendi`, order: newOrder });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/api/tgo/dev/mock-orders', requireAdminAuth, async (_req: any, res: any) => {
  try {
    mockDevOrders.length = 0; // Clear the array
    res.json({ success: true, message: 'Tüm test siparişleri temizlendi' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/tgo/store/status', requireAdminAuth, async (req: any, res: any) => {
  try {
    const status = req.body.status; // 'OPEN' or 'CLOSED'
    const supplierId = getTrendyolSupplierId();
    const storeId = await resolveTrendyolStoreId();
    
    let responseData: any = null;
    try {
      const response = await axios.put(`${getTgoBaseUrl()}/store/meal/suppliers/${supplierId}/stores/${storeId}/status`, 
        { status: status, workingStatus: status, isOpen: status === 'OPEN' },
        { headers: getTgoHeaders() }
      );
      responseData = response.data;
    } catch (primaryErr: any) {
      try {
        const fallbackRes = await axios.put(`${getTgoBaseUrl()}/store/meal/suppliers/${supplierId}/stores/${storeId}`, 
          { status: status, workingStatus: status, isOpen: status === 'OPEN' },
          { headers: getTgoHeaders() }
        );
        responseData = fallbackRes.data;
      } catch (fallbackErr) {
        throw primaryErr;
      }
    }
    
    res.json({ success: true, storeId, status, data: responseData });
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
    console.error('Trendyol store status error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: errorMsg, data: error.response?.data });
  }
});

router.get('/api/tgo/store', requireAdminAuth, async (req: any, res: any) => {
  try {
    const supplierId = getTrendyolSupplierId();
    const storeId = await resolveTrendyolStoreId();
    
    let storeData: any = null;
    try {
      const response = await axios.get(`${getTgoBaseUrl()}/store/meal/suppliers/${supplierId}/stores/${storeId}`, {
        headers: getTgoHeaders()
      });
      storeData = response.data;
    } catch (err: any) {
      const response = await axios.get(`${getTgoBaseUrl()}/store/meal/suppliers/${supplierId}/stores`, {
        headers: getTgoHeaders()
      });
      storeData = response.data;
    }

    let workingStatus = 'CLOSED';
    if (storeData) {
      let target = storeData.data || storeData;
      if (target.restaurants && Array.isArray(target.restaurants) && target.restaurants.length > 0) {
        target = target.restaurants[0];
      } else if (Array.isArray(target) && target.length > 0) {
        target = target[0];
      }
      workingStatus = target.workingStatus || target.status || (target.isOpen ? 'OPEN' : 'CLOSED');
    }

    const isOpen = (workingStatus === 'OPEN' || workingStatus === 'ACTIVE');
    res.json({
      success: true,
      storeId,
      status: isOpen ? 'OPEN' : 'CLOSED',
      workingStatus,
      isOpen,
      data: storeData
    });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.message, data: error.response?.data });
  }
});

router.get('/api/tgo/menu', requireAdminAuth, async (req: any, res: any) => {
  try {
    const supplierId = getTrendyolSupplierId();
    const storeId = getTrendyolStoreId();
    const response = await axios.get(`${getTgoBaseUrl()}/product/meal/suppliers/${supplierId}/stores/${storeId}/products`, {
      headers: getTgoHeaders()
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.message, data: error.response?.data });
  }
});

router.post('/api/tgo/category/status', requireAdminAuth, async (req: any, res: any) => {
  try {
    const { sectionId, status } = req.body;
    const supplierId = getTrendyolSupplierId();
    const storeId = getTrendyolStoreId();
    const response = await axios.put(`${getTgoBaseUrl()}/product/meal/suppliers/${supplierId}/stores/${storeId}/sections/${sectionId}/status`, 
      { status: status },
      { headers: getTgoHeaders() }
    );
    res.json({ success: true, data: response.data, status });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.message, data: error.response?.data });
  }
});

router.post('/api/tgo/order/status', requireAdminAuth, async (req: any, res: any) => {
  try {
    const { packageId, status } = req.body; // status: picked, invoiced, manual-shipped, manual-delivered
    
    if (!packageId) {
      return res.status(400).json({ error: 'packageId zorunludur' });
    }

    const pId = String(packageId);

    const statusMap: Record<string, string> = { 
      'picked': 'prepared', 
      'invoiced': 'prepared', 
      'manual-shipped': 'shipped', 
      'manual-delivered': 'delivered',
      'prepared': 'prepared',
      'shipped': 'shipped',
      'delivered': 'delivered',
      'cancelled': 'cancelled'
    };
    const pkgStatusMap: Record<string, string> = {
      'picked': 'Picking',
      'invoiced': 'Invoiced',
      'manual-shipped': 'Shipped',
      'manual-delivered': 'Delivered',
      'prepared': 'Picking',
      'shipped': 'Shipped',
      'delivered': 'Delivered',
      'cancelled': 'Cancelled'
    };

    const newStatus = statusMap[status] || status;
    const newPkgStatus = pkgStatusMap[status] || status;

    // Local status sync across active orders in all shops
    const { shops } = require('../models'); // Adjust import paths as necessary
    for (const shopItem of shops.values()) {
      const matchIdx = shopItem.activeOrders.findIndex((o: any) => 
        String(o.packageId || o.id || o.orderNumber || o.order_id) === pId ||
        (o.customer_name && o.customer_name.includes(pId))
      );
      if (matchIdx !== -1) {
        shopItem.activeOrders[matchIdx].status = newStatus;
        shopItem.activeOrders[matchIdx].packageStatus = newPkgStatus;
        shopItem.activeOrders[matchIdx].tgo_status = newPkgStatus;
        shopItem.activeOrders[matchIdx].trendyol_status = newPkgStatus;
        shopItem.saveOrders();
        broadcastUpdateToPhones(shopItem);
        notifyUI('orders_update', shopItem.activeOrders, shopItem);
      }
    }

    // If mock order, update mock status locally
    const mockOrder = mockDevOrders.find(o => String(o.id) === pId || String(o.orderNumber) === pId || String(o.packageId) === pId);
    if (mockOrder) {
      mockOrder.status = newPkgStatus;
      mockOrder.packageStatus = newPkgStatus;
      const currentShop = getShop();
      broadcastUpdateToPhones(currentShop);
      notifyUI('orders_update', currentShop.activeOrders, currentShop);
      return res.json({ success: true, isMock: true, data: mockOrder });
    }

    const supplierId = getTrendyolSupplierId();
    const baseUrl = getTgoBaseUrl();
    let url = '';
    let payload: any = {};

    if (status === 'picked') {
      url = `${baseUrl}/order/meal/suppliers/${supplierId}/packages/picked`;
      const prepTime = req.body.preparationTime ? parseInt(req.body.preparationTime) : 30;
      payload = { packageId: pId, preparationTime: prepTime };
    } else if (status === 'invoiced') {
      url = `${baseUrl}/order/meal/suppliers/${supplierId}/packages/invoiced`;
      payload = { packageId: pId, actualDate: Date.now() };
    } else if (status === 'manual-shipped') {
      url = `${baseUrl}/order/meal/suppliers/${supplierId}/packages/${pId}/manual-shipped`;
      payload = { actualDate: Date.now() };
    } else if (status === 'manual-delivered') {
      url = `${baseUrl}/order/meal/suppliers/${supplierId}/packages/${pId}/manual-delivered`;
      payload = { actualDate: Date.now() };
    } else {
      const currentShop = getShop();
      broadcastUpdateToPhones(currentShop);
      notifyUI('orders_update', currentShop.activeOrders, currentShop);
      return res.json({ success: true, localOnly: true });
    }

    const response = await axios.put(url, payload, { headers: getTgoHeaders() });
    
    const currentShop = getShop();
    broadcastUpdateToPhones(currentShop);
    notifyUI('orders_update', currentShop.activeOrders, currentShop);

    res.json({ success: true, data: response.data });
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
    const currentShop = getShop();
    broadcastUpdateToPhones(currentShop);
    notifyUI('orders_update', currentShop.activeOrders, currentShop);
    res.status(error.response?.status || 500).json({ error: errorMsg, data: error.response?.data });
  }
});

router.post('/api/tgo/send_to_app1', requireAdminAuth, async (req: any, res: any) => {
  try {
    const { parsedOrderText, rawData } = req.body;
    
    const shop = getShop();
    const { shops } = require('../models'); // Adjust import paths as necessary
    let saracShop = shops.get('sarac');
    if (!saracShop) {
        saracShop = shop; // Fallback to current shop if sarac is not connected yet
    }

    if (rawData && rawData.id && rawData.customer && rawData.customer.id) {
        const orderId = String(rawData.id);
        const customerId = String(rawData.customer.id);
        
        // Read directly from MongoDB
        const [statsDoc, processedDoc] = await Promise.all([
          DataModel.findOne({ key: 'tgoCustomerStats' }),
          DataModel.findOne({ key: 'tgoProcessedOrders' })
        ]);
        const tgoCustomerStats: Record<string, number> = statsDoc?.value || {};
        const tgoProcessedOrdersArr: string[] = processedDoc?.value || [];
        const tgoProcessedOrdersSet = new Set(tgoProcessedOrdersArr);

        if (!tgoProcessedOrdersSet.has(orderId)) {
            tgoProcessedOrdersSet.add(orderId);
            tgoCustomerStats[customerId] = (tgoCustomerStats[customerId] || 0) + 1;
            // Write back to MongoDB
            await Promise.all([
              DataModel.findOneAndUpdate({ key: 'tgoCustomerStats' }, { value: tgoCustomerStats }, { upsert: true }),
              DataModel.findOneAndUpdate({ key: 'tgoProcessedOrders' }, { value: Array.from(tgoProcessedOrdersSet) }, { upsert: true })
            ]);
            // Also update in-memory shop if available
            if (saracShop) {
              saracShop.tgoCustomerStats = tgoCustomerStats;
              saracShop.tgoProcessedOrders = tgoProcessedOrdersSet;
            }
        }
    }

    // Insert into activeOrders if not already there so tv-sarac displays it immediately
    if (rawData) {
        const packageId = String(rawData.packageId || rawData.id || '');
        const orderNumber = String(rawData.orderNumber || rawData.id || '');
        const pId = packageId || orderNumber;

        const existingIdx = saracShop.activeOrders.findIndex((o: any) => {
            const oId = String(o.id || '');
            const oPkgId = String(o.packageId || '');
            const oOrderNum = String(o.orderNumber || o.order_id || '');
            const oCust = String(o.customer_name || '');

            if (orderNumber && (oId === orderNumber || oOrderNum === orderNumber || oPkgId === orderNumber || oCust.includes(orderNumber))) return true;
            if (packageId && (oId === packageId || oPkgId === packageId || oOrderNum === packageId || oCust.includes(packageId))) return true;
            if (pId && (oId === pId || oOrderNum === pId || oPkgId === pId)) return true;
            return false;
        });

        // Format items with modifierProducts, extraIngredients, removedIngredients, and notes
        const formattedItems = (rawData.lines || []).flatMap((l: any) => {
            const qty = l.items ? l.items.length : (l.quantity || 1);
            let notes = '';
            if (l.modifierProducts && l.modifierProducts.length > 0) {
              notes = l.modifierProducts.map((m: any) => m.name).join(', ');
            }
            if (l.extraIngredients && l.extraIngredients.length > 0) {
              const extras = l.extraIngredients.map((e: any) => `+${e.name}`).join(', ');
              notes = notes ? `${notes}, ${extras}` : extras;
            }
            if (l.removedIngredients && l.removedIngredients.length > 0) {
              const removed = l.removedIngredients.map((r: any) => `❌${r.name}`).join(', ');
              notes = notes ? `${notes} | ${removed}` : removed;
            }
            if (l.note || l.notes) {
              const itemNote = l.note || l.notes;
              notes = notes ? `${notes} | ${itemNote}` : itemNote;
            }

            const resItems: any[] = [];
            for (let j = 0; j < qty; j++) {
              resItems.push({
                name: l.name || l.productName || 'Ürün',
                portion: l.selectedOptions ? l.selectedOptions.join(', ') : '',
                price: l.unitSellingPrice || l.price || 0,
                notes: notes
              });
            }
            return resItems;
        });

        // Format address and note
        let finalNote = rawData.customerNote || '';
        if (rawData.address) {
            const a = rawData.address;
            const addrParts: string[] = [];
            if (a.neighborhood) addrParts.push(a.neighborhood);
            if (a.address1) addrParts.push(a.address1.trim());
            if (a.address2) addrParts.push(a.address2.trim());
            if (a.apartmentNumber) addrParts.push(`Apt: ${a.apartmentNumber}`);
            if (a.doorNumber) addrParts.push(`No: ${a.doorNumber.trim()}`);
            if (a.floor) addrParts.push(`Kat: ${a.floor}`);
            if (a.addressDescription) addrParts.push(`Tarif: ${a.addressDescription}`);
            if (a.phone) addrParts.push(`Tel: ${a.phone}`);

            const addressStr = addrParts.filter(Boolean).join(', ');
            finalNote = finalNote ? `${finalNote}\n[Adres: ${addressStr}]` : `[Adres: ${addressStr}]`;
        }

        const custName = rawData.customer ? `${rawData.customer.firstName || ''} ${rawData.customer.lastName || ''}`.trim() : 'Trendyol Siparişi';
        const newOrder = {
            customer_name: `${custName} (TGO)`,
            masa_no: saracShop.getNextQueueNo().toString(),
            order_note: finalNote,
            order_id: orderNumber || pId,
            packageId: packageId || pId,
            id: orderNumber || pId,
            orderNumber: orderNumber || pId,
            time: new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }),
            items: formattedItems,
            total_amount: rawData.totalPrice || 0,
            status: 'waiting',
            packageStatus: rawData.packageStatus || 'Created',
            tgo_status: rawData.packageStatus || 'Created',
            color: '#FF9800',
            platform: 'trendyol'
        };

        if (existingIdx >= 0) {
            const existing = saracShop.activeOrders[existingIdx];
            const hasBetterDetails = finalNote && (!existing.order_note || existing.order_note.length < finalNote.length);
            if (hasBetterDetails || (existing.customer_name && existing.customer_name.includes('#'))) {
                saracShop.activeOrders[existingIdx] = {
                    ...existing,
                    ...newOrder,
                    masa_no: existing.masa_no || newOrder.masa_no,
                    time: existing.time || newOrder.time
                };
                saracShop.saveOrders();
            }
        } else {
            saracShop.activeOrders.unshift(newOrder);
            saracShop.saveOrders();
        }
    }

    // 1. Siparişi Kasa'ya (App1) ve TV'ye (tv-sarac) canlı olarak bildir
    broadcastUpdateToPhones(saracShop);
    notifyUI('orders_update', saracShop.activeOrders, saracShop);
    notifyUI('tgo_add_order', rawData, saracShop);
    res.json({ success: true });
  } catch (error: any) {
    console.error('SEND_TO_APP1 ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/upload_trendyol_log', (req: any, res: any): any => {
    res.header("Access-Control-Allow-Origin", "*");
    try {
        console.log('[TRENDYOL LOG SERVER] Received log data:', JSON.stringify(req.body).slice(0, 200) + '...');
        // Here we could save it to DB, but for now we just acknowledge receipt
        res.json({ success: true, message: 'Log received' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false });
    }
});

function fuzzyMatchProduct(platformName: string) {
    const lower = (platformName || '').toLowerCase();
    let name = platformName;
    let color = '#757575'; 

    if (lower.includes('et') || lower.includes('beyti') || lower.includes('iskender')) {
        color = '#8B0000'; 
        if (lower.includes('dürüm')) name = 'Et Dürüm';
        if (lower.includes('tombik')) name = 'Et Tombik';
        if (lower.includes('porsiyon')) name = 'Et Porsiyon';
    } else if (lower.includes('tavuk')) {
        color = '#D84315'; 
        if (lower.includes('dürüm')) name = 'Tavuk Dürüm';
        if (lower.includes('tombik')) name = 'Tavuk Tombik';
        if (lower.includes('porsiyon')) name = 'Tavuk Porsiyon';
        if (lower.includes('hatay')) name = 'Hatay Usulü';
    } else if (lower.includes('ayran') || lower.includes('kola') || lower.includes('su') || lower.includes('fanta') || lower.includes('sprite')) {
        color = '#1565C0'; 
    }

    if (name !== platformName && !platformName.includes(name)) {
        name = `${name} (${platformName})`;
    }

    return { name, color };
}

router.post('/trendyol_web_siparis', requireAuth, idempotencyMiddleware, (req: any, res: any): any => {
    // Restrict CORS purely for extension
    res.header("Access-Control-Allow-Origin", "*");
    try {
        const data = req.body;
        if (!data || !data.order_id) return res.status(400).json({ error: 'Missing order_id' });

        const shop = getShop();
        const exists = shop.activeOrders.some((o: any) => o.order_id === data.order_id);
        if (exists) return res.json({ success: true, duplicate: true });

        const formattedItems = (data.items || []).map((i: any) => {
            const match = fuzzyMatchProduct(i.name);
            return {
                name: match.name,
                portion: i.options ? i.options.join(', ') : '',
                quantity: i.quantity || 1,
                price: i.price || 0,
                notes: ''
            };
        });

        const newOrder = {
            customer_name: data.customer_name || 'Trendyol Siparişi',
            masa_no: shop.getNextQueueNo().toString(),
            order_note: data.order_note || '',
            order_id: data.order_id,
            time: new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }),
            items: formattedItems,
            total_amount: data.total_amount || 0,
            status: 'waiting',
            color: '#FF9800'
        };

        shop.activeOrders.unshift(newOrder);
        shop.saveOrders();
        broadcastUpdateToPhones(shop);
        notifyUI('order_received', newOrder, shop);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
