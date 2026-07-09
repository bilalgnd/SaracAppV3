require('dotenv').config()
const mongoose = require('mongoose')

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const admin = mongoose.connection.db.admin()
    const result = await admin.listDatabases()
    console.log(result.databases.map(d => d.name))
    
    // Now let's query the test database explicitly
    const DataModel = mongoose.model('Data', new mongoose.Schema({
      key: { type: String, required: true, unique: true },
      value: { type: mongoose.Schema.Types.Mixed }
    }))
    const ds = await DataModel.findOne({ key: 'systemSettings' })
    console.log(ds ? ds.value : 'Not found in test DB')
    process.exit(0)
  })
