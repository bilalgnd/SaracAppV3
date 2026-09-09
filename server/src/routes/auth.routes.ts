import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { UserModel, ActivityLogModel, shopContext, getShop } from '../models';
import { requireAuth } from '../middleware/auth';
import { loginRateLimiter, pairRateLimiter, bossTokenRateLimiter } from '../middleware/rateLimiter';
import { env } from '../config/env';

const router = Router();

// POST /api/login
router.post('/login', loginRateLimiter, async (req: any, res: any) => {
  try {
    const { username, password } = req.body;
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur ve metin tipinde olmalıdır' });
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

    const tokenVer = (user as any).tokenVersion ?? 0;
    const token = jwt.sign(
      { id: user._id, role: user.role, username: user.username, tokenVersion: tokenVer },
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

    let dbUser: any = null;
    if (user && (user.id || user.username)) {
      const query = user.id ? { _id: user.id } : { username: user.username };
      dbUser = await UserModel.findOne(query);
      if (dbUser) {
        if (dbUser.status === 'suspended') {
          return res.status(403).json({ error: 'Hesabınız askıya alınmıştır' });
        }
        dbUser.lastSeen = new Date();
        await dbUser.save();
      }
    }

    if (user && (user.id || dbUser)) {
      const currentId = user.id || dbUser?._id;
      const currentRole = dbUser?.role || user.role;
      const currentUsername = dbUser?.username || user.username;
      const tokenVersion = dbUser?.tokenVersion ?? 0;

      const token = jwt.sign(
        { id: currentId, role: currentRole, username: currentUsername, tokenVersion },
        env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      res.json({ success: true, token, role: currentRole, username: currentUsername });
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

// GET /api/boss-token (Admin Emergency Fallback Token — Audit Logged & Rate-Limited)
router.get('/boss-token', bossTokenRateLimiter, async (req: any, res: any) => {
  const secret = req.headers['x-boss-secret'];
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
  const isMatch = secret && secret === env.BOSS_SECRET;

  // Security Audit Log
  try {
    const log = new ActivityLogModel({
      username: 'SYSTEM_BOSS',
      shopId: getShop().shopId || 'sarac',
      action: isMatch ? 'BOSS_TOKEN_ACCESS_GRANTED' : 'BOSS_TOKEN_ACCESS_DENIED',
      details: `IP: ${clientIp}, Time: ${new Date().toISOString()}`
    });
    await log.save();
  } catch (e) {}

  if (isMatch) {
    res.json({ token: getShop().systemSettings.API_TOKEN });
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Helper: 6 haneli eşleşme kodu üret / al (15 Dakika TTL ile)
const PAIR_CODE_TTL_MS = 15 * 60 * 1000; // 15 dakika

function getOrCreatePairCode(shop: any): { code: string; expiresAt: number } {
  const now = Date.now();
  const currentCode = shop.systemSettings['PAIR_CODE'];
  const currentExpiresAt = Number(shop.systemSettings['PAIR_CODE_EXPIRES_AT']) || 0;

  // Eğer kod yoksa veya süresi dolmuşsa yeni üret
  if (!currentCode || now > currentExpiresAt) {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newExpiresAt = now + PAIR_CODE_TTL_MS;
    shop.systemSettings['PAIR_CODE'] = randomCode;
    shop.systemSettings['PAIR_CODE_EXPIRES_AT'] = newExpiresAt;
    shop.saveSettings();
    return { code: randomCode, expiresAt: newExpiresAt };
  }

  return { code: currentCode, expiresAt: currentExpiresAt };
}

// GET /api/shop/pair-code (App1 Kasa ekranı çağırır — requireAuth ZORUNLU)
router.get('/shop/pair-code', requireAuth, (req: any, res: any) => {
  try {
    const shop = getShop();
    const { code, expiresAt } = getOrCreatePairCode(shop);
    const shopId = shop.shopId || 'sarac';
    const qrData = JSON.stringify({ app: 'saracapp', type: 'pair', code, shopId, expiresAt });

    res.json({ success: true, code, expiresAt, qrData, shopId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shop/pair-code/refresh (App1 Kasa kodu yenilemek isterse — requireAuth ZORUNLU)
router.post('/shop/pair-code/refresh', requireAuth, (req: any, res: any) => {
  try {
    const shop = getShop();
    const now = Date.now();
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newExpiresAt = now + PAIR_CODE_TTL_MS;
    shop.systemSettings['PAIR_CODE'] = newCode;
    shop.systemSettings['PAIR_CODE_EXPIRES_AT'] = newExpiresAt;
    shop.saveSettings();
    const shopId = shop.shopId || 'sarac';
    const qrData = JSON.stringify({ app: 'saracapp', type: 'pair', code: newCode, shopId, expiresAt: newExpiresAt });

    res.json({ success: true, code: newCode, expiresAt: newExpiresAt, qrData, shopId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/pair (App2 Garson kodu veya QR'ı girerek bağlanır — Rate-Limited & TTL Checked)
router.post('/auth/pair', pairRateLimiter, async (req: any, res: any) => {
  try {
    const { code, nickname, color, deviceId } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Eşleşme kodu gereklidir.' });
    }

    const cleanCode = String(code).trim().replace(/\s+/g, '');
    const waiterName = (nickname && String(nickname).trim()) || 'Garson';
    const waiterColor = (color && String(color).trim()) || '#4CAF50';
    const now = Date.now();

    // Koda sahip mağazayı bul
    const { shops } = require('../models');
    let matchedShop: any = null;
    let matchedShopId: string = 'sarac';

    // 1) Bellekteki mağazalarda ara ve TTL kontrol et
    for (const [sId, shop] of shops.entries()) {
      if (shop.systemSettings && String(shop.systemSettings['PAIR_CODE']) === cleanCode) {
        const expiresAt = Number(shop.systemSettings['PAIR_CODE_EXPIRES_AT']) || 0;
        if (now > expiresAt && expiresAt > 0) {
          return res.status(401).json({ error: 'Eşleşme kodunun süresi dolmuş (15 dk TTL). Lütfen Kasa ekranından kodu yenileyin.' });
        }
        matchedShop = shop;
        matchedShopId = sId;
        break;
      }
    }

    // 2) Eğer bulunamadıysa 'sarac' mağazasını kontrol et
    if (!matchedShop) {
      const saracShop = getShop();
      const { code: sCode, expiresAt: sExpiresAt } = getOrCreatePairCode(saracShop);
      if (sCode === cleanCode) {
        if (now > sExpiresAt) {
          return res.status(401).json({ error: 'Eşleşme kodunun süresi dolmuş (15 dk TTL). Lütfen Kasa ekranından kodu yenileyin.' });
        }
        matchedShop = saracShop;
        matchedShopId = 'sarac';
      }
    }

    if (!matchedShop) {
      return res.status(401).json({ error: 'Geçersiz eşleşme kodu! Lütfen Kasa ekranındaki güncel 6 haneli kodu girin.' });
    }

    // Garson için JWT token üret (Alt hesap rolü: garson, Mağaza: matchedShopId)
    const currentWaiterVersion = Number(matchedShop.systemSettings?.['WAITER_TOKEN_VERSION']) || 1;
    const token = jwt.sign(
      {
        role: 'garson',
        username: matchedShopId,
        shopId: matchedShopId,
        waiterName: waiterName,
        waiterColor: waiterColor,
        isWaiter: true,
        waiterVersion: currentWaiterVersion,
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
      role: 'garson',
      waiterVersion: currentWaiterVersion
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shop/waiters/revoke (Kasa veya Admin tüm aktif garson oturumlarını anında iptal eder)
router.post('/shop/waiters/revoke', requireAuth, (req: any, res: any) => {
  try {
    const shop = getShop();
    const currentVersion = Number(shop.systemSettings['WAITER_TOKEN_VERSION']) || 1;
    const newVersion = currentVersion + 1;
    shop.systemSettings['WAITER_TOKEN_VERSION'] = newVersion;
    shop.saveSettings();
    console.log(`[AUTH] Waiter sessions revoked for shop ${shop.shopId || 'sarac'}. New version: ${newVersion}`);
    res.json({ success: true, message: 'Tüm garson oturumları sonlandırıldı.', newVersion });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- TV QR PAIRING SESSIONS ---
interface TvPairSession {
  sessionId: string;
  status: 'pending' | 'approved';
  token?: string;
  shopId?: string;
  localIp?: string;
  createdAt: number;
}
const tvSessions = new Map<string, TvPairSession>();

// Cleanup expired sessions every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [sId, s] of tvSessions.entries()) {
    if (now - s.createdAt > 15 * 60 * 1000) {
      tvSessions.delete(sId);
    }
  }
}, 10 * 60 * 1000);

// POST /api/tv/session (TV generates a QR pairing session)
router.post('/tv/session', (req: any, res: any) => {
  const sessionId = 'tv_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  const shopId = req.query.shopId || 'sarac';
  tvSessions.set(sessionId, { sessionId, status: 'pending', shopId, createdAt: Date.now() });
  const qrPayload = JSON.stringify({
    app: 'saracapp',
    type: 'sarac_tv_pair',
    sessionId,
    shopId
  });
  res.json({ success: true, sessionId, qrPayload });
});

// GET /api/tv/session/:sessionId (TV checks pairing status)
router.get('/tv/session/:sessionId', (req: any, res: any) => {
  const session = tvSessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }
  if (session.status === 'approved') {
    return res.json({
      success: true,
      status: 'approved',
      token: session.token,
      shopId: session.shopId,
      localIp: session.localIp
    });
  }
  res.json({ success: true, status: 'pending' });
});

// POST /api/tv/approve (App2 waiter/admin scans TV QR and approves pairing)
router.post('/tv/approve', requireAuth, (req: any, res: any) => {
  const { sessionId, localIp } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId zorunludur' });
  const session = tvSessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Geçersiz veya süresi dolmuş oturum' });

  const shop = getShop();
  const token = shop.systemSettings?.['API_TOKEN'] || req.headers.authorization?.replace('Bearer ', '');
  session.status = 'approved';
  session.token = token;
  session.localIp = localIp || '';
  res.json({ success: true, message: 'TV başarıyla eşlendi' });
});

export default router;
