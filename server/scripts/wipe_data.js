const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

mongoose.connect(process.env.MONGODB_URI || '')
  .then(async () => {
    console.log('Connected to DB');
    const { DataModel, UserModel } = require('./dist/models');
    // We will delete all data related to shops
    await DataModel.deleteMany({});
    console.log('All shop data (menus, orders) has been wiped.');
    
    // Add account_ids to existing users if they don't have one
    const users = await UserModel.find({});
    for (const u of users) {
      if (!u.account_id) {
        u.account_id = 'ACC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        await u.save();
        console.log(`Added account_id to ${u.username}`);
      }
    }

    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
