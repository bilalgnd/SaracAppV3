require('dotenv').config()
const mongoose = require('mongoose')

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const DataStore = mongoose.model('Data', new mongoose.Schema({}, { strict: false }))
    const ds = await DataStore.findOne({ type: 'settings' })
    console.log(ds)
    process.exit(0)
  })
