import React, { useState, useEffect } from 'react';
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
    useWindowDimensions
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import YoutubePlayer from 'react-native-youtube-iframe';
import * as ScreenOrientation from 'expo-screen-orientation';

// --- Global State & Config ---
import { tmdbService } from '../services/tmdbService';
import { getImageUrl } from '../constants/config';
import { useUserListStore } from '../store/useUserListStore';
import { useAuthStore } from '../store/useAuthStore';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

export default function PlayerScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const { id, type } = useLocalSearchParams(); // <-- TYPE is already here!

    const [isLoading, setIsLoading] = useState(true);
    const [mediaDetails, setMediaDetails] = useState(null);
    const [trailerKey, setTrailerKey] = useState(null);
    const [similarMedia, setSimilarMedia] = useState([]);
    const [watchProviders, setWatchProviders] = useState(null);

    const [hasStarted, setHasStarted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);

    const { watchlist, watched, toggleWatchlist, toggleWatched } = useUserListStore();
    const { token } = useAuthStore();

    useEffect(() => {
        return () => {
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        };
    }, []);

    useEffect(() => {
        if (!id || !type) return;

        const fetchAllData = async () => {
            setIsLoading(true);
            try {
                const [details, videos, similar, providers] = await Promise.all([
                    tmdbService.getDetails(id, type),
                    tmdbService.getVideos(id, type),
                    tmdbService.getSimilar(id, type),
                    tmdbService.getWatchProviders(id, type)
                ]);

                const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube')
                    || videos.find(v => v.site === 'YouTube');

                setTrailerKey(trailer ? trailer.key : null);
                setMediaDetails(details);
                setSimilarMedia(similar);
                setWatchProviders(providers);
            } catch (error) {
                console.error("Failed to load player data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllData();
    }, [id, type]);

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
        // 1. Optimistic UI Update passing mediaType
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

    const toggleFullScreen = async () => {
        if (isFullScreen) {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            setIsFullScreen(false);
        } else {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
            setIsFullScreen(true);
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
                        {trailerKey && (
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
                        )}

                        {!hasStarted && (
                            <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]}>
                                <Image
                                    source={{ uri: getImageUrl(mediaDetails.backdrop_path, 'original') }}
                                    style={styles.videoThumbnail}
                                />
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
                                        <Text style={styles.noTrailerText}>No Trailer Available</Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {isFullScreen && (
                            <TouchableOpacity style={styles.fullscreenExitBtn} onPress={toggleFullScreen} activeOpacity={0.7}>
                                <Ionicons name="close" size={26} color="#FFFFFF" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <ScrollView
                    style={{ display: isFullScreen ? 'none' : 'flex' }}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    <View style={styles.externalControlBar}>
                        <View style={styles.externalLeftControls}>
                            <TouchableOpacity onPress={handleBackPress} style={styles.externalBtn}>
                                <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={toggleFullScreen} style={styles.externalBtn}>
                                <Ionicons name="expand" size={22} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.externalRightControls}>
                            <TouchableOpacity onPress={() => handleAuthAction(() => handleToggleAction(id, type, 'watchlist'))} style={styles.externalBtn}>
                                <Ionicons name={isCurrentInWatchlist ? "bookmark" : "bookmark-outline"} size={22} color={isCurrentInWatchlist ? "#F5C518" : "#FFFFFF"} />
                                <Text style={[styles.externalBtnText, isCurrentInWatchlist && { color: '#F5C518' }]}>Save</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleAuthAction(() => handleToggleAction(id, type, 'watched'))} style={styles.externalBtn}>
                                <Ionicons name="checkmark-done" size={22} color={isCurrentInWatched ? "#1F80E0" : "#FFFFFF"} />
                                <Text style={[styles.externalBtnText, isCurrentInWatched && { color: '#1F80E0' }]}>Watched</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.detailsContainer}>
                        <Text style={styles.mediaTitle}>{title}</Text>
                        <View style={styles.metaRow}>
                            <Text style={styles.metaText}>{year}</Text>
                            <Text style={styles.metaDot}>•</Text>
                            <Text style={styles.metaText}>{languages}</Text>
                            <Text style={styles.metaDot}>•</Text>
                            <View style={styles.ratingBadge}>
                                <Ionicons name="star" size={12} color="#F5C518" />
                                <Text style={styles.ratingText}>{mediaDetails.vote_average?.toFixed(1)}</Text>
                            </View>
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

                        <Text style={styles.overviewText}>{mediaDetails.overview}</Text>
                    </View>

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
    scrollContent: { paddingBottom: 40 },

    /* --- Player Section --- */
    playerContainer: { backgroundColor: '#000', position: 'relative' },
    videoThumbnail: { width: '100%', height: '100%', position: 'absolute' },
    playerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
    centerPlayButton: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    noTrailerText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 8 },

    /* --- Floating Exit Fullscreen Button --- */
    fullscreenExitBtn: { position: 'absolute', top: 15, left: 20, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.7)', padding: 8, borderRadius: 20 },

    /* --- External Controls Bar Below Video --- */
    externalControlBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#14141A', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
    externalLeftControls: { flexDirection: 'row', gap: 12 },
    externalBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    externalRightControls: { flexDirection: 'row', gap: 10 },
    externalBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

    /* --- Media Details --- */
    detailsContainer: { paddingHorizontal: 16, paddingTop: 20 },
    mediaTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold', marginBottom: 8 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    metaText: { color: '#A0A0A5', fontSize: 14, fontWeight: '600' },
    metaDot: { color: '#A0A0A5', fontSize: 14, marginHorizontal: 8 },
    ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 197, 24, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    ratingText: { color: '#F5C518', fontSize: 13, fontWeight: 'bold', marginLeft: 4 },
    overviewText: { color: '#D0D0D5', fontSize: 15, lineHeight: 22, marginTop: 8 },

    /* --- Providers Section --- */
    providersContainer: { marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8 },
    providersTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
    providerIconsRow: { flexDirection: 'row', gap: 10 },
    providerLogo: { width: 36, height: 36, borderRadius: 8 },

    /* --- Sections --- */
    sectionContainer: { marginTop: 30 },
    sectionTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 16, letterSpacing: 0.2 },
    listContent: { paddingHorizontal: 16, gap: 12 },

    /* --- More Like This Cards --- */
    standardCard: { width: 125, height: 175, borderRadius: 8, overflow: 'hidden', backgroundColor: '#1E1428', position: 'relative' },
    cardImage: { width: '100%', height: '100%', position: 'absolute' },
    cardBottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%' },
    translucentRatingBadge: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
    smallCardRatingText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold', marginLeft: 3, marginTop: 1 },
    smallCardActions: { position: 'absolute', top: 6, right: 6, gap: 6 },
    smallIconBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' },
});