// 1. Your Private Render Instance
const PRIMARY_BASE = 'https://jiosaavn-api-47fm.onrender.com/api';
// 2. Public Fallback
const FALLBACK_BASE = 'https://saavn.sumit.co/api';

export const safeFetchJson = async (endpoint, options = {}) => {
    try {
        let res = await fetch(`${PRIMARY_BASE}${endpoint}`, options);
        let text = await res.text();

        try {
            return JSON.parse(text);
        } catch (err) {
            console.warn(`[SafeFetch] Primary API failed. Switching to Fallback...`);
            res = await fetch(`${FALLBACK_BASE}${endpoint}`, options);
            text = await res.text();
            return JSON.parse(text);
        }
    } catch (error) {
        console.error(`[SafeFetch] Network error completely failed:`, error.message);
        return { success: false, data: { results: [] } };
    }
};

// Universal mapper to keep both screens DRY
export const mapSaavnSong = (t) => {
    return {
        id: t.id,
        title: t.name || t.title,
        artist: t.artists?.primary?.map(a => a.name).join(', ') || t.subtitle || t.description || 'Unknown Artist',
        image: Array.isArray(t.image)
            ? (t.image.find(i => i.quality === '500x500')?.url || t.image[0]?.url)
            : t.image,
        url: Array.isArray(t.downloadUrl)
            ? (t.downloadUrl.find(d => d.quality === '320kbps')?.url || t.downloadUrl[0]?.url)
            : t.url
    };
};