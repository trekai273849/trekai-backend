const mongoose = require('mongoose');

// Directly use the connection string without dotenv
const uri = 'mongodb+srv://trekkingaiportal:0c6RBiwf5btZevZb@smarttrails.j0wtyvf.mongodb.net/?retryWrites=true&w=majority&appName=SmartTrails';
console.log('Using hardcoded connection string (beginning only):', uri.substring(0, 20) + '...');

mongoose.connect(uri)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas successfully!');
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('❌ Failed to connect to MongoDB Atlas:', err.message);
  });