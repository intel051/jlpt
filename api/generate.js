export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API 키 누락" });

  const prompt = "JLPT N2 수준의 객관식 문제 4개를 생성해줘. JSON 배열 형식으로만 응답해. 각 객체는 type, subType, question, options(4개), answer(0-3), explanation(한국어) 필드를 가져야 해.";

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      }
    );
    const data = await response.json();
    const questions = JSON.parse(data.candidates[0].content.parts[0].text);
    res.status(200).json(questions);
  } catch (e) {
    res.status(500).json({ error: "생성 실패" });
  }
}
