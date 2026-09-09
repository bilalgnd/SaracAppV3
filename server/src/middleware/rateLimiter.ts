import rateLimit from 'express-rate-limit';

// Login brute-force koruması — 15 dakikada max 10 deneme
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.' },
  skipSuccessfulRequests: true,
});

// 6 haneli garson eşleştirme (pair) PIN brute-force koruması — 15 dakikada max 5 başarısız deneme
export const pairRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla hatalı eşleşme denemesi. Lütfen 15 dakika sonra tekrar deneyin.' },
  skipSuccessfulRequests: true,
});

// Boss token rate limiter — 15 dakikada max 3 deneme
export const bossTokenRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla yetkisiz erişim denemesi.' },
  skipSuccessfulRequests: false,
});

// Genel API rate limit — 1 dakikada max 300 istek
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek gönderildi. Lütfen kısa bir süre bekleyin.' },
});
