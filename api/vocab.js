export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { level, query, type } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key is missing', detail: 'Vercel 환경 변수에 GEMINI_API_KEY를 등록해 주세요.' });
  }

  const isDictMode = !!query;
  const isQuizMode = type === 'quiz';

  // 1. 모드별 시스템 프롬프트 및 스키마 설정
  let systemPrompt, userPrompt, responseSchema;

  const itemSchemaProperties = {
    kanji: { type: "STRING" },
    kana: { type: "STRING" },
    korean_meaning: { type: "STRING" },
    part_of_speech: { type: "STRING" },
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
  };

  if (isDictMode) {
    systemPrompt = "Professional Japanese-Korean dictionary. Accuracy is paramount. Format as Kanji(Hiragana). Provide 3-5 synonyms and antonyms.";
    userPrompt = `Search dictionary for: ${query}`;
    responseSchema = { type: "OBJECT", properties: itemSchemaProperties, required: ["kanji", "kana", "korean_meaning", "examples", "synonyms", "antonyms"] };
  } else if (isQuizMode) {
    systemPrompt = `JLPT exam creator for N${level}. Create 10 multiple-choice questions. Distractors should be plausible.`;
    userPrompt = `Generate 10 quiz questions for JLPT N${level || 2}.`;
    responseSchema = {
      type: "OBJECT",
      properties: {
        questions: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              question_word: { type: "STRING" },
              reading: { type: "STRING" },
              options: { type: "ARRAY", items: { type: "STRING" } },
              answer_idx: { type: "NUMBER" },
              explanation: { type: "STRING" }
            },
            required: ["question_word", "reading", "options", "answer_idx", "explanation"]
          }
        }
      },
      required: ["questions"]
    };
  } else {
    systemPrompt = `Professional Japanese tutor. Generate 20 diverse JLPT N${level} words. Format as Kanji(Hiragana). High randomness required.`;
    userPrompt = `Generate 20 random words for JLPT N${level || 2}.`;
    responseSchema = { type: "ARRAY", items: { type: "OBJECT", properties: itemSchemaProperties, required: ["kanji", "kana", "korean_meaning", "examples", "synonyms", "antonyms"] } };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

  async function callGemini(retries = 5) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json", responseSchema }
        })
      });

      if (!response.ok) {
        if (response.status === 429 && retries > 0) throw new Error('RATE_LIMIT');
        throw new Error(`Status: ${response.status}`);
      }

      const result = await response.json();
      return JSON.parse(result.candidates[0].content.parts[0].text);
    } catch (err) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, Math.pow(2, 6 - retries) * 1000));
        return callGemini(retries - 1);
      }
      throw err;
    }
  }

  try {
    const data = await callGemini();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data', message: error.message });
  }
}
