// api/vocab.js
export default async function handler(req, res) {
  const { level } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ error: "API 키 누락" });

  const systemInstruction = "You are a Japanese vocabulary expert. Generate 20 random JLPT words in JSON format.";
  const userQuery = `Generate 20 random high-frequency words for JLPT N${level}. Include kanji, kana, korean_meaning, part_of_speech, example_jp, and example_kr.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userQuery }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { 
            responseMimeType: "application/json",
            responseSchema: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  "kanji": { "type": "STRING" },
                  "kana": { "type": "STRING" },
                  "korean_meaning": { "type": "STRING" },
                  "part_of_speech": { "type": "STRING" },
                  "example_jp": { "type": "STRING" },
                  "example_kr": { "type": "STRING" }
                },
                required: ["kanji", "kana", "korean_meaning", "part_of_speech", "example_jp", "example_kr"]
              }
            }
          }
        })
      }
    );

    const data = await response.json();
    const words = JSON.parse(data.candidates[0].content.parts[0].text);
    res.status(200).json(words);
  } catch (e) {
    res.status(500).json({ error: "서버 오류 발생" });
  }
}
