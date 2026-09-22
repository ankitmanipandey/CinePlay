import React, { useRef, useState, useEffect } from 'react';
import {
    ActivityIndicator, Animated, Dimensions, Image, Modal, Platform, ScrollView,
    StatusBar, StyleSheet, Text, TouchableOpacity, UIManager, View, useWindowDimensions, Pressable, BackHandler
} from 'react-native';
import ReAnimated, {
    FadeIn, FadeOut, LinearTransition,
    useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { toastConfig } from '../app/_layout';
import { FilterDropdown } from '../components/home/FilterDropDown';
import { GenreRow, HorizontalRow, LanguageRow } from '../components/home/HomeRows';
import { LiveSportsFeed } from '../components/home/LiveSportsFeed';
import { LiveTvFeed } from '../components/home/LiveTvFeed';
import { MiniPlayer } from '../components/home/MiniPlayer';
import { YTMusicFeed } from '../components/home/YTMusicFeed';
import { MusicPlayerUI } from '../components/player/MusicPlayerUI';
import CinePlayLogo from '../components/Logo/CinePlayLogo';

import { useHomeLogic } from '../hooks/useHomeLogic';
import { getImageUrl } from '../constants/config';
import GradientText from '../components/Logo/GradientText';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- ANIMATED DESKTOP HOVER CARD COMPONENT ---
const DesktopHoverCard = ({ item, isTop10, index, watchlist, watched, handleAuthAction, handleToggleAction, handleNavigateToPlayer }) => {
    const [isHovered, setIsHovered] = useState(false);
    const hoverAnim = useRef(new Animated.Value(0)).current;

    const posterUri = getImageUrl(item.poster_path || item.backdrop_path);
    const inWatchlist = !!watchlist[item.id];
    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
    const year = (item.release_date || item.first_air_date || '').substring(0, 4);

    const handleHoverIn = () => {
        setIsHovered(true);
        Animated.spring(hoverAnim, { toValue: 1, friction: 6, tension: 40, useNativeDriver: false }).start();
    };

    const handleHoverOut = () => {
        Animated.timing(hoverAnim, { toValue: 0, duration: 150, useNativeDriver: false }).start(() => setIsHovered(false));
    };

    return (
        <View style={[styles.desktopCardWrapper, isTop10 && styles.desktopTop10Card, { zIndex: isHovered ? 9999 : 1 }]}>
            <Pressable
                onHoverIn={handleHoverIn}
                onHoverOut={handleHoverOut}
                onPress={() => handleNavigateToPlayer({ id: item.id, type: mediaType })}
                style={{ width: '100%', height: '100%' }}
            >
                {/* Standard Card */}
                <Image source={{ uri: posterUri }} style={styles.desktopCardImage} resizeMode="cover" />
                {isTop10 && <Text style={styles.top10Number}>{index + 1}</Text>}

                {/* Animated Popup Overlay */}
                {isHovered && (
                    <Animated.View style={[styles.desktopHoverPopup, {
                        opacity: hoverAnim,
                        transform: [{
                            scale: hoverAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.08] })
                        }]
                    }]}>
                        <Image source={{ uri: getImageUrl(item.backdrop_path || item.poster_path) }} style={styles.hoverPopupImage} resizeMode="cover" />
                        <LinearGradient colors={['transparent', '#11131A', '#11131A']} style={styles.hoverGradientContainer}>
                            <View style={styles.hoverControlsRow}>
                                <TouchableOpacity style={styles.hoverPlayBtn} onPress={() => handleNavigateToPlayer({ id: item.id, type: mediaType })}>
                                    <Ionicons name="play" size={16} color="#000" />
                                    <Text style={styles.hoverPlayBtnText}>Watch Now</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.hoverActionBtn} onPress={() => handleAuthAction(() => handleToggleAction(item.id, mediaType, 'watchlist'))}>
                                    <Ionicons name={inWatchlist ? "checkmark" : "add"} size={22} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.hoverTitleText} numberOfLines={1}>{item.title || item.name}</Text>
                            <Text style={styles.hoverMetaText}>{year} • U/A 16+ • Hindi</Text>
                            <Text style={styles.hoverSynopsisText} numberOfLines={3}>{item.overview}</Text>
                        </LinearGradient>
                    </Animated.View>
                )}
            </Pressable>
        </View>
    );
};

// --- DESKTOP ROW WRAPPER ---
const DesktopRow = ({ category, idx, categoryDataLength, mainScrollRef, ...props }) => {
    const scrollRef = useRef(null);
    const isTop10 = category.title === "Trending" || category.title.includes("Top");

    useEffect(() => {
        if (Platform.OS !== 'web' || !scrollRef.current) return;
        const node = scrollRef.current;

        const onWheel = (e) => {
            // Genuine horizontal intent: shift+wheel, or deltaX actually dominant
            const isHorizontalIntent = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);

            if (isHorizontalIntent) {
                // let the row's native overflow-x handle it
                return;
            }

            // Any vertical intent — mouse wheel tick or trackpad swipe — always
            // drives the page scroll, never the row. No flicker, no heuristics.
            e.preventDefault();
            const target = mainScrollRef?.current?.getScrollableNode
                ? mainScrollRef.current.getScrollableNode()
                : mainScrollRef?.current;
            if (target) target.scrollTop += e.deltaY;
        };

        node.addEventListener('wheel', onWheel, { passive: false });
        return () => node.removeEventListener('wheel', onWheel);
    }, [mainScrollRef]);

    return (
        <View style={[styles.desktopRowContainer, { zIndex: categoryDataLength - idx }]}>
            <Text style={styles.desktopRowHeader}>{category.title}</Text>
            <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 40, paddingTop: 30, paddingBottom: 60, gap: 20 }}
                style={
                    Platform.OS === 'web'
                        ? { overflowX: 'auto', overflowY: 'visible' }
                        : { overflow: 'visible' }
                }
            >
                {category.data.map((item, index) => (
                    <DesktopHoverCard
                        key={item.id} item={item} isTop10={isTop10} index={index} {...props}
                    />
                ))}
            </ScrollView>
        </View>
    );
};

export default function HomeScreen() {
    const { width: windowWidth } = useWindowDimensions();
    const isDesktop = windowWidth >= 1024;
    const mainScrollRef = useRef(null);

    const {
        router, insets, filters, setFilter, isLoading,
        trendingList, currentIndex, pan, rotate, topCardOpacity, nextCardScale, panResponder,
        showFilters, toggleFilterMenu, setShowFilters,
        watchlist, watched, handleAuthAction, handleToggleAction, handleNavigateToPlayer,
        musicQueue, currentMusicIndex, setCurrentMusicIndex,
        musicPrefs, isShuffle, setIsShuffle, loopMode, setLoopMode,
        musicProgress, musicDuration, isPlaying, setIsPlaying,
        handleNextTrack, handlePrevTrack, handleSeekTo, handleMusicAction, handlePlayMusic,
        isMusicModalOpen, setIsMusicModalOpen, sleepTimerRemaining, startSleepTimer,
        uiPlaying, handleTogglePlay, currentTrack, categoryData, activeLiveCategory, isLiveSportsFeed,
        actionList, thrillerList, scifiList, romanceList, comedyList, horrorList,

        // ✅ We get everything from the hook now:
        desktopHeroItem,
        heroTrailerKey
    } = useHomeLogic();

    // Trailer Mute State & Iframe Ref
    const iframeRef = useRef(null);
    const [isHeroMuted, setIsHeroMuted] = useState(true);

    const [isMiniPlayerVisible, setIsMiniPlayerVisible] = useState(true);

    useEffect(() => {
        if (currentTrack) setIsMiniPlayerVisible(true);
    }, [currentTrack]);

    const toggleDesktopMute = () => {
        const nextMuted = !isHeroMuted;
        setIsHeroMuted(nextMuted);
        if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
                JSON.stringify({
                    event: 'command',
                    func: nextMuted ? 'mute' : 'unMute',
                    args: []
                }),
                '*'
            );
        }
    };

    // ✅ Recreate the watchlist check here using the item from the hook
    const desktopHeroInWatchlist = desktopHeroItem ? !!watchlist[desktopHeroItem.id] : false;


    const [showMusicModal, setShowMusicModal] = useState(false);
    const modalTranslateY = useSharedValue(SCREEN_HEIGHT);

    useEffect(() => {
        if (isMusicModalOpen) {
            setShowMusicModal(true);
            modalTranslateY.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
        } else if (showMusicModal) {
            modalTranslateY.value = withTiming(
                SCREEN_HEIGHT,
                { duration: 280, easing: Easing.in(Easing.cubic) },
                (finished) => { if (finished) runOnJS(setShowMusicModal)(false); }
            );
        }
    }, [isMusicModalOpen]);

    const musicModalStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: modalTranslateY.value }],
    }));

    // Android hardware back button — Modal used to handle this via onRequestClose
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (isMusicModalOpen) {
                setIsMusicModalOpen(false);
                return true;
            }
            return false;
        });
        return () => sub.remove();
    }, [isMusicModalOpen]);

    useEffect(() => {
        if (Platform.OS !== 'web' || !heroTrailerKey) return;

        const handleMessage = (event) => {
            if (typeof event.data !== 'string' || !event.origin.includes('youtube.com')) return;
            let data;
            try { data = JSON.parse(event.data); } catch { return; }

            if (data.event === 'onStateChange' && data.info === 0) {
                iframeRef.current?.contentWindow?.postMessage(
                    JSON.stringify({ event: 'command', func: 'seekTo', args: [0, true] }), '*'
                );
                iframeRef.current?.contentWindow?.postMessage(
                    JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*'
                );
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [heroTrailerKey]);

    // ==========================================
    // 📱 ORIGINAL MOBILE / TABLET RENDER LOGIC
    // ==========================================
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
                <View style={styles.badgeContainer}>
                    <Ionicons name="ticket" size={13} color="#F5C518" style={{ marginRight: 4 }} />
                    <Text style={styles.badgeText}>IMDb {rating}</Text>
                </View>
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
                    <TouchableOpacity style={styles.playButtonWrapper} activeOpacity={0.8} onPress={() => handleNavigateToPlayer({ id: item.id, type: mediaType })}>
                        <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.playButtonGradient}>
                            <Ionicons name="play" size={26} color="#FFFFFF" style={{ marginLeft: 3 }} />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </>
        );
    };

    const renderCardStack = () => {
        if (isLoading || trendingList.length === 0) return <View style={[styles.mainCardContainer, { width: windowWidth * 0.85, justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#00E5FF" /></View>;
        const safeIndex = currentIndex % trendingList.length;
        const nextIndex = (currentIndex + 1) % trendingList.length;
        return (
            <>
                <Animated.View key={`${trendingList[nextIndex].id}-next`} style={[styles.mainCardContainer, { width: windowWidth * 0.85, transform: [{ scale: nextCardScale }], zIndex: 1 }]}>
                    {renderCardContent(trendingList[nextIndex])}
                </Animated.View>
                <Animated.View key={`${trendingList[safeIndex].id}-top`} style={[styles.mainCardContainer, { width: windowWidth * 0.85, opacity: topCardOpacity, transform: [{ translateX: pan.x }, { rotate: rotate }], zIndex: 99 }]} {...panResponder.panHandlers}>
                    {renderCardContent(trendingList[safeIndex])}
                </Animated.View>
            </>
        );
    };

    return (
        <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.background}>
            <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {!isDesktop && (
                    <View style={styles.header}>
                        <View style={styles.logoContainer}>
                            <CinePlayLogo size={34} />
                            {Platform.OS === 'web' ? (
                                <Text style={[styles.appName, styles.webGradientText]}>CinePlay</Text>
                            ) : (
                                <GradientText text="CinePlay" fontSize={26} width={150} height={36} />
                            )}
                        </View>
                        <TouchableOpacity style={styles.headerRightBtn} onPress={() => handleAuthAction(() => router.push('/my-list'))}>
                            <Ionicons name="bookmarks" size={24} color="#E0E0E0" />
                        </TouchableOpacity>
                    </View>
                )}

                <ScrollView
                    ref={mainScrollRef}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[
                        isDesktop ? { paddingBottom: 100 } : styles.scrollContent,
                        currentTrack ? { paddingBottom: insets.bottom + 160 } : undefined
                    ]}
                    style={{ flex: 1 }}
                    bounces={false}
                >
                    {isDesktop ? (
                        /* ================== DESKTOP VIEW ================== */
                        <View style={styles.desktopContainer}>
                            {isLoading && filters.type !== 'music' ? (
                                <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 100 }} />
                            ) : filters.type === 'music' ? (
                                <View style={{ marginTop: 40, paddingHorizontal: 40 }}>
                                    <YTMusicFeed onPlayMusic={handlePlayMusic} activeTrackId={currentTrack?.mediaId} />
                                </View>
                            ) : filters.type === 'live' ? (
                                <View style={{ marginTop: 40, paddingHorizontal: 40 }}>
                                    {isLiveSportsFeed
                                        ? <LiveSportsFeed selectedSport={activeLiveCategory} />
                                        : <LiveTvFeed selectedCategory={activeLiveCategory} selectedLanguage={filters.language} onNavigateToPlayer={handleNavigateToPlayer} />
                                    }
                                </View>
                            ) : (
                                <>
                                    {desktopHeroItem && (
                                        <View style={styles.desktopHeroContainer}>
                                            {Platform.OS === 'web' && heroTrailerKey ? (
                                                <iframe
                                                    ref={iframeRef}
                                                    id="hero-trailer"
                                                    src={`https://www.youtube.com/embed/${heroTrailerKey}?autoplay=1&mute=1&enablejsapi=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${heroTrailerKey}`}
                                                    style={{ width: '100%', height: '100%', border: 'none', objectFit: 'cover', pointerEvents: 'none' }}
                                                    allow="autoplay; encrypted-media"
                                                    title="Trailer"
                                                    onLoad={() => {
                                                        iframeRef.current?.contentWindow?.postMessage(
                                                            JSON.stringify({ event: 'listening', id: 'hero-trailer' }), '*'
                                                        );
                                                    }}
                                                />
                                            ) : (
                                                <Image source={{ uri: getImageUrl(desktopHeroItem.backdrop_path || desktopHeroItem.poster_path) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                                            )}

                                            <LinearGradient colors={['#0A0A0C', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 0 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
                                            <LinearGradient colors={['transparent', '#0A0A0C']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />

                                            <TouchableOpacity
                                                style={styles.heroMuteBtn}
                                                onPress={toggleDesktopMute}
                                            >
                                                <Ionicons name={isHeroMuted ? "volume-mute" : "volume-high"} size={22} color="#FFF" />
                                            </TouchableOpacity>

                                            <View style={styles.desktopHeroContent}>
                                                <Text style={styles.heroNewReleaseBadge}>New Release</Text>
                                                <Text style={styles.heroTitle}>{desktopHeroItem.title || desktopHeroItem.name}</Text>
                                                <Text style={styles.heroMetaData}>{(desktopHeroItem.release_date || '').substring(0, 4)} • U/A 16+ • Hindi</Text>
                                                <Text style={styles.heroSynopsis} numberOfLines={3}>{desktopHeroItem.overview}</Text>

                                                <View style={styles.heroActionRow}>
                                                    <TouchableOpacity style={styles.heroMainPlayBtn} onPress={() => handleNavigateToPlayer({ id: desktopHeroItem.id, type: desktopHeroItem.media_type || 'movie' })}>
                                                        <LinearGradient colors={['#00E5FF', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroMainPlayGradient}>
                                                            <Ionicons name="play" size={24} color="#FFF" />
                                                            <Text style={styles.heroMainPlayText}>Watch Now</Text>
                                                        </LinearGradient>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={styles.heroAddBtn} onPress={() => handleAuthAction(() => handleToggleAction(desktopHeroItem.id, desktopHeroItem.media_type || 'movie', 'watchlist'))}>
                                                        <Ionicons name={desktopHeroInWatchlist ? "checkmark" : "add"} size={28} color="#FFF" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </View>
                                    )}

                                    <View style={[styles.desktopRowsWrapper, { marginTop: desktopHeroItem ? -40 : 20 }]}>
                                        {categoryData.map((category, idx) => {
                                            if (!category.data || category.data.length === 0) return null;
                                            return (
                                                <DesktopRow
                                                    key={idx}
                                                    idx={idx}
                                                    category={category}
                                                    categoryDataLength={categoryData.length}
                                                    watchlist={watchlist}
                                                    watched={watched}
                                                    handleAuthAction={handleAuthAction}
                                                    handleToggleAction={handleToggleAction}
                                                    handleNavigateToPlayer={handleNavigateToPlayer}
                                                    mainScrollRef={mainScrollRef}
                                                />
                                            );
                                        })}
                                    </View>
                                </>
                            )}
                        </View>
                    ) : (
                        /* ================== MOBILE VIEW ================== */
                        <View style={{ width: '100%' }}>
                            {filters.type !== 'live' && filters.type !== 'music' && (
                                <View style={styles.deckArea}>{renderCardStack()}</View>
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
                                    <FilterDropdown filters={filters} setFilter={setFilter} onClose={() => setShowFilters(false)} />
                                </ReAnimated.View>
                            )}

                            <View style={styles.categoriesWrapper}>
                                {isLoading && filters.type !== 'music' ? (
                                    <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 40, marginBottom: 80 }} />
                                ) : filters.type === 'music' ? (
                                    <YTMusicFeed onPlayMusic={handlePlayMusic} activeTrackId={currentTrack?.mediaId} />
                                ) : filters.type === 'live' ? (
                                    isLiveSportsFeed
                                        ? <LiveSportsFeed selectedSport={activeLiveCategory} />
                                        : <LiveTvFeed selectedCategory={activeLiveCategory} selectedLanguage={filters.language} onNavigateToPlayer={handleNavigateToPlayer} />
                                ) : (
                                    <View>
                                        {categoryData.map((category, index) => (
                                            <HorizontalRow key={index.toString()} title={category.title} data={category.data} onAuthAction={handleAuthAction} watchlist={watched} toggleAction={handleToggleAction} onNavigateToPlayer={handleNavigateToPlayer} />
                                        ))}
                                    </View>
                                )}
                            </View>

                            {filters.type !== 'live' && filters.type !== 'music' && (
                                <ReAnimated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} layout={LinearTransition}>
                                    <LanguageRow router={router} />
                                    <GenreRow router={router} lists={{ actionList, thrillerList, scifiList, romanceList, comedyList, horrorList }} />
                                </ReAnimated.View>
                            )}
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>

            {/* GLOBAL OVERLAYS */}
            {currentTrack && !isMusicModalOpen && (
                <View style={isDesktop ? styles.desktopMiniPlayerBox : styles.mobileMiniPlayerBox} pointerEvents="box-none">
                    {isMiniPlayerVisible && (
                        <MiniPlayer
                            currentTrack={currentTrack} isMusicPlaying={isPlaying} musicProgress={musicProgress}
                            musicDuration={musicDuration} isShuffle={isShuffle} setIsShuffle={setIsShuffle}
                            loopMode={loopMode} setLoopMode={setLoopMode} onTogglePlay={() => setIsPlaying(!isPlaying)}
                            handleNextTrack={handleNextTrack} handlePrevTrack={handlePrevTrack}
                            onOpenModal={() => setIsMusicModalOpen(true)}
                            onDismiss={() => { setIsPlaying(false); setIsMiniPlayerVisible(false); }}
                            bottomOffset={isDesktop ? 0 : insets.bottom + 60}
                            isDesktop={isDesktop}
                        />
                    )}
                </View>
            )}
            {showMusicModal && (
                <ReAnimated.View
                    pointerEvents={isMusicModalOpen ? 'auto' : 'none'}
                    style={[
                        StyleSheet.absoluteFillObject,
                        { zIndex: 10000, elevation: 10000, backgroundColor: '#0A0A0C' },
                        musicModalStyle,
                    ]}
                >
                    <View style={{ flex: 1, paddingBottom: isDesktop ? 80 : 0 }}>
                        <MusicPlayerUI
                            currentTrack={currentTrack} musicQueue={musicQueue} currentMusicIndex={currentMusicIndex} setCurrentMusicIndex={setCurrentMusicIndex}
                            musicProgress={musicProgress} musicDuration={musicDuration} isPlaying={uiPlaying} setIsPlaying={handleTogglePlay}
                            isShuffle={isShuffle} setIsShuffle={setIsShuffle} loopMode={loopMode} setLoopMode={setLoopMode}
                            handleNextTrack={handleNextTrack} handlePrevTrack={handlePrevTrack} handleSeekTo={handleSeekTo}
                            handleMusicAction={handleMusicAction} musicPrefs={musicPrefs} sleepTimerRemaining={sleepTimerRemaining}
                            startSleepTimer={startSleepTimer} isDesktop={isDesktop} router={{ ...router, back: () => setIsMusicModalOpen(false) }}
                        />
                    </View>
                </ReAnimated.View>
            )}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    // --- DESKTOP STYLES ---
    desktopContainer: { flex: 1, backgroundColor: '#0A0A0C' },
    desktopHeroContainer: { height: '80vh', width: '100%', position: 'relative' },
    desktopHeroContent: { position: 'absolute', bottom: '15%', left: 40, width: '40%', zIndex: 10 },

    heroMuteBtn: { position: 'absolute', bottom: 30, right: 40, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', zIndex: 20 },

    heroNewReleaseBadge: { color: '#00E5FF', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8, fontSize: 14 },
    heroTitle: { color: '#FFF', fontSize: 48, fontWeight: '900', marginBottom: 12 },
    heroMetaData: { color: '#B0B5B9', fontSize: 16, fontWeight: '600', marginBottom: 12 },
    heroSynopsis: { color: '#E0E0E0', fontSize: 16, lineHeight: 24, marginBottom: 24 },
    heroActionRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    heroMainPlayBtn: { borderRadius: 8, overflow: 'hidden' },
    heroMainPlayGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 14, gap: 8 },
    heroMainPlayText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    heroAddBtn: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },

    desktopRowsWrapper: {},
    desktopRowContainer: { marginBottom: 30, overflow: 'visible' },
    desktopRowHeader: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginLeft: 40, marginBottom: -10 },

    desktopCardWrapper: { width: 160, height: 230, borderRadius: 8, overflow: 'visible' },
    desktopCardImage: { width: 160, height: 230, borderRadius: 8 },
    desktopTop10Card: { marginLeft: 50 },
    top10Number: { position: 'absolute', left: -50, bottom: -20, fontSize: 140, fontWeight: '900', color: '#0A0A0C', textShadowColor: '#FFF', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 3, zIndex: -1 },

    desktopHoverPopup: {
        position: 'absolute', top: -35, left: -40, width: 260, height: 400,
        backgroundColor: '#11131A', borderRadius: 12, overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.9, shadowRadius: 25, elevation: 24,
    },
    hoverPopupImage: { width: '100%', height: '42%' },
    hoverGradientContainer: { flex: 1, padding: 16, paddingTop: 24, justifyContent: 'flex-start' },
    hoverControlsRow: { flexDirection: 'row', gap: 12, position: 'absolute', top: -25, left: 16, right: 16 },
    hoverPlayBtn: { backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6, gap: 6, flex: 1, justifyContent: 'center' },
    hoverPlayBtnText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
    hoverActionBtn: { backgroundColor: '#333', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#555' },
    hoverTitleText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginTop: 14, marginBottom: 6 },
    hoverMetaText: { color: '#A0A0A0', fontSize: 12, fontWeight: 'bold', marginBottom: 8 },
    hoverSynopsisText: { color: '#D0D0D0', fontSize: 13, lineHeight: 18 },

    desktopMiniPlayerBox: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        width: 340,
        borderRadius: 12,
        zIndex: 9999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.75,
        shadowRadius: 15,
        elevation: 10,
    },
    mobileMiniPlayerBox: {
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 9999
    },

    // --- MOBILE STYLES (Untouched) ---
    background: { flex: 1 },
    container: { flex: 1 },
    header: { paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    maskedView: { height: 32, flexDirection: 'row', alignItems: 'center' },
    appName: { fontSize: 26, fontWeight: '900', letterSpacing: 0.5, lineHeight: 32, includeFontPadding: false },
    headerRightBtn: { padding: 4 },
    scrollContent: { paddingBottom: 60 },
    categoriesWrapper: { paddingTop: 4 },
    deckArea: { height: 440, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    mainCardContainer: { height: 430, backgroundColor: '#2A1E39', borderRadius: 22, overflow: 'hidden', position: 'absolute', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 8 },
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
    filterBarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 14 },
    filterTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    funnelBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    funnelBtnActive: { backgroundColor: 'rgba(0, 229, 255, 0.15)', borderColor: '#00E5FF' },
    webGradientText: { backgroundImage: 'linear-gradient(to right, #00E5FF, #9B51E0, #FF007A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' },
});