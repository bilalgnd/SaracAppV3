const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.env.HOME || '/home/bilalgnd00', 'backups');
const MAX_BACKUP_DAYS = 30;

function log(msg) {
  const time = new Date().toISOString();
  const line = `[${time}] ${msg}`;
  console.log(line);
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    fs.appendFileSync(path.join(BACKUP_DIR, 'backup.log'), line + '\n');
  } catch (err) {
    console.error('Failed writing to log file:', err);
  }
}

async function runBackup() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    log('❌ ERROR: MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  log(`🚀 Starting Database Backup...`);
  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;
  const dbName = db.databaseName;
  log(`Connected to MongoDB Atlas database: ${dbName}`);

  const collections = await db.listCollections().toArray();
  const backupData = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    database: dbName,
    collections: {}
  };

  let totalDocs = 0;
  for (const col of collections) {
    const colName = col.name;
    // Skip system collections
    if (colName.startsWith('system.')) continue;

    const docs = await db.collection(colName).find({}).toArray();
    backupData.collections[colName] = docs;
    totalDocs += docs.length;
    log(`  - Exported collection "${colName}": ${docs.length} documents`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `saracapp_${dbName}_${timestamp}.json.gz`;
  const filePath = path.join(BACKUP_DIR, fileName);

  const jsonString = JSON.stringify(backupData, null, 2);
  const compressed = zlib.gzipSync(jsonString);
  fs.writeFileSync(filePath, compressed);

  const sizeKb = (compressed.length / 1024).toFixed(2);
  log(`✅ Backup saved successfully: ${fileName} (${sizeKb} KB, ${totalDocs} total documents across ${Object.keys(backupData.collections).length} collections)`);

  // Cleanup old backups
  cleanOldBackups();

  await mongoose.disconnect();
  log('✨ Backup task finished cleanly.');
}

function cleanOldBackups() {
  try {
    const now = Date.now();
    const files = fs.readdirSync(BACKUP_DIR);
    let deletedCount = 0;

    for (const file of files) {
      if (file.endsWith('.json.gz')) {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        const ageInDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);

        if (ageInDays > MAX_BACKUP_DAYS) {
          fs.unlinkSync(filePath);
          log(`🧹 Deleted old backup (> ${MAX_BACKUP_DAYS} days): ${file}`);
          deletedCount++;
        }
      }
    }
    if (deletedCount > 0) {
      log(`Cleaned up ${deletedCount} old backup files.`);
    }
  } catch (err) {
    log(`⚠️ Warning during old backup cleanup: ${err.message}`);
  }
}

runBackup().catch(err => {
  log(`❌ Backup failed: ${err.stack || err.message}`);
  process.exit(1);
});
