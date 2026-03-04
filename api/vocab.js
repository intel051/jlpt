export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { level } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ 
      error: "API Key Error", 
      detail: "Vercel 환경 변수에 GEMINI_API_KEY가 등록되어 있는지 확인해 주세요." 
    });
  }

  const systemInstruction = "Professional Japanese tutor. Generate exactly 20 high-frequency JLPT vocabulary words. Output strictly in JSON format.";
  const userQuery = `Generate 20 random high-frequency words for JLPT N${level || 2}. Include 'kanji', 'kana', 'korean_meaning', 'part_of_speech', 'example_jp', and 'example_kr'. Return as a clean JSON array.`;

  // 지수 백오프(Exponential Backoff)를 이용한 재시도 함수
  const fetchWithRetry = async (url, options, retries = 3, backoff = 1000) => {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429 && retries > 0) {
        // 429 에러 발생 시 대기 후 재시도
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      
      return response;
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw error;
    }
  };

  try {
    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userQuery }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { 
            responseMimeType: "application/json"
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Google API Error Details:", JSON.stringify(result));
      return res.status(response.status).json({ 
        error: "Gemini API failure", 
        detail: result.error?.message || "구글 서버 응답 오류가 발생했습니다.",
        code: result.error?.status || "UNKNOWN_ERROR"
      });
    }

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("AI 응답 데이터가 없습니다.");

    res.status(200).json(JSON.parse(text));
  } catch (e) {
    console.error("Server Runtime Error:", e.message);
    res.status(500).json({ error: "Server Error", message: e.message });
  }
}
