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

    const { id, type, ytId } = useLocalSearchParams();

    const [isLoading, setIsLoading] = useState(true);
    const [mediaDetails, setMediaDetails] = useState(null);
    const [trailerKey, setTrailerKey] = useState(null);
    const [similarMedia, setSimilarMedia] = useState([]);
    const [watchProviders, setWatchProviders] = useState(null);
    const [relatedYtClips, setRelatedYtClips] = useState([]);

    const [hasStarted, setHasStarted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);

    // --- Vidking States ---
    const [activeMediaView, setActiveMediaView] = useState('trailer'); // 'trailer' | 'movie'
    const [isVidkingAvailable, setIsVidkingAvailable] = useState(null);

    // --- Season & Episode States ---
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [selectedEpisode, setSelectedEpisode] = useState(1);

    // --- Fullscreen Cross Auto-Hide State & Anim ---
    const [showFsExitBtn, setShowFsExitBtn] = useState(true);
    const fsExitFadeAnim = useRef(new Animated.Value(1)).current;
    const fsExitTimer = useRef(null);

    const { watchlist, watched, toggleWatchlist, toggleWatched } = useUserListStore();
    const { token } = useAuthStore();

    const TAB_BAR_HEIGHT = (Platform.OS === 'ios' ? 88 : 65) + insets.bottom;

    useEffect(() => {
        return () => {
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            if (fsExitTimer.current) clearTimeout(fsExitTimer.current);
        };
    }, []);

    // Fullscreen Cross Auto-Hide Controller
    const resetFsExitTimer = useCallback(() => {
        if (fsExitTimer.current) clearTimeout(fsExitTimer.current);
        setShowFsExitBtn(true);
        Animated.timing(fsExitFadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();

        fsExitTimer.current = setTimeout(() => {
            Animated.timing(fsExitFadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
                setShowFsExitBtn(false);
            });
        }, 3500);
    }, [fsExitFadeAnim]);

    // Availability Checker
    useEffect(() => {
        if (id && type && !ytId) {
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
    }, [id, type, ytId]);

    useEffect(() => {
        if (!id && !ytId) return;

        const fetchAllData = async () => {
            setIsLoading(true);
            try {
                let videoTitle = "";

                if (ytId) {
                    setTrailerKey(ytId);
                    setHasStarted(true);
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
                                        spoken_languages: [{ english_name: snippet.channelTitle }]
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
                        setHasStarted(true);
                        setIsPlaying(true);
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
    }, [id, type, ytId]);

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

    // --- NEW: Create Watch Party Shortcut ---
    const handleCreateWatchParty = () => {
        handleAuthAction(() => {
            const newRoomId = Math.floor(10000 + Math.random() * 90000).toString();
            let vidId = '';

            // Map the current media directly into the Vidking Room Format
            if (id && type) {
                vidId = type === 'tv'
                    ? `VIDKING:tv:${id}:${selectedSeason}:${selectedEpisode}`
                    : `VIDKING:movie:${id}`;
            } else {
                // Fallback to youtube trailer if it's just a raw YT search
                vidId = trailerKey || ytId;
            }

            setIsPlaying(false); // Pause current player

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
            if (fsExitTimer.current) clearTimeout(fsExitTimer.current);
            setShowFsExitBtn(true);
            fsExitFadeAnim.setValue(1);
        } else {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
            setIsFullScreen(true);
            resetFsExitTimer();
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
                    <View style={{ width: innerVideoWidth, height: innerVideoHeight, backgroundColor: '#000', position: 'relative' }}>

                        {activeMediaView === 'movie' ? (
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
                                            resetFsExitTimer();
                                        }
                                    } catch (e) { }
                                }}
                                onShouldStartLoadWithRequest={(request) => {
                                    if (!request.url.includes('vidking.net') && !request.url.includes('about:blank')) {
                                        return false;
                                    }
                                    return true;
                                }}
                                injectedJavaScript={`
                                    window.open = function() { return null; };
                                    const style = document.createElement('style');
                                    style.innerHTML = 'iframe[src*="ads"], .ad-overlay, .jw-ad, .jw-icon-fullscreen, .vjs-fullscreen-control, [aria-label="Fullscreen"], [title="Fullscreen"] { display: none !important; }';
                                    document.head.appendChild(style);

                                    const triggerPlay = () => {
                                        const v = document.querySelector('video');
                                        if (v) {
                                            v.play().catch(() => {});
                                        }
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
                            <YoutubePlayer
                                height={innerVideoHeight}
                                width={innerVideoWidth}
                                play={isPlaying}
                                videoId={trailerKey}
                                webViewProps={{ allowsFullscreenVideo: false }}
                                initialPlayerParams={{ controls: 1, modestbranding: 1, rel: 0, iv_load_policy: 3, fs: 0 }}
                                onChangeState={(state) => {
                                    if (state === 'playing') setIsPlaying(true);
                                    if (state === 'paused' || state === 'ended') setIsPlaying(false);
                                }}
                            />
                        ) : null}

                        {!hasStarted && activeMediaView === 'trailer' && (
                            <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]}>
                                {mediaDetails.backdrop_path && (
                                    <Image
                                        source={{ uri: getImageUrl(mediaDetails.backdrop_path, 'original') }}
                                        style={styles.videoThumbnail}
                                    />
                                )}
                                <View style={styles.playerOverlay}>
                                    {trailerKey ? (
                                        <TouchableOpacity
                                            style={styles.centerPlayButton}
                                            activeOpacity={0.7}
                                            onPress={() => {
                                                setHasStarted(true);
                                                setIsPlaying(true);
                                            }}
                                        >
                                            <Ionicons name="play" size={38} color="#FFFFFF" style={{ marginLeft: 4 }} />
                                        </TouchableOpacity>
                                    ) : (
                                        <Text style={styles.noTrailerText}>No Video Available</Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {isFullScreen && (
                            <Animated.View
                                style={[
                                    styles.fullscreenExitBtn,
                                    { opacity: fsExitFadeAnim }
                                ]}
                                pointerEvents={showFsExitBtn ? 'auto' : 'none'}
                            >
                                <TouchableOpacity onPress={handleBackPress} activeOpacity={0.7}>
                                    <Ionicons name="close" size={26} color="#FFFFFF" />
                                </TouchableOpacity>
                            </Animated.View>
                        )}

                        {isFullScreen && !showFsExitBtn && (
                            <TouchableOpacity
                                style={styles.fsWakeHotspot}
                                onPress={resetFsExitTimer}
                                activeOpacity={1}
                            />
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
                            {/* --- UPDATED: ACTION BAR WITH WATCH PARTY BUTTON --- */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.externalRightControls} bounces={false}>

                                <TouchableOpacity onPress={handleCreateWatchParty} style={[styles.externalBtn, { borderColor: '#00E5FF', borderWidth: 1, backgroundColor: 'rgba(0, 229, 255, 0.1)' }]}>
                                    <Ionicons name="people-circle" size={18} color="#00E5FF" />
                                    <Text style={[styles.externalBtnText, { color: '#00E5FF' }]}>Watch Party</Text>
                                </TouchableOpacity>

                                {id && (
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

                <ScrollView
                    style={{ display: isFullScreen ? 'none' : 'flex' }}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_HEIGHT + 20 }]}
                >
                    <View style={styles.detailsContainer}>
                        <Text style={styles.mediaTitle}>{title}</Text>

                        {!ytId && (
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
                                    colors={
                                        activeMediaView === 'movie' ? ['#2A2A30', '#2A2A30'] :
                                            isVidkingAvailable === false ? ['#2A2A30', '#2A2A30'] :
                                                ['#00E5FF', '#9B51E0', '#FF007A']
                                    }
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={styles.watchToggleGradient}
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
                                                {isVidkingAvailable
                                                    ? (type === 'tv' ? 'Watch Show' : 'Watch Movie')
                                                    : (type === 'tv' ? 'Show Not Available' : 'Movie Not Available')}
                                            </Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        )}

                        {activeMediaView === 'movie' && type === 'tv' && tvSeasons.length > 0 && (
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
                            <Text style={styles.metaText}>{languages}</Text>
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

                        {streamingPlatforms.length > 0 && (
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

                    {!ytId && relatedYtClips.length > 0 && (
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
                                            setHasStarted(true);
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

                    {similarMedia.length > 0 && (
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
    centerPlayButton: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
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
    fsWakeHotspot: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 100,
        height: 100,
        zIndex: 99998
    },

    externalControlBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#14141A', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
    externalLeftControls: { flexDirection: 'row', gap: 12 },

    // --- UPDATED ACTION BAR STYLES ---
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
    ytCardTitle: { color: '#D0D0D5', fontSize: 13, marginTop: 8, fontWeight: '500' }
});