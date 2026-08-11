/**
 * Samsung Health CSV → MongoDB Importer
 * Parses all exported Samsung Health CSV files and uploads to saracapp MongoDB
 * Fixes: Exercise duration unit (ms -> sec), Sleep stage durations in mins, Exercise Type mappings.
 */

require('dotenv').config({ path: 'C:\\Users\\bilal\\SARACAPP\\SARACAPPV3\\server\\.env' });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DATA_DIR = 'C:\\Users\\bilal\\Desktop\\samsunghealth_bilalgnd00_20260727223103';
const MONGODB_URI = process.env.MONGODB_URI;

// ---- MongoDB Schema ----
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

// 1. Heart Rate
function transformHeartRate(records) {
  return records
    .filter(r => r['com.samsung.health.heart_rate.heart_rate'] || r['com.samsung.health.heart_rate.start_time'])
    .map(r => ({
      bpm: parseFloat(r['com.samsung.health.heart_rate.heart_rate'] || r['heart_rate']) || null,
      min: parseFloat(r['com.samsung.health.heart_rate.min']) || null,
      max: parseFloat(r['com.samsung.health.heart_rate.max']) || null,
      time: r['com.samsung.health.heart_rate.start_time'] || r['start_time'] || null,
    }))
    .filter(r => r.bpm && r.time);
}

// 2. Steps
function transformSteps(records) {
  return records
    .filter(r => r['step_count'] && r['day_time'])
    .map(r => ({
      count: parseInt(r['step_count']) || 0,
      walk_steps: parseInt(r['walk_step_count']) || 0,
      run_steps: parseInt(r['run_step_count']) || 0,
      distance_meters: parseFloat(r['distance']) || 0,
      calories: parseFloat(r['calorie']) || 0,
      active_time_ms: parseInt(r['active_time']) || 0,
      start_time: r['day_time'],
      end_time: r['day_time'],
    }))
    .filter(r => r.count > 0);
}

// 3. Sleep (Fixed durations in minutes and seconds)
function transformSleep(records) {
  return records
    .filter(r => r['com.samsung.health.sleep.start_time'] && r['com.samsung.health.sleep.end_time'])
    .map(r => {
      const startStr = r['com.samsung.health.sleep.start_time'];
      const endStr = r['com.samsung.health.sleep.end_time'];
      const start = new Date(startStr);
      const end = new Date(endStr);
      
      const totalMins = parseInt(r['sleep_duration']) || Math.round((end - start) / 60000);
      const lightMins = parseInt(r['total_light_duration']) || 0;
      const remMins = parseInt(r['total_rem_duration']) || 0;
      const awakeMins = parseInt(r['movement_awakening']) || 0;
      const deepMins = Math.max(0, totalMins - (lightMins + remMins + awakeMins));

      return {
        start_time: startStr,
        session_end_time: endStr,
        duration_seconds: totalMins * 60,
        duration_mins: totalMins,
        deep_duration_min: deepMins,
        rem_duration_min: remMins,
        light_duration_min: lightMins,
        awake_duration_min: awakeMins,
        sleep_score: parseFloat(r['sleep_score']) || null,
        efficiency: parseFloat(r['efficiency']) || null,
      };
    })
    .filter(r => r.duration_seconds && r.duration_seconds >= 1800);
}

// 4. Weight
function transformWeight(records) {
  return records
    .filter(r => r['weight'] && r['start_time'])
    .map(r => ({
      kilograms: parseFloat(r['weight']) || null,
      height_cm: parseFloat(r['height']) || null,
      body_fat_pct: parseFloat(r['body_fat']) || null,
      muscle_mass_kg: parseFloat(r['muscle_mass']) || null,
      time: r['start_time'],
    }))
    .filter(r => r.kilograms && r.kilograms > 20);
}

// 5. Exercise (Fixed Duration: ms -> seconds & Exercise Type Mapping)
function transformExercise(records) {
  const typeMap = {
    '1001': 'WALKING',
    '1002': 'RUNNING',
    '1003': 'CYCLING',
    '11001': 'WALK_AUTO',
    '11002': 'RUN_AUTO',
    '11007': 'BIKE_AUTO',
    '14001': 'SWIMMING',
    '12001': 'CARDIO_TREADMILL',
    '10025': 'ELLIPTICAL',
    '10026': 'CIRCUIT_TRAINING',
    '3001': 'STRENGTH_TRAINING',
    '2001': 'HIKING',
    '6001': 'YOGA',
  };

  return records
    .filter(r => r['com.samsung.health.exercise.start_time'] || r['start_time'])
    .map(r => {
      const start = r['com.samsung.health.exercise.start_time'] || r['start_time'];
      const end = r['com.samsung.health.exercise.end_time'] || r['end_time'];
      
      // Duration in CSV is in milliseconds! Convert to seconds
      const rawDur = parseFloat(r['com.samsung.health.exercise.duration'] || r['duration']) || 0;
      const durSecs = rawDur > 10000 ? Math.round(rawDur / 1000) : Math.round(rawDur);

      const typeCode = r['com.samsung.health.exercise.exercise_type'] || r['exercise_type'] || '0';
      const exerciseType = typeMap[typeCode] || (typeCode === '0' ? 'WORKOUT' : `TYPE_${typeCode}`);

      const distMeters = parseFloat(r['com.samsung.health.exercise.distance'] || r['distance']) || null;
      const cals = parseFloat(r['com.samsung.health.exercise.calorie'] || r['calorie'] || r['total_calorie']) || null;

      return {
        type: exerciseType,
        start_time: start,
        end_time: end,
        duration_seconds: durSecs,
        distance_meters: distMeters,
        calories: cals,
        mean_heart_rate: parseFloat(r['com.samsung.health.exercise.mean_heart_rate'] || r['mean_heart_rate']) || null,
        max_heart_rate: parseFloat(r['com.samsung.health.exercise.max_heart_rate'] || r['max_heart_rate']) || null,
      };
    })
    .filter(r => r.duration_seconds > 30 && r.duration_seconds < 86400 && r.start_time);
}

// 6. Oxygen Saturation
function transformOxygenSaturation(records) {
  return records
    .filter(r => (r['spo2'] || r['percentage'] || r['com.samsung.health.oxygen_saturation.spo2']) && r['start_time'])
    .map(r => ({
      percentage: parseFloat(r['spo2'] || r['percentage'] || r['com.samsung.health.oxygen_saturation.spo2']) || null,
      time: r['start_time'] || r['com.samsung.health.oxygen_saturation.start_time'],
    }))
    .filter(r => r.percentage && r.percentage > 50);
}

// 7. Blood Pressure
function transformBloodPressure(records) {
  return records
    .filter(r => r['systolic'] && r['start_time'])
    .map(r => ({
      systolic: parseFloat(r['systolic']) || null,
      diastolic: parseFloat(r['diastolic']) || null,
      time: r['start_time'],
    }))
    .filter(r => r.systolic);
}

// 8. Hydration
function transformHydration(records) {
  return records
    .filter(r => (r['amount'] || r['intake']) && (r['start_time'] || r['create_time']))
    .map(r => ({
      liters: (parseFloat(r['amount'] || r['intake']) || 0) / 1000,
      start_time: r['start_time'] || r['create_time'],
      end_time: r['end_time'] || r['start_time'] || r['create_time'],
    }))
    .filter(r => r.liters > 0);
}

// ---- Main Import ----
async function importData() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB Atlas (saracapp)\n');

  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.csv'));
  
  const data = {
    doc_id: 'latest_health_record',
    last_updated: new Date().toISOString(),
    app_version: 'samsung_health_import_v2',
    heart_rate: [], steps: [], sleep: [], weight: [],
    exercise: [], oxygen_saturation: [], blood_pressure: [],
    hydration: [], heart_rate_variability: [], stress: [],
    skin_temperature: [], total_calories: [], distance: [],
    active_calories: [], resting_heart_rate: [],
  };

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const records = parseCSV(filePath);
    if (records.length === 0) continue;

    if (file.includes('tracker.heart_rate')) {
      data.heart_rate = transformHeartRate(records);
    } else if (file.includes('pedometer_day_summary')) {
      data.steps = transformSteps(records);
    } else if (file.includes('shealth.sleep.20') && !file.includes('stage') && !file.includes('combined') && !file.includes('snoring') && !file.includes('raw')) {
      data.sleep = transformSleep(records);
    } else if (file.includes('health.weight')) {
      data.weight = transformWeight(records);
    } else if (file.includes('shealth.exercise.2') && !file.includes('extension') && !file.includes('recovery') && !file.includes('weather') && !file.includes('max_heart') && !file.includes('route') && !file.includes('custom')) {
      data.exercise = transformExercise(records);
    } else if (file.includes('oxygen_saturation') && !file.includes('raw')) {
      data.oxygen_saturation = transformOxygenSaturation(records);
    } else if (file.includes('blood_pressure')) {
      data.blood_pressure = transformBloodPressure(records);
    } else if (file.includes('water_intake')) {
      data.hydration = transformHydration(records);
    }
  }

  console.log('💾 Saving clean parsed data to MongoDB...');
  await HealthRecord.findOneAndUpdate(
    { doc_id: 'latest_health_record' },
    { $set: data },
    { upsert: true }
  );

  console.log('\n🎉 RE-IMPORT COMPLETE!');
  console.log(`   Exercise Sessions:  ${data.exercise.length}`);
  console.log(`   Sleep Sessions:     ${data.sleep.length}`);
  console.log(`   Daily Steps:        ${data.steps.length}`);
  console.log(`   Heart Rate:         ${data.heart_rate.length}`);

  await mongoose.disconnect();
  process.exit(0);
}

importData().catch(e => { console.error('❌ FAILED:', e.message); process.exit(1); });
