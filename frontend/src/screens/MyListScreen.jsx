import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    FlatList,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Mock Data - Strictly Movies, including IMDb ratings
const INITIAL_MOVIES = [
    { id: '1', title: 'PREMALU', duration: '2h 36m', year: '2024', genre: 'Romance, Comedy', rating: '8.3', poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=200&q=80', status: 'watchlist' },
    { id: '2', title: 'RATSASAN', duration: '2h 50m', year: '2018', genre: 'Crime, Thriller', rating: '8.7', poster: 'https://images.unsplash.com/photo-1614729939124-03290b55c9ce?w=200&q=80', status: 'watchlist' },
    { id: '3', title: 'SPIDER-MAN: NO WAY HOME', duration: '2h 28m', year: '2021', genre: 'Action, Adventure', rating: '8.2', poster: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=200&q=80', status: 'watched' },
];

const MyListScreen = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [activeTab, setActiveTab] = useState('watchlist');
    const [movies, setMovies] = useState(INITIAL_MOVIES);

    const activeData = movies.filter(movie => movie.status === activeTab);

    const handleStatusChange = (id, targetStatus) => {
        setMovies(prev => prev.map(movie => {
            if (movie.id === id) {
                return { ...movie, status: movie.status === targetStatus ? 'none' : targetStatus };
            }
            return movie;
        }));
    };

    const renderMovieItem = ({ item }) => {
        const inWatchlist = item.status === 'watchlist';
        const inWatched = item.status === 'watched';

        return (
            <View style={styles.movieCard}>
                {/* Poster Container with Absolute Rating Badge */}
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
                    <Text style={styles.genre}>{item.genre}</Text>

                    <View style={styles.actionButtonsRow}>
                        <TouchableOpacity
                            style={styles.smallIconBtn}
                            activeOpacity={0.8}
                            onPress={() => handleStatusChange(item.id, 'watchlist')}
                        >
                            <Ionicons
                                name={inWatchlist ? "bookmark" : "bookmark-outline"}
                                size={16}
                                color={inWatchlist ? "#F5C518" : "#FFFFFF"}
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.smallIconBtn}
                            activeOpacity={0.8}
                            onPress={() => handleStatusChange(item.id, 'watched')}
                        >
                            <Ionicons
                                name="checkmark-done"
                                size={14}
                                color={inWatched ? "#1F80E0" : "#FFFFFF"}
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity style={styles.playIcon} activeOpacity={0.7} onPress={() => router.push('/player')}>
                    <Ionicons name="play-circle" size={42} color="#E5E5EA" />
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
                        style={[styles.tab, activeTab === 'watchlist' && styles.activeTab]}
                        onPress={() => setActiveTab('watchlist')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabText, activeTab === 'watchlist' && styles.activeTabText]}>Watchlist</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'watched' && styles.activeTab]}
                        onPress={() => setActiveTab('watched')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabText, activeTab === 'watched' && styles.activeTabText]}>Watched</Text>
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={activeData}
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
        alignItems: 'center'
    },
    activeTab: { borderBottomWidth: 2, borderBottomColor: '#1F80E0' },
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

    // Poster and Badge Styles
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

    playIcon: { padding: 14 },

    emptyContainer: { alignItems: 'center', marginTop: '40%' },
    emptyIcon: { marginBottom: 16 },
    emptyText: { color: '#8F98A0', fontSize: 15, fontWeight: '500' }
});