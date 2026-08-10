import React, { useRef, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    StatusBar,
    TouchableOpacity,
    Image,
    Dimensions,
    Animated,
    PanResponder,
    ScrollView,
    FlatList
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = 60;
const SWIPE_VELOCITY = 1.0;

// --- Mock Data ---
const MOCK_MOVIES = [
    {
        id: '1',
        title: 'ASUR 2',
        subtitle: '|| RISE OF THE DARK SIDE ||',
        metadata: '2023  •  8 Languages  •  Crime',
        badgeType: 'imdb',
        badgeText: 'IMDb 8.5',
        poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=80',
    },
    {
        id: '2',
        title: 'SPIDER-MAN',
        subtitle: 'NO WAY HOME',
        metadata: '2021  •  10 Languages  •  Action',
        badgeType: 'rank',
        badgeText: '#10 in Hindi Today',
        poster: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=800&auto=format&fit=crop&q=80',
    },
    {
        id: '3',
        title: 'IND vs SL',
        subtitle: 'India Tour of Sri Lanka 2026',
        metadata: '5m  •  Cricket',
        badgeType: 'live',
        badgeText: 'FOLLOW THE BLUES',
        poster: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&auto=format&fit=crop&q=80',
    },
];

const MOCK_ROW_POSTERS = [
    { id: '101', rating: '8.4', image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=300&auto=format&fit=crop&q=60' },
    { id: '102', rating: '9.1', image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=60' },
    { id: '103', rating: '7.8', image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=300&auto=format&fit=crop&q=60' },
    { id: '104', rating: '8.0', image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=300&auto=format&fit=crop&q=60' },
    { id: '105', rating: '6.5', image: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=300&auto=format&fit=crop&q=60' },
];

const CATEGORIES = [
    "Trending",
    "Top Rated",
    "Rewinding this Year",
    "Action",
    "Drama",
    "Inspirational Movies",
    "Horror",
    "Crime",
    "Popular in Comedy",
    "Romance"
];

const MOCK_LANGUAGES = [
    { id: 'l1', title: 'Hindi', subtitle: 'हिन्दी', image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=60', color: '#323246' },
    { id: 'l2', title: 'English', subtitle: '', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=60', color: '#5A3732' },
    { id: 'l3', title: 'Tamil', subtitle: 'தமிழ்', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=60', color: '#4A3428' },
    { id: 'l4', title: 'Telugu', subtitle: 'తెలుగు', image: 'https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?w=300&auto=format&fit=crop&q=60', color: '#2C3E50' },
];

const MOCK_GENRES = [
    { id: 'g1', title: 'Action', image: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=300&auto=format&fit=crop&q=60', tint: 'rgba(150, 50, 50, 0.75)' },
    { id: 'g2', title: 'Romance', image: 'https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=300&auto=format&fit=crop&q=60', tint: 'rgba(180, 80, 80, 0.75)' },
    { id: 'g3', title: 'Sci-Fi', image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&q=80', tint: 'rgba(50, 50, 150, 0.75)' },
    { id: 'g4', title: 'Drama', image: 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=300&auto=format&fit=crop&q=60', tint: 'rgba(50, 120, 120, 0.75)' },
];

// --- Reusable Components ---
const HorizontalRow = ({ title, data, onAuthAction, userLists, toggleAction }) => {
    const router = useRouter();

    return (
        <View style={styles.rowContainer}>
            <Text style={styles.rowTitle}>{title}</Text>
            <FlatList
                horizontal
                data={data}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rowListContent}
                renderItem={({ item }) => {
                    const inWatchlist = userLists.watchlist[item.id];
                    const inWatched = userLists.watched[item.id];

                    return (
                        <TouchableOpacity
                            style={styles.smallCard}
                            activeOpacity={0.7}
                            delayPressIn={0}
                            onPress={() => router.push('/player')}
                        >
                            <Image source={{ uri: item.image }} style={styles.smallCardImage} resizeMode="cover" />

                            <View style={styles.translucentRatingBadge}>
                                <Ionicons name="star" size={10} color="#F5C518" />
                                <Text style={styles.smallCardRatingText}>{item.rating}</Text>
                            </View>

                            <View style={styles.smallCardActions}>
                                <TouchableOpacity
                                    style={styles.smallIconBtn}
                                    activeOpacity={0.8}
                                    onPress={() => onAuthAction(() => toggleAction(item.id, 'watchlist'))}
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
                                    onPress={() => onAuthAction(() => toggleAction(item.id, 'watched'))}
                                >
                                    <Ionicons
                                        name="checkmark-done"
                                        size={14}
                                        color={inWatched ? "#1F80E0" : "#FFFFFF"}
                                    />
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );
};

const LanguageRow = ({ router }) => (
    <View style={styles.rowContainer}>
        <Text style={styles.rowTitle}>Popular Languages</Text>
        <FlatList
            horizontal
            data={MOCK_LANGUAGES}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rowListContent}
            renderItem={({ item }) => (
                <TouchableOpacity
                    style={[styles.wideCard, { backgroundColor: item.color }]}
                    activeOpacity={0.85}
                    delayPressIn={0}
                    onPress={() => router.push({ pathname: '/category', params: { title: item.title } })}
                >
                    <Image source={{ uri: item.image }} style={styles.languageImage} resizeMode="cover" />

                    <LinearGradient
                        colors={[item.color, `${item.color}E6`, `${item.color}00`]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.languageGradient}
                    />

                    <View style={styles.languageTextContainer}>
                        <Text style={styles.languageMainText}>{item.title}</Text>
                        {item.subtitle ? <Text style={styles.languageSubText}>{item.subtitle}</Text> : null}
                    </View>
                </TouchableOpacity>
            )}
        />
    </View>
);

const GenreRow = ({ router }) => (
    <View style={styles.rowContainer}>
        <Text style={styles.rowTitle}>Popular Genres</Text>
        <FlatList
            horizontal
            data={MOCK_GENRES}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rowListContent}
            renderItem={({ item }) => (
                <TouchableOpacity
                    style={styles.wideCard}
                    activeOpacity={0.85}
                    delayPressIn={0}
                    onPress={() => router.push({ pathname: '/category', params: { title: item.title } })}
                >
                    <Image source={{ uri: item.image }} style={styles.genreImage} resizeMode="cover" />
                    <View style={[styles.genreTintOverlay, { backgroundColor: item.tint }]} />
                    <Text style={styles.genreTitle}>{item.title}</Text>
                </TouchableOpacity>
            )}
        />
    </View>
);

const HomeScreen = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const scrollRef = useRef(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const panRef = useRef(new Animated.ValueXY());

    const [userLists, setUserLists] = useState({
        watchlist: {},
        watched: {}
    });

    const handleAuthAction = async (actionCallback) => {
        const token = await SecureStore.getItemAsync('userToken');
        if (!token) {
            Toast.show({
                type: 'info',
                text1: 'Log in for personalization',
                position: 'top',
                topOffset: insets.top > 0 ? insets.top + 10 : 50,
                visibilityTime: 2500,
            });
        } else {
            actionCallback();
        }
    };

    const handleToggleAction = (id, targetList) => {
        setUserLists(prev => {
            const newWatchlist = { ...prev.watchlist };
            const newWatched = { ...prev.watched };

            if (targetList === 'watchlist') {
                if (newWatchlist[id]) {
                    delete newWatchlist[id];
                } else {
                    newWatchlist[id] = true;
                    delete newWatched[id];
                }
            } else if (targetList === 'watched') {
                if (newWatched[id]) {
                    delete newWatched[id];
                } else {
                    newWatched[id] = true;
                    delete newWatchlist[id];
                }
            }

            return { watchlist: newWatchlist, watched: newWatched };
        });
    };

    const panResponder = useRef(
        PanResponder.create({
            // Capture if it is distinctly a horizontal gesture
            onMoveShouldSetPanResponderCapture: (_, gestureState) => {
                const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
                const isSignificant = Math.abs(gestureState.dx) > 5;
                return isHorizontal && isSignificant;
            },
            onMoveShouldSetPanResponder: (_, gestureState) => {
                const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
                const isSignificant = Math.abs(gestureState.dx) > 5;
                return isHorizontal && isSignificant;
            },
            onPanResponderGrant: () => {
                if (scrollRef.current) {
                    scrollRef.current.setNativeProps({ scrollEnabled: false });
                }
            },
            onPanResponderMove: (_, gestureState) => {
                panRef.current.setValue({ x: gestureState.dx, y: 0 });
            },
            // CRITICAL FIX: Tell the OS to NOT let the ScrollView steal this gesture once it starts
            onPanResponderTerminationRequest: () => false,
            onPanResponderRelease: (_, gestureState) => {
                if (scrollRef.current) {
                    scrollRef.current.setNativeProps({ scrollEnabled: true });
                }

                if (gestureState.dx > SWIPE_THRESHOLD || gestureState.vx > SWIPE_VELOCITY) {
                    forceSwipe('right');
                } else if (gestureState.dx < -SWIPE_THRESHOLD || gestureState.vx < -SWIPE_VELOCITY) {
                    forceSwipe('left');
                } else {
                    resetPosition();
                }
            },
            onPanResponderTerminate: () => {
                if (scrollRef.current) {
                    scrollRef.current.setNativeProps({ scrollEnabled: true });
                }
                resetPosition();
            }
        })
    ).current;

    const forceSwipe = (direction) => {
        const x = direction === 'right' ? width * 2 : -width * 2;
        Animated.timing(panRef.current, {
            toValue: { x, y: 0 },
            duration: 250,
            useNativeDriver: false,
        }).start(() => onSwipeComplete());
    };

    const onSwipeComplete = () => {
        panRef.current = new Animated.ValueXY();
        setCurrentIndex((prevIndex) => (prevIndex + 1) % MOCK_MOVIES.length);
    };

    const resetPosition = () => {
        Animated.spring(panRef.current, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: false,
        }).start();
    };

    const rotate = panRef.current.x.interpolate({
        inputRange: [-width / 2, 0, width / 2],
        outputRange: ['-10deg', '0deg', '10deg'],
        extrapolate: 'clamp',
    });

    const topCardOpacity = panRef.current.x.interpolate({
        inputRange: [-width / 1.5, 0, width / 1.5],
        outputRange: [0, 1, 0],
        extrapolate: 'clamp',
    });

    const nextCardScale = panRef.current.x.interpolate({
        inputRange: [-width / 2, 0, width / 2],
        outputRange: [1, 0.92, 1],
        extrapolate: 'clamp',
    });

    const renderCardContent = (item) => {
        const inWatchlist = userLists.watchlist[item.id];
        const inWatched = userLists.watched[item.id];

        return (
            <>
                <Image source={{ uri: item.poster }} style={styles.mainCardImage} resizeMode="cover" />

                {item.badgeType !== 'none' && (
                    <View style={styles.badgeContainer}>
                        {item.badgeType === 'imdb' && (
                            <>
                                <Ionicons name="ticket" size={13} color="#F5C518" style={{ marginRight: 4 }} />
                                <Text style={styles.badgeText}>{item.badgeText}</Text>
                            </>
                        )}
                        {item.badgeType === 'rank' && (
                            <>
                                <Ionicons name="trophy" size={12} color="#F5C518" style={{ marginRight: 4 }} />
                                <Text style={styles.badgeText}>{item.badgeText}</Text>
                            </>
                        )}
                    </View>
                )}

                <LinearGradient
                    colors={['transparent', 'rgba(10, 10, 12, 0.75)', '#0A0A0C']}
                    style={styles.gradientOverlay}
                >
                    <View style={styles.movieDetailsContainer}>
                        <Text style={styles.movieTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.movieSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                        <Text style={styles.metadataText}>{item.metadata}</Text>
                    </View>
                </LinearGradient>

                <View style={styles.actionButtonsWrapper}>
                    <TouchableOpacity
                        style={styles.iconActionBtn}
                        activeOpacity={0.8}
                        onPress={() => handleAuthAction(() => handleToggleAction(item.id, 'watchlist'))}
                    >
                        <Ionicons
                            name={inWatchlist ? "bookmark" : "bookmark-outline"}
                            size={24}
                            color={inWatchlist ? "#F5C518" : "#FFFFFF"}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.iconActionBtn}
                        activeOpacity={0.8}
                        onPress={() => handleAuthAction(() => handleToggleAction(item.id, 'watched'))}
                    >
                        <Ionicons
                            name="checkmark-done"
                            size={22}
                            color={inWatched ? "#1F80E0" : "#FFFFFF"}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.playButton}
                        activeOpacity={0.8}
                        onPress={() => router.push('/player')}
                    >
                        <Ionicons name="play" size={26} color="#000000" style={{ marginLeft: 3 }} />
                    </TouchableOpacity>
                </View>
            </>
        );
    };

    const renderCardStack = () => {
        if (MOCK_MOVIES.length === 0) return null;
        const topItem = MOCK_MOVIES[currentIndex];
        const nextItem = MOCK_MOVIES[(currentIndex + 1) % MOCK_MOVIES.length];

        return (
            <>
                <Animated.View
                    key={`${nextItem.id}-next`}
                    style={[styles.mainCardContainer, { transform: [{ scale: nextCardScale }], zIndex: 1 }]}
                >
                    {renderCardContent(nextItem)}
                </Animated.View>

                <Animated.View
                    key={`${topItem.id}-top`}
                    style={[
                        styles.mainCardContainer,
                        {
                            opacity: topCardOpacity,
                            transform: [{ translateX: panRef.current.x }, { rotate: rotate }],
                            zIndex: 99,
                        },
                    ]}
                    {...panResponder.panHandlers}
                >
                    {renderCardContent(topItem)}
                </Animated.View>
            </>
        );
    };

    return (
        <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.background}>
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                <View style={styles.header}>
                    <MaskedView maskElement={<Text style={styles.appName}>CinePlay</Text>}>
                        <LinearGradient
                            colors={['#1F80E0', '#D63484']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Text style={[styles.appName, { opacity: 0 }]}>CinePlay</Text>
                        </LinearGradient>
                    </MaskedView>

                    <TouchableOpacity
                        style={styles.headerRightBtn}
                        onPress={() => handleAuthAction(() => router.push('/my-list'))}
                    >
                        <Ionicons name="bookmarks" size={24} color="#E0E0E0" />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    ref={scrollRef}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    overScrollMode="never" // CRITICAL FIX: Disables stretching glow on Android
                    bounces={false}        // CRITICAL FIX: Disables bouncing on iOS
                >
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>For You</Text>
                    </View>

                    <View style={styles.deckArea}>
                        {renderCardStack()}
                    </View>

                    <View style={styles.categoriesWrapper}>
                        {CATEGORIES.map((categoryTitle, index) => (
                            <HorizontalRow
                                key={index.toString()}
                                title={categoryTitle}
                                data={MOCK_ROW_POSTERS}
                                onAuthAction={handleAuthAction}
                                userLists={userLists}
                                toggleAction={handleToggleAction}
                            />
                        ))}
                    </View>

                    <LanguageRow router={router} />
                    <GenreRow router={router} />

                </ScrollView>
            </SafeAreaView>
        </LinearGradient>
    );
};

export default HomeScreen;

const styles = StyleSheet.create({
    background: { flex: 1 },
    container: { flex: 1 },
    header: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    appName: { fontSize: 26, fontWeight: '900', letterSpacing: 0.5 },
    headerRightBtn: { padding: 4 },
    scrollContent: { paddingBottom: 60 },
    sectionHeader: { paddingHorizontal: 16, marginTop: 10, marginBottom: 6 },
    sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },

    deckArea: { height: 440, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    mainCardContainer: { width: width * 0.85, height: 430, backgroundColor: '#2A1E39', borderRadius: 22, overflow: 'hidden', position: 'absolute', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 8 },
    mainCardImage: { width: '100%', height: '100%', position: 'absolute' },
    badgeContainer: { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15, 15, 20, 0.75)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)' },
    badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
    gradientOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 16 },
    movieDetailsContainer: { width: '72%' },
    movieTitle: { color: '#F5C518', fontSize: 26, fontWeight: '900', letterSpacing: 0.5, textShadowColor: 'rgba(0, 0, 0, 0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
    movieSubtitle: { color: '#E0E0E0', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginVertical: 3 },
    metadataText: { color: '#B0B5B9', fontSize: 11, fontWeight: '500' },

    actionButtonsWrapper: {
        position: 'absolute',
        bottom: 18,
        right: 14,
        alignItems: 'center',
        gap: 12
    },
    iconActionBtn: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(30, 30, 35, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.2,
        borderColor: 'rgba(255, 255, 255, 0.35)'
    },
    playButton: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#E5E5EA',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 4
    },

    categoriesWrapper: { paddingTop: 4 },
    rowContainer: { marginBottom: 28 },
    rowTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 14, letterSpacing: 0.2 },
    rowListContent: { paddingHorizontal: 16, gap: 10 },

    smallCard: { width: 112, height: 162, backgroundColor: '#1E1428', borderRadius: 8, overflow: 'hidden', position: 'relative' },
    smallCardImage: { width: '100%', height: '100%', position: 'absolute' },
    translucentRatingBadge: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
    smallCardRatingText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold', marginLeft: 3, marginTop: 1 },

    smallCardActions: { position: 'absolute', top: 6, right: 6, gap: 6 },
    smallIconBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)'
    },

    wideCard: { width: 145, height: 75, borderRadius: 8, overflow: 'hidden', position: 'relative', justifyContent: 'center' },

    languageImage: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '70%' },
    languageGradient: { ...StyleSheet.absoluteFillObject },

    languageTextContainer: { paddingLeft: 14, justifyContent: 'center' },
    languageMainText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.2 },
    languageSubText: { color: '#A0A0A5', fontSize: 11, marginTop: 2 },

    genreImage: { position: 'absolute', width: '100%', height: '100%', opacity: 0.8 },
    genreTintOverlay: { position: 'absolute', width: '100%', height: '100%' },
    genreTitle: { position: 'absolute', bottom: 10, left: 12, color: '#FFFFFF', fontSize: 15, fontWeight: 'bold', letterSpacing: 0.2 }
});