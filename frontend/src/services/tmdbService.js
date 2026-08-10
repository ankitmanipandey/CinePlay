import { tmdbClient } from './apiClient';

export const tmdbService = {
    // Get Trending Movies (Day or Week)
    getTrendingMovies: async (timeWindow = 'day') => {
        try {
            const response = await tmdbClient.get(`/trending/movie/${timeWindow}`);
            return response.data.results;
        } catch (error) {
            console.error('Error fetching trending movies:', error);
            throw error;
        }
    },

    // Get Top Rated Movies
    getTopRatedMovies: async () => {
        try {
            const response = await tmdbClient.get('/movie/top_rated');
            return response.data.results;
        } catch (error) {
            console.error('Error fetching top rated movies:', error);
            throw error;
        }
    },

    // Search Movies
    searchMovies: async (query) => {
        try {
            const response = await tmdbClient.get('/search/movie', {
                params: { query, include_adult: false }
            });
            return response.data.results;
        } catch (error) {
            console.error('Error searching movies:', error);
            throw error;
        }
    }
};