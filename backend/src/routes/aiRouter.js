// routes/aiRouter.js
const express = require('express');
const aiRouter = express.Router();

// 1. Load all keys into an array
// The .filter(Boolean) safely removes any keys you might have left blank in your .env
const geminiKeys = [
    process.env.GEMINI_API_KEY1,
    process.env.GEMINI_API_KEY2,
    process.env.GEMINI_API_KEY3,
    process.env.GEMINI_API_KEY4,
    process.env.GEMINI_API_KEY5,
    process.env.GEMINI_API_KEY6,
    process.env.GEMINI_API_KEY7,
    process.env.GEMINI_API_KEY8,
    process.env.GEMINI_API_KEY9,
].filter(Boolean);

const GEMINI_MODEL = "gemini-3.5-flash";

// 2. State variable to track the current position in the array
let currentKeyIndex = 0;

aiRouter.post('/recommend', async (req, res) => {
    const { query } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
    }

    // Failsafe in case the .env variables aren't loading properly
    if (geminiKeys.length === 0) {
        return res.status(500).json({ error: 'No Gemini API keys configured' });
    }

    // --- ROUND ROBIN LOGIC ---
    // Grab the current key
    const activeKey = geminiKeys[currentKeyIndex];

    // Log which key index is being used (optional, good for debugging)
    console.log(`[AI Search] Using API Key #${currentKeyIndex + 1} of ${geminiKeys.length}`);

    // Increment the counter, and loop back to 0 if we hit the end of the array
    currentKeyIndex = (currentKeyIndex + 1) % geminiKeys.length;
    // -------------------------

    try {
        const prompt = `You are an elite film and TV curator. Based on the following user prompt: "${query}", recommend exactly 12 highly-rated, real movies or TV shows that perfectly match the requested mood, theme, genre, or language.

        CRITICAL RULES:
        1. Exact Titles Only: Provide the exact, official release titles to ensure 100% compatibility with TMDB search.
        2. No Extra Metadata: Do NOT include release years, directors, or subtitles in the string (e.g., return "The Matrix", NOT "The Matrix (1999)").
        3. Quality Control: Prioritize critically acclaimed, culturally significant, or universally loved titles over obscure B-movies, unless the prompt specifically asks for them.
        4. Failsafe: If the prompt is vague, inappropriate, or completely unrelated to movies/TV, gracefully default to recommending 12 universally popular, highly-rated blockbusters.

        Return ONLY a raw, valid JSON array of strings. Do NOT wrap the response in markdown blocks, do NOT use backticks (\`\`\`), and do NOT include any conversational text.
        Example: ["Inception", "Parasite", "The Dark Knight"]`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${activeKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();

        // 🔴 NEW: Log the exact response from Google to your backend terminal
        if (!response.ok) {
            console.error("Google API Error:", JSON.stringify(data, null, 2));
            return res.status(500).json({ error: data.error?.message || 'Google API rejected the key' });
        }

        if (!data.candidates || !data.candidates[0].content) {
            console.error("Unexpected Gemini Payload:", JSON.stringify(data, null, 2));
            throw new Error("Invalid Gemini response format");
        }

        const rawText = data.candidates[0].content.parts[0].text;

        // Clean up markdown blocks if Gemini includes them
        const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const titles = JSON.parse(cleanedText);

        res.status(200).json({ titles });

    } catch (error) {
        console.error("Backend AI Error:", error.message);
        res.status(500).json({ error: 'Failed to process AI recommendation' });
    }
});

module.exports = aiRouter;