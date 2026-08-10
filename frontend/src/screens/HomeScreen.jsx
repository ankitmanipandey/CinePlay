import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
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
    FlatList,
    Easing,
    ActivityIndicator,
    LayoutAnimation,
    Platform,
    UIManager
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- Global State & Config ---
import { useMovieStore } from '../store/useMovieStore';
import { useUserListStore } from '../store/useUserListStore';
import { useAuthStore } from '../store/useAuthStore';
import { getImageUrl } from '../constants/config';
import { tmdbService } from '../services/tmdbService';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = 60;
const SWIPE_VELOCITY = 1.0;

const MOCK_LANGUAGES = [
    { id: 'l1', title: 'Hindi', code: 'hi', subtitle: 'हिन्दी', fallbackImage: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&q=60', color: '#323246' },
    { id: 'l2', title: 'English', code: 'en', subtitle: 'Hollywood', fallbackImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=60', color: '#5A3732' },
    { id: 'l3', title: 'Tamil', code: 'ta', subtitle: 'தமிழ்', fallbackImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&q=60', color: '#4A3428' },
    { id: 'l4', title: 'Telugu', code: 'te', subtitle: 'తెలుగు', fallbackImage: 'https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?w=300&q=60', color: '#2C3E50' },
    { id: 'l5', title: 'Punjabi', code: 'pa', subtitle: 'ਪੰਜਾਬੀ', fallbackImage: 'https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?w=300&q=60', color: '#4A4A28' },
    { id: 'l6', title: 'Malayalam', code: 'ml', subtitle: 'മലയാളം', fallbackImage: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=300&q=60', color: '#284A3B' },
];

// --- DROP-DOWN FILTER UI COMPONENTS ---
const FilterDropdown = ({ filters, setFilter }) => {
    const regionOptions = [{ l: 'All', v: 'all' }, { l: 'Indian', v: 'indian' }, { l: 'Others', v: 'others' }];
    const typeOptions = [{ l: 'All', v: 'all' }, { l: 'Movies', v: 'movie' }, { l: 'TV Shows / Web Series', v: 'tv' }];
    const langOptions = [{ l: 'Any', v: 'any' }, { l: 'Hindi', v: 'hi' }, { l: 'English', v: 'en' }, { l: 'Punjabi', v: 'pa' }, { l: 'Tamil', v: 'ta' }, { l: 'Others', v: 'others' }];

    const renderGroup = (title, options, activeValue, filterKey) => (
        <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>{title}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                {options.map(opt => {
                    const isActive = activeValue === opt.v;
                    return (
                        <TouchableOpacity
                            key={opt.v}
                            style={[styles.filterChip, isActive && styles.activeFilterChip]}
                            onPress={() => setFilter(filterKey, opt.v)}
                        >
                            <Text style={[styles.filterText, isActive && styles.activeFilterText]}>{opt.l}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );

    return (
        <View style={styles.filterDropdownContainer}>
            {renderGroup("Region", regionOptions, filters.region, 'region')}
            {renderGroup("Type", typeOptions, filters.type, 'type')}
            {renderGroup("Language", langOptions, filters.language, 'language')}
        </View>
    );
};

// --- ROWS ---
const HorizontalRow = React.memo(({ title, data, onAuthAction, watchlist, watched, toggleAction, router }) => {
    if (!data || data.length === 0) return null;

    return (
        <View style={styles.rowContainer}>
            <Text style={styles.rowTitle}>{title}</Text>
            <FlatList
                horizontal
                data={data}
                keyExtractor={(item, index) => `${item.id}-${index}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rowListContent}
                renderItem={({ item }) => {
                    const inWatchlist = watchlist[item.id];
                    const inWatched = watched[item.id];
                    const posterUri = getImageUrl(item.poster_path);
                    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
                    const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');

                    return (
                        <TouchableOpacity
                            style={styles.smallCard}
                            activeOpacity={0.7}
                            delayPressIn={0}
                            onPress={() => router.push({ pathname: '/player', params: { id: item.id, type: type } })}
                        >
                            <Image source={{ uri: posterUri }} style={styles.smallCardImage} resizeMode="cover" />
                            <View style={styles.translucentRatingBadge}>
                                <Ionicons name="star" size={10} color="#F5C518" />
                                <Text style={styles.smallCardRatingText}>{rating}</Text>
                            </View>
                            <View style={styles.smallCardActions}>
                                <TouchableOpacity style={styles.smallIconBtn} activeOpacity={0.8} onPress={() => onAuthAction(() => toggleAction(item.id, 'watchlist'))}>
                                    <Ionicons name={inWatchlist ? "bookmark" : "bookmark-outline"} size={14} color={inWatchlist ? "#F5C518" : "#FFFFFF"} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.smallIconBtn} activeOpacity={0.8} onPress={() => onAuthAction(() => toggleAction(item.id, 'watched'))}>
                                    <Ionicons name="checkmark-done" size={14} color={inWatched ? "#1F80E0" : "#FFFFFF"} />
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );
});

// Dynamic Language Row - Fetches 1st movie per language
const LanguageRow = React.memo(({ router }) => {
    const [dynamicImages, setDynamicImages] = useState({});

    useEffect(() => {
        const fetchImages = async () => {
            const newImages = {};
            await Promise.all(MOCK_LANGUAGES.map(async (lang) => {
                try {
                    const res = await tmdbService.fetchSection({ type: 'movie', language: lang.code }, {});

                    if (res && res.length > 0) {
                        newImages[lang.id] = getImageUrl(res[0].backdrop_path || res[0].poster_path);
                    }
                } catch (e) {
                    console.error(`Failed to fetch image for ${lang.title}:`, e);
                }
            }));
            setDynamicImages(newImages);
        };
        fetchImages();
    }, []);

    return (
        <View style={styles.rowContainer}>
            <Text style={styles.rowTitle}>Popular Languages</Text>
            <FlatList
                horizontal
                data={MOCK_LANGUAGES}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rowListContent}
                renderItem={({ item }) => {
                    const imageUri = dynamicImages[item.id] || item.fallbackImage;
                    return (
                        <TouchableOpacity
                            style={[styles.wideCard, { backgroundColor: item.color }]}
                            activeOpacity={0.85}
                            // Route directly to CategoryScreen, passing the Language Title
                            onPress={() => router.push({ pathname: '/category', params: { title: item.title } })}
                        >
                            <Image source={{ uri: imageUri }} style={styles.languageImage} resizeMode="cover" />
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
                    );
                }}
            />
        </View>
    );
});

// Dynamic Genre Row - Pulls 1st movie from existing store arrays
const GenreRow = React.memo(({ router, lists }) => {
    const genres = [
        { id: 'g1', title: 'Action', data: lists.actionList, tint: 'rgba(150, 50, 50, 0.4)' },
        { id: 'g2', title: 'Thriller', data: lists.thrillerList, tint: 'rgba(30, 30, 30, 0.5)' },
        { id: 'g3', title: 'Sci-Fi', data: lists.scifiList, tint: 'rgba(50, 50, 150, 0.4)' },
        { id: 'g4', title: 'Romance', data: lists.romanceList, tint: 'rgba(150, 50, 100, 0.4)' },
        { id: 'g5', title: 'Comedy', data: lists.comedyList, tint: 'rgba(150, 100, 50, 0.4)' },
        { id: 'g6', title: 'Horror', data: lists.horrorList, tint: 'rgba(60, 10, 10, 0.5)' },
    ];

    return (
        <View style={styles.rowContainer}>
            <Text style={styles.rowTitle}>Popular Genres</Text>
            <FlatList
                horizontal
                data={genres}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rowListContent}
                renderItem={({ item }) => {
                    const firstMovie = item.data?.[0];
                    const imageUri = firstMovie
                        ? getImageUrl(firstMovie.backdrop_path || firstMovie.poster_path)
                        : 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=300&q=60';

                    return (
                        <TouchableOpacity
                            style={styles.wideCard}
                            activeOpacity={0.85}
                            // Route directly to CategoryScreen, passing the Genre Title
                            onPress={() => router.push({ pathname: '/category', params: { title: item.title } })}
                        >
                            <Image source={{ uri: imageUri }} style={styles.genreImage} resizeMode="cover" />
                            <View style={[styles.genreTintOverlay, { backgroundColor: item.tint }]} />
                            <Text style={styles.genreTitle}>{item.title}</Text>
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );
});

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

    const [pan, setPan] = useState(() => new Animated.ValueXY());
    const isDragging = useRef(false);
    const isTransitioning = useRef(false);

    const moviesLengthRef = useRef(0);
    useEffect(() => {
        moviesLengthRef.current = trendingList.length;
    }, [trendingList]);

    useEffect(() => {
        fetchAllData();
    }, []);

    // Toggle Filters with a smooth animation
    const toggleFilterMenu = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowFilters(!showFilters);
    };

    // Memoize actions so rows don't re-render
    const handleAuthAction = useCallback((actionCallback) => {
        if (!token) {
            Toast.show({ type: 'hotstarInfo', text1: 'Log in for personalization', position: 'top', topOffset: insets.top > 0 ? insets.top + 10 : 50, visibilityTime: 2500 });
        } else {
            actionCallback();
        }
    }, [token, insets.top]);

    const handleToggleAction = useCallback((id, targetList) => {
        if (targetList === 'watchlist') toggleWatchlist(id);
        if (targetList === 'watched') toggleWatched(id);
    }, [toggleWatchlist, toggleWatched]);

    const forceSwipe = (direction, isAuto = false) => {
        isTransitioning.current = true;
        const x = direction === 'right' ? width * 1.5 : -width * 1.5;
        Animated.timing(pan, {
            toValue: { x, y: 0 },
            duration: isAuto ? 700 : 300,
            easing: isAuto ? Easing.inOut(Easing.sin) : Easing.out(Easing.quad),
            useNativeDriver: false,
        }).start(() => onSwipeComplete());
    };

    const onSwipeComplete = () => {
        setPan(new Animated.ValueXY());
        setCurrentIndex((prevIndex) => (prevIndex + 1) % (moviesLengthRef.current || 1));
    };

    useEffect(() => {
        isTransitioning.current = false;
    }, [pan]);

    const resetPosition = () => {
        Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: false,
        }).start();
    };

    const panResponder = useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
            if (isTransitioning.current) return false;
            const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
            return isHorizontal && Math.abs(gestureState.dx) > 5;
        },
        onMoveShouldSetPanResponder: (_, gestureState) => {
            if (isTransitioning.current) return false;
            const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
            return isHorizontal && Math.abs(gestureState.dx) > 5;
        },
        onPanResponderGrant: () => {
            isDragging.current = true;
            pan.stopAnimation();
            pan.extractOffset();
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }),
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, gestureState) => {
            isDragging.current = false;
            pan.flattenOffset();
            if (gestureState.dx > SWIPE_THRESHOLD || gestureState.vx > SWIPE_VELOCITY) {
                forceSwipe('right', false);
            } else if (gestureState.dx < -SWIPE_THRESHOLD || gestureState.vx < -SWIPE_VELOCITY) {
                forceSwipe('left', false);
            } else {
                resetPosition();
            }
        },
        onPanResponderTerminate: () => {
            isDragging.current = false;
            resetPosition();
        }
    }), [pan]);

    useEffect(() => {
        const timer = setInterval(() => {
            if (!isDragging.current && !isTransitioning.current && trendingList.length > 0) {
                forceSwipe('left', true);
            }
        }, 3500);

        return () => clearInterval(timer);
    }, [pan, trendingList.length]);

    const rotate = pan.x.interpolate({ inputRange: [-width / 2, 0, width / 2], outputRange: ['-10deg', '0deg', '10deg'], extrapolate: 'clamp' });
    const topCardOpacity = pan.x.interpolate({ inputRange: [-width / 1.5, 0, width / 1.5], outputRange: [0, 1, 0], extrapolate: 'clamp' });
    const nextCardScale = pan.x.interpolate({ inputRange: [-width / 2, 0, width / 2], outputRange: [1, 0.92, 1], extrapolate: 'clamp' });

    const renderCardContent = (item) => {
        const inWatchlist = watchlist[item.id];
        const inWatched = watched[item.id];
        const posterUri = getImageUrl(item.poster_path);
        const title = item.title || item.name;
        const dateString = item.release_date || item.first_air_date;
        const year = dateString ? dateString.substring(0, 4) : '';
        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
        const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');

        return (
            <>
                <Image source={{ uri: posterUri }} style={styles.mainCardImage} resizeMode="cover" />
                <View style={styles.badgeContainer}><Ionicons name="ticket" size={13} color="#F5C518" style={{ marginRight: 4 }} /><Text style={styles.badgeText}>IMDb {rating}</Text></View>
                <LinearGradient colors={['transparent', 'rgba(10, 10, 12, 0.75)', '#0A0A0C']} style={styles.gradientOverlay}>
                    <View style={styles.movieDetailsContainer}>
                        <Text style={styles.movieTitle} numberOfLines={1}>{title}</Text>
                        <Text style={styles.movieSubtitle} numberOfLines={2}>{item.overview}</Text>
                        <Text style={styles.metadataText}>{year}  •  TMDB</Text>
                    </View>
                </LinearGradient>
                <View style={styles.actionButtonsWrapper}>
                    <TouchableOpacity style={styles.iconActionBtn} activeOpacity={0.8} onPress={() => handleAuthAction(() => handleToggleAction(item.id, 'watchlist'))}>
                        <Ionicons name={inWatchlist ? "bookmark" : "bookmark-outline"} size={24} color={inWatchlist ? "#F5C518" : "#FFFFFF"} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconActionBtn} activeOpacity={0.8} onPress={() => handleAuthAction(() => handleToggleAction(item.id, 'watched'))}>
                        <Ionicons name="checkmark-done" size={22} color={inWatched ? "#1F80E0" : "#FFFFFF"} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.playButton} activeOpacity={0.8} onPress={() => router.push({ pathname: '/player', params: { id: item.id, type: type } })}>
                        <Ionicons name="play" size={26} color="#000000" style={{ marginLeft: 3 }} />
                    </TouchableOpacity>
                </View>
            </>
        );
    };

    const renderCardStack = () => {
        if (isLoading || trendingList.length === 0) {
            return (
                <View style={[styles.mainCardContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="large" color="#1F80E0" />
                </View>
            );
        }
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
        { title: "Trending", data: trendingList },
        { title: "Top Rated", data: topRatedList },
        { title: "Latest", data: latestList },
        { title: "Action Blockbusters", data: actionList },
        { title: "Comedy", data: comedyList },
        { title: "Thriller", data: thrillerList },
        { title: "Horror", data: horrorList },
        { title: "Romance", data: romanceList },
        { title: "Sci-Fi", data: scifiList },
        { title: "Feel Good", data: feelGoodList },
        { title: "Biopics", data: biopicsList }
    ];

    return (
        <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.background}>
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                <View style={styles.header}>
                    <MaskedView maskElement={<Text style={styles.appName}>CinePlay</Text>}>
                        <LinearGradient colors={['#1F80E0', '#D63484']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                            <Text style={[styles.appName, { opacity: 0 }]}>CinePlay</Text>
                        </LinearGradient>
                    </MaskedView>
                    <TouchableOpacity style={styles.headerRightBtn} onPress={() => handleAuthAction(() => router.push('/my-list'))}>
                        <Ionicons name="bookmarks" size={24} color="#E0E0E0" />
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} bounces={false}>

                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>For You</Text>
                    </View>

                    <View style={styles.deckArea}>
                        {renderCardStack()}
                    </View>

                    <View style={styles.filterBarHeader}>
                        <Text style={styles.filterTitle}>Explore Collections</Text>
                        <TouchableOpacity
                            style={[styles.funnelBtn, showFilters && styles.funnelBtnActive]}
                            onPress={toggleFilterMenu}
                        >
                            <Ionicons name="funnel" size={20} color={showFilters ? "#1F80E0" : "#FFFFFF"} />
                        </TouchableOpacity>
                    </View>

                    {showFilters && <FilterDropdown filters={filters} setFilter={setFilter} />}

                    <View style={styles.categoriesWrapper}>
                        {isLoading ? (
                            <ActivityIndicator size="large" color="#1F80E0" style={{ marginTop: 40, marginBottom: 80 }} />
                        ) : (
                            categoryData.map((category, index) => (
                                <HorizontalRow
                                    key={index.toString()}
                                    title={category.title}
                                    data={category.data}
                                    onAuthAction={handleAuthAction}
                                    watchlist={watchlist}
                                    watched={watched}
                                    toggleAction={handleToggleAction}
                                    router={router}
                                />
                            ))
                        )}
                    </View>

                    <LanguageRow router={router} />
                    <GenreRow router={router} lists={{ actionList, thrillerList, scifiList, romanceList, comedyList, horrorList }} />

                </ScrollView>
            </SafeAreaView>
        </LinearGradient>
    );
};

export default HomeScreen;

const styles = StyleSheet.create({
    background: { flex: 1 },
    container: { flex: 1 },
    header: { paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    appName: { fontSize: 26, fontWeight: '900', letterSpacing: 0.5 },
    headerRightBtn: { padding: 4 },
    scrollContent: { paddingBottom: 60 },
    sectionHeader: { paddingHorizontal: 16, marginTop: 10, marginBottom: 6 },
    sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    deckArea: { height: 440, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },

    // FILTER UI STYLES
    filterBarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 14 },
    filterTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    funnelBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    funnelBtnActive: { backgroundColor: 'rgba(31, 128, 224, 0.2)', borderColor: '#1F80E0' },
    filterDropdownContainer: { backgroundColor: 'rgba(20, 15, 30, 0.8)', paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 20 },
    filterGroup: { marginBottom: 16 },
    filterGroupTitle: { color: '#808085', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', paddingHorizontal: 16, marginBottom: 8, letterSpacing: 1 },
    filterScroll: { paddingHorizontal: 16, gap: 10 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    activeFilterChip: { backgroundColor: '#1F80E0', borderColor: '#1F80E0' },
    filterText: { color: '#A0A0A5', fontSize: 13, fontWeight: '600' },
    activeFilterText: { color: '#FFFFFF' },

    categoriesWrapper: { paddingTop: 4 },
    rowContainer: { marginBottom: 28 },
    rowTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 14, letterSpacing: 0.2 },
    rowListContent: { paddingHorizontal: 16, gap: 10 },

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
    playButton: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#E5E5EA', justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 4 },

    smallCard: { width: 112, height: 162, backgroundColor: '#1E1428', borderRadius: 8, overflow: 'hidden', position: 'relative' },
    smallCardImage: { width: '100%', height: '100%', position: 'absolute' },
    translucentRatingBadge: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
    smallCardRatingText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold', marginLeft: 3, marginTop: 1 },
    smallCardActions: { position: 'absolute', top: 6, right: 6, gap: 6 },
    smallIconBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' },

    wideCard: { width: 145, height: 75, borderRadius: 8, overflow: 'hidden', position: 'relative', justifyContent: 'center' },
    languageImage: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '70%' },
    languageGradient: { ...StyleSheet.absoluteFillObject },
    languageTextContainer: { paddingLeft: 14, justifyContent: 'center' },
    languageMainText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.2 },
    languageSubText: { color: '#A0A0A5', fontSize: 11, marginTop: 2 },

    genreImage: { position: 'absolute', width: '100%', height: '100%' },
    genreTintOverlay: { position: 'absolute', width: '100%', height: '100%' },
    genreTitle: {
        position: 'absolute', bottom: 10, left: 12, color: '#FFFFFF',
        fontSize: 15, fontWeight: 'bold', letterSpacing: 0.2,
        textShadowColor: 'rgba(0, 0, 0, 0.9)', textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 4
    }
});