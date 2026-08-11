// routes/aiRouter.js
const express = require('express');
const aiRouter = express.Router();
const User = require('../models/User');
const axios = require('axios');
const { optionalProtect } = require('../middleware/authMiddleware');
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN;

// Helper to convert IDs to Titles with Languages & Actors for the AI Prompt
const resolveIdsToTitles = async (idTypeStrings) => {
    if (!idTypeStrings || !Array.isArray(idTypeStrings) || idTypeStrings.length === 0) return [];

    const recentItems = idTypeStrings.slice(-15);

    const requests = recentItems.map(item => {
        if (typeof item !== 'string') return null;

        const [id, type] = item.split(':');

        return axios.get(`https://api.themoviedb.org/3/${type || 'movie'}/${id}?append_to_response=credits`, {
            headers: { Authorization: `Bearer ${TMDB_ACCESS_TOKEN}` }
        }).catch(() => null);
    });

    const responses = await Promise.all(requests);

    return responses
        .filter(res => res && res.data)
        .map(res => {
            const data = res.data;
            const title = data.title || data.name;
            const lang = data.original_language || 'unknown';

            const genres = data.genres ? data.genres.slice(0, 2).map(g => g.name).join('/') : '';
            const cast = data.credits?.cast ? data.credits.cast.slice(0, 2).map(c => c.name).join(', ') : '';

            let enrichedString = `${title} (Language: ${lang}`;
            if (genres) enrichedString += `, Genres: ${genres}`;
            if (cast) enrichedString += `, Starring: ${cast}`;
            enrichedString += `)`;

            return enrichedString;
        });
};

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

// Using your specified model constant
const GEMINI_MODEL = "gemini-3.5-flash"; // Updated to the standard fast model, adjust if you strictly need 3.5

let currentKeyIndex = 0;

// --- Phase 4: YouTube AI Orchestration Endpoint ---
aiRouter.post('/youtube-search', optionalProtect, async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Search prompt is required' });
    }

    const activeKey = geminiKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % geminiKeys.length;

    try {
        const aiPrompt = `You are an expert YouTube search optimizer. 
        The user will give you a mood, vibe, or vague request. 
        Your job is to convert it into a highly effective, specific YouTube search query.
        Keep it under 6 words. 
        Return ONLY the raw search query string, no quotes, no explanations, no markdown.
        
        Example 1:
        User: "I want to learn react native really fast"
        You: React Native crash course 2024
        
        Example 2:
        User: "Something super scary and unsettling to watch"
        You: terrifying short horror films

        User: "${prompt}"
        You:`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${activeKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: aiPrompt }] }] })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Gemini API Error (YouTube):", data.error?.message);
            // Fallback securely to the original prompt so the app doesn't crash
            return res.status(200).json({ optimizedQuery: prompt });
        }

        if (!data.candidates || !data.candidates[0].content) {
            return res.status(200).json({ optimizedQuery: prompt });
        }

        const rawText = data.candidates[0].content.parts[0].text;
        const cleanedText = rawText.replace(/[\n"']/g, '').trim();

        res.status(200).json({ optimizedQuery: cleanedText });

    } catch (error) {
        console.error("Backend AI YouTube Search Error:", error.message);
        // Fallback to the original user prompt if AI fails
        res.status(200).json({ optimizedQuery: prompt });
    }
});


// --- Existing TMDB AI Recommendation Endpoint ---
aiRouter.post('/recommend', optionalProtect, async (req, res) => {
    const { query } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
    }

    const activeKey = geminiKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % geminiKeys.length;

    try {
        let tasteProfile = "";
        let exclusionList = "";

        if (req.user) {
            const watchedTitles = await resolveIdsToTitles(req.user.watched);
            const watchlistTitles = await resolveIdsToTitles(req.user.watchlist);

            if (watchedTitles.length > 0) {
                tasteProfile = `\nUSER TASTE PROFILE: To understand their preferences, they have previously watched and enjoyed: ${watchedTitles.join(', ')}.`;
                exclusionList = `\nEXCLUSION RULE: You MUST NOT recommend any of these titles because the user has already seen them or plans to see them: ${[...watchedTitles, ...watchlistTitles].join(', ')}.`;
            }
        }

        const prompt = `You are an elite film and TV curator. Based on the following user prompt: "${query}", recommend exactly 9 highly-rated, real movies or TV shows.
        ${tasteProfile}
        ${exclusionList}

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
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(500).json({ error: data.error?.message || 'Google API rejected the key' });
        }

        if (!data.candidates || !data.candidates[0].content) {
            throw new Error("Invalid Gemini response format");
        }

        const rawText = data.candidates[0].content.parts[0].text;
        const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const titles = JSON.parse(cleanedText);

        res.status(200).json({ titles });

    } catch (error) {
        console.error("Backend AI Error:", error.message);
        res.status(500).json({ error: 'Failed to process AI recommendation' });
    }
});

module.exports = aiRouter;