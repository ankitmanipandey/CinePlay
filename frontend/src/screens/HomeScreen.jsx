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
    Platform,
    UIManager,
    TextInput
} from 'react-native';
import ReAnimated, { FadeIn, FadeOut, LinearTransition, FadeInDown, FadeInUp, FadeOutUp } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Circle, Path } from 'react-native-svg';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- Global Stores ---
import { useMovieStore } from '../store/useMovieStore';
import { useUserListStore } from '../store/useUserListStore';
import { useAuthStore } from '../store/useAuthStore';
import { useSportsStore } from '../store/useSportsStore';
import { useTvStore } from '../store/useTvStore';
import { getImageUrl } from '../constants/config';
import { tmdbService } from '../services/tmdbService';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = 60;
const SWIPE_VELOCITY = 1.0;

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

const MOCK_LANGUAGES = [
    { id: 'l1', title: 'Hindi', code: 'hi', subtitle: 'हिन्दी', fallbackImage: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&q=60', color: '#323246' },
    { id: 'l2', title: 'English', code: 'en', subtitle: 'Hollywood', fallbackImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=60', color: '#5A3732' },
    { id: 'l3', title: 'Tamil', code: 'ta', subtitle: 'தமிழ்', fallbackImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&q=60', color: '#4A3428' },
    { id: 'l4', title: 'Telugu', code: 'te', subtitle: 'తెలుగు', fallbackImage: 'https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?w=300&q=60', color: '#2C3E50' },
    { id: 'l5', title: 'Punjabi', code: 'pa', subtitle: 'ਪੰਜਾਬੀ', fallbackImage: 'https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?w=300&q=60', color: '#4A4A28' },
    { id: 'l6', title: 'Malayalam', code: 'ml', subtitle: 'മലയാളം', fallbackImage: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=300&q=60', color: '#284A3B' },
];

const LiveSportsFeed = ({ selectedSport }) => {
    const { liveMatches, isLoadingSports, fetchLiveScores } = useSportsStore();

    useEffect(() => {
        fetchLiveScores();
        const intervalId = setInterval(() => {
            fetchLiveScores();
        }, 15000);

        return () => clearInterval(intervalId);
    }, []);

    const displayedMatches = useMemo(() => {
        if (!selectedSport || selectedSport === 'all') return liveMatches;
        return liveMatches.filter(match => match.sport === selectedSport);
    }, [liveMatches, selectedSport]);

    if (isLoadingSports && liveMatches.length === 0) {
        return (
            <ReAnimated.View entering={FadeIn} exiting={FadeOut} style={[styles.sportsContainer, { alignItems: 'center', paddingTop: 40 }]}>
                <ActivityIndicator size="large" color="#00E5FF" />
            </ReAnimated.View>
        );
    }

    if (displayedMatches.length === 0) {
        return (
            <ReAnimated.View entering={FadeIn} exiting={FadeOut} layout={LinearTransition} style={styles.sportsContainer}>
                <Text style={styles.rowTitle}>Live Matches & Scores</Text>
                <Text style={{ color: '#8F98A0', textAlign: 'center', marginTop: 20 }}>
                    {selectedSport === 'all' ? "No matches currently scheduled." : `No live ${selectedSport} matches right now.`}
                </Text>
            </ReAnimated.View>
        );
    }

    return (
        <ReAnimated.View layout={LinearTransition} style={styles.sportsContainer}>
            <Text style={styles.rowTitle}>Live Matches & Scores</Text>
            {displayedMatches.map((match, index) => (
                <ReAnimated.View
                    key={match.id}
                    entering={FadeInDown.delay(index * 40).duration(300)}
                    exiting={FadeOut.duration(200)}
                    layout={LinearTransition.springify().damping(14)}
                >
                    <TouchableOpacity style={styles.sportsCard} activeOpacity={0.85}>
                        <View style={styles.sportsCardHeader}>
                            <Text style={styles.sportsSportText}>{match.sport}</Text>
                            <View style={[styles.liveBadge, !match.isLive && { backgroundColor: '#808085' }]}>
                                <Text style={styles.liveBadgeText}>{match.status}</Text>
                            </View>
                        </View>

                        <Text style={styles.sportsTitle}>{match.title}</Text>

                        <View style={styles.sportsMatchInfo}>
                            <View style={styles.sportsTeamWrap}>
                                <Image source={{ uri: match.team1Logo }} style={styles.sportsFlag} />
                                <Text style={styles.sportsScoreText}>{match.team1Score}</Text>
                            </View>
                            <Text style={styles.sportsVs}>vs</Text>
                            <View style={styles.sportsTeamWrapRight}>
                                <Text style={styles.sportsScoreText}>{match.team2Score}</Text>
                                <Image source={{ uri: match.team2Logo }} style={styles.sportsFlag} />
                            </View>
                        </View>

                        <View style={styles.sportsCommentaryBox}>
                            <Ionicons name="mic" size={14} color="#00E5FF" />
                            <Text style={styles.sportsCommentaryText} numberOfLines={2}>
                                {match.commentary}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </ReAnimated.View>
            ))}
        </ReAnimated.View>
    );
};

// --- 2. LIVE TV FEED (With Search Box) ---
const LiveTvFeed = ({ selectedCategory, selectedLanguage }) => {
    const router = useRouter();
    const { allChannels, activeFeeds, isLoadingTv, fetchTvData, filterByCategory } = useTvStore();

    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (allChannels.length === 0) fetchTvData();
    }, []);

    useEffect(() => {
        filterByCategory(selectedCategory, selectedLanguage);
        setSearchQuery('');
    }, [selectedCategory, selectedLanguage, allChannels]);

    const displayedChannels = useMemo(() => {
        if (!searchQuery.trim()) return activeFeeds;
        return activeFeeds.filter(channel =>
            channel.title.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [activeFeeds, searchQuery]);

    if (isLoadingTv && allChannels.length === 0) {
        return (
            <ReAnimated.View entering={FadeIn} exiting={FadeOut} style={[styles.sportsContainer, { alignItems: 'center', paddingTop: 40 }]}>
                <ActivityIndicator size="large" color="#00E5FF" />
            </ReAnimated.View>
        );
    }

    return (
        <ReAnimated.View layout={LinearTransition} style={styles.sportsContainer}>
            <Text style={styles.rowTitle}>Live TV Channels</Text>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#8F98A0" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search channels..."
                    placeholderTextColor="#8F98A0"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    selectionColor="#00E5FF"
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                        <Ionicons name="close-circle" size={18} color="#8F98A0" />
                    </TouchableOpacity>
                )}
            </View>

            {displayedChannels.length === 0 ? (
                <Text style={{ color: '#8F98A0', textAlign: 'center', marginTop: 20 }}>
                    {searchQuery
                        ? `No channels matching "${searchQuery}"`
                        : `No channels currently broadcasting for ${selectedCategory} in the selected language.`}
                </Text>
            ) : (
                <FlatList
                    data={displayedChannels}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    scrollEnabled={false}
                    columnWrapperStyle={{ justifyContent: 'space-between' }}
                    initialNumToRender={8}
                    maxToRenderPerBatch={8}
                    windowSize={5}
                    removeClippedSubviews={Platform.OS === 'android'}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    renderItem={({ item: channel }) => (
                        <View style={styles.tvCardWrapper}>
                            <TouchableOpacity
                                style={styles.tvCard}
                                activeOpacity={0.8}
                                onPress={() => router.push({ pathname: '/player', params: { streamUrl: channel.url, channelName: channel.title } })}
                            >
                                <View style={styles.tvLogoContainer}>
                                    <Image source={{ uri: channel.logo }} style={styles.tvLogo} resizeMode="contain" />
                                </View>
                                <View style={styles.tvCardInfo}>
                                    <Text style={styles.tvChannelName} numberOfLines={1}>{channel.title}</Text>
                                    <View style={styles.tvLiveBadge}>
                                        <View style={styles.tvLiveDot} />
                                        <Text style={styles.tvCategoryText}>{channel.category}</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}
                />
            )}
        </ReAnimated.View>
    );
};

const FilterDropdown = ({ filters, setFilter }) => {
    const regionOptions = [{ l: 'All', v: 'all' }, { l: 'Indian', v: 'indian' }, { l: 'Others', v: 'others' }];
    const typeOptions = [
        { l: 'All', v: 'all' },
        { l: 'Movies', v: 'movie' },
        { l: 'TV Shows / Web Series', v: 'tv' },
        { l: 'Live Sports & TV', v: 'live' }
    ];
    const langOptions = [{ l: 'Any', v: 'any' }, { l: 'Hindi', v: 'hi' }, { l: 'English', v: 'en' }, { l: 'Punjabi', v: 'pa' }, { l: 'Tamil', v: 'ta' }, { l: 'Others', v: 'others' }];

    const platformOptions = [
        { l: 'Any', v: 'any' },
        { l: 'Netflix', v: '8' },
        { l: 'Prime Video', v: '119' },
        { l: 'JioHotstar', v: '122|220|337' },
        { l: 'SonyLIV', v: '237' },
        { l: 'Zee5', v: '232' }
    ];

    const liveOptions = [
        { l: 'Cricket (Scores)', v: 'Cricket' },
        { l: 'Football (Scores)', v: 'Football' },
        { l: 'Basketball (Scores)', v: 'Basketball' },
        { l: 'Live News', v: 'news' },
        { l: 'Live Music', v: 'music' },
        { l: 'Entertainment TV', v: 'entertainment' },
        { l: 'Movies TV', v: 'movies' }
    ];

    const renderGroup = (title, options, activeValue, filterKey) => (
        <ReAnimated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>{title}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                {options.map(opt => {
                    const isActive = activeValue === opt.v;
                    return (
                        <TouchableOpacity
                            key={opt.v}
                            style={styles.filterChipContainer}
                            onPress={() => setFilter(filterKey, opt.v)}
                            activeOpacity={0.8}
                        >
                            {isActive ? (
                                <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.filterChipActive}>
                                    <Text style={styles.activeFilterText}>{opt.l}</Text>
                                </LinearGradient>
                            ) : (
                                <View style={styles.filterChipInactive}>
                                    <Text style={styles.filterText}>{opt.l}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </ReAnimated.View>
    );

    const activeLiveCategory = filters.liveCategory || 'Cricket';
    const isLiveSportsFeed = ['Cricket', 'Football', 'Basketball'].includes(activeLiveCategory);

    return (
        <ReAnimated.View layout={LinearTransition} style={styles.filterDropdownContainer}>
            {renderGroup("Category", typeOptions, filters.type, 'type')}

            {filters.type === 'live' ? (
                <>
                    {renderGroup("Live Feed", liveOptions, activeLiveCategory, 'liveCategory')}
                    {!isLiveSportsFeed && renderGroup("Language", langOptions, filters.language || 'any', 'language')}
                </>
            ) : (
                <>
                    {renderGroup("Platform", platformOptions, filters.platform || 'any', 'platform')}
                    {renderGroup("Region", regionOptions, filters.region, 'region')}
                    {renderGroup("Language", langOptions, filters.language, 'language')}
                </>
            )}
        </ReAnimated.View>
    );
};

const MovieCard = React.memo(({ item, inWatchlist, inWatched, onToggleAction, router }) => {
    const posterUri = getImageUrl(item.poster_path);
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');

    return (
        <TouchableOpacity
            style={styles.smallCard}
            activeOpacity={0.7}
            delayPressIn={0}
            onPress={() => router.push({ pathname: '/player', params: { id: item.id, type: mediaType } })}
        >
            <Image source={{ uri: posterUri }} style={styles.smallCardImage} resizeMode="cover" />
            <View style={styles.translucentRatingBadge}>
                <Ionicons name="star" size={10} color="#F5C518" />
                <Text style={styles.smallCardRatingText}>{rating}</Text>
            </View>
            <View style={styles.smallCardActions}>
                <TouchableOpacity style={styles.smallIconBtn} activeOpacity={0.8} onPress={() => onToggleAction(item.id, mediaType, 'watchlist')}>
                    <Ionicons name={inWatchlist ? "bookmark" : "bookmark-outline"} size={14} color={inWatchlist ? "#FF007A" : "#FFFFFF"} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.smallIconBtn} activeOpacity={0.8} onPress={() => onToggleAction(item.id, mediaType, 'watched')}>
                    <Ionicons name="checkmark-done" size={14} color={inWatched ? "#00E5FF" : "#FFFFFF"} />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.inWatchlist === nextProps.inWatchlist &&
        prevProps.inWatched === nextProps.inWatched &&
        prevProps.item.id === nextProps.item.id
    );
});

const HorizontalRow = React.memo(({ title, data, onAuthAction, watchlist, watched, toggleAction, router }) => {
    if (!data || data.length === 0) return null;

    const handleToggle = useCallback((id, mediaType, listType) => {
        onAuthAction(() => toggleAction(id, mediaType, listType));
    }, [onAuthAction, toggleAction]);

    const renderItem = useCallback(({ item }) => (
        <MovieCard item={item} inWatchlist={!!watchlist[item.id]} inWatched={!!watched[item.id]} onToggleAction={handleToggle} router={router} />
    ), [watchlist, watched, handleToggle, router]);

    return (
        <View style={styles.rowContainer}>
            <Text style={styles.rowTitle}>{title}</Text>
            <FlatList
                horizontal
                data={data}
                extraData={{ watchlist, watched }}
                keyExtractor={(item) => String(item.id)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rowListContent}
                renderItem={renderItem}
                initialNumToRender={4}
                maxToRenderPerBatch={4}
                windowSize={3}
                removeClippedSubviews={Platform.OS === 'android'}
                getItemLayout={(data, index) => ({ length: 122, offset: 122 * index, index })}
            />
        </View>
    );
});

const LanguageRow = React.memo(({ router }) => {
    const [dynamicImages, setDynamicImages] = useState({});

    useEffect(() => {
        const fetchImages = async () => {
            const newImages = {};
            await Promise.all(MOCK_LANGUAGES.map(async (lang) => {
                try {
                    const res = await tmdbService.fetchSection({ type: 'movie', language: lang.code }, {});
                    if (res && res.length > 0) newImages[lang.id] = getImageUrl(res[0].backdrop_path || res[0].poster_path);
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
                            onPress={() => router.push({ pathname: '/category', params: { title: item.title } })}
                        >
                            <Image source={{ uri: imageUri }} style={styles.languageImage} resizeMode="cover" />
                            <LinearGradient colors={[item.color, `${item.color}E6`, `${item.color}00`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.languageGradient} />
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
                    const imageUri = firstMovie ? getImageUrl(firstMovie.backdrop_path || firstMovie.poster_path) : 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=300&q=60';
                    return (
                        <TouchableOpacity style={styles.wideCard} activeOpacity={0.85} onPress={() => router.push({ pathname: '/category', params: { title: item.title } })}>
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

const CinePlayLogo = ({ size = 38 }) => (
    <Svg viewBox="0 0 500 500" width={size} height={size}>
        <Defs>
            <SvgLinearGradient id="playGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#00E5FF" />
                <Stop offset="50%" stopColor="#9B51E0" />
                <Stop offset="100%" stopColor="#FF007A" />
            </SvgLinearGradient>
        </Defs>
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

    const moviesLengthRef = useRef(0);
    useEffect(() => {
        moviesLengthRef.current = trendingList.length;
    }, [trendingList]);

    useEffect(() => {
        fetchAllData();
    }, []);

    useEffect(() => {
        const syncUserLists = async () => {
            if (!token) return;
            try {
                const response = await fetch(`${BACKEND_URL}/user/lists`, { headers: { Authorization: `Bearer ${token}` } });
                if (response.ok) {
                    const data = await response.json();
                    const arrayToMap = (arr) => arr.reduce((acc, curr) => {
                        const [idStr, typeStr] = String(curr).split(':');
                        acc[idStr] = typeStr || 'movie';
                        return acc;
                    }, {});
                    useUserListStore.setState({
                        watchlist: arrayToMap(data.watchlist || []),
                        watched: arrayToMap(data.watched || [])
                    });
                }
            } catch (error) {
                console.error("Failed to sync user lists on load:", error);
            }
        };
        syncUserLists();
    }, [token]);

    const handleAuthAction = useCallback((actionCallback) => {
        if (!token) {
            Toast.show({
                type: 'hotstarInfo', text1: 'Log in for personalization', position: 'top',
                topOffset: insets.top > 0 ? insets.top + 10 : 50, visibilityTime: 2500,
            });
        } else {
            actionCallback();
        }
    }, [token, insets.top]);

    const handleToggleAction = useCallback(async (id, mediaType, targetList) => {
        if (targetList === 'watchlist') toggleWatchlist(id, mediaType);
        if (targetList === 'watched') toggleWatched(id, mediaType);

        try {
            const tmdbIdWithType = `${id}:${mediaType}`;
            const response = await fetch(`${BACKEND_URL}/user/${targetList}/toggle`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ tmdbId: tmdbIdWithType })
            });

            if (!response.ok) throw new Error('Failed to update on server');
            const data = await response.json();
            const arrayToMap = (arr) => arr.reduce((acc, curr) => {
                const [idStr, typeStr] = String(curr).split(':');
                acc[idStr] = typeStr || 'movie';
                return acc;
            }, {});

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
        Animated.timing(pan, {
            toValue: { x, y: 0 }, duration: isAuto ? 700 : 300,
            easing: isAuto ? Easing.inOut(Easing.sin) : Easing.out(Easing.quad), useNativeDriver: false,
        }).start(() => onSwipeComplete());
    };

    const onSwipeComplete = () => {
        setPan(new Animated.ValueXY());
        setCurrentIndex((prevIndex) => (prevIndex + 1) % (moviesLengthRef.current || 1));
    };

    useEffect(() => { isTransitioning.current = false; }, [pan]);
    const resetPosition = () => { Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: false }).start(); };

    const panResponder = useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
            if (isTransitioning.current) return false;
            return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 5;
        },
        onMoveShouldSetPanResponder: (_, gestureState) => {
            if (isTransitioning.current) return false;
            return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 5;
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
            if (gestureState.dx > SWIPE_THRESHOLD || gestureState.vx > SWIPE_VELOCITY) forceSwipe('right', false);
            else if (gestureState.dx < -SWIPE_THRESHOLD || gestureState.vx < -SWIPE_VELOCITY) forceSwipe('left', false);
            else resetPosition();
        },
        onPanResponderTerminate: () => {
            isDragging.current = false;
            resetPosition();
        }
    }), [pan]);

    useEffect(() => {
        const timer = setInterval(() => {
            if (!isDragging.current && !isTransitioning.current && trendingList.length > 0) forceSwipe('left', true);
        }, 3500);
        return () => clearInterval(timer);
    }, [pan, trendingList.length]);

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
                <View style={styles.badgeContainer}><Ionicons name="ticket" size={13} color="#F5C518" style={{ marginRight: 4 }} /><Text style={styles.badgeText}>IMDb {rating}</Text></View>
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
                    <TouchableOpacity style={styles.playButtonWrapper} activeOpacity={0.8} onPress={() => router.push({ pathname: '/player', params: { id: item.id, type: mediaType } })}>
                        <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.playButtonGradient}>
                            <Ionicons name="play" size={26} color="#FFFFFF" style={{ marginLeft: 3 }} />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </>
        );
    };

    const renderCardStack = () => {
        if (isLoading || trendingList.length === 0) {
            return (
                <View style={[styles.mainCardContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="large" color="#00E5FF" />
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

    const activeLiveCategory = filters.liveCategory || 'Cricket';
    const isLiveSportsFeed = ['Cricket', 'Football', 'Basketball'].includes(activeLiveCategory);

    return (
        <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.background}>
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <CinePlayLogo size={34} />
                        <MaskedView style={styles.maskedView} maskElement={<Text style={styles.appName}>CinePlay</Text>}>
                            <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                <Text style={[styles.appName, { opacity: 0 }]}>CinePlay</Text>
                            </LinearGradient>
                        </MaskedView>
                    </View>
                    <TouchableOpacity style={styles.headerRightBtn} onPress={() => handleAuthAction(() => router.push('/my-list'))}>
                        <Ionicons name="bookmarks" size={24} color="#E0E0E0" />
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} bounces={false}>

                    {filters.type !== 'live' && (
                        <ReAnimated.View entering={FadeInUp.duration(300)} exiting={FadeOutUp.duration(200)} layout={LinearTransition}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>For You</Text>
                            </View>
                            <View style={styles.deckArea}>
                                {renderCardStack()}
                            </View>
                        </ReAnimated.View>
                    )}

                    <ReAnimated.View layout={LinearTransition}>
                        <View style={styles.filterBarHeader}>
                            <Text style={styles.filterTitle}>Explore Collections</Text>
                            <TouchableOpacity style={[styles.funnelBtn, showFilters && styles.funnelBtnActive]} onPress={toggleFilterMenu}>
                                <Ionicons name="funnel" size={20} color={showFilters ? "#00E5FF" : "#FFFFFF"} />
                            </TouchableOpacity>
                        </View>
                    </ReAnimated.View>

                    {showFilters && (
                        <ReAnimated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} layout={LinearTransition}>
                            <FilterDropdown filters={filters} setFilter={setFilter} />
                        </ReAnimated.View>
                    )}

                    <ReAnimated.View layout={LinearTransition.duration(280)} style={styles.categoriesWrapper}>
                        {isLoading ? (
                            <ReAnimated.View key="loading" entering={FadeIn} exiting={FadeOut}>
                                <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 40, marginBottom: 80 }} />
                            </ReAnimated.View>
                        ) : filters.type === 'live' ? (
                            isLiveSportsFeed ? (
                                <ReAnimated.View key="live-sports" entering={FadeIn} exiting={FadeOut}>
                                    <LiveSportsFeed selectedSport={activeLiveCategory} />
                                </ReAnimated.View>
                            ) : (
                                <ReAnimated.View key="live-tv" entering={FadeIn} exiting={FadeOut}>
                                    <LiveTvFeed selectedCategory={activeLiveCategory} selectedLanguage={filters.language} />
                                </ReAnimated.View>
                            )
                        ) : (
                            <ReAnimated.View key="movies" entering={FadeIn} exiting={FadeOut}>
                                {categoryData.map((category, index) => (
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
                                ))}
                            </ReAnimated.View>
                        )}
                    </ReAnimated.View>

                    {filters.type !== 'live' && (
                        <ReAnimated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} layout={LinearTransition}>
                            <LanguageRow router={router} />
                            <GenreRow router={router} lists={{ actionList, thrillerList, scifiList, romanceList, comedyList, horrorList }} />
                        </ReAnimated.View>
                    )}

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
    logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    maskedView: { height: 32, flexDirection: 'row', alignItems: 'center' },
    appName: {
        fontSize: 26,
        fontWeight: '900',
        letterSpacing: 0.5,
        lineHeight: 32,
        includeFontPadding: false
    },
    headerRightBtn: { padding: 4 },
    scrollContent: { paddingBottom: 60 },
    sectionHeader: { paddingHorizontal: 16, marginTop: 10, marginBottom: 6 },
    sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    deckArea: { height: 440, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },

    filterBarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 14 },
    filterTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    funnelBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    funnelBtnActive: { backgroundColor: 'rgba(0, 229, 255, 0.15)', borderColor: '#00E5FF' },

    filterDropdownContainer: { backgroundColor: 'rgba(20, 15, 30, 0.8)', paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 20 },

    filterGroup: { marginBottom: 16 },
    filterGroupTitle: { color: '#808085', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', paddingHorizontal: 16, marginBottom: 8, letterSpacing: 1 },
    filterScroll: { paddingHorizontal: 16, gap: 10 },

    filterChipContainer: { borderRadius: 20, overflow: 'hidden' },
    filterChipActive: { paddingHorizontal: 16, paddingVertical: 8, justifyContent: 'center', alignItems: 'center', borderRadius: 20, },
    filterChipInactive: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
    filterText: { color: '#A0A0A5', fontSize: 13, fontWeight: '600' },
    activeFilterText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },

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

    playButtonWrapper: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', elevation: 6, shadowColor: '#FF007A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 4 },
    playButtonGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

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
    },

    sportsContainer: { paddingHorizontal: 16, paddingBottom: 20 },
    sportsCard: { backgroundColor: '#1E1428', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    sportsCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sportsSportText: { color: '#8F98A0', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
    liveBadge: { backgroundColor: '#FF007A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
    liveBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
    sportsMatchInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sportsTeamWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    sportsTeamWrapRight: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'flex-end' },
    sportsFlag: { width: 36, height: 26, borderRadius: 4, backgroundColor: '#2A2A30' },
    sportsScoreText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    sportsVs: { color: '#8F98A0', fontSize: 14, fontWeight: 'bold', paddingHorizontal: 10 },
    sportsTitle: { color: '#E0E0E0', fontSize: 14, marginBottom: 16, fontWeight: '600' },
    sportsCommentaryBox: { flexDirection: 'row', backgroundColor: 'rgba(0, 229, 255, 0.08)', padding: 12, borderRadius: 8, alignItems: 'center', gap: 8 },
    sportsCommentaryText: { color: '#00E5FF', fontSize: 13, flex: 1, fontStyle: 'italic' },

    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E1428',
        borderRadius: 12,
        paddingHorizontal: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        height: 44
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, color: '#FFF', fontSize: 14, height: '100%' },
    clearSearchBtn: { padding: 4 },

    // --- LIVE TV STYLES ---
    tvGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    tvCardWrapper: { width: '48%', marginBottom: 16 },
    tvCard: { backgroundColor: '#1E1428', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    tvLogoContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2A2A30', justifyContent: 'center', alignItems: 'center', marginBottom: 12, overflow: 'hidden' },
    tvLogo: { width: '80%', height: '80%' },
    tvCardInfo: { alignItems: 'center', width: '100%' },
    tvChannelName: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
    tvLiveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 0, 122, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    tvLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF007A', marginRight: 6 },
    tvCategoryText: { color: '#FF007A', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
});