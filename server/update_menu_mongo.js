require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB Connected');
    
    // Mongoose Schemas
    const DataSchema = new mongoose.Schema({
      key: { type: String, required: true, unique: true },
      value: { type: mongoose.Schema.Types.Mixed }
    });

    const DataModel = mongoose.models.Data || mongoose.model('Data', DataSchema);

    const menuPath = 'C:\\Users\\bilal\\AppData\\Roaming\\SaracApp\\custom_menu.json';
    const menuData = JSON.parse(fs.readFileSync(menuPath, 'utf8'));

    await DataModel.findOneAndUpdate({ key: 'customMenu' }, { value: menuData }, { upsert: true });
    console.log('Menu successfully updated in MongoDB');
    process.exit(0);
  })
  .catch(err => {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
  });
