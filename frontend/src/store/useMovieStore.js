import { create } from 'zustand';
import { tmdbService } from '../services/tmdbService';

export const useMovieStore = create((set) => ({
    // State
    trendingMovies: [],
    topRatedMovies: [],
    searchResults: [],
    isLoading: false,
    error: null,

    // Actions
    fetchTrending: async () => {
        set({ isLoading: true, error: null });
        try {
            const movies = await tmdbService.getTrendingMovies('day');
            set({ trendingMovies: movies, isLoading: false });
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },

    fetchTopRated: async () => {
        set({ isLoading: true, error: null });
        try {
            const movies = await tmdbService.getTopRatedMovies();
            set({ topRatedMovies: movies, isLoading: false });
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },

    searchMovies: async (query) => {
        if (!query.trim()) {
            set({ searchResults: [] });
            return;
        }

        set({ isLoading: true, error: null });
        try {
            const movies = await tmdbService.searchMovies(query);
            set({ searchResults: movies, isLoading: false });
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },

    clearSearch: () => set({ searchResults: [] })
}));