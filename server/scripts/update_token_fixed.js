const mongoose = require('mongoose')

mongoose.connect('mongodb+srv://bilalgnd00_db_user:nXYAd9YjvcDWfDCr@bilalshop.usdvvvn.mongodb.net/saracapp?retryWrites=true&w=majority&appName=BILALshop')
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
    } else {
      console.log('Not found in saracapp DB either')
    }
    process.exit(0)
  })
