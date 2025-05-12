require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('✅ TrekAI server is running');
});

// Step 1: Initial location-based message
app.post('/api/start', async (req, res) => {
  const { location } = req.body;

  if (!location) return res.status(400).json({ error: 'Location is required.' });

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
    console.error('Error in /api/start:', error.response?.data || error.message);
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
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a professional trekking planner. Generate a personalized, detailed itinerary based on provided filters."
        },
        {
          role: "user",
          content: `Here are the trek preferences:\n${filterSummary}\nPlease generate a suitable itinerary.`
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
    console.error('Error in /api/finalize:', error.response?.data || error.message);
    res.status(500).send('Failed to generate final itinerary.');
  }
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
