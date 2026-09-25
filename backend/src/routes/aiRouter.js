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

const callGeminiWithRetry = async (url, body, maxRetries = 2) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();

        if (response.ok) return { data, response };

        const isOverloaded = response.status === 503 || data.error?.status === 'UNAVAILABLE';
        if (isOverloaded && attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
            continue;
        }
        return { data, response };
    }
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
const GEMINI_MODEL = "gemini-3.5-flash";

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

        const { data, response } = await callGeminiWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${activeKey}`,
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: 150 // 9 short titles in a JSON array needs very little
                }
            }
        );

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
            const [watchedTitles, watchlistTitles] = await Promise.all([
                resolveIdsToTitles(req.user.watched),
                resolveIdsToTitles(req.user.watchlist)
            ]);

            if (watchedTitles.length > 0) {
                tasteProfile = `\nUSER TASTE PROFILE: To understand their preferences, they have previously watched and enjoyed: ${watchedTitles.join(', ')}.`;
                exclusionList = `\nEXCLUSION RULE: You MUST NOT recommend any of these titles because the user has already seen them or plans to see them: ${[...watchedTitles, ...watchlistTitles].join(', ')}.`;
            }
        }

        const prompt = `You are a film curator. For the prompt "${query}", return exactly 6 real, highly-rated movie/TV titles.
                        ${tasteProfile}
                        ${exclusionList}
                        Rules: exact official titles only, no years/subtitles, avoid obscure picks unless asked.
                        Return ONLY a raw JSON array of strings, no markdown, no commentary.
                        Example: ["Inception", "Parasite", "The Dark Knight"]`;

        const { data, response } = await callGeminiWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${activeKey}`,
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: 150 // 9 short titles in a JSON array needs very little
                }
            }
        );

        if (!response.ok) {
            console.error("Gemini API Error (recommend):", data.error);
            const status = response.status === 503 ? 503 : 500;
            return res.status(status).json({
                error: status === 503
                    ? 'AI recommendations are temporarily unavailable, please try again shortly.'
                    : (data.error?.message || 'Google API rejected the key')
            });
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