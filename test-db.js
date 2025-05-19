require('dotenv').config();
const mongoose = require('mongoose');

// Debug .env loading
console.log('Environment variables loaded:', Object.keys(process.env).includes('MONGODB_URI'));

const uri = process.env.MONGODB_URI;

// Show what we're working with (safely)
if (!uri) {
  console.error('❌ MONGODB_URI is not defined in your .env file');
  process.exit(1);
}

console.log('Attempting to connect to MongoDB...');
console.log(`Connection string starts with: ${uri.substring(0, 20)}...`);

mongoose.connect(uri)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas successfully!');
    console.log('Connection established to database:', mongoose.connection.db.databaseName);
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('❌ Failed to connect to MongoDB Atlas:', err.message);
  });