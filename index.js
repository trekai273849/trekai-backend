
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ✅ Replace with your actual Netlify frontend origin
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://feature-test-customize-page--delightful-croquembouche-cafa23.netlify.app',
  'https://smarttrails.pro'
];
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

app.post('/api/finalize', async (req, res) => {
  try {
    const { location, filters, comments } = req.body;

    const systemPrompt = `
You are an expert local mountain guide. Based on the user's location and preferences, generate a detailed multi-day trekking itinerary including hiking routes, huts, and daily highlights. Format the itinerary using markdown headers: "### Itinerary", followed by each day (e.g., "Day 1: ...", "Day 2: ..."), then conclude with "### Packing List" and "### Local Insights".
`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: \`Location: \${location}\nFilters: \${JSON.stringify(filters)}\nComments: \${comments}\` }
    ];

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4',
      messages,
      temperature: 0.7
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${process.env.OPENAI_API_KEY}\`
      },
      timeout: 10000 // 10 seconds timeout
    });

    const reply = response.data.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    console.error('API Error:', error.message);
    res.status(500).json({ error: 'Failed to generate itinerary' });
  }
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
