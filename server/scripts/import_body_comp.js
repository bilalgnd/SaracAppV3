/**
 * Samsung Health CSV → MongoDB Importer
 * Updated to parse full Body Composition metrics (Skeletal Muscle, Fat Mass, Body Water, BMR, BMI)
 */

require('dotenv').config({ path: 'C:\\Users\\bilal\\SARACAPP\\SARACAPPV3\\server\\.env' });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DATA_DIR = 'C:\\Users\\bilal\\Desktop\\samsunghealth_bilalgnd00_20260727223103';
const MONGODB_URI = process.env.MONGODB_URI;

const HealthDataSchema = new mongoose.Schema({
  doc_id: { type: String, default: 'latest_health_record', unique: true },
  last_updated: String,
  app_version: String,
  steps: Array,
  sleep: Array,
  heart_rate: Array,
  heart_rate_variability: Array,
  active_calories: Array,
  total_calories: Array,
  distance: Array,
  weight: Array,
  height: Array,
  blood_pressure: Array,
  oxygen_saturation: Array,
  body_temperature: Array,
  resting_heart_rate: Array,
  exercise: Array,
  hydration: Array,
  stress: Array,
  floors_climbed: Array,
  skin_temperature: Array,
  energy_scores: Array,
}, { timestamps: true });

const HealthRecord = mongoose.models.HealthRecord || mongoose.model('HealthRecord', HealthDataSchema);

function parseCSV(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 3) return [];

    const headers = lines[1].split(',').map(h => h.trim());
    const records = [];

    for (let i = 2; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const values = [];
      let inQuote = false, cur = '';
      for (let c = 0; c < line.length; c++) {
        if (line[c] === '"') { inQuote = !inQuote; continue; }
        if (line[c] === ',' && !inQuote) { values.push(cur.trim()); cur = ''; continue; }
        cur += line[c];
      }
      values.push(cur.trim());

      const record = {};
      headers.forEach((h, idx) => {
        record[h] = values[idx] !== undefined ? values[idx] : '';
      });
      records.push(record);
    }
    return records;
  } catch (e) {
    return [];
  }
}

// Transform Body Composition Weight Records
function transformWeight(records) {
  return records
    .filter(r => r['weight'] && r['start_time'])
    .map(r => {
      const kg = parseFloat(r['weight']) || null;
      const h_cm = parseFloat(r['height']) || 173;
      const h_m = h_cm / 100;
      const bmi = (kg && h_m) ? parseFloat((kg / (h_m * h_m)).toFixed(1)) : null;

      const muscle = parseFloat(r['skeletal_muscle_mass'] || r['skeletal_muscle']) || null;
      const fatMass = parseFloat(r['body_fat_mass']) || null;
      const fatPct = parseFloat(r['body_fat']) || null;
      const water = parseFloat(r['total_body_water']) || null;
      const bmr = parseInt(r['basal_metabolic_rate']) || null;

      return {
        kilograms: kg,
        height_cm: h_cm,
        bmi: bmi,
        skeletal_muscle_kg: muscle ? parseFloat(muscle.toFixed(1)) : null,
        body_fat_mass_kg: fatMass ? parseFloat(fatMass.toFixed(1)) : null,
        body_fat_pct: fatPct ? parseFloat(fatPct.toFixed(1)) : null,
        body_water_kg: water ? parseFloat(water.toFixed(1)) : null,
        bmr_cal: bmr,
        time: r['start_time'],
      };
    })
    .filter(r => r.kilograms && r.kilograms > 20);
}

// Main Import
async function importBodyComposition() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected!');

  const weightFile = path.join(DATA_DIR, 'com.samsung.health.weight.20260727223103.csv');
  if (fs.existsSync(weightFile)) {
    const raw = parseCSV(weightFile);
    const weightData = transformWeight(raw);
    console.log(`Parsed ${weightData.length} Body Composition records.`);

    await HealthRecord.findOneAndUpdate(
      { doc_id: 'latest_health_record' },
      { $set: { weight: weightData } },
      { upsert: true }
    );
    console.log('✅ Body Composition updated in MongoDB!');
  }

  await mongoose.disconnect();
  process.exit(0);
}

importBodyComposition().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
