/**
 * backupService.ts
 * MongoDB'nin tüm koleksiyonlarını gzip JSON olarak kaydeder.
 * Her gece 03:00'te node-cron tarafından tetiklenir (server.ts).
 *
 * Backup klasörü: BACKUP_DIR env değişkeni veya ~/backups
 * Saklama süresi: MAX_BACKUP_DAYS (varsayılan 30 gün)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import mongoose from 'mongoose';

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.env.HOME || '/home/bilalgnd', 'backups');
const MAX_BACKUP_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);

/** Backup log satırını hem konsola hem de backup.log dosyasına yazar */
function blogLog(msg: string) {
  const line = `[${new Date().toISOString()}] [Backup] ${msg}`;
  console.log(line);
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.appendFileSync(path.join(BACKUP_DIR, 'backup.log'), line + '\n');
  } catch (_) { /* log yazılamazsa sessiz geç */ }
}

/** 30 günden eski backup dosyalarını siler */
function cleanOldBackups() {
  try {
    const now = Date.now();
    const files = fs.readdirSync(BACKUP_DIR);
    let deletedCount = 0;
    for (const file of files) {
      if (!file.endsWith('.json.gz')) continue;
      const filePath = path.join(BACKUP_DIR, file);
      const ageInDays = (now - fs.statSync(filePath).mtimeMs) / 86_400_000;
      if (ageInDays > MAX_BACKUP_DAYS) {
        fs.unlinkSync(filePath);
        blogLog(`🧹 Eski backup silindi (${ageInDays.toFixed(0)} gün): ${file}`);
        deletedCount++;
      }
    }
    if (deletedCount > 0) blogLog(`${deletedCount} eski backup dosyası temizlendi.`);
  } catch (err: any) {
    blogLog(`⚠️ Eski backup temizleme hatası: ${err?.message}`);
  }
}

/**
 * Tüm MongoDB koleksiyonlarını tek bir gzip JSON dosyasına yazar.
 * Mevcut mongoose bağlantısını kullanır — yeni bağlantı açmaz.
 */
export async function runBackup(): Promise<void> {
  blogLog('🚀 Otomatik backup başladı...');

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const db = mongoose.connection.db;
  if (!db) {
    blogLog('❌ MongoDB bağlantısı yok, backup atlanıyor.');
    return;
  }

  const dbName = db.databaseName;
  blogLog(`Veritabanı: ${dbName}`);

  const collections = await db.listCollections().toArray();
  const backupData: Record<string, any> = {
    version: '1.1',
    createdAt: new Date().toISOString(),
    database: dbName,
    collections: {} as Record<string, any[]>,
  };

  let totalDocs = 0;
  for (const col of collections) {
    if (col.name.startsWith('system.')) continue;
    const docs = await db.collection(col.name).find({}).toArray();
    backupData.collections[col.name] = docs;
    totalDocs += docs.length;
    blogLog(`  ✓ "${col.name}": ${docs.length} belge`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `saracapp_${dbName}_${timestamp}.json.gz`;
  const filePath = path.join(BACKUP_DIR, fileName);

  const compressed = zlib.gzipSync(JSON.stringify(backupData, null, 2));
  fs.writeFileSync(filePath, compressed);

  const sizeKb = (compressed.length / 1024).toFixed(1);
  blogLog(`✅ Backup tamamlandı: ${fileName} (${sizeKb} KB, toplam ${totalDocs} belge, ${Object.keys(backupData.collections).length} koleksiyon)`);

  cleanOldBackups();
}
