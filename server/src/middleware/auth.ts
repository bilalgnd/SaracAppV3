import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { shopContext, shops, getShop, UserModel } from '../models';
import { env } from '../config/env';

// ── requireAdminAuth ─────────────────────────────────────────────────────────
export const requireAdminAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    if (decoded.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden: Admin access required' });
      return;
    }

    // Database verification: tokenVersion, role and suspension status
    if (decoded.id || decoded.username) {
      const query = decoded.id ? { _id: decoded.id } : { username: decoded.username };
      const dbUser = await UserModel.findOne(query).select('tokenVersion status role').lean();
      
      if (!dbUser) {
        res.status(401).json({ error: 'User not found' });
        return;
      }

      if (dbUser.status === 'suspended') {
        res.status(403).json({ error: 'Hesabınız askıya alınmıştır' });
        return;
      }

      if (dbUser.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden: Admin privileges have been revoked' });
        return;
      }

      const storedVersion = (dbUser as any).tokenVersion ?? 0;
      if (typeof decoded.tokenVersion === 'number' && decoded.tokenVersion < storedVersion) {
        res.status(401).json({ error: 'Admin token revoked — please log in again' });
        return;
      }
    }

    (req as any).user = decoded;
    // Admin shop context'inde çalıştır
    shopContext.run('admin', next);
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// ── requireAuth ──────────────────────────────────────────────────────────────
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.split(' ')[1] || authHeader;

  // 1) JWT doğrulama
  try {
    const decoded: any = jwt.verify(token, env.JWT_SECRET);
    (req as any).user = decoded;

    // tokenVersion & suspension check: if password changed or account suspended,
    // the stored tokenVersion will be higher than the one in the JWT — reject immediately.
    // Only applies to user JWTs (not API_TOKEN fallback below).
    if (decoded.id || (decoded.username && !decoded.isWaiter)) {
      const query = decoded.id ? { _id: decoded.id } : { username: decoded.username };
      const dbUser = await UserModel.findOne(query).select('tokenVersion status').lean();
      if (!dbUser) {
        res.status(401).json({ error: 'User not found' });
        return;
      }
      if (dbUser.status === 'suspended') {
        res.status(403).json({ error: 'Hesabınız askıya alınmıştır' });
        return;
      }
      const storedVersion = (dbUser as any).tokenVersion ?? 0;
      const tokenVersion = typeof decoded.tokenVersion === 'number' ? decoded.tokenVersion : 0;
      if (tokenVersion < storedVersion) {
        res.status(401).json({ error: 'Token revoked — please log in again' });
        return;
      }
    }

    // Waiter revocation check: if shop revoked waiter tokens, reject
    if (decoded.isWaiter) {
      const targetShopId = decoded.shopId || decoded.username || 'sarac';
      const targetShop = shops.get(targetShopId) || getShop();
      const currentWaiterVer = Number(targetShop?.systemSettings?.['WAITER_TOKEN_VERSION']) || 1;
      const tokenWaiterVer = typeof decoded.waiterVersion === 'number' ? decoded.waiterVersion : 1;
      if (tokenWaiterVer < currentWaiterVer) {
        res.status(401).json({ error: 'Garson oturumu yönetici tarafından sonlandırıldı. Lütfen yeniden eşleşin.' });
        return;
      }
    }

    return shopContext.run(decoded.username, () => next());
  } catch (err) {
    // 2) Fallback: API_TOKEN ile eşleşme kontrolü
    if (token === getShop().systemSettings.API_TOKEN) {
      return shopContext.run('sarac', () => next());
    }
    for (const [sId, shop] of shops.entries()) {
      if (shop.systemSettings && shop.systemSettings['API_TOKEN'] === token) {
        return shopContext.run(sId, () => next());
      }
    }
    res.status(401).json({ error: 'Invalid token' });
  }
}
