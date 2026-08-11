// routes/aiRouter.js
const express = require('express');
const aiRouter = express.Router();
const User = require('../models/User');
const axios = require('axios');
const { optionalProtect } = require('../middleware/authMiddleware');
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN; // Add this to your backend .env

// Helper to convert IDs to Titles with Languages & Actors for the AI Prompt
const resolveIdsToTitles = async (idTypeStrings) => {
    // Safety check in case the array is empty or undefined
    if (!idTypeStrings || !Array.isArray(idTypeStrings) || idTypeStrings.length === 0) return [];

    const recentItems = idTypeStrings.slice(-15);

    const requests = recentItems.map(item => {
        // Safety check to ensure the item is a string before splitting
        if (typeof item !== 'string') return null;

        const [id, type] = item.split(':');

        // 🔴 NEW: We added ?append_to_response=credits to get the actors in one single API call
        return axios.get(`https://api.themoviedb.org/3/${type || 'movie'}/${id}?append_to_response=credits`, {
            headers: { Authorization: `Bearer ${TMDB_ACCESS_TOKEN}` }
        }).catch(() => null); // Ignore failures silently
    });

    const responses = await Promise.all(requests);

    return responses
        .filter(res => res && res.data)
        .map(res => {
            const data = res.data;
            const title = data.title || data.name;
            const lang = data.original_language || 'unknown';

            // Grab the top 2 genres
            const genres = data.genres ? data.genres.slice(0, 2).map(g => g.name).join('/') : '';

            // Grab the top 2 actors from the credits
            const cast = data.credits?.cast ? data.credits.cast.slice(0, 2).map(c => c.name).join(', ') : '';

            // Format the string: "Title (Language: en, Genres: Action, Starring: Actor 1, Actor 2)"
            let enrichedString = `${title} (Language: ${lang}`;
            if (genres) enrichedString += `, Genres: ${genres}`;
            if (cast) enrichedString += `, Starring: ${cast}`;
            enrichedString += `)`;

            return enrichedString;
        });
};

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
            // We can use req.user directly because the middleware already fetched it!
            const watchedTitles = await resolveIdsToTitles(req.user.watched);
            const watchlistTitles = await resolveIdsToTitles(req.user.watchlist);

            if (watchedTitles.length > 0) {
                tasteProfile = `\nUSER TASTE PROFILE: To understand their preferences, they have previously watched and enjoyed: ${watchedTitles.join(', ')}.`;
                exclusionList = `\nEXCLUSION RULE: You MUST NOT recommend any of these titles because the user has already seen them or plans to see them: ${[...watchedTitles, ...watchlistTitles].join(', ')}.`;
            }
        }

        const prompt = `You are an elite film and TV curator. Based on the following user prompt: "${query}", recommend exactly 30 highly-rated, real movies or TV shows.
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