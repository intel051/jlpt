export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { level } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API Key Error", detail: "환경 변수 설정이 필요합니다." });
  }

  const systemInstruction = "Professional Japanese tutor. Generate exactly 20 high-frequency JLPT vocabulary words. Output strictly in JSON format.";
  // 예문을 2개씩 생성하도록 쿼리 수정
  const userQuery = `Generate 20 random high-frequency words for JLPT N${level || 2}. Include 'kanji', 'kana', 'korean_meaning', 'part_of_speech', and an 'examples' array containing 2 objects with 'jp' and 'kr' fields. Return as a clean JSON array.`;

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