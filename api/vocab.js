export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { level } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API Key Error", detail: "환경 변수 설정이 필요합니다." });
  }

  // 무작위성을 높이기 위한 타임스탬프 기반 시드 텍스트 생성
  const randomSeed = Date.now().toString().slice(-4);
  
  const systemInstruction = `Professional Japanese tutor. Generate exactly 20 diverse and random JLPT vocabulary words. Avoid repeating only the most common ones; ensure a wide variety. Output strictly in JSON format.`;
  
  const userQuery = `Generate 20 random JLPT N${level || 2} words. 
  Each object must include:
  - 'kanji', 'kana', 'korean_meaning', 'part_of_speech'
  - 'examples': array of 2 {jp, kr}
  - 'synonyms': array of {word, meaning} (up to 3)
  - 'antonyms': array of {word, meaning} (up to 3)
  Use random seed hint: ${randomSeed}. Return as a clean JSON array.`;

  const fetchWithRetry = async (model, retries = 3, backoff = 2000) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userQuery }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      if (response.status === 429 && retries > 0) {
        await new Promise(r => setTimeout(r, backoff));
        return fetchWithRetry(model, retries - 1, backoff * 2);
      }
      return response;
    } catch (e) {
      if (retries > 0) return fetchWithRetry(model, retries - 1, backoff * 2);
      throw e;
    }
  };

  try {
    let response = await fetchWithRetry("gemini-3.1-flash-lite-preview");
    if (response.status === 404 || response.status === 429) {
      response = await fetchWithRetry("gemini-2.5-flash");
    }

    const result = await response.json();
    if (!response.ok) return res.status(response.status).json(result);

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    res.status(200).json(JSON.parse(text));
  } catch (e) {
    res.status(500).json({ error: "Server Error", message: e.message });
  }
}