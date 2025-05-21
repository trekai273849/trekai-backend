// config/database.js
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
      console.error('MONGODB_URI environment variable is not defined');
      return null; // Don't exit - let server continue
    }
    
    // Set connection options for better reliability
    const options = {
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4 // Use IPv4, skip trying IPv6
    };
    
    await mongoose.connect(uri, options);
    console.log('MongoDB connected successfully');
    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    return null; // Don't exit - let server continue without crashing
  }
};

module.exports = connectDB;