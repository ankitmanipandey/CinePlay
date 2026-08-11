import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    FlatList,
    Image,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';

// --- Global State & Config ---
import { useUserListStore } from '../store/useUserListStore';
import { useAuthStore } from '../store/useAuthStore';
import { tmdbService } from '../services/tmdbService';
import { getImageUrl } from '../constants/config';

// Base URL for backend sync
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

const MyListScreen = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();

    const [activeTab, setActiveTab] = useState(params.tab === 'watched' ? 'watched' : 'watchlist');
    const [moviesData, setMoviesData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Global Stores
    const { watchlist, watched, toggleWatchlist, toggleWatched } = useUserListStore();
    const { token } = useAuthStore();

    // Update active tab dynamically if params change while component is mounted
    useEffect(() => {
        if (params.tab === 'watched' || params.tab === 'watchlist') {
            setActiveTab(params.tab);
        }
    }, [params.tab]);

    // Fetch details for all IDs currently stored in the user's lists
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

        const handle = requestIdleCallback(() => {
            fetchListDetails();
        });

        // Cleanup if the component unmounts before it fires
        return () => cancelIdleCallback(handle);
    }, [token, watchlist, watched]);

    // --- 1. Instant Auth Check ---
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

    // --- 2. API Sync & Optimistic Update ---
    const handleStatusChange = useCallback(async (id, mediaType, targetStatus) => {
        if (targetStatus === 'watchlist') toggleWatchlist(id, mediaType);
        if (targetStatus === 'watched') toggleWatched(id, mediaType);

        try {
            const tmdbIdWithType = `${id}:${mediaType}`;

            const response = await fetch(`${BACKEND_URL}/user/${targetStatus}/toggle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ tmdbId: tmdbIdWithType })
            });

            if (!response.ok) throw new Error('Failed to update list on server');

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

    const renderMovieItem = ({ item }) => {
        const inWatchlist = !!watchlist[item.id];
        const inWatched = !!watched[item.id];

        return (
            <View style={styles.movieCard}>
                <View style={styles.posterContainer}>
                    <Image source={{ uri: item.poster }} style={styles.poster} resizeMode="cover" />
                    <View style={styles.translucentRatingBadge}>
                        <Ionicons name="star" size={10} color="#F5C518" />
                        <Text style={styles.ratingText}>{item.rating}</Text>
                    </View>
                </View>

                <View style={styles.detailsContainer}>
                    <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.metadata}>{item.year}  •  {item.duration}</Text>
                    <Text style={styles.genre} numberOfLines={1}>{item.genre}</Text>

                    <View style={styles.actionButtonsRow}>
                        <TouchableOpacity
                            style={styles.smallIconBtn}
                            activeOpacity={0.8}
                            onPress={() => handleAuthAction(() => handleStatusChange(item.id, item.media_type, 'watchlist'))}
                        >
                            <Ionicons
                                name={inWatchlist ? "bookmark" : "bookmark-outline"}
                                size={16}
                                // Theme Pink for active Watchlist
                                color={inWatchlist ? "#FF007A" : "#FFFFFF"}
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.smallIconBtn}
                            activeOpacity={0.8}
                            onPress={() => handleAuthAction(() => handleStatusChange(item.id, item.media_type, 'watched'))}
                        >
                            <Ionicons
                                name="checkmark-done"
                                size={14}
                                // Theme Cyan for active Watched
                                color={inWatched ? "#00E5FF" : "#FFFFFF"}
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Gradient Play Button */}
                <TouchableOpacity
                    style={styles.playIconBtn}
                    activeOpacity={0.7}
                    onPress={() => router.push({ pathname: '/player', params: { id: item.id, type: item.media_type } })}
                >
                    <LinearGradient
                        colors={['#00E5FF', '#9B51E0', '#FF007A']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.playGradient}
                    >
                        <Ionicons name="play" size={20} color="#FFFFFF" style={{ marginLeft: 2 }} />
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.background}>
            <View style={[styles.container, { paddingTop: insets.top }]}>

                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>My Activity</Text>
                    <View style={styles.headerPlaceholder} />
                </View>

                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={styles.tab}
                        onPress={() => setActiveTab('watchlist')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabText, activeTab === 'watchlist' && styles.activeTabText]}>Watchlist</Text>
                        {/* Gradient Indicator for Watchlist */}
                        {activeTab === 'watchlist' && (
                            <LinearGradient
                                colors={['#00E5FF', '#9B51E0', '#FF007A']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.activeTabIndicator}
                            />
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.tab}
                        onPress={() => setActiveTab('watched')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabText, activeTab === 'watched' && styles.activeTabText]}>Watched</Text>
                        {/* Gradient Indicator for Watched */}
                        {activeTab === 'watched' && (
                            <LinearGradient
                                colors={['#00E5FF', '#9B51E0', '#FF007A']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.activeTabIndicator}
                            />
                        )}
                    </TouchableOpacity>
                </View>

                {isLoading && moviesData.length === 0 ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        {/* Theme Cyan Loader */}
                        <ActivityIndicator size="large" color="#00E5FF" />
                    </View>
                ) : (
                    <FlatList
                        data={activeData}
                        extraData={{ watchlist, watched }}
                        keyExtractor={(item) => item.id}
                        renderItem={renderMovieItem}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="film-outline" size={48} color="rgba(255,255,255,0.2)" style={styles.emptyIcon} />
                                <Text style={styles.emptyText}>No movies in this list yet.</Text>
                            </View>
                        }
                    />
                )}

            </View>
        </LinearGradient>
    );
};

export default MyListScreen;

const styles = StyleSheet.create({
    background: { flex: 1 },
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12
    },
    backButton: { padding: 4 },
    headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 },
    headerPlaceholder: { width: 32 },

    tabContainer: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
        marginBottom: 8
    },
    tab: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
        position: 'relative', // Allows absolute positioning of the gradient bar
    },
    activeTabIndicator: {
        position: 'absolute',
        bottom: -1, // Sits exactly over the container's bottom border
        left: 0,
        right: 0,
        height: 3,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
    },
    tabText: { color: '#8F98A0', fontSize: 15, fontWeight: '600' },
    activeTabText: { color: '#FFFFFF', fontWeight: 'bold' },

    listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
    movieCard: {
        flexDirection: 'row',
        backgroundColor: '#1E1428',
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },

    posterContainer: {
        position: 'relative',
    },
    poster: { width: 105, height: 155 },
    translucentRatingBadge: {
        position: 'absolute',
        top: 6,
        left: 6,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
    },
    ratingText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 3,
        marginTop: 1,
    },

    detailsContainer: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
        justifyContent: 'center'
    },
    title: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginBottom: 4, letterSpacing: 0.3 },
    metadata: { color: '#8F98A0', fontSize: 12, marginBottom: 4, fontWeight: '500' },
    genre: { color: '#A0A0A5', fontSize: 11, fontStyle: 'italic' },

    actionButtonsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
    },
    smallIconBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },

    // Gradient Play Button Styles
    playIconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
        marginRight: 14,
    },
    playGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    emptyContainer: { alignItems: 'center', marginTop: '40%' },
    emptyIcon: { marginBottom: 16 },
    emptyText: { color: '#8F98A0', fontSize: 15, fontWeight: '500' }
});