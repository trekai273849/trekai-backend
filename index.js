// ✅ FINAL index.js — Enhanced with dynamic day count prompt
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

app.post('/api/finalize', async (req, res) => {
  const { location, filters, comments } = req.body;

  if (!location || !filters) {
    return res.status(400).json({ error: 'Location and filters are required.' });
  }

  const dayMatch = location.match(/(\d+)\s*(day|night)/i);
  const dayInfo = dayMatch ? `${dayMatch[1]}-day` : '';

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

Your response must include these **4 sections**, clearly separated:

1. A short intro paragraph.
2. A day-by-day itinerary using this format:
Day X: Title
- Start:
- End:
- Distance: (in km and miles)
- Elevation: (in meters and feet)
- Difficulty:
- Lunch:
- Accommodation:
- Tips:

3. ### Packing List
A bullet-point list of essential items.

4. ### Local Insights
A bullet-point list of cultural, safety, or food tips.

🛑 Do not skip any of the 4 sections. Always include Packing List and Local Insights.
✅ Use "### Packing List" and "### Local Insights" as section headers. Do not use markdown anywhere else.
          `.trim()
        },
        {
          role: 'user',
          content: `
Here are the trek preferences:

${filterSummary}

If the user specifies a number of days (e.g. "6-day trek", "10 days in Nepal", etc), generate that number of individual day entries.

Each day must use "Day X: Title" format.

Please generate the full itinerary, packing list, and local insights.
          `.trim()
        }
      ],
      temperature: 0.8,
      max_tokens: 2500
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();

    // ✅ Log full reply for debugging
    console.log('\n📦 GPT Reply:\n', reply);

    if (!reply) return res.status(500).json({ error: 'No response from OpenAI' });
    res.json({ reply });
  } catch (error) {
    console.error('❌ Error in /api/finalize:', error.response?.data || error.message);
    res.status(500).send('Failed to generate final itinerary.');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
