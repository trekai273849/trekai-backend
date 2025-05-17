// ✅ FULLY UPDATED index.js — Enhanced with output normalizer and improved prompt
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

// Helper function to normalize GPT output
function normalizeGptOutput(gptResponse) {
  let output = gptResponse;

  // Make sure day headings are properly formatted with ### prefix
  output = output.replace(/^(\s*Day\s+\d+:)/gm, '### $1');
  
  // Make sure section headings are properly formatted
  if (!output.includes('### Packing List')) {
    // Find packing list and add heading if not properly formatted
    const packingMatch = output.match(/(?:^|\n)(?:\d+\.\s*)?(?:packing list|what to pack)(?:\s*\:)?/i);
    if (packingMatch) {
      output = output.replace(packingMatch[0], '\n\n### Packing List\n');
    }
  }
  
  if (!output.includes('### Local Insights')) {
    // Find local insights and add heading if not properly formatted
    const insightsMatch = output.match(/(?:^|\n)(?:\d+\.\s*)?(?:local insights|useful tips|local tips)(?:\s*\:)?/i);
    if (insightsMatch) {
      output = output.replace(insightsMatch[0], '\n\n### Local Insights\n');
    }
  }

  // Make sure each day section has proper bullet points for structured data
  const dayRegex = /### Day \d+:.*?(?=### Day \d+:|### Packing List|### Local Insights|$)/gs;
  let processedOutput = output;
  let match;
  
  while ((match = dayRegex.exec(output)) !== null) {
    let daySection = match[0];
    const dayHeader = daySection.match(/(### Day \d+:.*?)(?:\n|$)/)[0];
    
    // Get section content without the header
    let dayContent = daySection.replace(dayHeader, '').trim();
    
    // Process each expected field if not already formatted with bullet points
    if (!dayContent.match(/\n\s*-\s*Start:/)) {
      // Find and format each standard field
      const fields = [
        'Start', 'End', 'Distance', 'Elevation', 'Difficulty', 
        'Lunch', 'Accommodation', 'Tips'
      ];
      
      fields.forEach(field => {
        const fieldRegex = new RegExp(`\\b${field}\\s*:\\s*([^\\n]+)`, 'i');
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

  // Convert packing list and local insights to bullet points if not already
  ['Packing List', 'Local Insights'].forEach(section => {
    const sectionRegex = new RegExp(`### ${section}\\s*([\\s\\S]*?)(?=###|$)`, 'g');
    const sectionMatch = sectionRegex.exec(processedOutput);
    
    if (sectionMatch) {
      let content = sectionMatch[1].trim();
      
      // Only process if not already in bullet point format
      if (!content.match(/^\s*-\s/m)) {
        // Split by newlines and convert to bullet points
        const lines = content.split('\n')
          .map(line => line.trim())
          .filter(line => line)
          .map(line => {
            // Convert to bullet point if not already
            return line.startsWith('-') ? line : `- ${line.replace(/^\d+\.\s*/, '')}`;
          });
        
        // Replace content with bullet points
        const newContent = '\n' + lines.join('\n') + '\n\n';
        processedOutput = processedOutput.replace(sectionMatch[0], `### ${section}${newContent}`);
      }
    }
  });
  
  return processedOutput;
}

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
Accommodation: ${filters.accommodation || 'Not specified'}
Difficulty: ${filters.difficulty || 'Not specified'}
Altitude: ${filters.altitude || 'Not specified'}
Technical: ${filters.technical || 'Not specified'}
User Notes: ${comments || 'None'}
`;

  // Improved GPT prompt template with strict formatting guidelines
  const systemPrompt = `
You are a professional trekking guide AI that creates detailed itineraries.

Your response MUST follow this EXACT format with these sections:

1. A brief intro paragraph (2-3 sentences max).

2. Day-by-day itinerary using this exact format for EACH day:
### Day X: [Title]
- Start: [location]
- End: [location]
- Distance: [X km (X miles)]
- Elevation: [X m (X ft)]
- Difficulty: [Easy/Moderate/Challenging]
- Lunch: [description]
- Accommodation: [description]
- Tips: [brief tip]

3. A packing list section with this exact heading:
### Packing List
- [item]
- [item]
- [item]
(continue with bulleted list)

4. A local insights section with this exact heading:
### Local Insights
- [insight]
- [insight]
- [insight]
(continue with bulleted list)

CRITICAL FORMATTING RULES:
- Use "### Day X:" format for EVERY day header
- Use bullet points (single hyphen) for ALL data points within each day
- ALWAYS include ALL sections (intro, all days, packing list, local insights)
- Use the EXACT format shown above including all field names
- Do not add any additional headers or sections
- ALWAYS include all fields (Start, End, Distance, etc.) for every day
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `
Here are the trek preferences:

${filterSummary}

If the user specifies a number of days (e.g. "6-day trek", "10 days in Nepal", etc), generate that number of individual day entries.

Each day MUST follow this exact format:
### Day X: [Title]
- Start: [location]
- End: [location]
- Distance: [X km (X miles)]
- Elevation: [X m (X ft)]
- Difficulty: [Easy/Moderate/Challenging]
- Lunch: [description]
- Accommodation: [description]
- Tips: [brief tip]

Please generate the full itinerary with proper formatting for each day, plus packing list and local insights sections.
          `.trim()
        }
      ],
      temperature: 0.8,
      max_tokens: 2500
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();

    // Normalize the output before sending it to the client
    const normalizedReply = normalizeGptOutput(reply);

    // Log both original and normalized replies for debugging
    console.log('\n📦 Original GPT Reply:\n', reply);
    console.log('\n📦 Normalized GPT Reply:\n', normalizedReply);

    if (!normalizedReply) return res.status(500).json({ error: 'No response from OpenAI' });
    res.json({ reply: normalizedReply });
  } catch (error) {
    console.error('❌ Error in /api/finalize:', error.response?.data || error.message);
    res.status(500).send('Failed to generate final itinerary.');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));