const fetch = require('node-fetch');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key is not configured' });
  }

  const systemPrompt = `You are a professional Japanese-Korean dictionary based on Gemini 2.5 Flash. 
  Rules:
  1. Response must be ONLY valid JSON.
  2. Format Japanese text as "Kanji(Hiragana)".
  3. Accuracy is paramount. Verify all readings and meanings twice to prevent hallucinations.
  4. Provide max 2 high-quality examples.
  5. Keep meaning and notes in Korean.`;

  const schema = {
    type: "OBJECT",
    properties: {
      word: { type: "STRING" },
      reading: { type: "STRING" },
      meaning: { type: "STRING" },
      examples: { 
        type: "ARRAY", 
        items: { 
          type: "OBJECT", 
          properties: { jp: { type: "STRING" }, kr: { type: "STRING" } },
          required: ["jp", "kr"]
        } 
      },
      humble: { 
        type: "OBJECT", 
        nullable: true,
        properties: { jp: { type: "STRING" }, kr: { type: "STRING" }, note: { type: "STRING" } } 
      },
      synonyms: { type: "ARRAY", items: { type: "STRING" } },
      antonyms: { type: "ARRAY", items: { type: "STRING" } }
    },
    required: ["word", "reading", "meaning", "examples", "synonyms", "antonyms"]
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

  let retryCount = 0;
  const maxRetries = 5;

  async function callGemini() {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Search dictionary for: ${query}` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { 
            responseMimeType: "application/json", 
            responseSchema: schema
          }
        })
      });

      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const result = await response.json();
      return JSON.parse(result.candidates[0].content.parts[0].text);
    } catch (err) {
      if (retryCount < maxRetries) {
        retryCount++;
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(r => setTimeout(r, delay));
        return callGemini();
      }
      throw err;
    }
  }

  try {
    const data = await callGemini();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dictionary data' });
  }
}

