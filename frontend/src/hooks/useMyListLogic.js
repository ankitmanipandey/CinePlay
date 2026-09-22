import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { useUserListStore } from '../store/useUserListStore';
import { useAuthStore } from '../store/useAuthStore';
import { tmdbService } from '../services/tmdbService';
import { getImageUrl } from '../constants/config';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

export const useMyListLogic = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();

    const [activeTab, setActiveTab] = useState(params.tab === 'watched' ? 'watched' : 'watchlist');
    const [moviesData, setMoviesData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const { watchlist, watched, toggleWatchlist, toggleWatched } = useUserListStore();
    const { token } = useAuthStore();

    useEffect(() => {
        if (params.tab === 'watched' || params.tab === 'watchlist') {
            setActiveTab(params.tab);
        }
    }, [params.tab]);

    useEffect(() => {
        const fetchListDetails = async () => {
            if (moviesData.length === 0) setIsLoading(true);

            try {
                const watchlistIds = Object.keys(watchlist);
                const watchedIds = Object.keys(watched);
                const allIds = Array.from(new Set([...watchlistIds, ...watchedIds]));

                if (allIds.length === 0) {
                    setMoviesData([]);
                    setIsLoading(false);
                    return;
                }

                const detailedItemsPromises = allIds.map(async (id) => {
                    const type = watchlist[id] === 'tv' || watched[id] === 'tv' ? 'tv' : 'movie';
                    const details = await tmdbService.getDetails(id, type);

                    if (!details) return null;

                    return {
                        id: String(details.id),
                        title: details.title || details.name,
                        duration: details.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : 'N/A',
                        year: (details.release_date || details.first_air_date || '').substring(0, 4),
                        genre: details.genres?.map(g => g.name).join(', ') || 'General',
                        rating: details.vote_average ? details.vote_average.toFixed(1) : 'NR',
                        poster: getImageUrl(details.poster_path),
                        media_type: type
                    };
                });

                const results = await Promise.all(detailedItemsPromises);
                setMoviesData(results.filter(Boolean));
            } catch (error) {
                console.error('Error loading list details:', error);
            } finally {
                setIsLoading(false);
            }
        };

        const handle = typeof requestIdleCallback !== 'undefined'
            ? requestIdleCallback(() => fetchListDetails())
            : setTimeout(() => fetchListDetails(), 1);

        return () => typeof cancelIdleCallback !== 'undefined'
            ? cancelIdleCallback(handle)
            : clearTimeout(handle);
    }, [token, watchlist, watched]);

    const handleAuthAction = useCallback((actionCallback) => {
        if (!token) {
            Toast.show({ type: 'hotstarInfo', text1: 'Log in for personalization', position: 'top', topOffset: insets.top > 0 ? insets.top + 10 : 50, visibilityTime: 2500 });
        } else {
            actionCallback();
        }
    }, [token, insets.top]);

    const handleStatusChange = useCallback(async (id, mediaType, targetStatus) => {
        if (targetStatus === 'watchlist') toggleWatchlist(id, mediaType);
        if (targetStatus === 'watched') toggleWatched(id, mediaType);

        try {
            const response = await fetch(`${BACKEND_URL}/user/${targetStatus}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ tmdbId: `${id}:${mediaType}` })
            });

            if (!response.ok) throw new Error('Failed to update list on server');

            const data = await response.json();
            const arrayToMap = (arr) => arr.reduce((acc, curr) => {
                const [idStr, typeStr] = String(curr).split(':');
                acc[idStr] = typeStr || 'movie';
                return acc;
            }, {});

            useUserListStore.setState({ watchlist: arrayToMap(data.watchlist), watched: arrayToMap(data.watched) });
        } catch (error) {
            Toast.show({ type: 'error', text1: `Failed to move to ${targetStatus}` });
            if (targetStatus === 'watchlist') toggleWatchlist(id, mediaType);
            if (targetStatus === 'watched') toggleWatched(id, mediaType);
        }
    }, [toggleWatchlist, toggleWatched, token]);

    const activeData = useMemo(() => {
        return moviesData.filter(movie => {
            if (activeTab === 'watchlist') return !!watchlist[movie.id];
            if (activeTab === 'watched') return !!watched[movie.id];
            return false;
        });
    }, [moviesData, activeTab, watchlist, watched]);

    return {
        router, insets, activeTab, setActiveTab, moviesData, isLoading,
        watchlist, watched, handleAuthAction, handleStatusChange, activeData
    };
};