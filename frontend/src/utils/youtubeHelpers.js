// src/utils/youtubeHelpers.js
const RAW_KEYS = process.env.EXPO_PUBLIC_YOUTUBE_API_KEYS || process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || '';
export let ACTIVE_YT_KEYS = RAW_KEYS.split(',').map(k => k.trim()).filter(Boolean);

export const fetchYouTubeWithRetry = async (urlTemplate) => {
    while (ACTIVE_YT_KEYS.length > 0) {
        const currentKey = ACTIVE_YT_KEYS[0];
        try {
            const res = await fetch(urlTemplate.replace('__API_KEY__', currentKey));
            const data = await res.json();
            if (data.error && (data.error.code === 403 || data.error.code === 429)) {
                console.warn(`[YT Quota Error] Key failed: ${currentKey}. Removing from rotation...`);
                ACTIVE_YT_KEYS.shift();
                continue;
            }
            return data;
        } catch (err) {
            console.error("[YT Fetch Error]", err);
            return { error: { code: 500, message: "Network error occurred." } };
        }
    }
    return { error: { code: 429, message: 'All YouTube API keys exhausted.' } };
};