import dotenv from 'dotenv';
dotenv.config();

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`[env] Zorunlu ortam değişkeni eksik: ${name}. Server başlatılamıyor.`);
  }
  return val;
}

function optionalEnv(name: string, fallback: string = ''): string {
  return process.env[name] || fallback;
}

// Üretimde zorunlu olan değişkenler — eksikse server başlamaz
const isProduction = process.env.NODE_ENV === 'production';

export const env = {
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
  PORT: parseInt(optionalEnv('PORT', '5000'), 10),

  // Auth — üretimde zayıf default kesinlikle yasak
  JWT_SECRET: isProduction
    ? requireEnv('JWT_SECRET')
    : optionalEnv('JWT_SECRET', 'default_secret'),

  ADMIN_TOOLS_PASSWORD: isProduction
    ? requireEnv('ADMIN_TOOLS_PASSWORD')
    : optionalEnv('ADMIN_TOOLS_PASSWORD', 'default_admin'),

  BOSS_SECRET: isProduction
    ? requireEnv('BOSS_SECRET')
    : optionalEnv('BOSS_SECRET', 'boss'),

  // MongoDB
  MONGODB_URI: optionalEnv('MONGODB_URI', ''),

  // Trendyol
  TRENDYOL_SUPPLIER_ID: optionalEnv('TRENDYOL_SUPPLIER_ID', '6647850'),
  TRENDYOL_STORE_ID: optionalEnv('TRENDYOL_STORE_ID', '367376'),
  TRENDYOL_API_KEY: optionalEnv('TRENDYOL_API_KEY'),
  TRENDYOL_API_SECRET: optionalEnv('TRENDYOL_API_SECRET'),
  TRENDYOL_EXECUTOR_USER: optionalEnv('TRENDYOL_EXECUTOR_USER'),

  // Yemeksepeti
  YEMEKSEPETI_CHAIN_ID: optionalEnv('YEMEKSEPETI_CHAIN_ID'),
  YEMEKSEPETI_STORE_ID: optionalEnv('YEMEKSEPETI_STORE_ID'),

  // Google / Gemini
  GEMINI_API_KEY: optionalEnv('GEMINI_API_KEY') || optionalEnv('GOOGLE_API_KEY'),

  // Spotify
  SPOTIFY_CLIENT_ID: optionalEnv('SPOTIFY_CLIENT_ID'),
  SPOTIFY_CLIENT_SECRET: optionalEnv('SPOTIFY_CLIENT_SECRET'),

  // Diğer
  SSH_PASSWORD: optionalEnv('SSH_PASSWORD'),
} as const;

// Üretimde mock fallback guard: entegrasyon servislerinde
// NODE_ENV !== 'production' koşuluyla kullanın.
export function isDevMode(): boolean {
  return env.NODE_ENV !== 'production';
}
