import { useState, useEffect, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { tmdbService } from '../services/tmdbService';
import { useUserListStore } from '../store/useUserListStore';
import { useAuthStore } from '../store/useAuthStore';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

export const TITLE_TO_API_MAP = {
    'Hindi': { type: 'language', val: 'hi' },
    'English': { type: 'language', val: 'en' },
    'Tamil': { type: 'language', val: 'ta' },
    'Telugu': { type: 'language', val: 'te' },
    'Punjabi': { type: 'language', val: 'pa' },
    'Malayalam': { type: 'language', val: 'ml' },
    'Action': { type: 'genre', val: 28 },
    'Comedy': { type: 'genre', val: 35 },
    'Drama': { type: 'genre', val: 18 },
    'Thriller': { type: 'genre', val: 53 },
    'Sci-Fi': { type: 'genre', val: 878 },
    'Horror': { type: 'genre', val: 27 },
    'Romance': { type: 'genre', val: 10749 },
};

export const useCategoryLogic = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { title } = useLocalSearchParams();

    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const { watchlist, watched, toggleWatchlist, toggleWatched } = useUserListStore();
    const { token } = useAuthStore();

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                let results = [];
                const mapInfo = TITLE_TO_API_MAP[title];

                if (mapInfo) {
                    if (mapInfo.type === 'language') {
                        results = await tmdbService.fetchSection({ type: 'all', language: mapInfo.val }, {}, {});
                    } else if (mapInfo.type === 'genre') {
                        results = await tmdbService.fetchSection(
                            { type: 'all' },
                            { with_genres: mapInfo.val },
                            { with_genres: mapInfo.val }
                        );
                    }
                } else {
                    results = await tmdbService.getTrending?.() || [];
                }

                setData(results);
            } catch (err) {
                console.error('Failed to load category data:', err);
            } finally {
                setIsLoading(false);
            }
        };

        if (title) loadData();
    }, [title]);

    const handleAuthAction = useCallback((actionCallback) => {
        if (!token) {
            Toast.show({
                type: 'hotstarInfo',
                text1: 'Log in for personalization',
                position: 'top',
                topOffset: insets.top > 0 ? insets.top + 10 : 50,
                visibilityTime: 2500,
            });
        } else {
            actionCallback();
        }
    }, [token, insets.top]);

    const handleToggleAction = useCallback(async (id, mediaType, targetList) => {
        if (targetList === 'watchlist') toggleWatchlist(id, mediaType);
        if (targetList === 'watched') toggleWatched(id, mediaType);

        try {
            const tmdbIdWithType = `${id}:${mediaType}`;

            const response = await fetch(`${BACKEND_URL}/user/${targetList}/toggle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ tmdbId: tmdbIdWithType })
            });

            if (!response.ok) throw new Error('Failed to update on server');

            const responseData = await response.json();

            const arrayToMap = (arr) => arr.reduce((acc, curr) => {
                const [idStr, typeStr] = String(curr).split(':');
                acc[idStr] = typeStr || 'movie';
                return acc;
            }, {});

            useUserListStore.setState({
                watchlist: arrayToMap(responseData.watchlist),
                watched: arrayToMap(responseData.watched)
            });

        } catch (error) {
            console.error('API Sync Error:', error);
            Toast.show({ type: 'error', text1: `Failed to save to ${targetList}` });

            if (targetList === 'watchlist') toggleWatchlist(id, mediaType);
            if (targetList === 'watched') toggleWatched(id, mediaType);
        }
    }, [toggleWatchlist, toggleWatched, token]);

    return {
        router, insets, title, data, isLoading,
        watchlist, watched, handleAuthAction, handleToggleAction
    };
};