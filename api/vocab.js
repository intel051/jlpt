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
      minItems: 2,
      description: "단어의 실제 사용 예문 (일본어와 한국어 번역)"
    },
    humble: { 
      type: "OBJECT", 
      nullable: true, 
      properties: { jp: { type: "STRING" }, kr: { type: "STRING" }, note: { type: "STRING" } } 
    },
    synonyms: { type: "ARRAY", items: { type: "STRING" }, description: "유의어 목록 (한자(히라가나) 형식)" },
    antonyms: { type: "ARRAY", items: { type: "STRING" }, description: "반의어 목록 (한자(히라가나) 형식)" }
  };

  if (isDictMode) {
    systemPrompt = "전문적인 일한 사전입니다. 정확성이 가장 중요합니다. 유의어와 반의어를 3~5개 제공하세요. 반드시 각 단어에 대한 실용적인 예문을 2개 이상 포함해야 합니다. 모든 일본어 텍스트는 '한자(히라가나)' 형식을 지켜주세요.";
    userPrompt = `다음 단어를 사전에서 검색해 주세요: ${query}`;
    responseSchema = { 
      type: "OBJECT", 
      properties: itemSchemaProperties, 
      required: ["kanji", "kana", "korean_meaning", "examples", "synonyms", "antonyms"] 
    };
  } else if (isQuizMode) {
    systemPrompt = `JLPT N${level} 단어 퀴즈 출제자입니다. 10개의 4지선다 문제를 만드세요. 오답은 정답과 혼동될 만한 단어로 구성하세요.`;
    userPrompt = `JLPT N${level || 2} 수준의 10개 퀴즈를 생성하세요.`;
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
    systemPrompt = `일본어 선생님입니다. JLPT N${level} 수준의 단어 20개를 생성하세요. 한자(히라가나) 형식을 지키고, 다양한 단어를 섞어주세요. 각 단어마다 예문을 2개씩 포함하세요.`;
    userPrompt = `JLPT N${level || 2} 수준의 랜덤 단어 20개를 생성하세요.`;
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

      if (!response.ok) {
        if (response.status === 429 && retries > 0) throw new Error('RATE_LIMIT');
        throw new Error(`Status: ${response.status}`);
      }

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty AI response");
      
      return JSON.parse(text);
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
