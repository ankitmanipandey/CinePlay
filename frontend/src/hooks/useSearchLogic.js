import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import Toast from 'react-native-toast-message';

import { tmdbService } from '../services/tmdbService';
import { useUserListStore } from '../store/useUserListStore';
import { useAuthStore } from '../store/useAuthStore';
import { useMovieStore } from '../store/useMovieStore';

export const FILTER_CHIPS = ['Action', 'Comedy', 'Drama', 'Thriller', 'Sci-Fi', 'Horror'];
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

// --- MULTI-KEY ROUND ROBIN SETUP ---
const RAW_KEYS = process.env.EXPO_PUBLIC_YOUTUBE_API_KEYS || process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || '';
let ACTIVE_YT_KEYS = RAW_KEYS.split(',').map(k => k.trim()).filter(Boolean);

const fetchYouTubeWithRetry = async (urlTemplate) => {
    while (ACTIVE_YT_KEYS.length > 0) {
        const currentKey = ACTIVE_YT_KEYS[0];
        const url = urlTemplate.replace('__API_KEY__', currentKey);

        try {
            const res = await fetch(url);
            const data = await res.json();

            if (data.error && (data.error.code === 403 || data.error.code === 429)) {
                console.warn(`[YouTube] API Key exhausted quota. Removing from active rotation.`);
                ACTIVE_YT_KEYS.shift();
                continue;
            }
            return data;
        } catch (err) {
            console.error("[YouTube Fetch Error]", err);
            return { error: { code: 500, message: "Network error occurred." } };
        }
    }
    return { error: { code: 429, message: 'All YouTube API keys have exhausted their daily quota.' } };
};

// --- CRASH-PROOF HELPER FUNCTIONS ---
export const formatDuration = (pt) => {
    if (!pt || typeof pt !== 'string') return '';
    const match = pt.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '';

    const h = match[1] ? parseInt(match[1]) : 0;
    const m = match[2] ? parseInt(match[2]) : 0;
    const s = match[3] ? parseInt(match[3]) : 0;

    if (h === 0 && m === 0 && s === 0) return '';
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

export const formatViews = (views) => {
    if (!views) return '';
    const n = parseInt(views);
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M views';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K views';
    return n + ' views';
};

// Detects whether voice search can actually work in the current environment.
// On native (iOS/Android app), the module handles permissions itself, so we trust it.
// On web — including web builds loaded inside an embedded WebView — the browser
// SpeechRecognition API must exist. Most embedded WebViews (Android System WebView,
// iOS WKWebView, in-app browsers) do NOT implement it at all, so this returns false
// there and we show a clear message instead of silently failing.
const isSpeechRecognitionAvailable = () => {
    if (Platform.OS !== 'web') return true;
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
};

export const useSearchLogic = () => {
    const { isYoutubeMode } = useMovieStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeChip, setActiveChip] = useState('Action');

    const [searchMode, setSearchMode] = useState(isYoutubeMode ? 'youtube' : 'standard');
    const isYtMode = searchMode === 'youtube';
    const isAiMode = searchMode === 'ai';

    const [rawResults, setRawResults] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [page, setPage] = useState(1);
    const [ytPageToken, setYtPageToken] = useState('');

    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const { watchlist, watched, toggleWatchlist, toggleWatched } = useUserListStore();
    const { token } = useAuthStore();
    const [isListening, setIsListening] = useState(false);

    const GENRE_MAP = { 'Action': 28, 'Comedy': 35, 'Drama': 18, 'Thriller': 53, 'Sci-Fi': 878, 'Horror': 27 };

    useEffect(() => {
        setSearchMode(isYoutubeMode ? 'youtube' : 'standard');
        setRawResults([]);
    }, [isYoutubeMode]);

    const fetchAiRecommendations = async (query) => {
        try {
            const fetchHeaders = {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            };
            const response = await fetch(`${BACKEND_URL}/ai/recommend`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ query }) });

            if (!response.ok) throw new Error(`AI Fetch failed with status ${response.status}`);
            const data = await response.json();
            if (!data.titles || !Array.isArray(data.titles)) throw new Error("Invalid titles array returned from AI API");

            const titlesToFetch = data.titles.slice(0, 12);
            const tmdbPromises = titlesToFetch.map(title => tmdbService.searchMulti(title));
            const tmdbResultsArrays = await Promise.all(tmdbPromises);

            return tmdbResultsArrays
                .map(results => results.find(item => item?.media_type === 'movie' || item?.media_type === 'tv'))
                .filter(Boolean)
                .filter(item => item.poster_path || item.backdrop_path);
        } catch (error) {
            console.error("[AI Search Error]", error);
            Toast.show({ type: 'hotstarError', text1: 'AI Search failed to process.' });
            return [];
        }
    };

    const fetchResults = async (pageNum = 1, currentYtToken = '') => {
        try {
            let newData = [];
            let nextYtToken = '';

            if (isYtMode) {
                if (!searchQuery.trim()) { setIsLoading(false); return; }
                const searchUrlTemplate = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&maxResults=10&pageToken=${currentYtToken}&key=__API_KEY__`;
                const ytData = await fetchYouTubeWithRetry(searchUrlTemplate);

                if (ytData.error) { Toast.show({ type: 'hotstarError', text1: ytData.error.message }); setIsLoading(false); return; }

                let items = ytData.items || [];
                nextYtToken = ytData.nextPageToken || '';

                if (items.length > 0) {
                    const videoIds = items.map(item => item.id.videoId).filter(Boolean).join(',');
                    const detailsUrlTemplate = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds}&key=__API_KEY__`;
                    const detailsData = await fetchYouTubeWithRetry(detailsUrlTemplate);

                    if (!detailsData.error) {
                        const detailsMap = {};
                        detailsData.items?.forEach(d => { detailsMap[d.id] = { duration: d.contentDetails?.duration, viewCount: d.statistics?.viewCount }; });
                        items = items.map(item => ({ ...item, extraDetails: detailsMap[item.id?.videoId] || {} }));
                    }
                }
                newData = items;
                if (!nextYtToken) setHasMore(false);
                setYtPageToken(nextYtToken);
            } else {
                if (searchQuery.trim().length > 0) {
                    if (isAiMode) { if (pageNum === 1) { newData = await fetchAiRecommendations(searchQuery); setHasMore(false); } }
                    else { newData = await tmdbService.smartSearch(searchQuery, pageNum); }
                } else {
                    const genreId = GENRE_MAP[activeChip];
                    if (genreId) { newData = await tmdbService.discoverByGenre(genreId, pageNum); }
                    else { newData = await tmdbService.getTrending(pageNum); }
                }
                if (newData.length === 0) setHasMore(false);
            }

            setRawResults(prev => {
                const combined = (pageNum === 1 && !currentYtToken) ? newData : [...prev, ...newData];
                const uniqueMap = new Map();
                combined.forEach(item => {
                    const id = item.id?.videoId || item.id;
                    if (id && !uniqueMap.has(id)) uniqueMap.set(id, item);
                });
                return Array.from(uniqueMap.values());
            });
        } catch (error) {
            console.error("[Search Fetch Failed]", error);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    };

    useEffect(() => {
        setPage(1); setYtPageToken(''); setHasMore(true); setRawResults([]); setIsLoading(true);
        let debounceTime = (searchQuery.trim().length > 0) ? (isAiMode ? 1500 : (isYtMode ? 800 : 500)) : 0;
        const delayDebounceFn = setTimeout(() => { fetchResults(1, ''); }, debounceTime);
        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, activeChip, searchMode]);

    const handleLoadMore = () => {
        if (!isLoadingMore && hasMore && rawResults.length > 0) {
            setIsLoadingMore(true);
            if (isYtMode) { fetchResults(page, ytPageToken); }
            else if (!isAiMode) { setPage(p => p + 1); fetchResults(page + 1); }
            else { setIsLoadingMore(false); }
        }
    };

    const filteredResults = useMemo(() => {
        if (isYtMode) return rawResults;
        return rawResults.filter(item => {
            const safeId = typeof item.id === 'object' ? item.id?.videoId : item.id;
            return !watched[safeId];
        });
    }, [rawResults, watched, isYtMode]);

    useSpeechRecognitionEvent('start', () => setIsListening(true));
    useSpeechRecognitionEvent('end', () => setIsListening(false));
    useSpeechRecognitionEvent('result', (e) => { if (e.results?.[0]?.transcript) setSearchQuery(e.results[0].transcript); if (e.isFinal) ExpoSpeechRecognitionModule.stop(); });
    useSpeechRecognitionEvent('error', () => setIsListening(false));

    const toggleListening = async () => {
        if (isListening) {
            ExpoSpeechRecognitionModule.stop();
            return;
        }

        if (!isSpeechRecognitionAvailable()) {
            Toast.show({
                type: 'hotstarError',
                text1: 'Voice search is not supported in this view.',
                text2: Platform.OS === 'web' ? 'Try opening this in Chrome or Safari directly.' : undefined,
            });
            return;
        }

        try {
            const p = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
            if (p.granted) {
                setSearchQuery('');
                ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
            } else {
                Toast.show({ type: 'hotstarError', text1: 'Microphone permission denied.' });
            }
        } catch (err) {
            console.error('[Speech Recognition Error]', err);
            Toast.show({ type: 'hotstarError', text1: 'Voice search failed to start.' });
        }
    };

    const handleAuthAction = useCallback((actionCallback) => {
        if (!token) Toast.show({ type: 'hotstarInfo', text1: 'Log in for personalization', position: 'top' });
        else actionCallback();
    }, [token]);

    const handleToggleAction = useCallback(async (id, mediaType, targetList) => {
        if (targetList === 'watchlist') toggleWatchlist(id, mediaType);
        if (targetList === 'watched') toggleWatched(id, mediaType);
        try {
            const res = await fetch(`${BACKEND_URL}/user/${targetList}/toggle`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ tmdbId: `${id}:${mediaType}` }) });
            if (!res.ok) throw new Error();
            const data = await res.json();
            const arrayToMap = (arr) => arr.reduce((acc, curr) => { const [idStr, typeStr] = String(curr).split(':'); acc[idStr] = typeStr || 'movie'; return acc; }, {});
            useUserListStore.setState({ watchlist: arrayToMap(data.watchlist), watched: arrayToMap(data.watched) });
        } catch {
            Toast.show({ type: 'hotstarError', text1: `Failed to save to ${targetList}` });
            if (targetList === 'watchlist') toggleWatchlist(id, mediaType);
            if (targetList === 'watched') toggleWatched(id, mediaType);
        }
    }, [toggleWatchlist, toggleWatched, token]);

    return {
        searchQuery, setSearchQuery, activeChip, setActiveChip, searchMode, setSearchMode,
        isYtMode, isAiMode, isLoading, hasMore, isLoadingMore, isListening, filteredResults,
        handleLoadMore, toggleListening, handleAuthAction, handleToggleAction, watchlist, watched
    };
};