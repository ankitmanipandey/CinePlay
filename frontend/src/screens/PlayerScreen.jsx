import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    Image,
    StatusBar,
    ActivityIndicator,
    useWindowDimensions,
    Platform,
    Animated,
    PanResponder
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import YoutubePlayer from 'react-native-youtube-iframe';
import * as ScreenOrientation from 'expo-screen-orientation';
import { WebView } from 'react-native-webview';
import { useVideoPlayer, VideoView } from 'expo-video';

// --- Global State, Config & API ---
import { tmdbService } from '../services/tmdbService';
import { getImageUrl } from '../constants/config';
import { useUserListStore } from '../store/useUserListStore';
import { useAuthStore } from '../store/useAuthStore';
import { safeFetchJson, mapSaavnSong } from '../services/jioSaavnApi';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;
const RAW_KEYS = process.env.EXPO_PUBLIC_YOUTUBE_API_KEYS || process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || '';
let ACTIVE_YT_KEYS = RAW_KEYS.split(',').map(k => k.trim()).filter(Boolean);

// STRICT DEDUPLICATION HELPER
const normalizeString = (str) => {
    if (!str) return '';
    return str.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();
};

const fetchYouTubeWithRetry = async (urlTemplate) => {
    while (ACTIVE_YT_KEYS.length > 0) {
        const currentKey = ACTIVE_YT_KEYS[0];
        const url = urlTemplate.replace('__API_KEY__', currentKey);

        try {
            const res = await fetch(url);
            const data = await res.json();

            if (data.error && (data.error.code === 403 || data.error.code === 429)) {
                console.warn(`[PlayerScreen YT Quota Error] Key failed: ${currentKey}. Removing from rotation...`);
                ACTIVE_YT_KEYS.shift();
                continue;
            }
            return data;
        } catch (err) {
            console.error("[PlayerScreen YT Fetch Error]", err);
            return { error: { code: 500, message: "Network error occurred." } };
        }
    }
    return { error: { code: 429, message: 'All YouTube API keys have exhausted their daily quota.' } };
};

const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// --- Mini player collapse thresholds (scrollY breakpoints, in px) ---
// 0                -> MINI_START   : full hero view (big art, like/dislike, full transport, full progress bar)
// MINI_START       -> MINI_PEAK    : "mid" state — mini bar fading in, thin progress bar visible (YT Music style)
// MINI_PEAK        -> MINI_END     : progress bar fades OUT, mini bar finishes docking as a clean icon-only strip
// MINI_END+                        : fully collapsed sticky bar, no progress bar
const MINI_START = 110;
const MINI_PEAK = 190;
const MINI_END = 260;

export default function PlayerScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();

    const { id, type, ytId, streamUrl, channelName, artworkUrl } = useLocalSearchParams();

    const [isLoading, setIsLoading] = useState(true);
    const [mediaDetails, setMediaDetails] = useState(null);
    const [trailerKey, setTrailerKey] = useState(null);
    const [similarMedia, setSimilarMedia] = useState([]);
    const [watchProviders, setWatchProviders] = useState(null);
    const [relatedYtClips, setRelatedYtClips] = useState([]);

    const [hasStarted, setHasStarted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);

    const [activeMediaView, setActiveMediaView] = useState('trailer');
    const [isVidkingAvailable, setIsVidkingAvailable] = useState(null);

    const [selectedSeason, setSelectedSeason] = useState(1);
    const [selectedEpisode, setSelectedEpisode] = useState(1);

    const [showControls, setShowControls] = useState(true);
    const controlsFadeAnim = useRef(new Animated.Value(1)).current;
    const playingTrackId = useRef(null);
    const controlsTimer = useRef(null);

    const [musicQueue, setMusicQueue] = useState([]);
    const [currentMusicIndex, setCurrentMusicIndex] = useState(0);
    const [musicPrefs, setMusicPrefs] = useState({});

    // Shuffle & Loop states
    const [isShuffle, setIsShuffle] = useState(false);
    const [loopMode, setLoopMode] = useState(0); // 0=off, 1=all, 2=one

    const [musicProgress, setMusicProgress] = useState(0);
    const [musicDuration, setMusicDuration] = useState(0);
    const [barWidth, setBarWidth] = useState(0);
    const [miniBarWidth, setMiniBarWidth] = useState(0);
    const scrollY = useRef(new Animated.Value(0)).current;
    const playRequestId = useRef(0);
    const isFetchingQueue = useRef(false);

    // Tracks whether the mini bar is far enough along to accept taps (avoids
    // ghost-touches on the queue underneath while it's still fading in).
    const [miniBarInteractive, setMiniBarInteractive] = useState(false);

    const { watchlist, watched, toggleWatchlist, toggleWatched } = useUserListStore();
    const { token } = useAuthStore();
    useEffect(() => {
        if (token) {
            fetch(`${BACKEND_URL}/user/lists`, { headers: { Authorization: `Bearer ${token}` } })
                .then(res => res.json())
                .then(data => {
                    if (data.likedSongs) {
                        const initialPrefs = {};
                        data.likedSongs.forEach(id => { initialPrefs[id] = 'like'; });
                        setMusicPrefs(initialPrefs);
                    }
                })
                .catch(() => { });
        }
    }, [token]);

    const TAB_BAR_HEIGHT = (Platform.OS === 'ios' ? 88 : 65) + insets.bottom;

    const livePlayer = useVideoPlayer(null, (player) => {
        player.loop = false;
        player.staysActiveInBackground = true;
        player.showNowPlayingNotification = true;
    });

    const handleMusicAction = async (songId, action) => {
        if (action === 'listen' && !token) return;

        if (!token) {
            Toast.show({
                type: 'hotstarInfo',
                text1: 'Log in for personalization',
                position: 'top',
                topOffset: insets.top > 0 ? insets.top + 10 : 50,
                visibilityTime: 2500
            });
            return;
        }

        let finalAction = action;
        if (action === 'toggleLike') {
            finalAction = musicPrefs[songId] === 'like' ? 'removeLike' : 'like';
        }

        if (action !== 'listen') {
            setMusicPrefs(prev => ({ ...prev, [songId]: finalAction === 'removeLike' ? null : finalAction }));
        }

        try {
            await fetch(`${BACKEND_URL}/user/music/interact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ songId, action: finalAction })
            });

            if (finalAction === 'like') {
                Toast.show({ type: 'hotstarSuccess', text1: 'Saved to Liked Songs' });
            } else if (finalAction === 'dislike') {
                Toast.show({ type: 'hotstarSuccess', text1: 'We will recommend less of this' });
                handleNextTrack();
            }
        } catch (error) {
            console.error('Failed to register interaction:', error);
        }
    };

    useEffect(() => {
        if (type === 'music' && currentMusicIndex >= 0 && musicQueue[currentMusicIndex]) {
            handleMusicAction(musicQueue[currentMusicIndex].id, 'listen');
        }
    }, [currentMusicIndex, type, musicQueue]);

    const extendQueueIfNeeded = useCallback(async (index, queue) => {
        const thresholdIndex = Math.floor(queue.length * 0.70);

        if (queue.length < 5 || index < thresholdIndex || isFetchingQueue.current) return;

        const seed = queue[index];
        if (!seed) return;

        isFetchingQueue.current = true;

        try {
            let newTracks = [];
            if (token) {
                const res = await fetch(`${BACKEND_URL}/user/music/recommendations?seedSongId=${seed.id}&seedArtist=${encodeURIComponent(seed.artist)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const json = await res.json();

                if (json.data) {
                    newTracks = json.data.map(mapSaavnSong).filter(t => t.url);
                }
            } else {
                const searchQ = encodeURIComponent(seed.artist || 'Trending');
                const randomPage = Math.floor(Math.random() * 8) + 1;
                const json = await safeFetchJson(`/search/songs?query=${searchQ}&page=${randomPage}&limit=15`);

                if (json?.success && json.data?.results) {
                    newTracks = json.data.results.map(mapSaavnSong).filter(t => t.url);
                }
            }

            if (newTracks.length > 0) {
                setMusicQueue(prev => {
                    const existingNames = new Set(prev.map(t => normalizeString(t.title)));
                    const filteredTracks = newTracks.filter(s => {
                        const normName = normalizeString(s.title);
                        if (!s.url || existingNames.has(normName)) return false;
                        existingNames.add(normName);
                        return true;
                    });

                    const finalTracks = filteredTracks.slice(0, 10);
                    if (finalTracks.length === 0) return prev;

                    return [...prev, ...finalTracks];
                });
            }
        } catch (e) {
        } finally {
            isFetchingQueue.current = false;
        }
    }, [token]);

    const handleNextTrack = useCallback(() => {
        if (isShuffle) {
            setCurrentMusicIndex(Math.floor(Math.random() * musicQueue.length));
        } else if (currentMusicIndex < musicQueue.length - 1) {
            setCurrentMusicIndex(prev => prev + 1);
        } else if (loopMode === 1) { // Loop All
            setCurrentMusicIndex(0);
        } else {
            livePlayer.pause();
            setIsPlaying(false);
        }
    }, [isShuffle, loopMode, currentMusicIndex, musicQueue.length, livePlayer]);

    const handlePrevTrack = useCallback(() => {
        if (musicProgress > 3) {
            livePlayer.currentTime = 0;
        } else if (isShuffle) {
            setCurrentMusicIndex(Math.floor(Math.random() * musicQueue.length));
        } else if (currentMusicIndex > 0) {
            setCurrentMusicIndex(prev => prev - 1);
        } else if (loopMode === 1) { // Loop All
            setCurrentMusicIndex(musicQueue.length - 1);
        }
    }, [isShuffle, loopMode, currentMusicIndex, musicQueue.length, musicProgress, livePlayer]);

    useEffect(() => {
        if (type !== 'music' || currentMusicIndex < 0 || !musicQueue[currentMusicIndex]) return;

        const track = musicQueue[currentMusicIndex];

        if (playingTrackId.current === track.id) return;
        playingTrackId.current = track.id;

        extendQueueIfNeeded(currentMusicIndex, musicQueue);

        const requestId = ++playRequestId.current;

        if (!track.url) {
            console.warn('Track has no url, skipping:', track.title);
            handleNextTrack();
            return;
        }

        (async () => {
            try {
                setIsPlaying(false);
                setMusicProgress(0);
                await livePlayer.replaceAsync({
                    uri: track.url,
                    metadata: {
                        title: track.title,
                        artist: track.artist,
                        artwork: track.image,
                    },
                });
                if (requestId !== playRequestId.current) return;
                livePlayer.play();
                setIsPlaying(true);
            } catch (err) {
                if (requestId !== playRequestId.current) return;
                console.error('Failed to load track:', track.title, err?.message || err);
                setIsPlaying(false);
                Toast.show({ type: 'error', text1: `Couldn't play "${track.title}", skipping...` });
                handleNextTrack();
            }
        })();
    }, [currentMusicIndex, musicQueue, type, livePlayer, extendQueueIfNeeded]);

    useEffect(() => {
        if (type !== 'music') return;
        const interval = setInterval(() => {
            if (isPlaying && livePlayer) {
                setMusicProgress(livePlayer.currentTime);
                setMusicDuration(livePlayer.duration);
            }
        }, 1000);

        const sub = livePlayer.addListener('playToEnd', async () => {
            setIsPlaying(false);
            if (loopMode === 2) { // Loop One
                livePlayer.currentTime = 0;
                livePlayer.play();
                setIsPlaying(true);
            } else {
                handleNextTrack();
            }
        });

        return () => { clearInterval(interval); sub?.remove(); };
    }, [livePlayer, currentMusicIndex, musicQueue, isPlaying, type, loopMode, handleNextTrack]);

    const handleSeek = (event) => {
        if (barWidth > 0 && musicDuration > 0) {
            const tapX = event.nativeEvent.locationX;
            const percentage = Math.max(0, Math.min(1, tapX / barWidth));
            const newTime = percentage * musicDuration;
            livePlayer.currentTime = newTime;
            setMusicProgress(newTime);
        }
    };

    // Same seek behaviour, but scoped to the mini bar's own thin progress line.
    const handleMiniSeek = (event) => {
        if (miniBarWidth > 0 && musicDuration > 0) {
            const tapX = event.nativeEvent.locationX;
            const percentage = Math.max(0, Math.min(1, tapX / miniBarWidth));
            const newTime = percentage * musicDuration;
            livePlayer.currentTime = newTime;
            setMusicProgress(newTime);
        }
    };

    const resetControlsTimer = useCallback(() => {
        if (controlsTimer.current) clearTimeout(controlsTimer.current);
        setShowControls(true);
        Animated.timing(controlsFadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();

        controlsTimer.current = setTimeout(() => {
            Animated.timing(controlsFadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
                setShowControls(false);
            });
        }, 3000);
    }, [controlsFadeAnim]);

    useEffect(() => {
        resetControlsTimer();
        return () => {
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            if (controlsTimer.current) clearTimeout(controlsTimer.current);
        };
    }, [resetControlsTimer]);

    // Drives miniBarInteractive off the same scrollY driving the animation,
    // so taps on the docked bar only register once it's mostly visible.
    useEffect(() => {
        const id = scrollY.addListener(({ value }) => {
            const shouldBeInteractive = value > MINI_START + (MINI_PEAK - MINI_START) * 0.5;
            setMiniBarInteractive(prev => (prev !== shouldBeInteractive ? shouldBeInteractive : prev));
        });
        return () => scrollY.removeListener(id);
    }, [scrollY]);

    useEffect(() => {
        const fetchAllData = async () => {
            setIsLoading(true);
            try {
                if (type === 'music') {
                    setMediaDetails({ title: channelName || "Music Player", vote_average: 0 });

                    const initialTrack = {
                        id: ytId || 'init',
                        title: channelName || 'Unknown Song',
                        artist: 'Playing Now',
                        url: streamUrl,
                        image: artworkUrl || 'https://images.unsplash.com/photo-1614680376573-3e4e1ef41090?w=500&q=80'
                    };
                    setMusicQueue([initialTrack]);

                    try {
                        const searchQ = encodeURIComponent(channelName || 'Arijit Singh');
                        const json = await safeFetchJson(`/search/songs?query=${searchQ}`);

                        if (json?.success && json.data?.results) {
                            const fetchedTracks = json.data.results.map(mapSaavnSong).filter(t => t.url);

                            setMusicQueue(prev => {
                                const existingNames = new Set(prev.map(t => normalizeString(t.title)));
                                const filteredTracks = fetchedTracks.filter(s => {
                                    const normName = normalizeString(s.title);
                                    if (existingNames.has(normName)) return false;
                                    existingNames.add(normName);
                                    return true;
                                });
                                return [...prev, ...filteredTracks];
                            });
                        }
                    } catch (e) {
                    }

                    setIsLoading(false);
                    return;
                }

                if (streamUrl) {
                    setMediaDetails({ title: channelName || "Live TV Broadcast", overview: "Streaming live broadcast...", vote_average: 0 });
                    try {
                        await livePlayer.replaceAsync({
                            uri: streamUrl,
                            metadata: { title: channelName, artist: 'Live TV', artwork: artworkUrl },
                        });
                        livePlayer.play();
                        setHasStarted(true);
                        setIsPlaying(true);
                    } catch (err) {
                        console.error('Failed to load live stream:', err?.message || err);
                        Toast.show({ type: 'error', text1: 'Failed to load stream' });
                    }
                    setIsLoading(false);
                    return;
                }

                let videoTitle = "";

                if (ytId) {
                    setTrailerKey(ytId);
                    setIsPlaying(true);

                    if (ACTIVE_YT_KEYS.length > 0) {
                        try {
                            const urlTemplate = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ytId}&key=__API_KEY__`;
                            const videoData = await fetchYouTubeWithRetry(urlTemplate);

                            if (!videoData.error) {
                                const snippet = videoData.items?.[0]?.snippet;
                                if (snippet) {
                                    videoTitle = snippet.title;
                                    setMediaDetails({
                                        title: snippet.title, overview: "", vote_average: 0,
                                        spoken_languages: [{ english_name: snippet.channelTitle }], ytThumbnail: snippet.thumbnails?.high?.url
                                    });
                                }
                            }
                        } catch (e) { console.error(e); }
                    }
                    if (!videoTitle) setMediaDetails({ title: "YouTube Video", overview: "", vote_average: 0 });
                }

                if (id && type !== 'music') {
                    const [details, videos, similar, providers] = await Promise.all([
                        tmdbService.getDetails(id, type), tmdbService.getVideos(id, type),
                        tmdbService.getSimilar(id, type), tmdbService.getWatchProviders(id, type)
                    ]);

                    const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos.find(v => v.site === 'YouTube');
                    setTrailerKey(trailer ? trailer.key : null);
                    if (trailer) setIsPlaying(true);

                    setMediaDetails(details); setSimilarMedia(similar); setWatchProviders(providers);
                    videoTitle = details.title || details.name;
                    setIsVidkingAvailable(true);
                }

                if (id && type !== 'music' && !ytId && videoTitle && ACTIVE_YT_KEYS.length > 0) {
                    try {
                        const searchQuery = encodeURIComponent(`${videoTitle} official clip OR soundtrack OR song`);
                        const urlTemplate = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&maxResults=10&key=__API_KEY__`;
                        const ytData = await fetchYouTubeWithRetry(urlTemplate);
                        if (!ytData.error && ytData.items) setRelatedYtClips(ytData.items);
                    } catch (ytError) { console.error(ytError); }
                }

            } catch (error) {
                console.error("Failed to load player data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllData();
    }, [id, type, ytId, streamUrl]);

    const handleAuthAction = (actionCallback) => {
        if (!token) {
            Toast.show({
                type: 'hotstarInfo',
                text1: 'Log in for personalization',
                position: 'top',
                topOffset: insets.top > 0 ? insets.top + 10 : 50,
                visibilityTime: 2500
            });
        } else {
            actionCallback();
        }
    };

    const handleToggleAction = async (mediaId, mediaType, targetList) => {
        if (!mediaId || !mediaType) return;
        if (targetList === 'watchlist') toggleWatchlist(mediaId, mediaType);
        if (targetList === 'watched') toggleWatched(mediaId, mediaType);

        try {
            const tmdbIdWithType = `${mediaId}:${mediaType}`;
            const response = await fetch(`${BACKEND_URL}/user/${targetList}/toggle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ tmdbId: tmdbIdWithType })
            });

            if (!response.ok) throw new Error('Failed to update on server');

            const data = await response.json();
            const arrayToMap = (arr) => arr.reduce((acc, curr) => {
                const [idStr, typeStr] = String(curr).split(':');
                acc[idStr] = typeStr || 'movie';
                return acc;
            }, {});

            useUserListStore.setState({
                watchlist: arrayToMap(data.watchlist),
                watched: arrayToMap(data.watched)
            });

        } catch (error) {
            console.error('API Sync Error:', error);
            Toast.show({ type: 'error', text1: `Failed to save to ${targetList}` });
            if (targetList === 'watchlist') toggleWatchlist(mediaId, mediaType);
            if (targetList === 'watched') toggleWatched(mediaId, mediaType);
        }
    };

    const handleCreateWatchParty = () => {
        handleAuthAction(() => {
            const newRoomId = Math.floor(10000 + Math.random() * 90000).toString();
            let vidId = '';

            if (id && type && activeMediaView === 'movie') {
                vidId = type === 'tv'
                    ? `VIDKING:tv:${id}:${selectedSeason}:${selectedEpisode}`
                    : `VIDKING:movie:${id}`;
            } else {
                vidId = trailerKey || ytId;
            }

            setIsPlaying(false);

            router.push({
                pathname: '/theatre',
                params: {
                    roomId: newRoomId,
                    isHost: 'true',
                    initialYtId: vidId,
                    initialTitle: mediaDetails?.title || mediaDetails?.name || 'Watch Party'
                }
            });
        });
    };

    const toggleFullScreen = async () => {
        if (isFullScreen) {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            setIsFullScreen(false);
            resetControlsTimer();
        } else {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
            setIsFullScreen(true);
            resetControlsTimer();
        }
    };

    const handleBackPress = async () => {
        if (isFullScreen) {
            await toggleFullScreen();
        } else {
            router.back();
        }
    };

    const [lastTap, setLastTap] = useState(0);
    const handleDoubleTapLike = (songId) => {
        const now = Date.now();
        if (now - lastTap < 300) {
            handleMusicAction(songId, 'toggleLike');
        }
        setLastTap(now);
    };

    const panResponderMusic = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderRelease: (evt, gestureState) => {
            const { dx, dy } = gestureState;
            if (Math.abs(dx) > 60) {
                if (dx > 0) handlePrevTrack();
                else handleNextTrack();
            } else if (dy > 60) {
                router.back();
            } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
                if (musicQueue[currentMusicIndex]) handleDoubleTapLike(musicQueue[currentMusicIndex].id);
            }
        }
    }), [currentMusicIndex, musicQueue, lastTap, handleNextTrack, handlePrevTrack]);

    if (isLoading) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="large" color="#FF007A" />
                </View>
            </SafeAreaView>
        );
    }

    if (!mediaDetails) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: 'white' }}>Failed to load media details.</Text>
                    <TouchableOpacity onPress={handleBackPress} style={{ marginTop: 20 }}>
                        <Text style={{ color: '#00E5FF' }}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // ==========================================
    // 🎵 DEDICATED MUSIC PLAYER UI
    // ==========================================
    if (type === 'music') {
        const currentTrack = musicQueue[currentMusicIndex] || {};

        // 1. ANIMATION CONSTANTS
        const SCROLL_RANGE = 260; // Total scroll distance for the morph
        const ART_ORIG_SIZE = width * 0.75;
        const ART_TARGET_SIZE = 48;
        const ART_SCALE = ART_TARGET_SIZE / ART_ORIG_SIZE;

        // 2. PIN THE HERO SECTION
        // This exactly counteracts the scroll, freezing the hero container on screen.
        const pinnedTranslateY = scrollY;

        // 3. MORPH THE ALBUM ART
        const artScale = scrollY.interpolate({
            inputRange: [0, SCROLL_RANGE],
            outputRange: [1, ART_SCALE],
            extrapolate: 'clamp'
        });

        // Move to the top-left edge
        const artTranslateX = scrollY.interpolate({
            inputRange: [0, SCROLL_RANGE],
            outputRange: [0, -(width / 2) + (ART_TARGET_SIZE / 2) + 20],
            extrapolate: 'clamp'
        });

        // Move up to the header level
        const artTranslateY = scrollY.interpolate({
            inputRange: [0, SCROLL_RANGE],
            outputRange: [0, -(ART_ORIG_SIZE / 2) + 24],
            extrapolate: 'clamp'
        });

        // 4. FADE OUT FULL CONTROLS
        const heroOpacity = scrollY.interpolate({
            inputRange: [0, SCROLL_RANGE * 0.5],
            outputRange: [1, 0],
            extrapolate: 'clamp'
        });

        // 5. FADE IN MINI CONTROLS (Next to shrunk art)
        const miniOpacity = scrollY.interpolate({
            inputRange: [SCROLL_RANGE * 0.7, SCROLL_RANGE],
            outputRange: [0, 1],
            extrapolate: 'clamp'
        });

        // 6. HEADER BACKGROUND (Blocks playlist text from bleeding through)
        const headerBgOpacity = scrollY.interpolate({
            inputRange: [SCROLL_RANGE * 0.5, SCROLL_RANGE],
            outputRange: [0, 0.95],
            extrapolate: 'clamp'
        });

        return (
            <SafeAreaView style={styles.safeArea}>
                <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.container}>
                    <VideoView player={livePlayer} style={{ width: 0, height: 0, position: 'absolute' }} nativeControls={false} />

                    {/* FIXED TOP HEADER */}
                    <View style={styles.musicFixedHeader}>
                        <TouchableOpacity onPress={handleBackPress} style={{ padding: 10, zIndex: 30 }}>
                            <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
                        </TouchableOpacity>

                        <Animated.View style={{ alignItems: 'center', opacity: heroOpacity }}>
                            <Text style={styles.musicHeaderSubtitle}>NOW PLAYING</Text>
                            <Text style={styles.musicHeaderTitle} numberOfLines={1}>{currentTrack.title}</Text>
                        </Animated.View>
                        <View style={{ width: 48 }} />
                    </View>

                    <Animated.ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 40 }}
                        onScroll={Animated.event(
                            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                            { useNativeDriver: true }
                        )}
                        scrollEventThrottle={16}
                    >
                        {/* THE PINNED HERO WRAPPER */}
                        <Animated.View style={{ zIndex: 10, transform: [{ translateY: pinnedTranslateY }] }} {...panResponderMusic.panHandlers}>

                            {/* Solid background that fades in to hide the scrolling queue underneath */}
                            <Animated.View style={{
                                position: 'absolute', top: -100, left: 0, right: 0, height: 200,
                                backgroundColor: '#170D22',
                                opacity: headerBgOpacity,
                                borderBottomWidth: 1,
                                borderBottomColor: 'rgba(255,255,255,0.06)'
                            }} />

                            {/* ALBUM ART (Shrinks and moves into place) */}
                            <Animated.View style={[styles.albumArtContainer, { transform: [{ translateX: artTranslateX }, { translateY: artTranslateY }, { scale: artScale }] }]}>
                                <Image source={{ uri: currentTrack.image }} style={[styles.albumArt, { width: ART_ORIG_SIZE, height: ART_ORIG_SIZE }]} />
                            </Animated.View>

                            {/* DOCKED MINI CONTROLS (Fade in seamlessly next to the art) */}
                            <Animated.View
                                style={{
                                    position: 'absolute',
                                    top: 24, // Matches the new Y position of the shrunk art
                                    left: 80, // Sits exactly to the right of the 48px art
                                    right: 20,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    opacity: miniOpacity
                                }}
                                pointerEvents={miniBarInteractive ? 'auto' : 'none'}
                            >
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <Text style={styles.miniPlayerTitle} numberOfLines={1}>{currentTrack.title}</Text>
                                    <Text style={styles.miniPlayerArtist} numberOfLines={1}>{currentTrack.artist}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                                    <TouchableOpacity onPress={handlePrevTrack}>
                                        <Ionicons name="play-skip-back" size={24} color="#FFFFFF" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => { if (isPlaying) { livePlayer.pause(); setIsPlaying(false); } else { livePlayer.play(); setIsPlaying(true); } }}>
                                        <Ionicons name={isPlaying ? "pause" : "play"} size={28} color="#FFFFFF" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={handleNextTrack}>
                                        <Ionicons name="play-skip-forward" size={24} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </View>
                            </Animated.View>

                            {/* FULL HERO CONTROLS (Fade out to reveal the queue sliding up) */}
                            <Animated.View style={{ opacity: heroOpacity }}>
                                <View style={[styles.musicTrackInfo, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 }]}>
                                    <TouchableOpacity onPress={() => handleMusicAction(currentTrack.id, 'dislike')} style={{ padding: 10 }}>
                                        <Ionicons name="thumbs-down-outline" size={28} color="#8F98A0" />
                                    </TouchableOpacity>

                                    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 10 }}>
                                        <Text style={styles.musicLargeTitle} numberOfLines={1}>{currentTrack.title}</Text>
                                        <Text style={styles.musicLargeArtist} numberOfLines={1}>{currentTrack.artist}</Text>
                                    </View>

                                    <TouchableOpacity onPress={() => handleMusicAction(currentTrack.id, 'toggleLike')} style={{ padding: 10 }}>
                                        <Ionicons name={musicPrefs[currentTrack.id] === 'like' ? "heart" : "heart-outline"} size={28} color={musicPrefs[currentTrack.id] === 'like' ? "#FF007A" : "#FFF"} />
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
                                        <Ionicons name="play-skip-back" size={32} color={currentMusicIndex > 0 || isShuffle || loopMode === 1 ? "#FFFFFF" : "#555"} />
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.neonPlayWrapper} activeOpacity={0.8} onPress={() => { resetControlsTimer(); if (isPlaying) { livePlayer.pause(); setIsPlaying(false); } else { livePlayer.play(); setIsPlaying(true); } }}>
                                        <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradientPlayInner}>
                                            <Ionicons name={isPlaying ? "pause" : "play"} size={36} color="#FFFFFF" style={!isPlaying ? { marginLeft: 6 } : {}} />
                                        </LinearGradient>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={handleNextTrack} style={styles.skipBtn}>
                                        <Ionicons name="play-skip-forward" size={32} color={currentMusicIndex < musicQueue.length - 1 || isShuffle || loopMode === 1 ? "#FFFFFF" : "#555"} />
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => setLoopMode((prev) => (prev + 1) % 3)} style={{ padding: 10, position: 'relative' }}>
                                        <Ionicons name="repeat" size={24} color={loopMode !== 0 ? "#00E5FF" : "#8F98A0"} />
                                        {loopMode === 2 && <Text style={{ position: 'absolute', fontSize: 10, color: '#00E5FF', top: 10, right: 6, fontWeight: 'bold' }}>1</Text>}
                                    </TouchableOpacity>
                                </View>
                            </Animated.View>
                        </Animated.View>

                        {/* PLAYLIST (Naturally slides up under the pinned header) */}
                        <View style={styles.queueContainer}>
                            <Text style={styles.queueTitle}>Playlist</Text>
                            {musicQueue.map((track, index) => {
                                const isActive = index === currentMusicIndex;
                                return (
                                    <TouchableOpacity
                                        key={track.id + index}
                                        style={[styles.queueItem, isActive && { borderColor: '#00E5FF', backgroundColor: 'rgba(0, 229, 255, 0.1)' }]}
                                        onPress={() => setCurrentMusicIndex(index)}
                                    >
                                        <Image source={{ uri: track.image }} style={styles.queueImage} />
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
                </LinearGradient>
            </SafeAreaView>
        );
    }

    // ==========================================
    // 🎬 STANDARD VIDEO / TV PLAYER UI
    // ==========================================
    const title = mediaDetails.title || mediaDetails.name;
    const year = (mediaDetails.release_date || mediaDetails.first_air_date || '').substring(0, 4);
    const languages = mediaDetails.spoken_languages?.map(lang => lang.english_name).join(', ') || 'Unknown';
    const isCurrentInWatchlist = watchlist[id];
    const isCurrentInWatched = watched[id];
    const streamingPlatforms = watchProviders?.flatrate || [];

    const tvSeasons = mediaDetails?.seasons?.filter(s => s.season_number > 0) || [];
    const currentSeasonData = tvSeasons.find(s => s.season_number === selectedSeason) || tvSeasons[0];
    const episodeCount = currentSeasonData?.episode_count || 1;
    const episodesArray = Array.from({ length: episodeCount }, (_, i) => i + 1);

    const actualWidth = Math.max(width, height);
    const actualHeight = Math.min(width, height);

    const containerWidth = isFullScreen ? actualWidth : width;
    const containerHeight = isFullScreen ? actualHeight : width * (9 / 16);
    const innerVideoWidth = isFullScreen ? actualHeight * (16 / 9) : width;
    const innerVideoHeight = isFullScreen ? actualHeight : width * (9 / 16);

    return (
        <SafeAreaView style={styles.safeArea} edges={isFullScreen ? [] : ['top', 'left', 'right']}>
            <View style={styles.container}>
                <StatusBar hidden={isFullScreen} showHideTransition="slide" barStyle="light-content" backgroundColor="#000" translucent={false} />

                <View style={[
                    styles.playerContainer,
                    { width: containerWidth, height: containerHeight },
                    isFullScreen && {
                        position: 'absolute', top: 0, left: 0, zIndex: 9999, elevation: 9999,
                        backgroundColor: '#000', justifyContent: 'center', alignItems: 'center'
                    }
                ]}>
                    <View
                        style={{ width: innerVideoWidth, height: innerVideoHeight, backgroundColor: '#000', position: 'relative' }}
                        onStartShouldSetResponderCapture={() => {
                            resetControlsTimer();
                            return false;
                        }}
                    >
                        {streamUrl ? (
                            <>
                                <VideoView
                                    player={livePlayer}
                                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                                    contentFit="contain"
                                    nativeControls={false}
                                />

                                <TouchableOpacity
                                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5 }}
                                    activeOpacity={1}
                                    onPress={resetControlsTimer}
                                />

                                <Animated.View
                                    style={[styles.liveStreamOverlay, { opacity: controlsFadeAnim }]}
                                    pointerEvents={showControls ? 'box-none' : 'none'}
                                >
                                    <View style={styles.liveBadgeContainer}>
                                        <View style={styles.liveDot} />
                                        <Text style={styles.liveBadgeText}>LIVE</Text>
                                    </View>

                                    <TouchableOpacity
                                        style={styles.gradientPlayWrapper}
                                        activeOpacity={0.8}
                                        onPress={() => {
                                            resetControlsTimer();
                                            if (isPlaying) { livePlayer.pause(); setIsPlaying(false); }
                                            else { livePlayer.play(); setIsPlaying(true); }
                                        }}
                                    >
                                        <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradientPlayInner}>
                                            <Ionicons name={isPlaying ? "pause" : "play"} size={24} color="#FFFFFF" style={!isPlaying ? { marginLeft: 4 } : {}} />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </Animated.View>
                            </>
                        ) : activeMediaView === 'movie' ? (
                            <WebView
                                key={`vidking-${selectedSeason}-${selectedEpisode}`}
                                source={{ uri: type === 'tv' ? `https://www.vidking.net/embed/tv/${id}/${selectedSeason}/${selectedEpisode}?autoPlay=true` : `https://www.vidking.net/embed/movie/${id}?autoPlay=true` }}
                                style={{ flex: 1, backgroundColor: '#000' }}
                                javaScriptEnabled={true}
                                allowsFullscreenVideo={false}
                                mediaPlaybackRequiresUserAction={false}
                                allowsInlineMediaPlayback={true}
                                setSupportMultipleWindows={false}
                                onMessage={(event) => {
                                    try {
                                        const data = JSON.parse(event.nativeEvent.data);
                                        if (data.type === 'USER_TOUCH' && isFullScreen) resetControlsTimer();
                                    } catch (e) { }
                                }}
                                onShouldStartLoadWithRequest={(request) => {
                                    if (!request.url.includes('vidking.net') && !request.url.includes('about:blank')) return false;
                                    return true;
                                }}
                                injectedJavaScript={`
                                    window.open = function() { return null; };
                                    const style = document.createElement('style');
                                    style.innerHTML = 'iframe[src*="ads"], .ad-overlay, .jw-ad, .jw-icon-fullscreen, .vjs-fullscreen-control, [aria-label="Fullscreen"], [title="Fullscreen"] { display: none !important; }';
                                    document.head.appendChild(style);

                                    const triggerPlay = () => {
                                        const v = document.querySelector('video');
                                        if (v) v.play().catch(() => {});
                                        const playBtn = document.querySelector('.play-btn, .jw-display-icon-container, [aria-label="Play"]');
                                        if (playBtn) playBtn.click();
                                    };
                                    setTimeout(triggerPlay, 400); setTimeout(triggerPlay, 1200); setTimeout(triggerPlay, 2500);

                                    ['click', 'touchstart'].forEach(evt => {
                                        document.addEventListener(evt, () => {
                                            if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'USER_TOUCH' }));
                                        }, { passive: true });
                                    });
                                    true;
                                `}
                            />
                        ) : trailerKey ? (
                            <YoutubePlayer
                                height={innerVideoHeight} width={innerVideoWidth}
                                play={isPlaying} videoId={trailerKey}
                                onReady={() => setIsPlaying(true)}
                                webViewProps={{ allowsFullscreenVideo: false, mediaPlaybackRequiresUserAction: false, allowsInlineMediaPlayback: true }}
                                initialPlayerParams={{ controls: 1, modestbranding: 1, rel: 0, iv_load_policy: 3, fs: 0, autoplay: 1 }}
                                onChangeState={(state) => {
                                    if (state === 'playing') { setIsPlaying(true); setHasStarted(true); }
                                    if (state === 'paused' || state === 'ended') setIsPlaying(false);
                                }}
                            />
                        ) : (
                            <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]}>
                                {(mediaDetails.backdrop_path || mediaDetails.ytThumbnail) && (
                                    <Image source={{ uri: mediaDetails.backdrop_path ? getImageUrl(mediaDetails.backdrop_path, 'original') : mediaDetails.ytThumbnail }} style={styles.videoThumbnail} />
                                )}
                                <View style={styles.playerOverlay}>
                                    <Text style={styles.noTrailerText}>No Video Available</Text>
                                </View>
                            </View>
                        )}

                        {isFullScreen && (
                            <Animated.View style={[styles.fullscreenExitBtn, { opacity: controlsFadeAnim }]} pointerEvents={showControls ? 'auto' : 'none'}>
                                <TouchableOpacity onPress={handleBackPress} activeOpacity={0.7}>
                                    <Ionicons name="close" size={26} color="#FFFFFF" />
                                </TouchableOpacity>
                            </Animated.View>
                        )}
                    </View>
                </View>

                {!isFullScreen && (
                    <View style={styles.externalControlBar}>
                        <View style={styles.externalLeftControls}>
                            <TouchableOpacity onPress={handleBackPress} style={styles.externalBtn}>
                                <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={toggleFullScreen} style={styles.externalBtn}>
                                <Ionicons name="expand" size={22} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <View style={{ flex: 1, paddingLeft: 12 }}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.externalRightControls} bounces={false}>
                                {id && !streamUrl && (
                                    <>
                                        <TouchableOpacity onPress={() => handleAuthAction(() => handleToggleAction(id, type, 'watchlist'))} style={styles.externalBtn}>
                                            <Ionicons name={isCurrentInWatchlist ? "bookmark" : "bookmark-outline"} size={20} color={isCurrentInWatchlist ? "#F5C518" : "#FFFFFF"} />
                                            <Text style={[styles.externalBtnText, isCurrentInWatchlist && { color: '#F5C518' }]}>Save</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleAuthAction(() => handleToggleAction(id, type, 'watched'))} style={styles.externalBtn}>
                                            <Ionicons name="checkmark-done" size={20} color={isCurrentInWatched ? "#1F80E0" : "#FFFFFF"} />
                                            <Text style={[styles.externalBtnText, isCurrentInWatched && { color: '#1F80E0' }]}>Watched</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </ScrollView>
                        </View>
                    </View>
                )}

                <ScrollView style={{ display: isFullScreen ? 'none' : 'flex' }} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_HEIGHT + 20 }]}>
                    <View style={styles.detailsContainer}>
                        <Text style={styles.mediaTitle}>{title}</Text>

                        {!streamUrl && (
                            ytId ? (
                                <TouchableOpacity style={styles.watchToggleBtn} activeOpacity={0.8} onPress={handleCreateWatchParty}>
                                    <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.watchToggleGradient}>
                                        <Ionicons name="people-circle" size={24} color="#FFF" style={{ marginRight: 8 }} />
                                        <Text style={styles.watchToggleText}>Start YouTube Watch Party</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={styles.watchToggleBtn} activeOpacity={0.8} disabled={activeMediaView === 'trailer' && isVidkingAvailable === false}
                                    onPress={() => {
                                        if (activeMediaView === 'trailer') setIsPlaying(false);
                                        setActiveMediaView(prev => prev === 'trailer' ? 'movie' : 'trailer');
                                    }}
                                >
                                    <LinearGradient colors={activeMediaView === 'movie' ? ['#2A2A30', '#2A2A30'] : isVidkingAvailable === false ? ['#2A2A30', '#2A2A30'] : ['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.watchToggleGradient}>
                                        {isVidkingAvailable === null ? (
                                            <Text style={styles.watchToggleText}>Checking availability...</Text>
                                        ) : activeMediaView === 'movie' ? (
                                            <>
                                                <Ionicons name="logo-youtube" size={20} color="#FFF" style={{ marginRight: 8 }} />
                                                <Text style={styles.watchToggleText}>Show Trailer</Text>
                                            </>
                                        ) : (
                                            <>
                                                <Ionicons name={isVidkingAvailable ? "play" : "close-circle"} size={20} color="#FFF" style={{ marginRight: 8 }} />
                                                <Text style={styles.watchToggleText}>{isVidkingAvailable ? (type === 'tv' ? 'Watch Show' : 'Watch Movie') : (type === 'tv' ? 'Show Not Available' : 'Movie Not Available')}</Text>
                                            </>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            )
                        )}

                        {/* TV SHOW SEASON & EPISODE SELECTORS */}
                        {activeMediaView === 'movie' && type === 'tv' && tvSeasons.length > 0 && !streamUrl && (
                            <View style={styles.tvControlsContainer}>
                                <Text style={styles.tvControlsLabel}>Select Season</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tvControlsRow}>
                                    {tvSeasons.map((season) => (
                                        <TouchableOpacity key={`season-${season.season_number}`} style={[styles.tvChip, selectedSeason === season.season_number && styles.tvChipActive]} onPress={() => { setSelectedSeason(season.season_number); setSelectedEpisode(1); }}>
                                            <Text style={[styles.tvChipText, selectedSeason === season.season_number && styles.tvChipTextActive]}>Season {season.season_number}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                <Text style={styles.tvControlsLabel}>Select Episode</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tvControlsRow}>
                                    {episodesArray.map((ep) => (
                                        <TouchableOpacity key={`ep-${ep}`} style={[styles.tvChip, selectedEpisode === ep && styles.tvChipActive]} onPress={() => setSelectedEpisode(ep)}>
                                            <Text style={[styles.tvChipText, selectedEpisode === ep && styles.tvChipTextActive]}>Episode {ep}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* WATCH PARTY BUTTON FOR MOVIES & TV SHOWS */}
                        {activeMediaView === 'movie' && !streamUrl && !ytId && isVidkingAvailable && (
                            <TouchableOpacity style={styles.watchToggleBtn} activeOpacity={0.8} onPress={handleCreateWatchParty}>
                                <LinearGradient colors={['#00E5FF', '#9B51E0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.watchToggleGradient}>
                                    <Ionicons name="people-circle" size={24} color="#FFF" style={{ marginRight: 8 }} />
                                    <Text style={styles.watchToggleText}>Start Watch Party</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        )}

                        <View style={styles.metaRow}>
                            {year ? <Text style={styles.metaText}>{year}</Text> : null}
                            {year && languages ? <Text style={styles.metaDot}>•</Text> : null}
                            <Text style={styles.metaText}>{languages !== 'Unknown' ? languages : ''}</Text>
                            {mediaDetails.vote_average > 0 && (
                                <>
                                    <Text style={styles.metaDot}>•</Text>
                                    <View style={styles.ratingBadge}>
                                        <Ionicons name="star" size={12} color="#F5C518" />
                                        <Text style={styles.ratingText}>{mediaDetails.vote_average?.toFixed(1)}</Text>
                                    </View>
                                </>
                            )}
                        </View>
                        {mediaDetails.overview ? <Text style={styles.overviewText}>{mediaDetails.overview}</Text> : null}
                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#000' },
    container: { flex: 1, backgroundColor: '#0A0A0C' },
    scrollContent: {},
    playerContainer: { position: 'relative', backgroundColor: '#000' },
    videoThumbnail: { width: '100%', height: '100%', position: 'absolute' },
    playerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
    noTrailerText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 8 },
    fullscreenExitBtn: { position: 'absolute', top: 20, left: 20, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.7)', padding: 8, borderRadius: 20 },
    externalControlBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#14141A', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
    externalLeftControls: { flexDirection: 'row', gap: 12 },
    externalRightControls: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    externalBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    externalBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
    detailsContainer: { paddingHorizontal: 16, paddingTop: 20 },
    mediaTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold', marginBottom: 8 },
    watchToggleBtn: { marginTop: 4, marginBottom: 16, borderRadius: 10, overflow: 'hidden' },
    watchToggleGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
    watchToggleText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    tvControlsContainer: { marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    tvControlsLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold', marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
    tvControlsRow: { gap: 10, paddingBottom: 6 },
    tvChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    tvChipActive: { backgroundColor: 'rgba(0, 229, 255, 0.15)', borderColor: '#00E5FF' },
    tvChipText: { color: '#8F98A0', fontSize: 13, fontWeight: '600' },
    tvChipTextActive: { color: '#00E5FF', fontWeight: 'bold' },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    metaText: { color: '#A0A0A5', fontSize: 14, fontWeight: '600' },
    metaDot: { color: '#A0A0A5', fontSize: 14, marginHorizontal: 8 },
    ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 197, 24, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    ratingText: { color: '#F5C518', fontSize: 13, fontWeight: 'bold', marginLeft: 4 },
    overviewText: { color: '#D0D0D5', fontSize: 15, lineHeight: 22, marginTop: 8 },
    liveStreamOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.15)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    liveBadgeContainer: { position: 'absolute', top: 20, left: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 0, 122, 0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255, 0, 122, 0.5)' },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF007A', marginRight: 6 },
    liveBadgeText: { color: '#FF007A', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    gradientPlayWrapper: { width: 56, height: 56, borderRadius: 28, elevation: 8, shadowColor: '#FF007A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8 },
    gradientPlayInner: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 28 },
    musicFixedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, zIndex: 10 },
    musicHeaderSubtitle: { color: '#8F98A0', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 4 },
    musicHeaderTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', maxWidth: 250, textAlign: 'center' },

    // --- Docked mini player bar ---
    miniPlayerBar: {
        position: 'absolute',
        top: 62, // sits directly under musicFixedHeader
        left: 0,
        right: 0,
        zIndex: 20,
        backgroundColor: 'rgba(10, 8, 14, 0.92)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
        paddingBottom: 6,
    },
    miniPlayerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
    miniPlayerArt: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#2A2A30' },
    miniPlayerTextWrap: { flex: 1, marginLeft: 12, marginRight: 8 },
    miniPlayerTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
    miniPlayerArtist: { color: '#8F98A0', fontSize: 12, marginTop: 2 },
    miniPlayerBtn: { paddingHorizontal: 6, paddingVertical: 4 },
    miniProgressTouchArea: { height: 14, justifyContent: 'center', paddingHorizontal: 16 },
    miniProgressBg: { height: 3, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2 },
    miniProgressFill: { height: '100%', borderRadius: 2 },

    albumArtContainer: { alignItems: 'center', marginTop: 20, marginBottom: 40, shadowColor: '#00E5FF', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 15 },
    albumArt: { borderRadius: 20, backgroundColor: '#1E1428' },
    musicTrackInfo: { marginBottom: 30 },
    musicLargeTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    musicLargeArtist: { color: '#00E5FF', fontSize: 16, fontWeight: '600', textAlign: 'center' },
    musicControlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 40 },
    skipBtn: { padding: 10 },
    neonPlayWrapper: { width: 76, height: 76, borderRadius: 38, elevation: 10, shadowColor: '#FF007A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.6, shadowRadius: 12 },
    neonPlayInner: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 38 },
    queueContainer: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    queueTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    queueItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16161A', padding: 10, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    queueImage: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#2A2A30' },
    queueInfo: { flex: 1, marginLeft: 12, marginRight: 10 },
    queueTrackTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
    queueTrackArtist: { color: '#8F98A0', fontSize: 12 },
    seekContainer: { paddingHorizontal: 30, marginBottom: 20 },
    progressBarTouchArea: { height: 30, justifyContent: 'center' },
    progressBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, position: 'relative' },
    progressBarFill: { height: '100%', borderRadius: 3 },
    progressKnob: { position: 'absolute', top: -5, width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF', elevation: 4, transform: [{ translateX: -8 }] },
    timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    timeText: { color: '#8F98A0', fontSize: 12, fontWeight: '600' }
});