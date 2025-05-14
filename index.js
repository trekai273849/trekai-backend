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
          You are a professional hiking guide and itinerary planner. Based on the user's preferences, generate a beautifully structured, easy-to-read hiking itinerary. For each day, provide:

          Day X: Title (e.g., Ortisei to Rifugio Brogles)

          - Start: [Trailhead Start]
          - End: [Trailhead End]
          - Distance: [KM] ([Miles])
          - Elevation: [Gain/Loss in meters and feet]
          - Difficulty: [Easy/Moderate/Difficult]
          - Lunch: [Where and what]
          - Accommodation: [Recommended overnight options]
          - Tips: [Concise and friendly advice]

          Start with a short intro paragraph to set the tone. End with a friendly tip or reminder.

          Do not use markdown (no **bold**, no ###). Use consistent punctuation and spacing for all bullet points. Prioritize clarity, friendliness, and usefulness—like a great local guide would.
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
