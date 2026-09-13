import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    Image,
    FlatList,
    StatusBar,
    ActivityIndicator,
    useWindowDimensions,
    Platform,
    Animated
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import YoutubePlayer from 'react-native-youtube-iframe';
import * as ScreenOrientation from 'expo-screen-orientation';
import { WebView } from 'react-native-webview';

// --- NEW: expo-video for Live TV Streams ---
import { useVideoPlayer, VideoView } from 'expo-video';

// --- Global State & Config ---
import { tmdbService } from '../services/tmdbService';
import { getImageUrl } from '../constants/config';
import { useUserListStore } from '../store/useUserListStore';
import { useAuthStore } from '../store/useAuthStore';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

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

export default function PlayerScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();

    const { id, type, ytId, streamUrl, channelName } = useLocalSearchParams();

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

    // --- Unified Auto-Hide UI State & Anim ---
    const [showControls, setShowControls] = useState(true);
    const controlsFadeAnim = useRef(new Animated.Value(1)).current;
    const controlsTimer = useRef(null);

    const { watchlist, watched, toggleWatchlist, toggleWatched } = useUserListStore();
    const { token } = useAuthStore();

    const TAB_BAR_HEIGHT = (Platform.OS === 'ios' ? 88 : 65) + insets.bottom;

    const livePlayer = useVideoPlayer(streamUrl || null, (player) => {
        if (streamUrl) {
            player.play();
        }
    });

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

    useEffect(() => {
        if (id && type && !ytId && !streamUrl) {
            const checkVidking = async () => {
                try {
                    const url = type === 'tv'
                        ? `https://www.vidking.net/embed/tv/${id}/1/1`
                        : `https://www.vidking.net/embed/movie/${id}`;

                    const res = await fetch(url);
                    const text = await res.text();

                    if (res.status === 404 || text.includes('404 Not Found') || text.includes('Movie not found')) {
                        setIsVidkingAvailable(false);
                    } else {
                        setIsVidkingAvailable(true);
                    }
                } catch (error) {
                    setIsVidkingAvailable(false);
                }
            };
            checkVidking();
        }
    }, [id, type, ytId, streamUrl]);

    useEffect(() => {
        if (!id && !ytId && !streamUrl) return;

        const fetchAllData = async () => {
            setIsLoading(true);
            try {
                if (streamUrl) {
                    setMediaDetails({
                        title: channelName || "Live TV Broadcast",
                        overview: "Streaming live broadcast...",
                        vote_average: 0
                    });
                    setHasStarted(true);
                    setIsPlaying(true);
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
                                        title: snippet.title,
                                        overview: "",
                                        vote_average: 0,
                                        spoken_languages: [{ english_name: snippet.channelTitle }],
                                        ytThumbnail: snippet.thumbnails?.high?.url
                                    });
                                }
                            }
                        } catch (e) {
                            console.error("Failed to fetch YT video details:", e);
                        }
                    }
                    if (!videoTitle) {
                        setMediaDetails({ title: "YouTube Video", overview: "", vote_average: 0 });
                    }
                }

                if (id && type) {
                    const [details, videos, similar, providers] = await Promise.all([
                        tmdbService.getDetails(id, type),
                        tmdbService.getVideos(id, type),
                        tmdbService.getSimilar(id, type),
                        tmdbService.getWatchProviders(id, type)
                    ]);

                    const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube')
                        || videos.find(v => v.site === 'YouTube');

                    setTrailerKey(trailer ? trailer.key : null);

                    if (trailer) {
                        setIsPlaying(true); // Automatically trigger playback on load
                    }

                    setMediaDetails(details);
                    setSimilarMedia(similar);
                    setWatchProviders(providers);

                    videoTitle = details.title || details.name;
                }

                if (id && type && !ytId && videoTitle && ACTIVE_YT_KEYS.length > 0) {
                    try {
                        const searchQuery = encodeURIComponent(`${videoTitle} official clip OR soundtrack OR song`);
                        const urlTemplate = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&maxResults=10&key=__API_KEY__`;
                        const ytData = await fetchYouTubeWithRetry(urlTemplate);

                        if (!ytData.error && ytData.items) {
                            setRelatedYtClips(ytData.items);
                        }
                    } catch (ytError) {
                        console.error("Failed to fetch YT clips:", ytError);
                    }
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

            if (id && type) {
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

    if (isLoading) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="large" color="#1F80E0" />
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
                        <Text style={{ color: '#1F80E0' }}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

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
                            // --- 1. LIVE TV STREAM WITH PERFECT OVERLAP AND AUTO-HIDE UI ---
                            <>
                                <VideoView
                                    player={livePlayer}
                                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                                    contentFit="contain"
                                    nativeControls={false}
                                />

                                {/* Custom Gradient Controls Overlay */}
                                <Animated.View
                                    style={[styles.liveStreamOverlay, { opacity: controlsFadeAnim }]}
                                    pointerEvents={showControls ? 'box-none' : 'none'}
                                >
                                    {/* Live Badge Top Left */}
                                    <View style={styles.liveBadgeContainer}>
                                        <View style={styles.liveDot} />
                                        <Text style={styles.liveBadgeText}>LIVE</Text>
                                    </View>

                                    {/* Gradient Play/Pause Button perfectly centered */}
                                    <TouchableOpacity
                                        style={styles.gradientPlayWrapper}
                                        activeOpacity={0.8}
                                        onPress={() => {
                                            resetControlsTimer();
                                            if (isPlaying) {
                                                livePlayer.pause();
                                                setIsPlaying(false);
                                            } else {
                                                livePlayer.play();
                                                setIsPlaying(true);
                                            }
                                        }}
                                    >
                                        <LinearGradient
                                            colors={['#00E5FF', '#9B51E0', '#FF007A']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.gradientPlayInner}
                                        >
                                            <Ionicons
                                                name={isPlaying ? "pause" : "play"}
                                                size={24}
                                                color="#FFFFFF"
                                                style={!isPlaying ? { marginLeft: 4 } : {}}
                                            />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </Animated.View>
                            </>
                        ) : activeMediaView === 'movie' ? (
                            // --- 2. VIDKING MOVIES (WebView) ---
                            <WebView
                                key={`vidking-${selectedSeason}-${selectedEpisode}`}
                                source={{
                                    uri: type === 'tv'
                                        ? `https://www.vidking.net/embed/tv/${id}/${selectedSeason}/${selectedEpisode}?autoPlay=true`
                                        : `https://www.vidking.net/embed/movie/${id}?autoPlay=true`
                                }}
                                style={{ flex: 1, backgroundColor: '#000' }}
                                javaScriptEnabled={true}
                                allowsFullscreenVideo={false}
                                mediaPlaybackRequiresUserAction={false}
                                allowsInlineMediaPlayback={true}
                                setSupportMultipleWindows={false}
                                onMessage={(event) => {
                                    try {
                                        const data = JSON.parse(event.nativeEvent.data);
                                        if (data.type === 'USER_TOUCH' && isFullScreen) {
                                            resetControlsTimer();
                                        }
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
                                    setTimeout(triggerPlay, 400);
                                    setTimeout(triggerPlay, 1200);
                                    setTimeout(triggerPlay, 2500);

                                    ['click', 'touchstart'].forEach(evt => {
                                        document.addEventListener(evt, () => {
                                            if (window.ReactNativeWebView) {
                                                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'USER_TOUCH' }));
                                            }
                                        }, { passive: true });
                                    });
                                    true;
                                `}
                            />
                        ) : trailerKey ? (
                            // --- 3. YOUTUBE TRAILERS (Iframe directly with no overlay) ---
                            <YoutubePlayer
                                height={innerVideoHeight}
                                width={innerVideoWidth}
                                play={isPlaying}
                                videoId={trailerKey}
                                onReady={() => setIsPlaying(true)}
                                webViewProps={{ allowsFullscreenVideo: false, mediaPlaybackRequiresUserAction: false, allowsInlineMediaPlayback: true }}
                                initialPlayerParams={{ controls: 1, modestbranding: 1, rel: 0, iv_load_policy: 3, fs: 0, autoplay: 1 }}
                                onChangeState={(state) => {
                                    if (state === 'playing') {
                                        setIsPlaying(true);
                                        setHasStarted(true);
                                    }
                                    if (state === 'paused' || state === 'ended') setIsPlaying(false);
                                }}
                            />
                        ) : (
                            // --- 4. NO VIDEO AVAILABLE FALLBACK ---
                            <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]}>
                                {(mediaDetails.backdrop_path || mediaDetails.ytThumbnail) && (
                                    <Image
                                        source={{
                                            uri: mediaDetails.backdrop_path
                                                ? getImageUrl(mediaDetails.backdrop_path, 'original')
                                                : mediaDetails.ytThumbnail
                                        }}
                                        style={styles.videoThumbnail}
                                    />
                                )}
                                <View style={styles.playerOverlay}>
                                    <Text style={styles.noTrailerText}>No Video Available</Text>
                                </View>
                            </View>
                        )}

                        {/* Fullscreen Close Button tied to the same Auto-Hide animation */}
                        {isFullScreen && (
                            <Animated.View
                                style={[styles.fullscreenExitBtn, { opacity: controlsFadeAnim }]}
                                pointerEvents={showControls ? 'auto' : 'none'}
                            >
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
                                        {/* Watch Party button specifically injected for Movie/TV Cards */}
                                        <TouchableOpacity onPress={handleCreateWatchParty} style={[styles.externalBtn, { borderColor: '#00E5FF', borderWidth: 1, backgroundColor: 'rgba(0, 229, 255, 0.1)' }]}>
                                            <Ionicons name="people-circle" size={18} color="#00E5FF" />
                                            <Text style={[styles.externalBtnText, { color: '#00E5FF' }]}>Watch Party</Text>
                                        </TouchableOpacity>
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

                <ScrollView
                    style={{ display: isFullScreen ? 'none' : 'flex' }}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_HEIGHT + 20 }]}
                >
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
                                    style={styles.watchToggleBtn}
                                    activeOpacity={0.8}
                                    disabled={activeMediaView === 'trailer' && isVidkingAvailable === false}
                                    onPress={() => {
                                        if (activeMediaView === 'trailer') setIsPlaying(false);
                                        setActiveMediaView(prev => prev === 'trailer' ? 'movie' : 'trailer');
                                    }}
                                >
                                    <LinearGradient
                                        colors={activeMediaView === 'movie' ? ['#2A2A30', '#2A2A30'] : isVidkingAvailable === false ? ['#2A2A30', '#2A2A30'] : ['#00E5FF', '#9B51E0', '#FF007A']}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.watchToggleGradient}
                                    >
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
                                                <Text style={styles.watchToggleText}>
                                                    {isVidkingAvailable ? (type === 'tv' ? 'Watch Show' : 'Watch Movie') : (type === 'tv' ? 'Show Not Available' : 'Movie Not Available')}
                                                </Text>
                                            </>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            )
                        )}

                        {activeMediaView === 'movie' && type === 'tv' && tvSeasons.length > 0 && !streamUrl && (
                            <View style={styles.tvControlsContainer}>
                                <Text style={styles.tvControlsLabel}>Select Season</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tvControlsRow}>
                                    {tvSeasons.map((season) => (
                                        <TouchableOpacity
                                            key={`season-${season.season_number}`}
                                            style={[styles.tvChip, selectedSeason === season.season_number && styles.tvChipActive]}
                                            onPress={() => {
                                                setSelectedSeason(season.season_number);
                                                setSelectedEpisode(1);
                                            }}
                                        >
                                            <Text style={[styles.tvChipText, selectedSeason === season.season_number && styles.tvChipTextActive]}>
                                                Season {season.season_number}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                <Text style={styles.tvControlsLabel}>Select Episode</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tvControlsRow}>
                                    {episodesArray.map((ep) => (
                                        <TouchableOpacity
                                            key={`ep-${ep}`}
                                            style={[styles.tvChip, selectedEpisode === ep && styles.tvChipActive]}
                                            onPress={() => setSelectedEpisode(ep)}
                                        >
                                            <Text style={[styles.tvChipText, selectedEpisode === ep && styles.tvChipTextActive]}>
                                                Episode {ep}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
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

                        {streamingPlatforms.length > 0 && !streamUrl && (
                            <View style={styles.providersContainer}>
                                <Text style={styles.providersTitle}>Available to Stream on:</Text>
                                <View style={styles.providerIconsRow}>
                                    {streamingPlatforms.map(provider => (
                                        <Image
                                            key={provider.provider_id}
                                            source={{ uri: getImageUrl(provider.logo_path, 'w92') }}
                                            style={styles.providerLogo}
                                        />
                                    ))}
                                </View>
                            </View>
                        )}

                        {mediaDetails.overview ? (
                            <Text style={styles.overviewText}>{mediaDetails.overview}</Text>
                        ) : null}
                    </View>

                    {!ytId && !streamUrl && relatedYtClips.length > 0 && (
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>Related on YouTube</Text>
                            <FlatList
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                data={relatedYtClips}
                                keyExtractor={(item, index) => item.id?.videoId || index.toString()}
                                contentContainerStyle={styles.listContent}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.ytCard}
                                        activeOpacity={0.7}
                                        onPress={() => {
                                            setActiveMediaView('trailer');
                                            setTrailerKey(item.id.videoId);
                                            setHasStarted(false);
                                            setIsPlaying(true);
                                        }}
                                    >
                                        <Image source={{ uri: item.snippet?.thumbnails?.medium?.url }} style={styles.ytCardImage} />
                                        <View style={styles.ytPlayIconOverlay}>
                                            <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.8)" />
                                        </View>
                                        <Text style={styles.ytCardTitle} numberOfLines={2}>{item.snippet?.title}</Text>
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    )}

                    {!streamUrl && similarMedia.length > 0 && (
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>More Like This</Text>
                            <FlatList
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                data={similarMedia}
                                extraData={{ watchlist, watched }}
                                keyExtractor={(item) => item.id.toString()}
                                contentContainerStyle={styles.listContent}
                                renderItem={({ item }) => {
                                    const inWatchlist = watchlist[item.id];
                                    const inWatched = watched[item.id];
                                    const simType = item.media_type || type;

                                    return (
                                        <TouchableOpacity
                                            style={styles.standardCard}
                                            activeOpacity={0.7}
                                            onPress={() => router.push({ pathname: '/player', params: { id: item.id, type: simType } })}
                                        >
                                            <Image source={{ uri: getImageUrl(item.poster_path) }} style={styles.cardImage} />
                                            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.cardBottomGradient} />
                                            <View style={styles.translucentRatingBadge}>
                                                <Ionicons name="star" size={10} color="#F5C518" />
                                                <Text style={styles.smallCardRatingText}>{item.vote_average?.toFixed(1) || 'NR'}</Text>
                                            </View>
                                            <View style={styles.smallCardActions}>
                                                <TouchableOpacity style={styles.smallIconBtn} onPress={() => handleAuthAction(() => handleToggleAction(item.id, simType, 'watchlist'))}>
                                                    <Ionicons name={inWatchlist ? "bookmark" : "bookmark-outline"} size={14} color={inWatchlist ? "#F5C518" : "#FFFFFF"} />
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.smallIconBtn} onPress={() => handleAuthAction(() => handleToggleAction(item.id, simType, 'watched'))}>
                                                    <Ionicons name="checkmark-done" size={14} color={inWatched ? "#1F80E0" : "#FFFFFF"} />
                                                </TouchableOpacity>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        </View>
                    )}
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

    fullscreenExitBtn: {
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 99999,
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 8,
        borderRadius: 20
    },

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

    providersContainer: { marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8 },
    providersTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
    providerIconsRow: { flexDirection: 'row', gap: 10 },
    providerLogo: { width: 36, height: 36, borderRadius: 8 },

    sectionContainer: { marginTop: 30 },
    sectionTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 16, letterSpacing: 0.2 },
    listContent: { paddingHorizontal: 16, gap: 12 },

    standardCard: { width: 125, height: 175, borderRadius: 8, overflow: 'hidden', backgroundColor: '#1E1428', position: 'relative' },
    cardImage: { width: '100%', height: '100%', position: 'absolute' },
    cardBottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%' },
    translucentRatingBadge: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
    smallCardRatingText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold', marginLeft: 3, marginTop: 1 },
    smallCardActions: { position: 'absolute', top: 6, right: 6, gap: 6 },
    smallIconBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' },

    ytCard: { width: 180, marginRight: 12 },
    ytCardImage: { width: '100%', height: 101, borderRadius: 8, backgroundColor: '#1E1428' },
    ytPlayIconOverlay: { position: 'absolute', top: 35, left: 74, zIndex: 2 },
    ytCardTitle: { color: '#D0D0D5', fontSize: 13, marginTop: 8, fontWeight: '500' },

    // --- CUSTOM LIVE STREAM UI STYLES ---
    liveStreamOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    liveBadgeContainer: {
        position: 'absolute',
        top: 20,
        left: 20,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 0, 122, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 0, 122, 0.5)'
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF007A',
        marginRight: 6
    },
    liveBadgeText: {
        color: '#FF007A',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1
    },
    gradientPlayWrapper: {
        width: 56,
        height: 56,
        borderRadius: 28,
        elevation: 8,
        shadowColor: '#FF007A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
    },
    gradientPlayInner: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 28
    }
});