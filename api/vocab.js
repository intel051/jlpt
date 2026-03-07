export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { level, query } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key is not configured' });
  }

  const isDictMode = !!query;

  // 1. 시스템 프롬프트 설정 (사용자 규칙 반영)
  const systemPrompt = isDictMode 
    ? `You are a professional Japanese-Korean dictionary based on Gemini. 
       Rules:
       1. Response must be ONLY valid JSON object.
       2. Format Japanese text in 'word' field as "Kanji(Hiragana)".
       3. Accuracy is paramount. Verify all readings and meanings twice to prevent hallucinations.
       4. Provide max 2 high-quality examples.
       5. Keep meaning and notes in Korean.`
    : `You are a professional Japanese tutor. 
       Generate exactly 20 diverse and random high-frequency JLPT N${level || 2} vocabulary words. 
       Rules:
       1. Response must be ONLY valid JSON array of objects.
       2. Format Japanese text in 'word' field as "Kanji(Hiragana)".
       3. Accuracy is paramount. Verify all readings and meanings to prevent hallucinations.
       4. Provide 2 high-quality examples per word.
       5. Keep meaning and notes in Korean.
       6. Ensure high randomness to avoid repetition of common words.`;

  // 2. 구조화된 데이터 스키마 정의
  const itemSchema = {
    type: "OBJECT",
    properties: {
      word: { type: "STRING", description: "The word in Kanji(Hiragana) format" },
      reading: { type: "STRING", description: "Reading in Hiragana" },
      meaning: { type: "STRING", description: "Meaning in Korean" },
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

  // 3. 실행 환경 설정
  const finalSchema = isDictMode ? itemSchema : { type: "ARRAY", items: itemSchema };
  const userPrompt = isDictMode ? `Search dictionary for: ${query}` : `Generate 20 random words for JLPT N${level || 2}`;
  
  // 가장 안정적인 gemini-3.1-flash-lite 모델 사용
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

  let retryCount = 0;
  const maxRetries = 5;

  async function callGemini() {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { 
            responseMimeType: "application/json", 
            responseSchema: finalSchema
          }
        })
      });

      if (!response.ok) {
        if (response.status === 429 && retryCount < maxRetries) {
          throw new Error('RATE_LIMIT');
        }
        throw new Error(`Status: ${response.status}`);
      }

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty AI response");
      
      return JSON.parse(text);

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
    console.error("API Error:", error.message);
    res.status(500).json({ error: 'Failed to fetch dictionary or vocab data' });
  }
}
