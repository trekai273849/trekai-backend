const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Print current directory for debugging
console.log('Current directory:', process.cwd());

// Check if .env file exists
const envPath = path.resolve(process.cwd(), '.env');
console.log('.env path:', envPath);
console.log('.env file exists:', fs.existsSync(envPath));

// If it exists, show its contents (safely)
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('.env file content (showing only keys):');
  const lines = envContent.split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      const parts = line.split('=');
      if (parts.length > 1) {
        console.log(`  ${parts[0]}=[HIDDEN]`);
      } else {
        console.log(`  ${line} (invalid format)`);
      }
    }
  });
}

// Load environment variables with explicit path
const result = dotenv.config({ path: envPath });
console.log('dotenv result:', result.error ? 'Error: ' + result.error.message : 'Success');

// Check if MongoDB URI is loaded
const mongoUri = process.env.MONGODB_URI;
console.log('MONGODB_URI loaded:', !!mongoUri);

// If MongoDB URI is loaded, try to connect
if (mongoUri) {
  const mongoose = require('mongoose');
  console.log('Attempting to connect to MongoDB...');
  
  mongoose.connect(mongoUri)
    .then(() => {
      console.log('✅ Connected to MongoDB Atlas successfully!');
      mongoose.connection.close();
    })
    .catch(err => {
      console.error('❌ Failed to connect to MongoDB Atlas:', err.message);
    });
} else {
  console.error('Cannot connect to MongoDB without a connection string.');
}