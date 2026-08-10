import { create } from 'zustand';

export const useUserListStore = create((set) => ({
    watchlist: {},
    watched: {},

    toggleWatchlist: (id, mediaType = 'movie') => set((state) => {
        const newWatchlist = { ...state.watchlist };
        const newWatched = { ...state.watched };

        if (newWatchlist[id]) {
            delete newWatchlist[id];
        } else {
            newWatchlist[id] = mediaType; // Save 'movie' or 'tv'
            delete newWatched[id];
        }
        return { watchlist: newWatchlist, watched: newWatched };
    }),

    toggleWatched: (id, mediaType = 'movie') => set((state) => {
        const newWatchlist = { ...state.watchlist };
        const newWatched = { ...state.watched };

        if (newWatched[id]) {
            delete newWatched[id];
        } else {
            newWatched[id] = mediaType; // Save 'movie' or 'tv'
            delete newWatchlist[id];
        }
        return { watchlist: newWatchlist, watched: newWatched };
    })
}));