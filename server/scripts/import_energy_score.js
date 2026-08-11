/**
 * Samsung Health CSV Importer Update: Vitality / Energy Score parser
 */

require('dotenv').config({ path: 'C:\\Users\\bilal\\SARACAPP\\SARACAPPV3\\server\\.env' });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DATA_DIR = 'C:\\Users\\bilal\\Desktop\\samsunghealth_bilalgnd00_20260727223103';
const MONGODB_URI = process.env.MONGODB_URI;

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

function getRating(score) {
  const val = parseFloat(score);
  if (isNaN(val)) return 'Good';
  if (val >= 85) return 'Excellent';
  if (val >= 70) return 'Good';
  if (val >= 50) return 'Fair';
  return 'Low';
}

async function updateEnergyScore() {
  await mongoose.connect(MONGODB_URI);
  const HealthRecord = mongoose.model('HealthRecord', new mongoose.Schema({}, { strict: false }));
  
  const vitalityFile = path.join(DATA_DIR, 'com.samsung.shealth.vitality_score.20260727223103.csv');
  let energyScores = [];

  if (fs.existsSync(vitalityFile)) {
    const raw = parseCSV(vitalityFile);
    energyScores = raw.map(r => {
      const total = parseFloat(r['total_score']);
      if (isNaN(total)) return null;
      return {
        score: Math.round(total),
        date: r['day_time'] || r['update_time'],
        rating: getRating(total),
        factors: {
          sleep_time_avg: getRating(r['sleep_duration_scale'] || r['sleep_score']),
          sleep_consistency: getRating(r['sleep_balance_scale'] || r['sleep_balance']),
          sleep_regularity: getRating(r['sleep_regularity_scale'] || r['sleep_regularity']),
          sleep_timing: getRating(r['sleep_timing_scale'] || r['sleep_timing']),
          prev_day_activity: getRating(r['activity_score']),
          activity_consistency: getRating(r['activity_balance_scale'] || r['activity_balance']),
          sleeping_hr: getRating(r['shr_score'] || r['shr_balance_scale']),
          sleeping_hrv: getRating(r['shrv_score'] || r['shrv_balance_scale']),
          sleeping_skin_temp: getRating(r['skin_temperature_scale'])
        }
      };
    }).filter(Boolean);
  }

  console.log(`Parsed ${energyScores.length} Energy Score records.`);

  await HealthRecord.findOneAndUpdate(
    { doc_id: 'latest_health_record' },
    { $set: { energy_scores: energyScores } },
    { upsert: true }
  );

  console.log('✅ Energy Scores updated in MongoDB!');
  await mongoose.disconnect();
}

updateEnergyScore();
