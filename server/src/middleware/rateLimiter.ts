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

// Genel API rate limit — 1 dakikada max 300 istek
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek gönderildi. Lütfen kısa bir süre bekleyin.' },
});
