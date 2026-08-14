const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const backupFile = process.argv[2];

if (!backupFile) {
  console.log('Usage: node restore_db.js <path-to-backup.json.gz>');
  process.exit(1);
}

async function restore() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing in .env');
    process.exit(1);
  }

  const fullPath = path.resolve(backupFile);
  if (!fs.existsSync(fullPath)) {
    console.error(`Backup file not found: ${fullPath}`);
    process.exit(1);
  }

  console.log(`Decompressing ${fullPath}...`);
  const compressed = fs.readFileSync(fullPath);
  const jsonString = zlib.gunzipSync(compressed).toString('utf8');
  const backupData = JSON.parse(jsonString);

  console.log(`Connecting to MongoDB...`);
  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;

  console.log(`Restoring database: ${backupData.database || db.databaseName} (created at ${backupData.createdAt})...`);

  for (const [colName, docs] of Object.entries(backupData.collections)) {
    if (!docs || docs.length === 0) continue;
    console.log(`Restoring collection ${colName} (${docs.length} documents)...`);
    const col = db.collection(colName);
    // Clear and restore
    await col.deleteMany({});
    await col.insertMany(docs);
    console.log(`  ✓ Restored ${colName}`);
  }

  console.log('✨ Database restore completed successfully!');
  await mongoose.disconnect();
  process.exit(0);
}

restore().catch(err => {
  console.error('Restore error:', err);
  process.exit(1);
});
