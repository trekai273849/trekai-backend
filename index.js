// Minimal debug version to isolate the problematic route
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');

console.log('🚀 Starting minimal server...');

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

console.log('📝 Setting up basic middleware...');

// IMPORTANT: Webhook middleware MUST come before express.json()
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(cookieParser());

console.log('✅ Basic middleware set up');

// Basic CORS
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

console.log('✅ CORS configured');

// Basic routes first
app.get('/', (req, res) => {
  res.send('✅ Minimal TrekAI server is running');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

console.log('✅ Basic routes configured');

// Now try loading route files one by one
console.log('🔍 Starting route file testing...');

// Test 1: Try loading users routes
try {
  console.log('📍 Testing users routes...');
  const userRoutes = require('./routes/users');
  console.log('✅ Users routes loaded successfully');
  app.use('/api/users', userRoutes);
  console.log('✅ Users routes registered successfully');
} catch (error) {
  console.error('❌ Error with users routes:', error.message);
  console.error('Full error:', error);
  process.exit(1);
}

// Test 2: Try loading itineraries routes
try {
  console.log('📍 Testing itineraries routes...');
  const itinerariesRoutes = require('./routes/itineraries');
  console.log('✅ Itineraries routes loaded successfully');
  
  // Load auth middleware
  const { verifyToken } = require('./middleware/auth');
  app.use('/api/itineraries', verifyToken, itinerariesRoutes);
  console.log('✅ Itineraries routes registered successfully');
} catch (error) {
  console.error('❌ Error with itineraries routes:', error.message);
  console.error('Full error:', error);
  process.exit(1);
}

// Test 3: Try loading subscription routes
try {
  console.log('📍 Testing subscription routes...');
  const subscriptionRoutes = require('./routes/subscriptions');
  console.log('✅ Subscription routes loaded successfully');
  app.use('/api/subscriptions', subscriptionRoutes);
  console.log('✅ Subscription routes registered successfully');
} catch (error) {
  console.error('❌ Error with subscription routes:', error.message);
  console.error('Full error:', error);
  process.exit(1);
}

console.log('🎉 All routes loaded successfully!');

// Error handler
app.use((err, req, res, next) => {
  console.error('Error handler caught:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Minimal server running on port ${PORT}`);
  console.log('✅ All routes successfully loaded and registered');
});