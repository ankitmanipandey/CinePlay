// src/app/index.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Image,
    Modal,
    PanResponder,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View,
    TextInput
} from 'react-native';
import ReAnimated, {
    FadeIn,
    FadeOut,
    LinearTransition,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import { toastConfig } from '../app/_layout';

import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

// --- RNTP V5 Import for enums ---
import { RepeatMode } from '@rntp/player';

import { FilterDropdown } from '../components/home/FilterDropDown';
import { GenreRow, HorizontalRow, LanguageRow } from '../components/home/HomeRows';
import { LiveSportsFeed } from '../components/home/LiveSportsFeed';
import { LiveTvFeed } from '../components/home/LiveTvFeed';
import { MiniPlayer } from '../components/home/MiniPlayer';
import { YTMusicFeed } from '../components/home/YTMusicFeed';
import { formatTime } from '../utils/homehelpers';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- Global Stores ---
import { getImageUrl } from '../constants/config';
import { useMusicEngine } from '../hooks/useMusicEngine';
import { useAuthStore } from '../store/useAuthStore';
import { useMovieStore } from '../store/useMovieStore';
import { useUserListStore } from '../store/useUserListStore';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = 60;
const SWIPE_VELOCITY = 1.0;

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

const CinePlayLogo = ({ size = 38 }) => (
    <Svg viewBox="0 0 500 500" width={size} height={size}>
        <Defs><SvgLinearGradient id="playGrad" x1="0%" y1="0%" x2="100%" y2="100%"><Stop offset="0%" stopColor="#00E5FF" /><Stop offset="50%" stopColor="#9B51E0" /><Stop offset="100%" stopColor="#FF007A" /></SvgLinearGradient></Defs>
        <Circle cx="250" cy="250" r="250" fill="url(#playGrad)" />
        <Path d="M 190 145 L 365 250 L 190 355 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="25" strokeLinejoin="round" />
    </Svg>
);

const HomeScreen = () => {
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
    // 🎵 GLOBAL MUSIC PLAYER 
    // ==========================================
    const {
        musicQueue, setMusicQueue, currentMusicIndex, setCurrentMusicIndex,
        musicPrefs, isShuffle, setIsShuffle, loopMode, setLoopMode,
        musicProgress, musicDuration, isPlaying, setIsPlaying,
        handleNextTrack, handlePrevTrack, handleSeekTo, handleMusicAction,
        startSleepTimer, sleepTimerRemaining
    } = useMusicEngine('music', token, insets);

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

    const renderCardContent = (item) => {
        const inWatchlist = !!watchlist[item.id];
        const inWatched = !!watched[item.id];
        const posterUri = getImageUrl(item.poster_path);
        const title = item.title || item.name;
        const year = (item.release_date || item.first_air_date || '').substring(0, 4);
        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
        const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');

        return (
            <>
                <Image source={{ uri: posterUri }} style={styles.mainCardImage} resizeMode="cover" />
                <View style={styles.badgeContainer}>
                    <Ionicons name="ticket" size={13} color="#F5C518" style={{ marginRight: 4 }} />
                    <Text style={styles.badgeText}>IMDb {rating}</Text>
                </View>
                <LinearGradient colors={['transparent', 'rgba(10, 10, 12, 0.75)', '#0A0A0C']} style={styles.gradientOverlay}>
                    <View style={styles.movieDetailsContainer}>
                        <Text style={styles.movieTitle} numberOfLines={1}>{title}</Text>
                        <Text style={styles.movieSubtitle} numberOfLines={2}>{item.overview}</Text>
                        <Text style={styles.metadataText}>{year}  •  TMDB</Text>
                    </View>
                </LinearGradient>
                <View style={styles.actionButtonsWrapper}>
                    <TouchableOpacity style={styles.iconActionBtn} activeOpacity={0.8} onPress={() => handleAuthAction(() => handleToggleAction(item.id, mediaType, 'watchlist'))}>
                        <Ionicons name={inWatchlist ? "bookmark" : "bookmark-outline"} size={24} color={inWatchlist ? "#FF007A" : "#FFFFFF"} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconActionBtn} activeOpacity={0.8} onPress={() => handleAuthAction(() => handleToggleAction(item.id, mediaType, 'watched'))}>
                        <Ionicons name="checkmark-done" size={22} color={inWatched ? "#00E5FF" : "#FFFFFF"} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.playButtonWrapper} activeOpacity={0.8} onPress={() => handleNavigateToPlayer({ id: item.id, type: mediaType })}>
                        <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.playButtonGradient}>
                            <Ionicons name="play" size={26} color="#FFFFFF" style={{ marginLeft: 3 }} />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </>
        );
    };

    const renderCardStack = () => {
        if (isLoading || trendingList.length === 0) return <View style={[styles.mainCardContainer, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#00E5FF" /></View>;
        const safeIndex = currentIndex % trendingList.length;
        const nextIndex = (currentIndex + 1) % trendingList.length;
        return (
            <>
                <Animated.View key={`${trendingList[nextIndex].id}-next`} style={[styles.mainCardContainer, { transform: [{ scale: nextCardScale }], zIndex: 1 }]}>
                    {renderCardContent(trendingList[nextIndex])}
                </Animated.View>
                <Animated.View key={`${trendingList[safeIndex].id}-top`} style={[styles.mainCardContainer, { opacity: topCardOpacity, transform: [{ translateX: pan.x }, { rotate: rotate }], zIndex: 99 }]} {...panResponder.panHandlers}>
                    {renderCardContent(trendingList[safeIndex])}
                </Animated.View>
            </>
        );
    };

    const categoryData = [
        { title: "Trending", data: trendingList }, { title: "Top Rated", data: topRatedList }, { title: "Latest", data: latestList }, { title: "Action Blockbusters", data: actionList },
        { title: "Comedy", data: comedyList }, { title: "Thriller", data: thrillerList }, { title: "Horror", data: romanceList }, { title: "Romance", data: romanceList },
        { title: "Sci-Fi", data: scifiList }, { title: "Feel Good", data: feelGoodList }, { title: "Biopics", data: biopicsList }
    ];

    const activeLiveCategory = filters.liveCategory || 'Cricket';
    const isLiveSportsFeed = ['Cricket', 'Football', 'Basketball'].includes(activeLiveCategory);

    const headerOpacity = scrollY.interpolate({ inputRange: [0, 150], outputRange: [0, 1], extrapolate: 'clamp' });
    const mainContentOpacity = scrollY.interpolate({ inputRange: [0, 150], outputRange: [1, 0], extrapolate: 'clamp' });
    const artScale = scrollY.interpolate({ inputRange: [-100, 0, 150], outputRange: [1.2, 1, 0.6], extrapolate: 'clamp' });
    const artTranslateY = scrollY.interpolate({ inputRange: [0, 150], outputRange: [0, -60], extrapolate: 'clamp' });

    return (
        <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.background}>
            <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <CinePlayLogo size={34} />
                        <MaskedView style={styles.maskedView} maskElement={<Text style={styles.appName}>CinePlay</Text>}>
                            <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}><Text style={[styles.appName, { opacity: 0 }]}>CinePlay</Text></LinearGradient>
                        </MaskedView>
                    </View>

                    <View style={styles.headerRightContainer}>
                        <TouchableOpacity
                            style={styles.headerRightBtn}
                            // UPDATED: Toggle between 'music' and 'all'
                            onPress={() => setFilter('type', filters.type === 'music' ? 'all' : 'music')}
                        >
                            <Ionicons
                                name={filters.type === 'music' ? "musical-notes" : "musical-notes-outline"}
                                size={26}
                                color={filters.type === 'music' ? "#00E5FF" : "#E0E0E0"}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerRightBtn} onPress={() => handleAuthAction(() => router.push('/my-list'))}>
                            <Ionicons name="bookmarks" size={24} color="#E0E0E0" />
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.scrollContent, currentTrack ? { paddingBottom: insets.bottom + 160 } : { paddingBottom: 80 }]}
                    bounces={false}
                >
                    {filters.type !== 'live' && filters.type !== 'music' && (
                        <View style={styles.deckArea}>{renderCardStack()}</View>
                    )}

                    <ReAnimated.View layout={LinearTransition}>
                        <View style={styles.filterBarHeader}>
                            <Text style={styles.filterTitle}>Explore Collections</Text>
                            <TouchableOpacity style={[styles.funnelBtn, showFilters && styles.funnelBtnActive]} onPress={toggleFilterMenu}><Ionicons name="funnel" size={20} color={showFilters ? "#00E5FF" : "#FFFFFF"} /></TouchableOpacity>
                        </View>
                    </ReAnimated.View>

                    {showFilters && (
                        <ReAnimated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} layout={LinearTransition}>
                            <FilterDropdown filters={filters} setFilter={setFilter} onClose={() => setShowFilters(false)} />
                        </ReAnimated.View>
                    )}

                    <View style={styles.categoriesWrapper}>
                        {isLoading && filters.type !== 'music' ? (
                            <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 40, marginBottom: 80 }} />
                        ) : filters.type === 'music' ? (
                            <YTMusicFeed onPlayMusic={handlePlayMusic} activeTrackId={currentTrack?.mediaId} />
                        ) : filters.type === 'live' ? (
                            isLiveSportsFeed
                                ? <LiveSportsFeed selectedSport={activeLiveCategory} />
                                : <LiveTvFeed selectedCategory={activeLiveCategory} selectedLanguage={filters.language} onNavigateToPlayer={handleNavigateToPlayer} />
                        ) : (
                            <View>
                                {categoryData.map((category, index) => (
                                    <HorizontalRow key={index.toString()} title={category.title} data={category.data} onAuthAction={handleAuthAction} watchlist={watched} toggleAction={handleToggleAction} onNavigateToPlayer={handleNavigateToPlayer} />
                                ))}
                            </View>
                        )}
                    </View>

                    {filters.type !== 'live' && filters.type !== 'music' && (
                        <ReAnimated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} layout={LinearTransition}>
                            <LanguageRow router={router} />
                            <GenreRow router={router} lists={{ actionList, thrillerList, scifiList, romanceList, comedyList, horrorList }} />
                        </ReAnimated.View>
                    )}
                </ScrollView>
            </SafeAreaView>

            {/* GLOBAL MINI PLAYER (Background Play) */}
            {currentTrack && !isMusicModalOpen && (
                <MiniPlayer
                    currentTrack={currentTrack}
                    isMusicPlaying={isPlaying}
                    musicProgress={musicProgress}
                    musicDuration={musicDuration}
                    isShuffle={isShuffle}
                    setIsShuffle={setIsShuffle}
                    loopMode={loopMode}
                    setLoopMode={setLoopMode}
                    onTogglePlay={() => setIsPlaying(!isPlaying)}
                    handleNextTrack={handleNextTrack}
                    handlePrevTrack={handlePrevTrack}
                    onOpenModal={() => setIsMusicModalOpen(true)}
                    onDismiss={() => {
                        setIsPlaying(false);
                        setMusicQueue([]);
                    }}
                    bottomOffset={insets.bottom + 60}
                />
            )}

            {/* FULL SCREEN MUSIC PLAYER MODAL */}
            <Modal visible={isMusicModalOpen} animationType="slide" transparent={false} onRequestClose={() => setIsMusicModalOpen(false)}>
                <LinearGradient colors={['#170D22', '#0A0A0C']} style={{ flex: 1 }}>
                    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>

                        {/* STICKY HEADER (Appears on scroll) */}
                        <Animated.View style={[styles.stickyHeader, { opacity: headerOpacity, paddingTop: insets.top + 10 }]}>
                            <TouchableOpacity onPress={() => setIsMusicModalOpen(false)} style={{ paddingRight: 10 }}>
                                <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
                            </TouchableOpacity>
                            <Image source={{ uri: currentTrack?.artwork || currentTrack?.artworkUrl || currentTrack?.image }} style={{ width: 40, height: 40, borderRadius: 6, marginRight: 10 }} />

                            {/* Flex: 1 ensures the text gracefully truncates and NEVER pushes the right icons out */}
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: 'bold' }} numberOfLines={1}>{currentTrack?.title}</Text>
                                <Text style={{ color: '#8F98A0', fontSize: 12 }} numberOfLines={1}>{currentTrack?.artist}</Text>
                            </View>

                            {/* Wrapping buttons in a row prevents them from wrapping or getting pushed */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
                                <TouchableOpacity onPress={handleTimerPress} style={{ paddingHorizontal: 8 }}>
                                    <Ionicons name="timer-outline" size={24} color={sleepTimerRemaining ? "#00E5FF" : "#FFF"} />
                                </TouchableOpacity>

                                <TouchableOpacity onPress={() => handleMusicAction(currentTrack?.mediaId, 'toggleLike')} style={{ paddingHorizontal: 8 }}>
                                    <Ionicons name={musicPrefs[currentTrack?.mediaId] === 'like' ? "heart" : "heart-outline"} size={22} color={musicPrefs[currentTrack?.mediaId] === 'like' ? "#FF007A" : "#FFF"} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleTogglePlay} style={{ paddingHorizontal: 8 }}>
                                    <Ionicons name={uiPlaying ? "pause" : "play"} size={26} color="#FFF" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleNextTrack} style={{ paddingLeft: 8 }}>
                                    <Ionicons name="play-skip-forward" size={22} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        </Animated.View>

                        {/* STATIC TOP HEADER (Fades out on scroll) */}
                        <Animated.View style={[styles.musicHeader, { opacity: mainContentOpacity, position: 'absolute', top: insets.top, left: 0, right: 0 }]}>
                            <TouchableOpacity onPress={() => setIsMusicModalOpen(false)} style={{ padding: 10, width: 60, alignItems: 'flex-start' }}>
                                <Ionicons name="chevron-down" size={32} color="#FFFFFF" />
                            </TouchableOpacity>

                            {/* Flex: 1 will shrink if title is extremely long, preventing layout breakage */}
                            <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 10 }}>
                                <Text style={styles.musicHeaderSubtitle}>NOW PLAYING</Text>
                                <Text style={styles.musicHeaderTitle} numberOfLines={1}>{currentTrack?.title}</Text>
                            </View>

                            <TouchableOpacity onPress={handleTimerPress} style={{ padding: 10, alignItems: 'flex-end', width: 60 }}>
                                <Ionicons name="timer-outline" size={26} color={sleepTimerRemaining ? "#00E5FF" : "#FFFFFF"} />
                                {sleepTimerRemaining > 0 && (
                                    <Text style={{ color: '#00E5FF', fontSize: 10, fontWeight: 'bold', marginTop: 2 }}>
                                        {Math.floor(sleepTimerRemaining / 60)}:{(sleepTimerRemaining % 60).toString().padStart(2, '0')}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </Animated.View>

                        <Animated.ScrollView
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingTop: 80, paddingBottom: 40 }}
                            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
                            scrollEventThrottle={16}
                        >
                            {/* Interactive Main Player Section */}
                            <Animated.View style={{ opacity: mainContentOpacity, transform: [{ scale: artScale }, { translateY: artTranslateY }] }} {...panResponderMusic.panHandlers}>
                                <View style={styles.albumArtContainer}>
                                    <Image source={{ uri: currentTrack?.artwork || currentTrack?.artworkUrl || currentTrack?.image }} style={[styles.albumArt, { width: width * 0.75, height: width * 0.75 }]} />
                                </View>

                                <View style={[styles.musicTrackInfo, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 }]}>
                                    <TouchableOpacity onPress={() => handleMusicAction(currentTrack?.mediaId, 'dislike')} style={{ padding: 10 }}>
                                        <Ionicons name="thumbs-down-outline" size={28} color="#8F98A0" />
                                    </TouchableOpacity>

                                    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 10 }}>
                                        <Text style={styles.musicLargeTitle} numberOfLines={1}>{currentTrack?.title}</Text>
                                        <Text style={styles.musicLargeArtist} numberOfLines={1}>{currentTrack?.artist}</Text>
                                    </View>

                                    <TouchableOpacity onPress={() => handleMusicAction(currentTrack?.mediaId, 'toggleLike')} style={{ padding: 10 }}>
                                        <Ionicons name={musicPrefs[currentTrack?.mediaId] === 'like' ? "heart" : "heart-outline"} size={28} color={musicPrefs[currentTrack?.mediaId] === 'like' ? "#FF007A" : "#FFF"} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.seekContainer}>
                                    <TouchableOpacity activeOpacity={1} style={styles.progressBarTouchArea} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)} onPress={handleSeek}>
                                        <View style={styles.progressBarBg}>
                                            <LinearGradient colors={['#00E5FF', '#9B51E0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.progressBarFill, { width: `${(musicProgress / (musicDuration || 1)) * 100}%` }]} />
                                            <View style={[styles.progressKnob, { left: `${(musicProgress / (musicDuration || 1)) * 100}%` }]} />
                                        </View>
                                    </TouchableOpacity>
                                    <View style={styles.timeRow}>
                                        <Text style={styles.timeText}>{formatTime(musicProgress)}</Text>
                                        <Text style={styles.timeText}>{formatTime(musicDuration)}</Text>
                                    </View>
                                </View>

                                <View style={styles.musicControlsRow}>
                                    <TouchableOpacity onPress={() => setIsShuffle(!isShuffle)} style={{ padding: 10 }}>
                                        <Ionicons name="shuffle" size={24} color={isShuffle ? "#00E5FF" : "#8F98A0"} />
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={handlePrevTrack} style={styles.skipBtn}>
                                        <Ionicons name="play-skip-back" size={32} color={currentMusicIndex > 0 || isShuffle || isLoopActive ? "#FFFFFF" : "#555"} />
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.neonPlayWrapper} activeOpacity={0.8} onPress={handleTogglePlay}>
                                        <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.neonPlayInner}>
                                            <Ionicons name={uiPlaying ? "pause" : "play"} size={36} color="#FFFFFF" style={!uiPlaying ? { marginLeft: 6 } : {}} />
                                        </LinearGradient>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={handleNextTrack} style={styles.skipBtn}>
                                        <Ionicons name="play-skip-forward" size={32} color={currentMusicIndex < musicQueue.length - 1 || isShuffle || isLoopActive ? "#FFFFFF" : "#555"} />
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={setLoopMode} style={{ padding: 10, position: 'relative' }}>
                                        <Ionicons name="repeat" size={24} color={isLoopActive ? "#00E5FF" : "#8F98A0"} />
                                        {isLoopOne && <Text style={{ position: 'absolute', fontSize: 10, color: '#00E5FF', top: 10, right: 6, fontWeight: 'bold' }}>1</Text>}
                                    </TouchableOpacity>
                                </View>
                            </Animated.View>

                            <View style={styles.queueContainer}>
                                <Text style={styles.queueTitle}>Playlist</Text>
                                {musicQueue.map((track, index) => {
                                    const isActive = index === currentMusicIndex;
                                    return (
                                        <TouchableOpacity
                                            key={track.mediaId + index}
                                            style={[styles.queueItem, isActive && { borderColor: '#00E5FF', backgroundColor: 'rgba(0, 229, 255, 0.1)' }]}
                                            onPress={() => setCurrentMusicIndex(index)}
                                        >
                                            <Image source={{ uri: track?.artwork || track?.artworkUrl || track?.image }} style={styles.queueImage} />
                                            <View style={styles.queueInfo}>
                                                <Text style={[styles.queueTrackTitle, isActive && { color: '#00E5FF' }]} numberOfLines={1}>{track.title}</Text>
                                                <Text style={styles.queueTrackArtist} numberOfLines={1}>{track.artist}</Text>
                                            </View>
                                            {isActive ? (
                                                <Ionicons name="stats-chart" size={20} color="#00E5FF" />
                                            ) : (
                                                <Ionicons name="play-circle-outline" size={24} color="#8F98A0" />
                                            )}
                                        </TouchableOpacity>
                                    )
                                })}
                            </View>
                        </Animated.ScrollView>
                    </View>
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999, elevation: 9999 }} pointerEvents="box-none">
                        <Toast config={toastConfig} position="top" topOffset={insets.top > 0 ? insets.top + 10 : 50} />
                    </View>
                </LinearGradient>
            </Modal>

            {/* DIGITAL SLEEP TIMER MODAL (WITH CUSTOM OPTION) */}
            <Modal visible={isSleepTimerModalOpen} animationType="fade" transparent={true} onRequestClose={closeTimerModal}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ backgroundColor: '#170D22', padding: 24, borderRadius: 20, width: '85%', borderWidth: 1, borderColor: 'rgba(0,229,255,0.3)', shadowColor: '#00E5FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                            <Ionicons name="timer" size={24} color="#00E5FF" style={{ marginRight: 8 }} />
                            <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold', letterSpacing: 1 }}>SLEEP TIMER</Text>
                        </View>

                        {showCustomTimerInput ? (
                            <View style={{ width: '100%', alignItems: 'center' }}>
                                <Text style={{ color: '#8F98A0', marginBottom: 12, fontSize: 14 }}>Enter minutes (1 - 180)</Text>
                                <TextInput
                                    style={styles.customTimerInput}
                                    keyboardType="numeric"
                                    maxLength={3}
                                    value={customTimerValue}
                                    onChangeText={setCustomTimerValue}
                                    placeholder="0"
                                    placeholderTextColor="#555"
                                    autoFocus={true}
                                />
                                <TouchableOpacity style={styles.startCustomBtn} onPress={handleStartCustomTimer}>
                                    <Text style={styles.startCustomBtnText}>START TIMER</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={{ marginTop: 24 }} onPress={() => setShowCustomTimerInput(false)}>
                                    <Text style={{ color: '#8F98A0', fontWeight: 'bold', letterSpacing: 1, fontSize: 12 }}>BACK TO PRESETS</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
                                    {[15, 30, 45, 60].map(mins => (
                                        <TouchableOpacity
                                            key={mins}
                                            style={{ width: '47%', backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 20, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                                            onPress={() => { startSleepTimer(mins); closeTimerModal(); }}
                                        >
                                            <Text style={{ color: '#00E5FF', fontSize: 28, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>{mins}</Text>
                                            <Text style={{ color: '#8F98A0', fontSize: 12, marginTop: 4, fontWeight: 'bold', letterSpacing: 1 }}>MINUTES</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* CUSTOM TIMER TOGGLE BUTTON */}
                                <TouchableOpacity
                                    style={styles.customTimerBtn}
                                    onPress={() => setShowCustomTimerInput(true)}
                                >
                                    <Ionicons name="create-outline" size={20} color="#00E5FF" style={{ marginRight: 8 }} />
                                    <Text style={{ color: '#00E5FF', fontWeight: 'bold', letterSpacing: 1 }}>CUSTOM TIMER</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <TouchableOpacity
                            style={{ marginTop: 20, paddingVertical: 14 }}
                            onPress={closeTimerModal}
                        >
                            <Text style={{ color: '#8F98A0', fontSize: 14, textAlign: 'center', fontWeight: 'bold' }}>CANCEL</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ACTIVE SLEEP TIMER ALERT MODAL */}
            <Modal visible={isActiveTimerAlertOpen} animationType="fade" transparent={true} onRequestClose={() => setIsActiveTimerAlertOpen(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ backgroundColor: '#170D22', padding: 24, borderRadius: 20, width: '85%', borderWidth: 1, borderColor: 'rgba(0,229,255,0.3)', shadowColor: '#00E5FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                            <Ionicons name="timer" size={28} color="#00E5FF" style={{ marginRight: 8 }} />
                            <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold', letterSpacing: 1 }}>TIMER ACTIVE</Text>
                        </View>

                        <Text style={{ color: '#8F98A0', fontSize: 14, textAlign: 'center', marginBottom: 8 }}>Audio will stop in</Text>
                        <Text style={{ color: '#00E5FF', fontSize: 42, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', textAlign: 'center', marginBottom: 24 }}>
                            {Math.floor((sleepTimerRemaining || 0) / 60)}:{((sleepTimerRemaining || 0) % 60).toString().padStart(2, '0')}
                        </Text>

                        <TouchableOpacity
                            style={{ paddingVertical: 14, backgroundColor: '#00E5FF', borderRadius: 12, marginBottom: 12 }}
                            onPress={() => { setIsActiveTimerAlertOpen(false); setIsSleepTimerModalOpen(true); }}
                        >
                            <Text style={{ color: '#0A0A0C', fontSize: 14, textAlign: 'center', fontWeight: 'bold', letterSpacing: 1 }}>CHANGE TIME</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ paddingVertical: 14, backgroundColor: 'rgba(255, 0, 122, 0.15)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 0, 122, 0.3)', marginBottom: 12 }}
                            onPress={() => { startSleepTimer(0); setIsActiveTimerAlertOpen(false); }}
                        >
                            <Text style={{ color: '#FF007A', fontSize: 14, textAlign: 'center', fontWeight: 'bold', letterSpacing: 1 }}>TURN OFF TIMER</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ paddingVertical: 14 }}
                            onPress={() => setIsActiveTimerAlertOpen(false)}
                        >
                            <Text style={{ color: '#8F98A0', fontSize: 14, textAlign: 'center', fontWeight: 'bold' }}>KEEP TIMER (CLOSE)</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </LinearGradient>
    );
};

export default HomeScreen;

const styles = StyleSheet.create({
    // --- BASE LAYOUT ---
    background: { flex: 1 },
    container: { flex: 1 },
    header: { paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    maskedView: { height: 32, flexDirection: 'row', alignItems: 'center' },
    appName: { fontSize: 26, fontWeight: '900', letterSpacing: 0.5, lineHeight: 32, includeFontPadding: false },
    headerRightContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerRightBtn: { padding: 4 },
    scrollContent: { paddingBottom: 60 },
    categoriesWrapper: { paddingTop: 4 },

    // --- MAIN MOVIE DECK (CAROUSEL) ---
    deckArea: { height: 440, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    mainCardContainer: { width: width * 0.85, height: 430, backgroundColor: '#2A1E39', borderRadius: 22, overflow: 'hidden', position: 'absolute', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 8 },
    mainCardImage: { width: '100%', height: '100%', position: 'absolute' },
    badgeContainer: { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15, 15, 20, 0.75)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)' },
    badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
    gradientOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 16 },
    movieDetailsContainer: { width: '72%' },
    movieTitle: { color: '#F5C518', fontSize: 26, fontWeight: '900', letterSpacing: 0.5, textShadowColor: 'rgba(0, 0, 0, 0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
    movieSubtitle: { color: '#E0E0E0', fontSize: 10, fontWeight: '500', lineHeight: 14, marginVertical: 4 },
    metadataText: { color: '#B0B5B9', fontSize: 11, fontWeight: 'bold' },
    actionButtonsWrapper: { position: 'absolute', bottom: 18, right: 14, alignItems: 'center', gap: 12 },
    iconActionBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(30, 30, 35, 0.65)', justifyContent: 'center', alignItems: 'center', borderWidth: 1.2, borderColor: 'rgba(255, 255, 255, 0.35)' },
    playButtonWrapper: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', elevation: 6, shadowColor: '#FF007A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 4 },
    playButtonGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // --- FILTER BAR (Above Feeds/Rows) ---
    filterBarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 14 },
    filterTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    funnelBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    funnelBtnActive: { backgroundColor: 'rgba(0, 229, 255, 0.15)', borderColor: '#00E5FF' },

    // --- FULL-SCREEN MUSIC PLAYER MODAL ---
    musicHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20, elevation: 20, zIndex: 20 },
    stickyHeader: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, backgroundColor: 'rgba(10, 10, 12, 0.95)', zIndex: 20, elevation: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    musicHeaderSubtitle: { color: '#8F98A0', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 4 },
    // Removed maxWidth so flex:1 does its job flawlessly
    musicHeaderTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center' },
    albumArtContainer: { alignItems: 'center', marginTop: 20, marginBottom: 40, shadowColor: '#00E5FF', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 15 },
    albumArt: { borderRadius: 20, backgroundColor: '#1E1428' },
    musicTrackInfo: { marginBottom: 30 },
    musicLargeTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    musicLargeArtist: { color: '#00E5FF', fontSize: 16, fontWeight: '600', textAlign: 'center' },
    musicControlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 40 },
    skipBtn: { padding: 10 },
    neonPlayWrapper: { width: 76, height: 76, borderRadius: 38, elevation: 10, shadowColor: '#FF007A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.6, shadowRadius: 12 },
    neonPlayInner: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 38 },

    // --- MODAL QUEUE ---
    queueContainer: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    queueTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    queueItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16161A', padding: 10, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    queueImage: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#2A2A30' },
    queueInfo: { flex: 1, marginLeft: 12, marginRight: 10 },
    queueTrackTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
    queueTrackArtist: { color: '#8F98A0', fontSize: 12 },

    // --- MODAL SEEK BAR ---
    seekContainer: { paddingHorizontal: 30, marginBottom: 20 },
    progressBarTouchArea: { height: 30, justifyContent: 'center' },
    progressBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, position: 'relative' },
    progressBarFill: { height: '100%', borderRadius: 3 },
    progressKnob: { position: 'absolute', top: -5, width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF', elevation: 4, transform: [{ translateX: -8 }] },
    timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    timeText: { color: '#8F98A0', fontSize: 12, fontWeight: '600' },

    // --- CUSTOM TIMER STYLES ---
    customTimerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,229,255,0.1)', paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,229,255,0.3)', marginTop: 12 },
    customTimerInput: { fontSize: 48, fontWeight: '900', color: '#00E5FF', textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#00E5FF', width: 120, marginBottom: 20, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', paddingBottom: 5 },
    startCustomBtn: { backgroundColor: '#00E5FF', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, elevation: 5, shadowColor: '#00E5FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
    startCustomBtnText: { color: '#0A0A0C', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },
});