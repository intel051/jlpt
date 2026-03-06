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

  // 지수 백오프를 적용한 재시도 로직
  const fetchWithRetry = async (model, retries = 5, backoff = 2000) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { responseMimeType: "application/json" }
      })
    };

    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        
        if (response.status === 429) {
          // 할당량 초과 시 대기 후 재시도
          const waitTime = backoff * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        return response;
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, backoff * Math.pow(2, i)));
      }
    }
    return { status: 429 }; // 모든 재시도 실패 시
  };

  try {
    // 1단계: 최신 모델인 2.0-flash로 시도
    let response = await fetchWithRetry("gemini-3.1-flash-lite-preview");

    // 2단계: 2.0 모델이 여전히 429를 반환하면 1.5-flash로 폴백
    if (response.status === 429) {
      console.log("Switching to fallback model: gemini-2.5-flash");
      response = await fetchWithRetry("gemini-2.5-flash");
    }

    const result = await response.json();

    if (!response.ok) {
      console.error("Google API Error:", JSON.stringify(result));
      return res.status(response.status).json({ 
        error: "Gemini API failure", 
        detail: result.error?.message || "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        code: result.error?.status || "TOO_MANY_REQUESTS"
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
