import { create } from 'zustand';
import { tmdbService } from '../services/tmdbService';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

export const useMovieStore = create((set, get) => ({
    filters: {
        region: 'all',
        type: 'all',
        language: 'any'
    },

    // --- Standard Category States ---
    trendingList: [],
    topRatedList: [],
    latestList: [],
    actionList: [],
    comedyList: [],
    thrillerList: [],
    horrorList: [],
    romanceList: [],
    scifiList: [],
    feelGoodList: [],
    biopicsList: [],

    // --- Personalized AI State ---
    recommendedList: [],
    isAiLoading: false,

    isLoading: false,

    setFilter: (key, value) => {
        set((state) => ({
            filters: { ...state.filters, [key]: value },
            isLoading: true
        }));
        get().fetchAllData();
    },

    // --- Fetch AI Personalization ---
    fetchPersonalizedRecommendations: async (token) => {
        // Only run if the user is logged in
        if (!token) return;

        set({ isAiLoading: true });
        try {
            // Ping your secure AI backend with a generic prompt to trigger the taste profile
            const response = await fetch(`${BACKEND_URL}/ai/recommend`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ query: "Suggest highly acclaimed movies or shows that perfectly match my taste profile." })
            });

            if (!response.ok) throw new Error("Failed to fetch AI recommendations");

            const data = await response.json();
            const titles = data.titles;

            // Fetch TMDB data for the AI's title suggestions concurrently
            const tmdbPromises = titles.map(title => tmdbService.searchMulti(title));
            const tmdbResultsArrays = await Promise.all(tmdbPromises);

            const finalResults = tmdbResultsArrays
                .map(results => results.find(item => item.media_type === 'movie' || item.media_type === 'tv'))
                .filter(Boolean); // Remove empty results

            set({ recommendedList: finalResults, isAiLoading: false });
        } catch (error) {
            console.error("Failed to load personalized recommendations:", error);
            set({ isAiLoading: false });
        }
    },

    // --- Standard TMDB Fetch ---
    fetchAllData: async () => {
        set({ isLoading: true });
        const f = get().filters;

        const today = new Date().toISOString().split('T')[0];

        try {
            const [
                trending, topRated, latest, action, comedy, thriller,
                horror, romance, scifi, feelGood, biopics
            ] = await Promise.all([
                tmdbService.fetchSection(f, {}, {}),
                tmdbService.fetchSection(f, { 'vote_count.gte': 500, sort_by: 'vote_average.desc' }, { 'vote_count.gte': 250, sort_by: 'vote_average.desc' }),
                tmdbService.fetchSection(f, { 'primary_release_date.lte': today, sort_by: 'primary_release_date.desc', 'vote_count.gte': 5 }, { 'first_air_date.lte': today, sort_by: 'first_air_date.desc', 'vote_count.gte': 5 }),
                tmdbService.fetchSection(f, { with_genres: '28' }, { with_genres: '10759' }),
                tmdbService.fetchSection(f, { with_genres: '35' }, { with_genres: '35' }),
                tmdbService.fetchSection(f, { with_genres: '53' }, { with_genres: '9648' }),
                tmdbService.fetchSection(f, { with_genres: '27' }, { with_genres: '10765' }),
                tmdbService.fetchSection(f, { with_genres: '10749' }, { with_genres: '10749' }),
                tmdbService.fetchSection(f, { with_genres: '878' }, { with_genres: '10765' }),

                // EXCLUDE ANIMATION (16) to stop cartoons showing up
                tmdbService.fetchSection(f, { with_genres: '35', without_genres: '16' }, { with_genres: '35', without_genres: '16' }),
                tmdbService.fetchSection(f, { with_keywords: '3205', without_genres: '16' }, { with_keywords: '3205', without_genres: '16' })
            ]);

            set({
                trendingList: trending,
                topRatedList: topRated,
                latestList: latest,
                actionList: action,
                comedyList: comedy,
                thrillerList: thriller,
                horrorList: horror,
                romanceList: romance,
                scifiList: scifi,
                feelGoodList: feelGood,
                biopicsList: biopics,
                isLoading: false
            });
        } catch (error) {
            console.error(error);
            set({ isLoading: false });
        }
    }
}));