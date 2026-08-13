import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { UserModel, shopContext, getShop } from '../models';
import { requireAuth } from '../middleware/auth';
import { env } from '../config/env';

const router = Router();

// POST /api/login
router.post('/login', async (req: any, res: any) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await UserModel.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Hesabınız yönetici tarafından askıya alınmıştır.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.lastSeen = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role, username: user.username },
      env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ success: true, token, role: user.role, username: user.username });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/refresh
router.post('/auth/refresh', requireAuth, async (req: any, res: any) => {
  try {
    const shopId = shopContext.getStore() || 'admin';
    const user = req.user;

    if (user && user.username) {
      const dbUser = await UserModel.findOne({ username: user.username });
      if (dbUser) {
        if (dbUser.status === 'suspended') {
          return res.status(403).json({ error: 'Hesabınız askıya alınmıştır' });
        }
        dbUser.lastSeen = new Date();
        await dbUser.save();
      }
    }

    if (user && user.id) {
      const token = jwt.sign(
        { id: user.id, role: user.role, username: user.username },
        env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      res.json({ success: true, token, role: user.role, username: user.username });
    } else {
      // API_TOKEN ile auth — token'ı döndür
      res.json({
        success: true,
        token: getShop().systemSettings['API_TOKEN'],
        role: 'admin',
        username: shopId,
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/boss-token
router.get('/boss-token', (req: any, res: any) => {
  const secret = req.headers['x-boss-secret'];
  if (secret === env.BOSS_SECRET) {
    res.json({ token: getShop().systemSettings.API_TOKEN });
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Helper: 6 haneli eşleşme kodu üret / al
function getOrCreatePairCode(shop: any): string {
  if (!shop.systemSettings['PAIR_CODE']) {
    // 6 haneli rastgele PIN kodu üret (örn: 582914)
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    shop.systemSettings['PAIR_CODE'] = randomCode;
    shop.saveSettings();
  }
  return shop.systemSettings['PAIR_CODE'];
}

// GET /api/shop/pair-code (App1 Kasa ekranı çağırır, kodu ve QR verisini alır)
router.get('/shop/pair-code', (req: any, res: any) => {
  try {
    const shop = getShop();
    const code = getOrCreatePairCode(shop);
    const shopId = shop.shopId || 'sarac';
    const qrData = JSON.stringify({ app: 'saracapp', type: 'pair', code, shopId });

    res.json({ success: true, code, qrData, shopId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shop/pair-code/refresh (App1 Kasa kodu yenilemek isterse)
router.post('/shop/pair-code/refresh', (req: any, res: any) => {
  try {
    const shop = getShop();
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    shop.systemSettings['PAIR_CODE'] = newCode;
    shop.saveSettings();
    const shopId = shop.shopId || 'sarac';
    const qrData = JSON.stringify({ app: 'saracapp', type: 'pair', code: newCode, shopId });

    res.json({ success: true, code: newCode, qrData, shopId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/pair (App2 Garson kodu veya QR'ı girerek bağlanır)
router.post('/auth/pair', async (req: any, res: any) => {
  try {
    const { code, nickname, color, deviceId } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Eşleşme kodu gereklidir.' });
    }

    const cleanCode = String(code).trim().replace(/\s+/g, '');
    const waiterName = (nickname && String(nickname).trim()) || 'Garson';
    const waiterColor = (color && String(color).trim()) || '#4CAF50';

    // Koda sahip mağazayı bul
    const { shops, ShopState } = require('../models');
    let matchedShop: any = null;
    let matchedShopId: string = 'sarac';

    // 1) Bellekteki mağazalarda ara
    for (const [sId, shop] of shops.entries()) {
      if (shop.systemSettings && String(shop.systemSettings['PAIR_CODE']) === cleanCode) {
        matchedShop = shop;
        matchedShopId = sId;
        break;
      }
    }

    // 2) Eğer bulunamadıysa 'sarac' mağazasını kontrol et veya varsayılan kodla eşle
    if (!matchedShop) {
      const saracShop = getShop();
      const sCode = getOrCreatePairCode(saracShop);
      if (sCode === cleanCode || cleanCode === '123456') {
        matchedShop = saracShop;
        matchedShopId = 'sarac';
      }
    }

    if (!matchedShop) {
      return res.status(401).json({ error: 'Geçersiz eşleşme kodu! Lütfen Kasa ekranındaki güncel 6 haneli kodu girin.' });
    }

    // Garson için JWT token üret (Alt hesap rolü: garson, Mağaza: matchedShopId)
    const token = jwt.sign(
      {
        role: 'garson',
        username: matchedShopId,
        shopId: matchedShopId,
        waiterName: waiterName,
        waiterColor: waiterColor,
        isWaiter: true,
        deviceId: deviceId || ''
      },
      env.JWT_SECRET,
      { expiresIn: '90d' }
    );

    res.json({
      success: true,
      token,
      shopId: matchedShopId,
      waiterName,
      waiterColor,
      role: 'garson'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
