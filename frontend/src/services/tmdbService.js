import { tmdbClient } from './apiClient';

// Master Filter Logic Engine
const getFilterParams = (filters) => {
    const { region, language } = filters;
    let params = {};

    // 1. Region Logic
    if (region === 'indian') {
        params.with_origin_country = 'IN';
    } else if (region === 'others') {
        // Exclude Indian languages to force international content
        params.without_original_language = 'hi|ta|te|ml|kn|bn|pa|gu|mr';
    }

    // 2. Language Logic
    if (language !== 'any') {
        if (language === 'others') {
            // Covers international languages or other regional Indian languages
            params.with_original_language = 'te|ml|kn|mr|bn|gu|fr|es|ko|ja';
        } else {
            params.with_original_language = language; // 'hi', 'en', 'pa', 'ta'
        }
    } else if (region === 'indian') {
        // If Indian is selected but no specific language, default to all Indian languages
        params.with_original_language = 'hi|ta|te|ml|kn|pa|bn|mr';
    }

    return params;
};

export const tmdbService = {
    // --- UNIFIED FILTER ENGINE ---
    fetchSection: async (filters, movieConfig, tvConfig) => {
        try {
            let results = [];
            const baseParams = { sort_by: 'popularity.desc', ...getFilterParams(filters) };
            const requests = [];

            // If user wants Movies (or All)
            if ((filters.type === 'all' || filters.type === 'movie') && movieConfig) {
                requests.push(
                    tmdbClient.get('/discover/movie', { params: { ...baseParams, ...movieConfig } })
                        .then(res => res.data.results.map(item => ({ ...item, media_type: 'movie' })))
                );
            }

            // If user wants TV Shows (or All)
            if ((filters.type === 'all' || filters.type === 'tv') && tvConfig) {
                requests.push(
                    tmdbClient.get('/discover/tv', { params: { ...baseParams, ...tvConfig } })
                        .then(res => res.data.results.map(item => ({ ...item, media_type: 'tv' })))
                );
            }

            if (requests.length === 0) return [];

            // Fire requests in parallel, merge, and sort by popularity
            const responses = await Promise.all(requests);
            responses.forEach(res => { results = [...results, ...res]; });

            return results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        } catch (error) {
            console.error('Error fetching section:', error);
            return [];
        }
    },

    // --- DETAILS ENDPOINTS (For Player/Details Screen) ---
    getWatchProviders: async (id, type = 'movie') => {
        try {
            const response = await tmdbClient.get(`/${type}/${id}/watch/providers`);
            return response.data.results.IN || null;
        } catch (error) {
            console.error('Error fetching watch providers:', error);
            return null;
        }
    },

    getDetails: async (id, type = 'movie') => {
        try {
            const response = await tmdbClient.get(`/${type}/${id}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching details:', error);
            return null;
        }
    },
    // Fetches the Trailer videos
    getVideos: async (id, type = 'movie') => {
        try {
            const response = await tmdbClient.get(`/${type}/${id}/videos`);
            return response.data.results;
        } catch (error) {
            console.error('Error fetching videos:', error);
            return [];
        }
    },

    // Fetches "More Like This"
    getSimilar: async (id, type = 'movie') => {
        try {
            const response = await tmdbClient.get(`/${type}/${id}/similar`);
            return response.data.results;
        } catch (error) {
            console.error('Error fetching similar:', error);
            return [];
        }
    }
};