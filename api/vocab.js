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

  // 전문 강사 컨셉의 시스템 프롬프트
  const systemInstruction = "Professional Japanese tutor. Generate exactly 20 high-frequency JLPT vocabulary words. Output strictly in JSON format.";
  const userQuery = `Generate 20 random high-frequency words for JLPT N${level || 2}. Include 'kanji', 'kana', 'korean_meaning', 'part_of_speech', 'example_jp', and 'example_kr'. Return as a clean JSON array.`;

  try {
    // 안정적인 gemini-2.0-flash 모델 사용
    const response = await fetch(
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
      return res.status(response.status).json({ 
        error: "Gemini API failure", 
        detail: result.error?.message || "구글 서버 응답 오류"
      });
    }

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("AI 응답 데이터가 없습니다.");

    // JSON 문자열을 파싱하여 클라이언트에 전달
    res.status(200).json(JSON.parse(text));
  } catch (e) {
    res.status(500).json({ error: "Server Error", message: e.message });
  }
}
