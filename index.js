// Express 5.x compatible index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const connectDB = require('./config/database');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser'); 
const { verifyToken, optionalAuth } = require('./middleware/auth'); // ✅ Import optionalAuth
const mongoose = require('mongoose');

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

// Basic middleware - Express 5.x compatible
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

console.log('✅ Basic middleware configured');

// Database connection
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

// Simplified CORS - Express 5.x compatible
const allowedOrigins = [
  'https://smarttrails.pro',
  'https://www.smarttrails.pro',
  'http://localhost:3000',
  'http://localhost:8080',      
  'http://127.0.0.1:8080',      
  'http://192.168.0.9:8080'
];

// Express 5.x compatible CORS setup
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Allow requests with no origin (mobile apps, Postman, etc.)
  if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  } else {
    // Check allowed origins or Netlify preview domains
    if (allowedOrigins.includes(origin) || 
        (origin && origin.includes('delightful-croquembouche-cafa23.netlify.app'))) {
      res.header('Access-Control-Allow-Origin', origin);
    }
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

console.log('✅ CORS configured');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Basic routes
app.get('/', (req, res) => {
  res.send('✅ TrekAI server is running with MongoDB, Firebase, and Stripe integration');
});

app.get('/api/health', async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const stateNames = ['disconnected', 'connected', 'connecting', 'disconnecting', 'uninitialized'];
    
    if (dbState === 1) {
      res.json({ 
        status: 'ok',
        message: 'API is running, database connected',
        dbState: 'connected',
        serverTime: new Date().toISOString()
      });
    } else {
      res.status(503).json({ 
        status: 'error',
        message: 'Database connection issue',
        dbState: stateNames[dbState] || 'unknown',
        serverTime: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message,
      serverTime: new Date().toISOString()
    });
  }
});

app.get('/api/debug', (req, res) => {
  res.json({
    serverTime: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    expressVersion: require('express/package.json').version,
    mongodbState: {
      connected: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState,
      stateName: ['disconnected', 'connected', 'connecting', 'disconnecting', 'uninitialized'][mongoose.connection.readyState] || 'unknown'
    },
    envVarsPresent: {
      mongoUri: !!process.env.MONGODB_URI,
      firebaseProjectId: !!process.env.FIREBASE_PROJECT_ID,
      openaiApiKey: !!process.env.OPENAI_API_KEY
    }
  });
});

console.log('✅ Basic routes configured');

// Load and register routes - Express 5.x compatible way
console.log('🔍 Loading routes...');

try {
  const userRoutes = require('./routes/users');
  const itinerariesRoutes = require('./routes/itineraries');
  const subscriptionRoutes = require('./routes/subscriptions');
  
  console.log('✅ Route files loaded');
  
  // Register routes with Express 5.x compatible syntax
  app.use('/api/users', userRoutes);
  app.use('/api/itineraries', verifyToken, itinerariesRoutes);
  app.use('/api/subscriptions', subscriptionRoutes);
  
  console.log('✅ Routes registered');
} catch (routeError) {
  console.error('❌ Route loading error:', routeError);
  console.log('⚠️ Some routes may not be available');
}

// Enhanced itinerary generation function
function enhancedNormalizeOutput(gptResponse) {
  let output = gptResponse;
  output = output.replace(/^(\s*Day\s+\d+:)/gm, '### $1');
  
  const sectionHeaders = ['Packing List', 'Local Insights', 'Practical Information'];
  
  sectionHeaders.forEach(header => {
    if (!output.includes(`### ${header}`)) {
      const headerRegex = new RegExp(`(?:^|\\n)(?:\\d+\\.\\s*)?(?:${header})(?:\\s*\\:)?`, 'i');
      const headerMatch = output.match(headerRegex);
      if (headerMatch) {
        output = output.replace(headerMatch[0], `\n\n### ${header}\n`);
      }
    }
  });

  return output;
}

// API endpoints
app.post('/api/start', verifyToken, async (req, res) => {
  const { location } = req.body;
  if (!location) return res.status(400).json({ error: 'Location is required.' });

  if (!req.user || !req.user.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a trekking guide assistant. Ask helpful follow-up questions to personalize the trek.'
        },
        {
          role: 'user',
          content: `I'm interested in trekking in ${location}.`
        }
      ],
      temperature: 0.7
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();
    res.json({ reply, userId: req.user.userId });
  } catch (error) {
    console.error('❌ Error in /api/start:', error);
    res.status(500).send('Failed to generate intro response.');
  }
});

// ✅ FIX: Add optionalAuth middleware to /api/finalize route
app.post('/api/finalize', optionalAuth, async (req, res) => {
  const userId = req.user?.userId;
  const { location, filters, comments, title } = req.body;

  if (!location || !filters) {
    return res.status(400).json({ error: 'Location and filters are required.' });
  }

  const filterSummary = `
Location: ${location}
Accommodation: ${filters.accommodation || 'Not specified'}
Difficulty: ${filters.difficulty || 'Not specified'}
Altitude: ${filters.altitude || 'Not specified'}
Technical: ${filters.technical || 'Not specified'}
User Notes: ${comments || 'None'}
`;

  const enhancedSystemPrompt = `
You are an expert trekking guide AI specializing in creating detailed, practical itineraries with rich local knowledge.

Your response MUST follow this EXACT format with these enhanced sections:

1. A compelling intro paragraph (2-3 sentences) that captures the essence of the trek and highlights a unique feature.

2. Day-by-day itinerary using this exact format for EACH day:
### Day X: [Descriptive Title with Notable Feature]
- Start: [location, with altitude if relevant]
- End: [location, with altitude if relevant]
- Distance: [X km (X miles)] - mention if it's mostly uphill/downhill/flat
- Elevation gain/loss: [X m (X ft)]
- Terrain: [brief description e.g., rocky paths, forest trails, alpine meadows, etc.]
- Difficulty: [Easy/Moderate/Challenging] with brief explanation why
- Highlights: [2-3 specific points of interest, landmarks, or views]
- Lunch: [specific recommendation with local specialties if applicable]
- Accommodation: [specific name if known, with brief description]
- Water sources: [information about water availability on trail]
- Tips: [practical advice specific to this day's trek]

3. A detailed packing list section with categories:
### Packing List
*Essentials:*
- [item with brief explanation if needed]

*Clothing:*
- [specific clothing recommendations for this trek's conditions]

*Trek-Specific Gear:*
- [items particularly important for this region/trek]

*Documentation:*
- [permits, maps, or documentation needed]

4. A comprehensive local insights section:
### Local Insights
*Cultural Considerations:*
- [specific cultural practices or etiquette for the region]

*Safety Information:*
- [region-specific safety tips, wildlife awareness, weather patterns]

*Local Food & Specialties:*
- [regional dishes or foods worth trying]

*Language Tips:*
- [2-3 useful phrases in local language if relevant]

5. A practical information section:
### Practical Information
*Best Time to Visit:*
- [specific months or seasons with brief weather patterns]

*Getting There:*
- [practical transportation options to starting point]

*Permits & Regulations:*
- [any required permits, fees, or regulations]

*Emergency Contacts:*
- [nearest medical facilities or emergency numbers]
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: enhancedSystemPrompt },
        {
          role: 'user',
          content: `Here are the trek preferences: ${filterSummary}

For ${location}, include authentic local knowledge about the trails, culture, and environment. 
Make this itinerary highly specific to the region rather than generic trekking advice.

Please generate the full itinerary with proper formatting for each day, plus the enhanced sections.`
        }
      ],
      temperature: 0.7,
      max_tokens: 3000
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();
    const normalizedReply = enhancedNormalizeOutput(reply);

    if (!normalizedReply) return res.status(500).json({ error: 'No response from OpenAI' });
    
    if (userId) {
      try {
        if (mongoose.connection.readyState !== 1) {
          return res.json({ 
            reply: normalizedReply,
            error: 'Database unavailable',
            message: 'Generated itinerary but database is unavailable for saving'
          });
        }
        
        const Itinerary = require('./models/Itinerary');
        
        const newItinerary = new Itinerary({
          user: userId,
          title: title || `${location} Trek`,
          location,
          filters,
          comments,
          content: normalizedReply,
          createdAt: Date.now(),
          lastViewed: Date.now()
        });
        
        const savedItinerary = await newItinerary.save();
        
        return res.json({ 
          reply: normalizedReply,
          itineraryId: savedItinerary._id,
          message: 'Itinerary saved to database'
        });
      } catch (dbError) {
        console.error('❌ Error saving to database:', dbError);
        return res.json({ 
          reply: normalizedReply,
          error: 'Failed to save to database',
          message: 'Generated itinerary but failed to save to database'
        });
      }
    } else {
      return res.json({ 
        reply: normalizedReply,
        isAuthenticated: false,
        message: 'Itinerary generated but not saved (user not authenticated)'
      });
    }
  } catch (error) {
    console.error('❌ Error in /api/finalize:', error.response?.data || error.message);
    res.status(500).send('Failed to generate final itinerary.');
  }
});

// Error handler - Express 5.x compatible
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    error: message,
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 TrekAI server running on port ${PORT}`);
  console.log('✅ Express 5.x compatible server started');
});