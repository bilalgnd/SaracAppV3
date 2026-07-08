const mongoose = require('mongoose')

mongoose.connect('mongodb+srv://bilalgnd00_db_user:nXYAd9YjvcDWfDCr@bilalshop.usdvvvn.mongodb.net/?appName=BILALshop')
  .then(async () => {
    const DataStore = mongoose.model('Data', new mongoose.Schema({}, { strict: false }))
    const ds = await DataStore.findOne({ type: 'settings' })
    console.log(ds)
    process.exit(0)
  })
