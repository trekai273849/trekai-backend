const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const port = process.env.PORT || 3000;

const allowedOrigins = [
  'https://feature-test-customize-page--delightful-croquembouche-cafa23.netlify.app',
  'https://smarttrails.pro',
];

app.use(cors({
  origin: allowedOrigins,
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type'],
}));

app.use(bodyParser.json());

const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
}));

app.post('/api/finalize', async (req, res) => {
  const { location, filters, comments } = req.body;

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Missing OpenAI API Key' });
  }

  try {
    const messages = [
      {
        role: 'system',
        content: `You are an expert trekking itinerary planner. Create detailed, scenic, and well-paced 3-day itineraries.`,
      },
      {
        role: 'user',
        content: `Location: ${location}\nFilters: ${JSON.stringify(filters)}\nComments: ${comments}`,
      },
    ];

    const completion = await openai.createChatCompletion({
      model: 'gpt-4',
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const reply = completion.data.choices[0].message.content;
    res.json({ reply });

  } catch (error) {
    console.error('API Error:', error);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }

    res.status(500).json({ error: 'Failed to generate itinerary' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});