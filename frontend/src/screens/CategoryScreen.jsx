import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    FlatList,
    Image,
    Dimensions,
    StatusBar,
    ActivityIndicator,
    Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';

// --- API & Store Imports ---
import { tmdbService } from '../services/tmdbService';
import { getImageUrl } from '../constants/config';
import { useUserListStore } from '../store/useUserListStore';
import { useAuthStore } from '../store/useAuthStore';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

const { width } = Dimensions.get('window');
const SCREEN_PADDING = 12;
const GAP = 8;
const AVAILABLE_WIDTH = width - (SCREEN_PADDING * 2);
const CARD_WIDTH = (AVAILABLE_WIDTH - (GAP * 2)) / 3;
const CARD_HEIGHT = CARD_WIDTH * 1.5;

// Map Home Screen card titles to TMDB API values
const TITLE_TO_API_MAP = {
    // Languages
    'Hindi': { type: 'language', val: 'hi' },
    'English': { type: 'language', val: 'en' },
    'Tamil': { type: 'language', val: 'ta' },
    'Telugu': { type: 'language', val: 'te' },
    'Punjabi': { type: 'language', val: 'pa' },
    'Malayalam': { type: 'language', val: 'ml' },
    // Genres
    'Action': { type: 'genre', val: 28 },
    'Comedy': { type: 'genre', val: 35 },
    'Drama': { type: 'genre', val: 18 },
    'Thriller': { type: 'genre', val: 53 },
    'Sci-Fi': { type: 'genre', val: 878 },
    'Horror': { type: 'genre', val: 27 },
    'Romance': { type: 'genre', val: 10749 },
};

// ==========================================
// 1. EXTRACTED MEMOIZED MOVIE CARD 
// Prevents the entire grid from re-rendering
// ==========================================
const MovieCard = React.memo(({ item, inWatchlist, inWatched, onToggleAction, handleAuthAction, router }) => {
    // Dynamically compute badges based on real data
    const posterUri = getImageUrl(item.poster_path || item.backdrop_path);
    const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');

    const isNew = item.release_date && item.release_date > '2024-01-01';
    const bottomBadge = isNew ? 'NEW RELEASE' : null;
    const topBadge = item.popularity > 1500 ? 'TOP\n10' : null;
    const bottomText = mediaType === 'tv' ? 'SERIES' : null;

    return (
        <TouchableOpacity
            style={styles.cardContainer}
            activeOpacity={0.8}
            onPress={() => router.push({ pathname: '/player', params: { id: item.id, type: mediaType } })}
        >
            {posterUri ? (
                <Image source={{ uri: posterUri }} style={styles.cardImage} resizeMode="cover" />
            ) : (
                <View style={[styles.cardImage, { backgroundColor: '#25252A', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="film-outline" size={24} color="#8F98A0" />
                </View>
            )}

            {/* Dark gradient for text readability if there is bottom text */}
            {bottomText && (
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.9)']}
                    style={styles.cardBottomGradient}
                />
            )}

            {/* IMDb Rating Badge (Top Left) */}
            {rating && (
                <View style={styles.translucentRatingBadge}>
                    <Ionicons name="star" size={10} color="#F5C518" />
                    <Text style={styles.ratingText}>{rating}</Text>
                </View>
            )}

            {/* Action Buttons Overlay (Top Right) */}
            <View style={[styles.cardActions, { top: topBadge ? 32 : 6 }]}>
                <TouchableOpacity
                    style={styles.smallIconBtn}
                    activeOpacity={0.8}
                    // FIX: Passed `mediaType` explicitly here!
                    onPress={() => handleAuthAction(() => onToggleAction(item.id, mediaType, 'watchlist'))}
                >
                    <Ionicons
                        name={inWatchlist ? "bookmark" : "bookmark-outline"}
                        size={14}
                        color={inWatchlist ? "#F5C518" : "#FFFFFF"}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.smallIconBtn}
                    activeOpacity={0.8}
                    // FIX: Passed `mediaType` explicitly here!
                    onPress={() => handleAuthAction(() => onToggleAction(item.id, mediaType, 'watched'))}
                >
                    <Ionicons
                        name="checkmark-done"
                        size={14}
                        color={inWatched ? "#1F80E0" : "#FFFFFF"}
                    />
                </TouchableOpacity>
            </View>

            {/* Top 10 Badge */}
            {topBadge && (
                <View style={styles.topBadgeContainer}>
                    <Text style={styles.topBadgeText}>{topBadge}</Text>
                </View>
            )}

            {/* Bottom Solid Badge (e.g., NEW RELEASE) */}
            {bottomBadge && (
                <View style={[styles.bottomBadgeContainer, { backgroundColor: '#E6398A' }]}>
                    <Text style={styles.bottomBadgeText}>{bottomBadge}</Text>
                </View>
            )}

            {/* Bottom Overlay Text (e.g., SERIES) */}
            {bottomText && !bottomBadge && (
                <View style={styles.bottomTextContainer}>
                    <Text style={styles.bottomText} numberOfLines={2}>{bottomText}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.inWatchlist === nextProps.inWatchlist &&
        prevProps.inWatched === nextProps.inWatched &&
        prevProps.item.id === nextProps.item.id
    );
});

export default function CategoryScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { title } = useLocalSearchParams();

    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Global Stores
    const { watchlist, watched, toggleWatchlist, toggleWatched } = useUserListStore();
    const { token } = useAuthStore();

    // Fetch data based on category title
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                let results = [];
                const mapInfo = TITLE_TO_API_MAP[title];

                if (mapInfo) {
                    if (mapInfo.type === 'language') {
                        // Fetch both movies and tv shows for a specific language
                        results = await tmdbService.fetchSection({ type: 'all', language: mapInfo.val }, {}, {});
                    } else if (mapInfo.type === 'genre') {
                        // Fetch both movies and tv shows for a specific genre ID
                        results = await tmdbService.fetchSection(
                            { type: 'all' },
                            { with_genres: mapInfo.val },
                            { with_genres: mapInfo.val }
                        );
                    }
                } else {
                    // Fallback to general trending if the title doesn't match the map
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

    // ==========================================
    // 2. INSTANT AUTH CHECK
    // ==========================================
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

    // ==========================================
    // 3. API SYNC & OPTIMISTIC UPDATE
    // ==========================================
    const handleToggleAction = useCallback(async (id, mediaType, targetList) => {
        // Optimistic UI Update passing mediaType
        if (targetList === 'watchlist') toggleWatchlist(id, mediaType);
        if (targetList === 'watched') toggleWatched(id, mediaType);

        try {
            // Append type so backend saves it as "123:tv"
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

            const data = await response.json();

            // Parse "123:tv" back into local HashMap
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

            // Revert
            if (targetList === 'watchlist') toggleWatchlist(id, mediaType);
            if (targetList === 'watched') toggleWatched(id, mediaType);
        }
    }, [toggleWatchlist, toggleWatched, token]);

    // Map function for FlatList
    const renderItem = useCallback(({ item }) => (
        <MovieCard
            item={item}
            inWatchlist={!!watchlist[item.id]}
            inWatched={!!watched[item.id]}
            onToggleAction={handleToggleAction}
            handleAuthAction={handleAuthAction}
            router={router}
        />
    ), [watchlist, watched, handleToggleAction, handleAuthAction, router]);

    return (
        <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.background}>
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{title || 'Category'}</Text>
                </View>

                {/* Grid Content */}
                {isLoading ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#1F80E0" />
                    </View>
                ) : (
                    <FlatList
                        data={data}
                        extraData={{ watchlist, watched }}
                        keyExtractor={(item, index) => `${item.id}-${index}`}
                        numColumns={3}
                        contentContainerStyle={styles.listContent}
                        columnWrapperStyle={styles.columnWrapper}
                        showsVerticalScrollIndicator={false}
                        renderItem={renderItem}

                        // --- Grid Performance Enhancements ---
                        initialNumToRender={12}
                        maxToRenderPerBatch={12}
                        windowSize={5}
                        removeClippedSubviews={Platform.OS === 'android'}

                        ListEmptyComponent={
                            <Text style={{ color: '#8F98A0', textAlign: 'center', marginTop: 40 }}>
                                No titles found for this category.
                            </Text>
                        }
                    />
                )}
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    background: { flex: 1 },
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 8
    },
    backButton: { marginRight: 16, padding: 4 },
    headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', letterSpacing: 0.3 },

    listContent: {
        paddingHorizontal: SCREEN_PADDING,
        paddingBottom: 40,
    },
    columnWrapper: {
        justifyContent: 'flex-start',
        gap: GAP,
        marginBottom: GAP,
    },
    cardContainer: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: 6,
        overflow: 'hidden',
        backgroundColor: '#1E1428',
        position: 'relative',
    },
    cardImage: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
    cardBottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '40%',
    },

    // --- Badge & Button Styles ---
    translucentRatingBadge: {
        position: 'absolute',
        top: 6,
        left: 6,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        paddingHorizontal: 5,
        paddingVertical: 3,
        borderRadius: 4,
        zIndex: 10
    },
    ratingText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 3,
        marginTop: 1
    },
    cardActions: {
        position: 'absolute',
        right: 6,
        gap: 6,
        zIndex: 10
    },
    smallIconBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },

    topBadgeContainer: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: '#E6398A',
        paddingHorizontal: 4,
        paddingVertical: 4,
        borderBottomLeftRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5
    },
    topBadgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '900',
        textAlign: 'center',
        lineHeight: 11,
    },
    bottomBadgeContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingVertical: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomBadgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    bottomTextContainer: {
        position: 'absolute',
        bottom: 8,
        left: 4,
        right: 4,
        alignItems: 'center',
    },
    bottomText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: 'bold',
        textAlign: 'center',
    },
});