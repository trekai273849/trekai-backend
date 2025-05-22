// Step-by-step debugging to find the exact issue
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser'); 

console.log('🚀 Starting TrekAI server...');

// Initialize Firebase
try {
  console.log('🔥 Loading Firebase config...');
  require('./config/firebase-config');
  console.log('✅ Firebase config loaded');
} catch (error) {
  console.error('❌ Firebase config error:', error);
  throw error;
}

const app = express();

console.log('📝 Setting up middleware...');

// Basic middleware only
app.use(express.json());
app.use(cookieParser());

console.log('✅ Basic middleware configured');

console.log('🔍 Step 1: Testing basic CORS...');

// Simple CORS first
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

console.log('✅ Step 1: Basic CORS configured');

console.log('🔍 Step 2: Testing basic route...');

// Test basic route
app.get('/', (req, res) => {
  res.send('✅ Basic route working');
});

console.log('✅ Step 2: Basic route added');

console.log('🔍 Step 3: Testing health route...');

// Simple health route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

console.log('✅ Step 3: Health route added');

console.log('🔍 Step 4: Testing debug route...');

// Simple debug route
app.get('/api/debug', (req, res) => {
  res.json({ message: 'Debug endpoint working' });
});

console.log('✅ Step 4: Debug route added');

console.log('🔍 Step 5: Testing database connection...');

// Database connection
try {
  const connectDB = require('./config/database');
  connectDB()
    .then(connection => {
      if (connection) {
        console.log('📊 MongoDB connected successfully');
      } else {
        console.log('⚠️ Warning: Starting server without MongoDB connection');
      }
    })
    .catch(err => {
      console.error('❌ MongoDB connection error:', err);
      console.log('⚠️ Warning: Starting server without MongoDB connection');
    });
} catch (dbError) {
  console.error('❌ Database module error:', dbError);
  console.log('⚠️ Continuing without database connection');
}

console.log('✅ Step 5: Database connection initiated');

console.log('🔍 Step 6: Testing OpenAI initialization...');

// OpenAI initialization
try {
  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log('✅ Step 6: OpenAI initialized');
} catch (openaiError) {
  console.error('❌ OpenAI initialization error:', openaiError);
  console.log('⚠️ Continuing without OpenAI');
}

console.log('🔍 Step 7: Testing middleware imports...');

// Test auth middleware import
try {
  const { verifyToken } = require('./middleware/auth');
  console.log('✅ Step 7: Auth middleware imported');
} catch (authError) {
  console.error('❌ Auth middleware error:', authError);
  console.log('⚠️ Continuing without auth middleware');
}

console.log('🔍 Step 8: Testing mongoose import...');

try {
  const mongoose = require('mongoose');
  console.log('✅ Step 8: Mongoose imported');
} catch (mongooseError) {
  console.error('❌ Mongoose import error:', mongooseError);
  console.log('⚠️ Continuing without mongoose');
}

console.log('🔍 Step 9: Testing route file imports (NOT registering yet)...');

try {
  console.log('   Testing users route import...');
  const userRoutes = require('./routes/users');
  console.log('   ✅ Users routes imported successfully');
  
  console.log('   Testing itineraries route import...');
  const itinerariesRoutes = require('./routes/itineraries');
  console.log('   ✅ Itineraries routes imported successfully');
  
  console.log('   Testing subscriptions route import...');
  const subscriptionRoutes = require('./routes/subscriptions');
  console.log('   ✅ Subscriptions routes imported successfully');
  
  console.log('✅ Step 9: All route files imported');
} catch (routeImportError) {
  console.error('❌ Route import error:', routeImportError);
  console.log('⚠️ Will continue without problematic routes');
}

console.log('🔍 Step 10: Server startup...');

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 TrekAI server running on port ${PORT}`);
  console.log('✅ All steps completed successfully!');
});

console.log('✅ Step 10: Server startup initiated');