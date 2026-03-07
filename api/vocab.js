export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { level, query, type } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key is missing' });
  }

  const isDictMode = !!query;
  const isQuizMode = type === 'quiz';

  let systemPrompt, userPrompt, responseSchema;

  const itemSchemaProperties = {
    kanji: { type: "STRING", description: "단어의 한자 표기 (한자가 없는 경우 가나 표기)" },
    kana: { type: "STRING", description: "단어의 히라가나 읽기" },
    korean_meaning: { type: "STRING", description: "한국어 뜻" },
    part_of_speech: { type: "STRING", description: "품사" },
    examples: { 
      type: "ARRAY", 
      items: { 
        type: "OBJECT", 
        properties: { jp: { type: "STRING" }, kr: { type: "STRING" } },
        required: ["jp", "kr"]
      },
      minItems: 2
    },
    humble: { 
      type: "OBJECT", 
      nullable: true, 
      properties: { jp: { type: "STRING" }, kr: { type: "STRING" }, note: { type: "STRING" } } 
    },
    synonyms: { type: "ARRAY", items: { type: "STRING" }, description: "반드시 '한자(히라가나)' 형식으로 제공" },
    antonyms: { type: "ARRAY", items: { type: "STRING" }, description: "반드시 '한자(히라가나)' 형식으로 제공" }
  };

  if (isDictMode) {
    systemPrompt = "전문 일한 사전입니다. 유의어와 반의어는 반드시 '한자(히라가나)' 형식으로 3-5개씩 제공하세요. 예문은 상황별로 2개 이상 포함하며, 정확한 한국어 번역을 제공하세요.";
    userPrompt = `사전 검색: ${query}`;
    responseSchema = { 
      type: "OBJECT", 
      properties: itemSchemaProperties, 
      required: ["kanji", "kana", "korean_meaning", "examples", "synonyms", "antonyms"] 
    };
  } else if (isQuizMode) {
    systemPrompt = `JLPT N${level} 퀴즈 출제자입니다. 10개의 4지선다 문제를 만드세요. 해설은 간결한 토스 스타일 문체를 사용하세요.`;
    userPrompt = `N${level || 2} 수준 퀴즈 10개 생성`;
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
    systemPrompt = `JLPT N${level} 단어 생성기입니다. 20개의 랜덤 단어를 생성하세요. 유의어/반의어는 반드시 '한자(히라가나)' 형식으로 포함하세요.`;
    userPrompt = `N${level || 2} 단어 20개 생성`;
    responseSchema = { 
      type: "ARRAY", 
      items: { 
        type: "OBJECT", 
        properties: itemSchemaProperties, 
        required: ["kanji", "kana", "korean_meaning", "examples", "synonyms", "antonyms"] 
      } 
    };
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
      const result = await response.json();
      return JSON.parse(result.candidates[0].content.parts[0].text);
    } catch (err) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 1000));
        return callGemini(retries - 1);
      }
      throw err;
    }
  }

  try {
    const data = await callGemini();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'API Error' });
  }
}
