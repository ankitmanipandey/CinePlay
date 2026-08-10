import { create } from 'zustand';

export const useUserListStore = create((set) => ({
    watchlist: {},
    watched: {},

    toggleWatchlist: (id) => set((state) => {
        const newWatchlist = { ...state.watchlist };
        const newWatched = { ...state.watched };

        if (newWatchlist[id]) {
            delete newWatchlist[id]; // Toggle off
        } else {
            newWatchlist[id] = true; // Toggle on
            delete newWatched[id];   // Ensure mutually exclusive
        }

        return { watchlist: newWatchlist, watched: newWatched };
    }),

    toggleWatched: (id) => set((state) => {
        const newWatchlist = { ...state.watchlist };
        const newWatched = { ...state.watched };

        if (newWatched[id]) {
            delete newWatched[id]; // Toggle off
        } else {
            newWatched[id] = true; // Toggle on
            delete newWatchlist[id]; // Ensure mutually exclusive
        }

        return { watchlist: newWatchlist, watched: newWatched };
    })
}));