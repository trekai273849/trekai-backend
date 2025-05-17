require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
app.use(express.json());

const allowedOrigins = [
  'https://smarttrails.pro',
  'https://your-frontend.netlify.app',
  'http://localhost:3000'
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post('/api/finalize', async (req, res) => {
  const { location, filters, comments } = req.body;

  if (!location || !filters || !comments) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const messages = [
      {
        role: 'system',
        content: `You are a helpful travel assistant that builds multi-day trekking itineraries for users based on their location and preferences. Return all output in plain text with section headers marked as ###.`
      },
      {
        role: 'user',
        content: `Location: ${location}\nFilters: ${JSON.stringify(filters)}\nComments: ${comments}`
      }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.7
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(500).json({ error: 'No response from OpenAI' });
    }

    res.json({ reply });
  } catch (error) {
    console.error('OpenAI API error:', error);
    res.status(500).json({ error: 'An error occurred while generating the itinerary' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});