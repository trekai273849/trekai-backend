// Enhanced index.js with MongoDB, Firebase, and Stripe integration
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const connectDB = require('./config/database');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser'); 
const { verifyToken } = require('./middleware/auth');
const mongoose = require('mongoose'); // Add this import

// Initialize Firebase
require('./config/firebase-config');

// Create routes directory if it doesn't exist
const routesDir = path.join(__dirname, 'routes');
if (!fs.existsSync(routesDir)) {
  fs.mkdirSync(routesDir);
}

const app = express();

// IMPORTANT: Webhook middleware MUST come before express.json()
// This handles Stripe webhook with raw body parsing
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }));

// Regular middleware (after webhook route)
app.use(express.json());
app.use(cookieParser());

// Database connection with better error handling
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
    // Don't exit - let the server start anyway
  });

const allowedOrigins = [
  'https://smarttrails.pro',
  'https://www.smarttrails.pro',
  'http://localhost:3000',
  'http://localhost:8080',      
  'http://127.0.0.1:8080',      
  'http://192.168.0.9:8080',
  'https://feature-test-user-profiles--delightful-croquembouche-cafa23.netlify.app',
  'https://feature-test-user-profiles--delightful-croquembouche-cafa23.netlify.app'
];

// Production-ready CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, cURL)
    if (!origin) return callback(null, true);
    
    // Allow specific origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Allow all Netlify preview domains for your site
    if (origin && origin.includes('delightful-croquembouche-cafa23.netlify.app')) {
      return callback(null, true);
    }
    
    // Block other origins
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true, // Allow cookies and authentication headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] // Include OPTIONS for preflight
}));

// Handle OPTIONS preflight requests explicitly
app.options('*', cors());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Improved Health check endpoint with better logging
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    const dbState = mongoose.connection.readyState;
    console.log(`Health check - DB state: ${dbState}`);
    
    // Define state names for logging
    const stateNames = ['disconnected', 'connected', 'connecting', 'disconnecting', 'uninitialized'];
    
    if (dbState === 1) {
      res.json({ 
        status: 'ok',
        message: 'API is running, database connected',
        dbState: 'connected',
        serverTime: new Date().toISOString()
      });
    } else {
      console.log(`Health check - DB connection issue: ${stateNames[dbState] || 'unknown'}`);
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
      stack: process.env.NODE_ENV === 'production' ? null : error.stack,
      serverTime: new Date().toISOString()
    });
  }
});

// Add new debug endpoint for diagnostics
app.get('/api/debug', (req, res) => {
  // Send debug info
  res.json({
    serverTime: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    mongodbState: {
      connected: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState,
      stateName: ['disconnected', 'connected', 'connecting', 'disconnecting', 'uninitialized'][mongoose.connection.readyState] || 'unknown'
    },
    corsConfig: {
      allowedOrigins: allowedOrigins
    },
    envVarsPresent: {
      mongoUri: !!process.env.MONGODB_URI,
      firebaseProjectId: !!process.env.FIREBASE_PROJECT_ID,
      openaiApiKey: !!process.env.OPENAI_API_KEY
    },
    versions: {
      node: process.version,
      express: require('express/package.json').version,
      mongoose: require('mongoose/package.json').version
    }
  });
});

app.get('/', (req, res) => {
  res.send('✅ TrekAI server is running with MongoDB, Firebase, and Stripe integration');
});

// Import routes with debugging
console.log('🔍 Starting route registration...');

let itinerariesRoutes, userRoutes, subscriptionRoutes;

try {
  console.log('📍 Loading itineraries routes...');
  itinerariesRoutes = require('./routes/itineraries');
  console.log('✅ Itineraries routes loaded');
} catch (error) {
  console.error('❌ Error loading itineraries routes:', error);
  throw error;
}

try {
  console.log('📍 Loading user routes...');
  userRoutes = require('./routes/users');
  console.log('✅ User routes loaded');
} catch (error) {
  console.error('❌ Error loading user routes:', error);
  throw error;
}

try {
  console.log('📍 Loading subscription routes...');
  subscriptionRoutes = require('./routes/subscriptions');
  console.log('✅ Subscription routes loaded');
} catch (error) {
  console.error('❌ Error loading subscription routes:', error);
  throw error;
}

// Use routes with authentication middleware
console.log('📍 Registering routes...');
app.use('/api/users', userRoutes);
app.use('/api/itineraries', verifyToken, itinerariesRoutes);
app.use('/api/subscriptions', subscriptionRoutes); // Register subscription routes (includes webhook)
console.log('✅ All routes registered successfully');

// Function to enhance itinerary output
function enhancedNormalizeOutput(gptResponse) {
  let output = gptResponse;

  // Make sure day headings are properly formatted with ### prefix
  output = output.replace(/^(\s*Day\s+\d+:)/gm, '### $1');
  
  // Make sure section headings are properly formatted
  const sectionHeaders = [
    'Packing List', 
    'Local Insights', 
    'Practical Information'
  ];
  
  sectionHeaders.forEach(header => {
    if (!output.includes(`### ${header}`)) {
      // Find section and add proper heading if not formatted correctly
      const headerRegex = new RegExp(`(?:^|\\n)(?:\\d+\\.\\s*)?(?:${header})(?:\\s*\\:)?`, 'i');
      const headerMatch = output.match(headerRegex);
      if (headerMatch) {
        output = output.replace(headerMatch[0], `\n\n### ${header}\n`);
      }
    }
  });

  // Process each day section to ensure proper field formatting
  const dayRegex = /### Day \d+:.*?(?=### Day \d+:|### Packing List|### Local Insights|### Practical Information|$)/gs;
  let processedOutput = output;
  let match;
  
  while ((match = dayRegex.exec(output)) !== null) {
    let daySection = match[0];
    const dayHeaderMatch = daySection.match(/(### Day \d+:.*?)(?:\n|$)/);
    
    if (!dayHeaderMatch) continue;
    
    const dayHeader = dayHeaderMatch[0];
    
    // Get section content without the header
    let dayContent = daySection.replace(dayHeader, '').trim();
    
    // Process each expected field if not already formatted with bullet points
    if (!dayContent.match(/\n\s*-\s*Start:/)) {
      // List of all possible fields in enhanced format
      const fields = [
        'Start', 'End', 'Distance', 'Elevation gain/loss', 'Elevation',
        'Terrain', 'Difficulty', 'Highlights', 'Lunch', 'Accommodation',
        'Water sources', 'Tips'
      ];
      
      fields.forEach(field => {
        const fieldRegex = new RegExp(`\\b${field.replace(/\//g, '\\/').replace(/\(/g, '\\(').replace(/\)/g, '\\)')}\\s*:\\s*([^\\n]+)`, 'i');
        const fieldMatch = dayContent.match(fieldRegex);
        
        if (fieldMatch) {
          // Replace the old format with bullet point format
          dayContent = dayContent.replace(
            fieldMatch[0], 
            `\n- ${field}: ${fieldMatch[1].trim()}`
          );
        }
      });
      
      // Replace the day section in the processed output
      const newDaySection = dayHeader + '\n' + dayContent;
      processedOutput = processedOutput.replace(daySection, newDaySection);
    }
  }

  // Process detailed subsections in Packing List, Local Insights, etc.
  const sectionRegex = /### (Packing List|Local Insights|Practical Information)\s*([\s\S]*?)(?=###|$)/g;
  let sectionMatch;
  
  while ((sectionMatch = sectionRegex.exec(processedOutput)) !== null) {
    const sectionName = sectionMatch[1];
    let sectionContent = sectionMatch[2].trim();
    
    // Handle subsection headers (marked with asterisks)
    const subsectionRegex = /\*(.*?):\*/g;
    let formattedContent = sectionContent;
    
    // Format subsection headers to be bold
    formattedContent = formattedContent.replace(subsectionRegex, '*$1:*');
    
    // Ensure each line in the section starts with a bullet point
    const lines = formattedContent.split('\n').map(line => {
      line = line.trim();
      if (line && !line.startsWith('-') && !line.startsWith('*') && !line.startsWith('**')) {
        return `- ${line}`;
      }
      return line;
    });
    
    const newSectionContent = '\n' + lines.join('\n') + '\n\n';
    processedOutput = processedOutput.replace(sectionMatch[0], `### ${sectionName}${newSectionContent}`);
  }
  
  return processedOutput;
}

// Enhanced /api/start endpoint with authentication
app.post('/api/start', verifyToken, async (req, res) => {
  const { location } = req.body;
  if (!location) return res.status(400).json({ error: 'Location is required.' });

  // Ensure user is authenticated
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

// Modified /api/finalize endpoint to work without authentication
app.post('/api/finalize', async (req, res) => {
  // Check if user is authenticated (but don't require it)
  const userId = req.user?.userId; // Optional chaining - this will be undefined if not authenticated
  
  const { location, filters, comments, title } = req.body;

  if (!location || !filters) {
    return res.status(400).json({ error: 'Location and filters are required.' });
  }

  const dayMatch = location.match(/(\d+)\s*(day|night)/i);
  const dayInfo = dayMatch ? `${dayMatch[1]}-day` : '';

  const filterSummary = `
Location: ${location}
Accommodation: ${filters.accommodation || 'Not specified'}
Difficulty: ${filters.difficulty || 'Not specified'}
Altitude: ${filters.altitude || 'Not specified'}
Technical: ${filters.technical || 'Not specified'}
User Notes: ${comments || 'None'}
`;

  // Enhanced GPT prompt for richer trek itineraries
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
- [item]

*Clothing:*
- [specific clothing recommendations for this trek's conditions]
- [item]

*Trek-Specific Gear:*
- [items particularly important for this region/trek]
- [item]

*Documentation:*
- [permits, maps, or documentation needed]
- [item]

4. A comprehensive local insights section:
### Local Insights
*Cultural Considerations:*
- [specific cultural practices or etiquette for the region]
- [insight]

*Safety Information:*
- [region-specific safety tips, wildlife awareness, weather patterns]
- [insight]

*Local Food & Specialties:*
- [regional dishes or foods worth trying]
- [insight]

*Language Tips:*
- [2-3 useful phrases in local language if relevant]
- [insight]

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

CRITICAL FORMATTING RULES:
- Use "### Day X:" format for EVERY day header
- Use bullet points (single hyphen) for ALL data points within each day
- ALWAYS include ALL sections (intro, all days, packing list, local insights, practical info)
- Use the EXACT format shown above including all field names
- ALWAYS include all fields for every day, with specific, actionable information
- Focus on providing SPECIFIC details rather than generic advice
- Include regional specialties, cultural insights, and location-specific information
- Mention actual place names, trail features, and local terminology when possible
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: enhancedSystemPrompt
        },
        {
          role: 'user',
          content: `
Here are the trek preferences:

${filterSummary}

If the user specifies a number of days (e.g. "6-day trek", "10 days in Nepal", etc), generate that number of individual day entries.

Each day MUST follow the exact format specified, with special attention to:
1. Providing SPECIFIC locations, landmarks, and points of interest by name
2. Including practical details about terrain, water sources, and trail conditions
3. Mentioning actual local food specialties and accommodation options
4. Adding region-specific cultural and safety information

For ${location}, include authentic local knowledge about the trails, culture, and environment. 
Make this itinerary highly specific to the region rather than generic trekking advice.

Please generate the full itinerary with proper formatting for each day, plus the enhanced sections.
          `.trim()
        }
      ],
      temperature: 0.7,
      max_tokens: 3000
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();
    const normalizedReply = enhancedNormalizeOutput(reply);

    if (!normalizedReply) return res.status(500).json({ error: 'No response from OpenAI' });
    
    // Only attempt to save if user is authenticated
    if (userId) {
      try {
        // Check database connection before attempting to save
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
        console.log(`✅ Itinerary saved to database with ID: ${savedItinerary._id}`);
        
        // Return both the content and the saved itinerary with ID
        return res.json({ 
          reply: normalizedReply,
          itineraryId: savedItinerary._id,
          message: 'Itinerary saved to database'
        });
      } catch (dbError) {
        console.error('❌ Error saving to database:', dbError);
        // Return content even if database save fails
        return res.json({ 
          reply: normalizedReply,
          error: 'Failed to save to database',
          message: 'Generated itinerary but failed to save to database'
        });
      }
    } else {
      // User is not authenticated, just return the content without saving
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

// Add error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    error: message,
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack
  });
};

app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));