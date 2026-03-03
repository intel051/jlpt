export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { level } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Vercel Environment Variable 'GEMINI_API_KEY' is missing." });
  }

  const systemInstruction = "You are a professional Japanese tutor. Generate 20 high-frequency JLPT vocabulary words. Output strictly in JSON format.";
  const userQuery = `Generate 20 random high-frequency words for JLPT N${level || 2}. Include kanji, kana, korean_meaning, part_of_speech, example_jp, and example_kr. Return as a JSON array.`;

  try {
    // Using Gemini 2.5 Flash Preview model
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
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

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ error: "Gemini API failure", detail: errorData });
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) throw new Error("No response text from AI");

    res.status(200).json(JSON.parse(text));
  } catch (e) {
    res.status(500).json({ error: "Server Error", message: e.message });
  }
}
