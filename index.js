require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.send('✅ TrekAI server is running');
});

// Step 1: Initial location-based message
app.post('/api/start', async (req, res) => {
  const { location } = req.body;

  if (!location) {
    return res.status(400).json({ error: 'Location is required.' });
  }

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a trekking guide assistant. Ask helpful follow-up questions to personalize the trek."
        },
        {
          role: "user",
          content: `I'm interested in trekking in ${location}.`
        }
      ],
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({ reply: response.data.choices[0].message.content });
  } catch (error) {
    console.error('❌ Error in /api/start:', error.response?.data || error.message);
    res.status(500).send('Failed to generate intro response.');
  }
});

// Step 2: Final itinerary generation with filters and comments
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
User Notes: ${comments || "None"}
`;

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-4-0125-preview", // ✅ Use GPT-4-turbo
      messages: [
        {
          role: "system",
          content: `
You are a professional hiking guide and itinerary planner. Create detailed, practical, itineraries based on user preferences. Each day should include:

- Specific trail names or well-known routes
- Trailhead start and end points
- Distance (in kilometers and miles)
- Elevation gain/loss (in meters and feet)
- Difficulty rating (easy, moderate, difficult)
- Rifugi or food stops for lunch or drinks
- Recommended accommodations at the start/end
- Tips about transport, crowds, or weather

Speak clearly and in a warm, helpful tone—like a local guide who really knows the trails and wants the user to have the best possible trip.

Format the response with:
- No markdown headers like ### or **bold**
- Use plain, short titles for each day (e.g., "Day 1: Ortisei to Rifugio Brogles")
- Use bullet points or numbered lists for details like distance, elevation, difficulty, lunch spots, accommodations, and tips
- Be conversational and warm, like a local hiking guide
`.trim()
        },
        {
          role: "user",
          content: `
Here are the trek preferences:

${filterSummary}

Please generate a suitable itinerary.
`.trim()
        }
      ],
      temperature: 0.8,
      max_tokens: 2000
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({ reply: response.data.choices[0].message.content });
  } catch (error) {
    console.error('❌ Error in /api/finalize:', error.response?.data || error.message);
    res.status(500).send('Failed to generate final itinerary.');
  }
});

// Start server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
