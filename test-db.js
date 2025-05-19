const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || 'your-connection-string-here';

mongoose.connect(uri)
  .then(() => {
    console.log('Connected to MongoDB Atlas successfully!');
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB Atlas:', err);
  });