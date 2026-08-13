import mongoose from 'mongoose';
import { initializeModels } from '../models';
import { env } from './env';

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI || '');
    console.log('[db] MongoDB Atlas bağlandı.');
  } catch (err) {
    console.error('[db] MongoDB bağlantı hatası:', err);
    process.exit(1);
  }
}

export async function initializeDB(): Promise<void> {
  await connectDB();
  await initializeModels();
  console.log('[db] Shop modelleri yüklendi.');
}
