import { tmdbClient } from './apiClient';

// --- VALIDATION ENGINE ---
// Helper to filter out items without thumbnails or YouTube trailers
const filterValidMedia = async (items) => {
    if (!items || !Array.isArray(items)) return [];

    // Step 1: Remove items missing both poster and backdrop images
    const itemsWithThumbnails = items.filter(
        (item) => item && (item.poster_path || item.backdrop_path)
    );

    // Step 2: Concurrently check if each item has an available YouTube video key
    const validationPromises = itemsWithThumbnails.map(async (item) => {
        try {
            const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
            const response = await tmdbClient.get(`/${mediaType}/${item.id}/videos`);
            const videos = response.data.results || [];

            const hasYoutubeVideo = videos.some(
                (v) => v.site === 'YouTube' && v.key
            );

            return hasYoutubeVideo ? item : null;
        } catch (error) {
            return null; // Exclude item if video check fails
        }
    });

    const validatedResults = await Promise.all(validationPromises);
    return validatedResults.filter(Boolean); // Remove null entries
};

// --- MASTER FILTER LOGIC ENGINE ---
const getFilterParams = (filters) => {
    const { region, language } = filters;
    let params = {};

    // 1. Region Logic
    if (region === 'indian') {
        params.with_origin_country = 'IN';
    } else if (region === 'others') {
        params.without_original_language = 'hi|ta|te|ml|kn|bn|pa|gu|mr';
    }

    // 2. Language Logic
    if (language !== 'any') {
        if (language === 'others') {
            params.with_original_language = 'te|ml|kn|mr|bn|gu|fr|es|ko|ja';
        } else {
            params.with_original_language = language;
        }
    } else if (region === 'indian') {
        params.with_original_language = 'hi|ta|te|ml|kn|pa|bn|mr';
    }

    return params;
};

export const tmdbService = {
    // --- SEARCH ENGINES ---
    searchMulti: async (query, page = 1) => {
        try {
            if (!query) return [];
            const response = await tmdbClient.get('/search/multi', {
                params: { query, include_adult: false, language: 'en-US', page: page }
            });

            const filteredDocs = response.data.results.filter(
                item => item.media_type === 'movie' || item.media_type === 'tv'
            );

            return await filterValidMedia(filteredDocs);
        } catch (error) {
            console.error('Error fetching search results:', error);
            return [];
        }
    },

    getTrending: async (page = 1) => {
        try {
            const response = await tmdbClient.get('/trending/all/day', {
                params: { language: 'en-US', page: page }
            });
            return await filterValidMedia(response.data.results);
        } catch (error) {
            console.error('Error fetching trending:', error);
            return [];
        }
    },

    // --- UNIFIED FILTER ENGINE ---
    fetchSection: async (filters, movieConfig, tvConfig) => {
        try {
            let results = [];
            const baseParams = { sort_by: 'popularity.desc', ...getFilterParams(filters) };
            const requests = [];

            if ((filters.type === 'all' || filters.type === 'movie') && movieConfig) {
                requests.push(
                    tmdbClient.get('/discover/movie', { params: { ...baseParams, ...movieConfig } })
                        .then(res => res.data.results.map(item => ({ ...item, media_type: 'movie' })))
                );
            }

            if ((filters.type === 'all' || filters.type === 'tv') && tvConfig) {
                requests.push(
                    tmdbClient.get('/discover/tv', { params: { ...baseParams, ...tvConfig } })
                        .then(res => res.data.results.map(item => ({ ...item, media_type: 'tv' })))
                );
            }

            if (requests.length === 0) return [];

            const responses = await Promise.all(requests);
            responses.forEach(res => { results = [...results, ...res]; });

            const sortedResults = results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
            return await filterValidMedia(sortedResults);
        } catch (error) {
            console.error('Error fetching section:', error);
            return [];
        }
    },

    // --- DETAILS ENDPOINTS ---
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

    getVideos: async (id, type = 'movie') => {
        try {
            const response = await tmdbClient.get(`/${type}/${id}/videos`);
            return response.data.results;
        } catch (error) {
            console.error('Error fetching videos:', error);
            return [];
        }
    },

    getSimilar: async (id, type = 'movie') => {
        try {
            const response = await tmdbClient.get(`/${type}/${id}/similar`);
            return await filterValidMedia(response.data.results);
        } catch (error) {
            console.error('Error fetching similar:', error);
            return [];
        }
    },

    discoverByGenre: async (genreId, page = 1) => {
        try {
            const response = await tmdbClient.get('/discover/movie', {
                params: {
                    with_genres: genreId,
                    sort_by: 'popularity.desc',
                    include_adult: false,
                    language: 'en-US',
                    page: page
                }
            });
            const formattedResults = response.data.results.map(item => ({ ...item, media_type: 'movie' }));
            return await filterValidMedia(formattedResults);
        } catch (error) {
            console.error('Error fetching genre:', error);
            return [];
        }
    },

    // --- SMART LOCAL NLP SEARCH ---
    smartSearch: async (query, page = 1) => {
        try {
            if (!query) return [];

            const queryLower = query.toLowerCase();

            // 1. Local Dictionaries to intercept keywords
            const GENRE_MAP = {
                'action': 28, 'comedy': 35, 'drama': 18, 'thriller': 53,
                'sci-fi': 878, 'science fiction': 878, 'horror': 27,
                'romance': 10749, 'animation': 16
            };
            const LANG_MAP = {
                'hindi': 'hi', 'english': 'en', 'tamil': 'ta',
                'telugu': 'te', 'malayalam': 'ml', 'punjabi': 'pa', 'korean': 'ko'
            };

            let foundGenres = [];
            let foundLang = null;

            // 2. Extract matching keywords
            for (const [key, val] of Object.entries(GENRE_MAP)) {
                if (queryLower.includes(key)) foundGenres.push(val);
            }
            for (const [key, val] of Object.entries(LANG_MAP)) {
                if (queryLower.includes(key)) foundLang = val;
            }

            // 3. Strip keywords to see if a specific title or actor is left over
            let cleanQuery = queryLower;
            Object.keys(GENRE_MAP).forEach(k => cleanQuery = cleanQuery.replace(k, ''));
            Object.keys(LANG_MAP).forEach(k => cleanQuery = cleanQuery.replace(k, ''));
            cleanQuery = cleanQuery.replace(/(movies|movie|shows|show|series|web series)/g, '').trim();

            // --- SCENARIO A: Pure Category Search ---
            if (cleanQuery.length === 0 && (foundGenres.length > 0 || foundLang)) {
                let params = { sort_by: 'popularity.desc', page: page };
                if (foundGenres.length > 0) params.with_genres = foundGenres.join(',');
                if (foundLang) params.with_original_language = foundLang;

                const res = await tmdbClient.get('/discover/movie', { params });
                const formattedA = res.data.results.map(item => ({ ...item, media_type: 'movie' }));
                return await filterValidMedia(formattedA);
            }

            // --- SCENARIO B: Standard Search ---
            const searchTarget = cleanQuery.length > 0 ? cleanQuery : query;

            const response = await tmdbClient.get('/search/multi', {
                params: { query: searchTarget, include_adult: false, language: 'en-US', page: page }
            });

            const results = response.data.results;
            if (results.length === 0) return [];

            // --- SCENARIO C: Actor Search ---
            if (results[0].media_type === 'person') {
                const personId = results[0].id;

                let params = { with_cast: personId, sort_by: 'popularity.desc', page: page };
                if (foundGenres.length > 0) params.with_genres = foundGenres.join(',');
                if (foundLang) params.with_original_language = foundLang;

                const personWorks = await tmdbClient.get('/discover/movie', { params });
                const formattedC = personWorks.data.results.map(item => ({ ...item, media_type: 'movie' }));
                return await filterValidMedia(formattedC);
            }

            // --- SCENARIO D: Regular Title ---
            const formattedD = results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
            return await filterValidMedia(formattedD);

        } catch (error) {
            console.error('Smart Search Error:', error);
            return [];
        }
    },
};