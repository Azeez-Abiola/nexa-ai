const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const BusinessUnit = mongoose.model('BusinessUnit', new mongoose.Schema({}, { strict: false }));
    const AdminUser = mongoose.model('AdminUser', new mongoose.Schema({}, { strict: false }));
    
    const lastTenant = await BusinessUnit.findOne().sort({ createdAt: -1 });
    const lastAdmin = await AdminUser.findOne().sort({ createdAt: -1 });
    
    console.log('Last Tenant:', JSON.stringify(lastTenant, null, 2));
    console.log('Last Admin:', JSON.stringify(lastAdmin, null, 2));
    
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

check();
