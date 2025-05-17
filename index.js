// ✅ FINAL index.js — Combines full original functionality with updated CORS + OpenAI SDK
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
app.use(express.json());

const allowedOrigins = [
  'https://smarttrails.pro',
  'https://your-frontend.netlify.app',
  'http://localhost:3000',
  'https://feature-test-customize-page--delightful-croquembouche-cafa23.netlify.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get('/', (req, res) => {
  res.send('✅ TrekAI server is running');
});

// /api/start endpoint
app.post('/api/start', async (req, res) => {
  const { location } = req.body;
  if (!location) return res.status(400).json({ error: 'Location is required.' });

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
    res.json({ reply });
  } catch (error) {
    console.error('❌ Error in /api/start:', error);
    res.status(500).send('Failed to generate intro response.');
  }
});

// /api/finalize endpoint
app.post('/api/finalize', async (req, res) => {
  const { location, filters, comments } = req.body;

  if (!location || !filters) {
    return res.status(400).json({ error: 'Location and filters are required.' });
  }

  const filterSummary = `
Location: ${location}
Accommodation: ${filters.accommodation}
Difficulty: ${filters.difficulty}
Altitude: ${filters.altitude}
Technical: ${filters.technical}
User Notes: ${comments || 'None'}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `
You are a professional trekking guide AI.

First, determine the number of trekking days from the user's request or comments. If no specific number is given, default to 3 days.

Respond with three clearly separated sections:

Start with a short paragraph, then outline each day using:
Day X: Title
- Start:
- End:
- Distance: (in km and miles, e.g. "7 km (4.3 miles)")
- Elevation: (in meters and feet, e.g. "+500m / -200m (+1640ft / -656ft)")
- Difficulty:
- Lunch:
- Accommodation:
- Tips:

### Packing List
Provide a detailed, bullet-point list of essential gear, clothing, and safety items based on the trip.

### Local Insights
Offer concise local tips as a bulleted list (use dashes). Include insights about local culture, attractions, safety and food. Ensure each point starts on a new line.

Do not use markdown styling. Keep formatting clean and consistent.
Do not include ### in the body of the response. Only use them as section headers: ### Packing List and ### Local Insights.
`.trim()
        },
        {
          role: 'user',
          content: `Here are the trek preferences:\n\n${filterSummary}\n\nPlease generate the full itinerary, packing list, and local insights.`
        }
      ],
      temperature: 0.8,
      max_tokens: 2500
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(500).json({ error: 'No response from OpenAI' });
    res.json({ reply });
  } catch (error) {
    console.error('❌ Error in /api/finalize:', error);
    res.status(500).send('Failed to generate final itinerary.');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
