import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { shopContext, shops, getShop } from '../models';
import { env } from '../config/env';

// ── requireAdminAuth ─────────────────────────────────────────────────────────
export const requireAdminAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    if (decoded.role !== 'admin') {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    // Admin shop context'inde çalıştır
    shopContext.run('admin', next);
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// ── requireAuth ──────────────────────────────────────────────────────────────
export function requireAuth(req: Request, res: Response, next: NextFunction) {
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
