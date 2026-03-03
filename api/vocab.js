export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { level } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  // 1. 서버 환경 변수 체크 로그
  if (!apiKey) {
    console.error("DEBUG: GEMINI_API_KEY is missing in process.env");
    return res.status(500).json({ error: "API 키 설정 오류", detail: "Vercel 환경 변수에 GEMINI_API_KEY가 없습니다." });
  }

  const userQuery = `JLPT N${level || 2} 수준의 단어 20개를 JSON으로 생성해줘. 필드: kanji, kana, korean_meaning, part_of_speech, example_jp, example_kr`;

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userQuery }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const result = await response.json();

    // 2. 구글 API 응답 상태를 로그에 출력
    console.log("DEBUG: Google API Status:", response.status);

    if (!response.ok) {
      console.error("DEBUG: Google API Error Detail:", JSON.stringify(result));
      return res.status(response.status).json({ 
        error: "Gemini API failure", 
        detail: result.error?.message || "구글 API에서 에러를 반환했습니다." 
      });
    }

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    res.status(200).json(JSON.parse(text));

  } catch (e) {
    console.error("DEBUG: Runtime Error:", e.message);
    res.status(500).json({ error: "Server Error", detail: e.message });
  }
}

