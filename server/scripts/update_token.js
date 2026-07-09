const mongoose = require('mongoose')

mongoose.connect('mongodb+srv://bilalgnd00_db_user:nXYAd9YjvcDWfDCr@bilalshop.usdvvvn.mongodb.net/?appName=BILALshop')
  .then(async () => {
    const DataModel = mongoose.model('Data', new mongoose.Schema({
      key: { type: String, required: true, unique: true },
      value: { type: mongoose.Schema.Types.Mixed }
    }))
    const ds = await DataModel.findOne({ key: 'systemSettings' })
    if (ds) {
      ds.value.API_TOKEN = '123456'
      await DataModel.findOneAndUpdate({ key: 'systemSettings' }, { value: ds.value })
      console.log('Token updated to 123456')
    }
    process.exit(0)
  })
