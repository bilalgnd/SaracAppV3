import { Request, Response, NextFunction } from 'express';
import { getShop } from '../models';

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  const idempotencyKey = req.headers['x-idempotency-key'] as string;
  if (!idempotencyKey) {
    return next();
  }

  const shop = getShop();
  if (shop.processedIdempotencyKeys.has(idempotencyKey)) {
    return res.status(200).json({ success: true, duplicate: true, message: 'Already processed' });
  }

  shop.processedIdempotencyKeys.add(idempotencyKey);
  // Max 1000 key sakla — eski olanı sil
  if (shop.processedIdempotencyKeys.size > 1000) {
    const firstKey = shop.processedIdempotencyKeys.values().next().value;
    if (firstKey) shop.processedIdempotencyKeys.delete(firstKey);
  }

  next();
}
