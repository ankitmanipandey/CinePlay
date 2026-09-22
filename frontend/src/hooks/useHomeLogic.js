import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Animated, Dimensions, PanResponder } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { RepeatMode } from '../services/trackPlayer';

import { useAuthStore } from '../store/useAuthStore';
import { useMovieStore } from '../store/useMovieStore';
import { useUserListStore } from '../store/useUserListStore';
import { useMusicEngine } from '../hooks/useMusicEngine';
import { tmdbService } from '../services/tmdbService'; // <-- ADD THIS IMPORT

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = 60;
const SWIPE_VELOCITY = 1.0;
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

export const useHomeLogic = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const {
        filters, setFilter, fetchAllData, isLoading,
        trendingList, topRatedList, latestList, actionList, comedyList,
        thrillerList, horrorList, romanceList, scifiList, feelGoodList, biopicsList
    } = useMovieStore();

    const { watchlist, watched, toggleWatchlist, toggleWatched } = useUserListStore();
    const { token } = useAuthStore();

    const [currentIndex, setCurrentIndex] = useState(0);
    const [showFilters, setShowFilters] = useState(false);
    const toggleFilterMenu = () => setShowFilters(prev => !prev);

    const [pan, setPan] = useState(() => new Animated.ValueXY());
    const isDragging = useRef(false);
    const isTransitioning = useRef(false);

    // ==========================================
    // 🖥️ DESKTOP HERO TRAILER LOGIC
    // ==========================================
    const desktopHeroItem = trendingList?.length > 0 ? trendingList[0] : null;
    const [heroTrailerKey, setHeroTrailerKey] = useState(null);

    useEffect(() => {
        if (desktopHeroItem && width >= 1024) {
            const fetchTrailer = async () => {
                const type = desktopHeroItem.media_type || (desktopHeroItem.first_air_date ? 'tv' : 'movie');
                const videos = await tmdbService.getVideos(desktopHeroItem.id, type);

                // Prioritize finding an official YouTube Trailer
                const trailer = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer');
                if (trailer) {
                    setHeroTrailerKey(trailer.key);
                } else {
                    // Fallback to any YouTube video if trailer is missing
                    const anyVideo = videos.find(v => v.site === 'YouTube');
                    setHeroTrailerKey(anyVideo ? anyVideo.key : null);
                }
            };
            fetchTrailer();
        }
    }, [desktopHeroItem?.id, width]);

    // ==========================================
    // 🎵 GLOBAL MUSIC PLAYER 
    // ==========================================
    const musicEngine = useMusicEngine('music', token, insets);
    const {
        musicQueue, setMusicQueue, currentMusicIndex, setCurrentMusicIndex,
        musicPrefs, isShuffle, setIsShuffle, loopMode, setLoopMode,
        musicProgress, musicDuration, isPlaying, setIsPlaying,
        handleNextTrack, handlePrevTrack, handleSeekTo, handleMusicAction,
        startSleepTimer, sleepTimerRemaining
    } = musicEngine;

    const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);

    // --- SLEEP TIMER STATE ---
    const [isSleepTimerModalOpen, setIsSleepTimerModalOpen] = useState(false);
    const [isActiveTimerAlertOpen, setIsActiveTimerAlertOpen] = useState(false);
    const [showCustomTimerInput, setShowCustomTimerInput] = useState(false);
    const [customTimerValue, setCustomTimerValue] = useState('');

    const [barWidth, setBarWidth] = useState(0);
    const scrollY = useRef(new Animated.Value(0)).current;

    const currentTrack = musicQueue[currentMusicIndex] || null;

    const [uiPlaying, setUiPlaying] = useState(!!isPlaying);
    useEffect(() => { setUiPlaying(!!isPlaying); }, [isPlaying]);

    const handleTogglePlay = () => {
        const nextState = !uiPlaying;
        setUiPlaying(nextState);
        setIsPlaying(nextState);
    };

    const isLoopActive = loopMode !== 0 && loopMode !== 'off' && !!loopMode;
    const isLoopOne = loopMode === 1 || loopMode === 'track' || loopMode === 'one' || loopMode === RepeatMode.Track;

    // --- SLEEP TIMER HANDLERS ---
    const handleTimerPress = () => {
        setShowCustomTimerInput(false);
        setCustomTimerValue('');
        if (sleepTimerRemaining > 0) {
            setIsActiveTimerAlertOpen(true);
        } else {
            setIsSleepTimerModalOpen(true);
        }
    };

    const handleStartCustomTimer = () => {
        const mins = parseInt(customTimerValue, 10);
        if (isNaN(mins) || mins <= 0 || mins > 180) {
            Toast.show({ type: 'error', text1: 'Please enter a valid time (1-180 mins)' });
            return;
        }
        startSleepTimer(mins);
        closeTimerModal();
    };

    const closeTimerModal = () => {
        setIsSleepTimerModalOpen(false);
        setShowCustomTimerInput(false);
        setCustomTimerValue('');
    };

    const handleNavigateToPlayer = useCallback((params) => {
        if (isPlaying) {
            setIsPlaying(false);
        }
        router.push({ pathname: '/player', params });
    }, [isPlaying, router, setIsPlaying]);

    const handlePlayMusic = async (arg1, arg2) => {
        try {
            let queue = [];
            let track = null;

            if (Array.isArray(arg1)) {
                queue = arg1;
                track = arg2;
            } else if (Array.isArray(arg2)) {
                queue = arg2;
                track = arg1;
            } else {
                queue = [arg1];
                track = arg1;
            }

            const trackId = typeof track === 'string' ? track : (track?.id || track?.mediaId || track?.videoId);
            await setMusicQueue(queue, trackId);
        } catch (error) {
            console.error("❌ ERROR in handlePlayMusic:", error);
        }
    };

    const handleSeek = (event) => {
        if (barWidth > 0 && musicDuration > 0) {
            const tapX = event.nativeEvent.locationX;
            const percentage = Math.max(0, Math.min(1, tapX / barWidth));
            const newTime = percentage * musicDuration;
            handleSeekTo(newTime);
        }
    };

    const panResponderMusic = useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponder: (evt, gestureState) => {
            return Math.abs(gestureState.dx) > 20 || Math.abs(gestureState.dy) > 20;
        },
        onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
            return Math.abs(gestureState.dx) > 20 || Math.abs(gestureState.dy) > 20;
        },
        onPanResponderRelease: (evt, gestureState) => {
            const { dx, dy } = gestureState;
            if (Math.abs(dx) > 60) {
                if (dx > 0) handlePrevTrack();
                else handleNextTrack();
            } else if (dy > 60) {
                setIsMusicModalOpen(false);
            }
        }
    }), [handleNextTrack, handlePrevTrack]);

    const moviesLengthRef = useRef(0);
    useEffect(() => { moviesLengthRef.current = trendingList.length; }, [trendingList]);

    useEffect(() => { fetchAllData(); }, []);

    useEffect(() => {
        let isMounted = true;
        const syncUserLists = async () => {
            if (!token) return;
            try {
                const response = await fetch(`${BACKEND_URL}/user/lists`, { headers: { Authorization: `Bearer ${token}` } });
                if (response.ok) {
                    const data = await response.json();
                    const arrayToMap = (arr) => arr.reduce((acc, curr) => {
                        const [idStr, typeStr] = String(curr).split(':'); acc[idStr] = typeStr || 'movie'; return acc;
                    }, {});

                    if (isMounted) {
                        useUserListStore.setState({ watchlist: arrayToMap(data.watchlist || []), watched: arrayToMap(data.watched || []) });
                    }
                }
            } catch (error) { }
        };
        syncUserLists();
        return () => { isMounted = false; };
    }, [token]);

    const handleAuthAction = useCallback((actionCallback) => {
        if (!token) { Toast.show({ type: 'hotstarInfo', text1: 'Log in for personalization', position: 'top', topOffset: insets.top > 0 ? insets.top + 10 : 50, visibilityTime: 2500 }); }
        else { actionCallback(); }
    }, [token, insets.top]);

    const handleToggleAction = useCallback(async (id, mediaType, targetList) => {
        if (targetList === 'watchlist') toggleWatchlist(id, mediaType);
        if (targetList === 'watched') toggleWatched(id, mediaType);

        try {
            const response = await fetch(`${BACKEND_URL}/user/${targetList}/toggle`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ tmdbId: `${id}:${mediaType}` }) });
            if (!response.ok) throw new Error('Failed to update on server');
            const data = await response.json();
            const arrayToMap = (arr) => arr.reduce((acc, curr) => { const [idStr, typeStr] = String(curr).split(':'); acc[idStr] = typeStr || 'movie'; return acc; }, {});
            useUserListStore.setState({ watchlist: arrayToMap(data.watchlist), watched: arrayToMap(data.watched) });
        } catch (error) {
            Toast.show({ type: 'error', text1: `Failed to save to ${targetList}` });
            if (targetList === 'watchlist') toggleWatchlist(id, mediaType);
            if (targetList === 'watched') toggleWatched(id, mediaType);
        }
    }, [toggleWatchlist, toggleWatched, token]);

    const forceSwipe = (direction, isAuto = false) => {
        isTransitioning.current = true;
        const x = direction === 'right' ? width * 1.5 : -width * 1.5;
        Animated.timing(pan, { toValue: { x, y: 0 }, duration: isAuto ? 700 : 300, useNativeDriver: false }).start(() => onSwipeComplete());
    };

    const onSwipeComplete = () => { setPan(new Animated.ValueXY()); setCurrentIndex((prevIndex) => (prevIndex + 1) % (moviesLengthRef.current || 1)); };

    useEffect(() => { isTransitioning.current = false; }, [pan]);
    const resetPosition = () => { Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: false }).start(); };

    const panResponder = useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => { if (isTransitioning.current) return false; return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 5; },
        onMoveShouldSetPanResponder: (_, gestureState) => { if (isTransitioning.current) return false; return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 5; },
        onPanResponderGrant: () => { isDragging.current = true; pan.stopAnimation(); pan.extractOffset(); },
        onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }),
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, gestureState) => {
            isDragging.current = false; pan.flattenOffset();
            if (gestureState.dx > SWIPE_THRESHOLD || gestureState.vx > SWIPE_VELOCITY) forceSwipe('right', false);
            else if (gestureState.dx < -SWIPE_THRESHOLD || gestureState.vx < -SWIPE_VELOCITY) forceSwipe('left', false);
            else resetPosition();
        },
        onPanResponderTerminate: () => { isDragging.current = false; resetPosition(); }
    }), [pan]);

    useEffect(() => {
        const timer = setInterval(() => { if (!isDragging.current && !isTransitioning.current && trendingList.length > 0 && filters.type !== 'music' && filters.type !== 'live') forceSwipe('left', true); }, 3500);
        return () => clearInterval(timer);
    }, [pan, trendingList.length, filters.type]);

    const rotate = pan.x.interpolate({ inputRange: [-width / 2, 0, width / 2], outputRange: ['-10deg', '0deg', '10deg'], extrapolate: 'clamp' });
    const topCardOpacity = pan.x.interpolate({ inputRange: [-width / 1.5, 0, width / 1.5], outputRange: [0, 1, 0], extrapolate: 'clamp' });
    const nextCardScale = pan.x.interpolate({ inputRange: [-width / 2, 0, width / 2], outputRange: [1, 0.92, 1], extrapolate: 'clamp' });

    const headerOpacity = scrollY.interpolate({ inputRange: [0, 150], outputRange: [0, 1], extrapolate: 'clamp' });
    const mainContentOpacity = scrollY.interpolate({ inputRange: [0, 150], outputRange: [1, 0], extrapolate: 'clamp' });
    const artScale = scrollY.interpolate({ inputRange: [-100, 0, 150], outputRange: [1.2, 1, 0.6], extrapolate: 'clamp' });
    const artTranslateY = scrollY.interpolate({ inputRange: [0, 150], outputRange: [0, -60], extrapolate: 'clamp' });

    const categoryData = [
        { title: "Trending", data: trendingList }, { title: "Top Rated", data: topRatedList }, { title: "Latest", data: latestList }, { title: "Action Blockbusters", data: actionList },
        { title: "Comedy", data: comedyList }, { title: "Thriller", data: thrillerList }, { title: "Horror", data: horrorList }, { title: "Romance", data: romanceList },
        { title: "Sci-Fi", data: scifiList }, { title: "Feel Good", data: feelGoodList }, { title: "Biopics", data: biopicsList }
    ];

    const activeLiveCategory = filters.liveCategory || 'Cricket';
    const isLiveSportsFeed = ['Cricket', 'Football', 'Basketball'].includes(activeLiveCategory);

    return {
        router, insets, width,
        filters, setFilter, isLoading,
        trendingList, currentIndex, pan, rotate, topCardOpacity, nextCardScale, panResponder,
        showFilters, toggleFilterMenu, setShowFilters,
        watchlist, watched, handleAuthAction, handleToggleAction, handleNavigateToPlayer,
        musicEngine, musicQueue, currentMusicIndex, setCurrentMusicIndex,
        musicPrefs, isShuffle, setIsShuffle, loopMode, setLoopMode,
        musicProgress, musicDuration, isPlaying, setIsPlaying,
        handleNextTrack, handlePrevTrack, handleSeekTo, handleMusicAction, handlePlayMusic,
        isMusicModalOpen, setIsMusicModalOpen,
        isSleepTimerModalOpen, setIsSleepTimerModalOpen,
        isActiveTimerAlertOpen, setIsActiveTimerAlertOpen,
        showCustomTimerInput, setShowCustomTimerInput,
        customTimerValue, setCustomTimerValue,
        sleepTimerRemaining, startSleepTimer, handleTimerPress, handleStartCustomTimer, closeTimerModal,
        uiPlaying, handleTogglePlay, isLoopActive, isLoopOne,
        currentTrack, barWidth, setBarWidth, scrollY, handleSeek, panResponderMusic,
        categoryData, activeLiveCategory, isLiveSportsFeed,
        headerOpacity, mainContentOpacity, artScale, artTranslateY,
        actionList, thrillerList, scifiList, romanceList, comedyList, horrorList,
        desktopHeroItem, // EXPORT HERO DATA
        heroTrailerKey   // EXPORT TRAILER KEY
    };
};