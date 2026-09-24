import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StatusBar, Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import YoutubePlayer from 'react-native-youtube-iframe';
import { VideoView } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import Toast from 'react-native-toast-message';
import { getImageUrl } from '../../constants/config';

const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// UPDATED: Corrected the numbering so Vidlink = 1, Filmu = 2, Vidsrc = 3
const SERVERS = {
    vidlink: {
        label: 'Server 1', host: 'vidlink.pro', referer: 'https://vidlink.pro/',
        movieUrl: (id) => `https://vidlink.pro/movie/${id}?autoplay=1`,
        tvUrl: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}?autoplay=1`
    },
    filmu: {
        label: 'Server 2', host: 'embed.filmu.in', referer: 'https://embed.filmu.in/',
        movieUrl: (id) => `https://embed.filmu.in/movie/${id}`,
        tvUrl: (id, s, e) => `https://embed.filmu.in/tv/${id}/${s}/${e}`,
        animeUrl: (anilistId, s, e) => (s && e) ? `https://embed.filmu.in/anime/${anilistId}/${s}/${e}` : `https://embed.filmu.in/anime/${anilistId}`
    },
    vidsrc: {
        label: 'Server 3', host: 'vidsrc.sbs', referer: 'https://vidsrc.sbs/',
        movieUrl: (id) => `https://vidsrc.sbs/embed/movie/${id}?autoplay=1`,
        tvUrl: (id, s, e) => `https://vidsrc.sbs/embed/tv/${id}/${s}/${e}?autoplay=1`
    }
};

const buildAdBlockScript = (host) => `
    (function() {
        try {
            var fakeUA = '${DESKTOP_USER_AGENT}';
            Object.defineProperty(navigator, 'userAgent', { get: function() { return fakeUA; } });
            Object.defineProperty(navigator, 'appVersion', { get: function() { return fakeUA; } });
            Object.defineProperty(navigator, 'platform', { get: function() { return 'Win32'; } });
            Object.defineProperty(navigator, 'webdriver', { get: function() { return false; } });
            Object.defineProperty(navigator, 'plugins', { get: function() { return [1, 2, 3, 4, 5]; } });
        } catch (e) {}

        if (window.ReactNativeWebView) {
            window.__rn_send = window.ReactNativeWebView.postMessage.bind(window.ReactNativeWebView);
            try { delete window.ReactNativeWebView; } catch(e) {}
        }

        window.open = function() { return null; };
        try { Object.defineProperty(window, 'open', { configurable: false, writable: false, value: function() { return null; } }); } catch(e) {}
        
        document.addEventListener('click', function(e) {
            var t = e.target;
            while (t && t !== document) {
                if (t.tagName === 'A' && (t.getAttribute('target') === '_blank' || (!t.href.includes('${host}') && !t.href.startsWith('blob:')))) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return false;
                }
                t = t.parentNode;
            }
        }, true);

        var killAdOverlays = function() {
            var divs = document.querySelectorAll('div');
            for (var i = 0; i < divs.length; i++) {
                var el = divs[i];
                var z = window.getComputedStyle(el).zIndex;
                if (z && parseInt(z) > 9999) {
                    var className = el.className || '';
                    if (typeof className === 'string' && className.indexOf('jw-') === -1 && className.indexOf('vjs-') === -1) {
                        el.style.display = 'none';
                        el.style.pointerEvents = 'none';
                    }
                }
            }
        };
        setInterval(killAdOverlays, 500);
        true;
    })();
`;

export const VideoPlayerUI = ({
    mediaDetails, streamUrl, ytId, trailerKey, isPlaying, setIsPlaying,
    activeMediaView, setActiveMediaView, isVidkingAvailable,
    selectedSeason, setSelectedSeason, selectedEpisode, setSelectedEpisode,
    handleCreateWatchParty, handleAuthAction, handleToggleAction,
    watchlist, watched, livePlayer, id, type, channelName, router,
    server, setServer, anilistId
}) => {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const controlsFadeAnim = useRef(new Animated.Value(1)).current;
    const controlsTimer = useRef(null);

    const webViewRef = useRef(null);
    const isNonYouTubeSource = !!streamUrl || activeMediaView === 'movie';
    const TAB_BAR_HEIGHT = 88 + insets.bottom;

    const adScript = useMemo(() => buildAdBlockScript(SERVERS[server].host), [server]);

    const injectedFallbackScript = useMemo(() => `
        (function() {
            if ('${server}' === 'vidlink') {
                var style = document.createElement('style');
                var css = 'iframe[src*="ads"], .ad-overlay { display: none !important; }';
                css += '.pjs-fullscreen, .pjs-icon-fullscreen, [aria-label="Fullscreen"], [title="Fullscreen"], .fullscreen-btn { display: none !important; }';
                style.innerHTML = css;
                document.head.appendChild(style);
            }

            setTimeout(function() {
                var text = document.body.innerText.toLowerCase();
                if (
                    text.includes('video not found') || 
                    text.includes('media not found') || 
                    text.includes('404 not found') ||
                    text.includes('could not be found')
                ) {
                    if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage('FALLBACK_REQUEST');
                    }
                }
            }, 3000);
        })();
        true;
    `, [server]);

    // UPDATED: Shift logic to Vidlink -> Filmu -> Vidsrc
    const handleServerFallback = useCallback(() => {
        if (server === 'vidlink') {
            Toast.show({ type: 'hotstarInfo', text1: 'Not available on Server 1. Trying Server 2...', position: 'top' });
            setServer('filmu');
        } else if (server === 'filmu') {
            Toast.show({ type: 'hotstarInfo', text1: 'Not available on Server 2. Trying Server 3...', position: 'top' });
            setServer('vidsrc');
        }
    }, [server, setServer]);

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

    const toggleFullScreen = async () => {
        if (isFullScreen) {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            setIsFullScreen(false);
        } else {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
            setIsFullScreen(true);
        }
        resetControlsTimer();
    };

    const handleBackPress = async () => {
        if (isFullScreen) await toggleFullScreen();
        else router.back();
    };

    const title = mediaDetails.title || mediaDetails.name;
    const year = (mediaDetails.release_date || mediaDetails.first_air_date || '').substring(0, 4);
    const languages = mediaDetails.spoken_languages?.map(lang => lang.english_name).join(', ') || 'Unknown';
    const isCurrentInWatchlist = watchlist[id];
    const isCurrentInWatched = watched[id];

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
                    isFullScreen && { position: 'absolute', top: 0, left: 0, zIndex: 9999, elevation: 9999, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }
                ]}>
                    <View style={{ width: innerVideoWidth, height: innerVideoHeight, backgroundColor: '#000', position: 'relative' }} onStartShouldSetResponderCapture={() => { resetControlsTimer(); return false; }}>
                        {streamUrl ? (
                            <>
                                <VideoView player={livePlayer} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} contentFit="contain" nativeControls={false} />
                                <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5 }} activeOpacity={1} onPress={resetControlsTimer} />
                                <Animated.View
                                    style={[styles.liveStreamOverlay, { opacity: controlsFadeAnim }]}
                                    pointerEvents={showControls ? 'box-none' : 'none'}
                                    renderToHardwareTextureAndroid={true}
                                >
                                    <View style={styles.liveBadgeContainer}>
                                        <View style={styles.liveDot} />
                                        <Text style={styles.liveBadgeText}>LIVE</Text>
                                    </View>
                                    <TouchableOpacity style={styles.gradientPlayWrapper} activeOpacity={0.8} onPress={() => { resetControlsTimer(); if (isPlaying) { livePlayer.pause(); setIsPlaying(false); } else { livePlayer.play(); setIsPlaying(true); } }}>
                                        <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradientPlayInner}>
                                            <Ionicons name={isPlaying ? "pause" : "play"} size={24} color="#FFFFFF" style={!isPlaying ? { marginLeft: 4 } : {}} />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </Animated.View>
                            </>
                        ) : activeMediaView === 'movie' ? (
                            <WebView
                                ref={webViewRef}
                                key={`${server}-${selectedSeason}-${selectedEpisode}`}
                                source={{
                                    uri: server === 'filmu' && anilistId
                                        ? SERVERS.filmu.animeUrl(anilistId, type === 'tv' ? selectedSeason : null, type === 'tv' ? selectedEpisode : null)
                                        : type === 'tv'
                                            ? SERVERS[server].tvUrl(id, selectedSeason, selectedEpisode)
                                            : SERVERS[server].movieUrl(id),
                                    headers: {
                                        'Referer': SERVERS[server].referer,
                                        'User-Agent': DESKTOP_USER_AGENT,
                                    }
                                }}
                                userAgent={DESKTOP_USER_AGENT}
                                style={{ flex: 1, backgroundColor: '#000' }}
                                javaScriptEnabled={true}
                                domStorageEnabled={true}
                                databaseEnabled={true}
                                allowsFullscreenVideo={false}
                                mediaPlaybackRequiresUserAction={false}
                                allowsInlineMediaPlayback={true}
                                setSupportMultipleWindows={false}
                                sharedCookiesEnabled={true}
                                thirdPartyCookiesEnabled={true}
                                androidLayerType="hardware"
                                injectedJavaScriptBeforeContentLoaded={adScript}
                                injectedJavaScriptForMainFrameOnly={false}
                                injectedJavaScript={injectedFallbackScript}
                                onMessage={(event) => {
                                    if (event.nativeEvent.data === 'FALLBACK_REQUEST') {
                                        handleServerFallback();
                                    }
                                }}
                                onHttpError={(syntheticEvent) => {
                                    const { nativeEvent } = syntheticEvent;
                                    // Trigger fallback on severe HTTP errors from the main stream host
                                    if (nativeEvent.statusCode >= 400 && nativeEvent.url.includes(SERVERS[server].host)) {
                                        handleServerFallback();
                                    }
                                }}
                                onError={() => handleServerFallback()}
                                onShouldStartLoadWithRequest={(request) => {
                                    if (request.isTopFrame === false) return true;

                                    const isAllowedHost =
                                        request.url.includes(SERVERS[server].host) ||
                                        request.url.startsWith('about:blank');

                                    if (!isAllowedHost) {
                                        return false;
                                    }
                                    return true;
                                }}
                            />
                        ) : trailerKey ? (
                            <YoutubePlayer height={innerVideoHeight} width={innerVideoWidth} play={isPlaying} videoId={trailerKey} onReady={() => setIsPlaying(true)} webViewProps={{ allowsFullscreenVideo: false, mediaPlaybackRequiresUserAction: false, allowsInlineMediaPlayback: true }} initialPlayerParams={{ controls: 1, modestbranding: 1, rel: 0, iv_load_policy: 3, fs: 0, autoplay: 1 }} onChangeState={(state) => { if (state === 'playing') setIsPlaying(true); if (state === 'paused' || state === 'ended') setIsPlaying(false); }} />
                        ) : (
                            <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]}>
                                {(mediaDetails.backdrop_path || mediaDetails.ytThumbnail) && (
                                    <Image source={{ uri: mediaDetails.backdrop_path ? getImageUrl(mediaDetails.backdrop_path, 'original') : mediaDetails.ytThumbnail }} style={styles.videoThumbnail} />
                                )}
                                <View style={styles.playerOverlay}>
                                    <Text style={styles.noTrailerText}>No Video Available</Text>
                                </View>
                            </View>
                        )}

                        {isFullScreen && (
                            <Animated.View
                                style={[styles.fullscreenExitBtn, { opacity: controlsFadeAnim }]}
                                pointerEvents={showControls ? 'auto' : 'none'}
                                renderToHardwareTextureAndroid={true}
                            >
                                <TouchableOpacity onPress={handleBackPress} activeOpacity={0.7}><Ionicons name="close" size={26} color="#FFFFFF" /></TouchableOpacity>
                            </Animated.View>
                        )}
                    </View>
                </View>

                {!isFullScreen && (
                    <View style={styles.externalControlBar}>
                        <View style={styles.externalLeftControls}>
                            <TouchableOpacity onPress={handleBackPress} style={styles.externalBtn}><Ionicons name="arrow-back" size={22} color="#FFFFFF" /></TouchableOpacity>
                            <TouchableOpacity onPress={toggleFullScreen} style={styles.externalBtn}><Ionicons name="expand" size={22} color="#FFFFFF" /></TouchableOpacity>
                        </View>
                        <View style={{ flex: 1, paddingLeft: 12 }}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.externalRightControls}>
                                {id && !streamUrl && (
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

                <ScrollView style={{ display: isFullScreen ? 'none' : 'flex' }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 20 }}>
                    <View style={styles.detailsContainer}>
                        <Text style={styles.mediaTitle}>{title}</Text>
                        {!streamUrl && (
                            ytId ? (
                                <TouchableOpacity style={styles.watchToggleBtn} activeOpacity={0.8} onPress={() => handleCreateWatchParty(ytId, title)}>
                                    <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.watchToggleGradient}>
                                        <Ionicons name="people-circle" size={24} color="#FFF" style={{ marginRight: 8 }} />
                                        <Text style={styles.watchToggleText}>Start YouTube Watch Party</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={styles.watchToggleBtn} activeOpacity={0.8} disabled={activeMediaView === 'trailer' && isVidkingAvailable === false}
                                    onPress={() => {
                                        if (activeMediaView === 'trailer') setIsPlaying(false);
                                        setActiveMediaView(prev => prev === 'trailer' ? 'movie' : 'trailer');
                                    }}
                                >
                                    <LinearGradient colors={activeMediaView === 'movie' ? ['#2A2A30', '#2A2A30'] : isVidkingAvailable === false ? ['#2A2A30', '#2A2A30'] : ['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.watchToggleGradient}>
                                        {isVidkingAvailable === null ? (
                                            <Text style={styles.watchToggleText}>Checking availability...</Text>
                                        ) : activeMediaView === 'movie' ? (
                                            <><Ionicons name="logo-youtube" size={20} color="#FFF" style={{ marginRight: 8 }} /><Text style={styles.watchToggleText}>Show Trailer</Text></>
                                        ) : (
                                            <><Ionicons name={isVidkingAvailable ? "play" : "close-circle"} size={20} color="#FFF" style={{ marginRight: 8 }} /><Text style={styles.watchToggleText}>{isVidkingAvailable ? (type === 'tv' ? 'Watch Show' : 'Watch Movie') : (type === 'tv' ? 'Show Not Available' : 'Movie Not Available')}</Text></>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            )
                        )}

                        {/* UPDATED: Server switcher chips in proper 1, 2, 3 order */}
                        {activeMediaView === 'movie' && !streamUrl && !ytId && (
                            <View style={styles.tvControlsContainer}>
                                <Text style={styles.tvControlsLabel}>Server</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tvControlsRow}>
                                    <TouchableOpacity style={[styles.tvChip, server === 'vidlink' && styles.tvChipActive]} onPress={() => setServer('vidlink')}>
                                        <Text style={[styles.tvChipText, server === 'vidlink' && styles.tvChipTextActive]}>{SERVERS.vidlink.label}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={[styles.tvChip, server === 'filmu' && styles.tvChipActive]} onPress={() => setServer('filmu')}>
                                        <Text style={[styles.tvChipText, server === 'filmu' && styles.tvChipTextActive]}>{SERVERS.filmu.label}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={[styles.tvChip, server === 'vidsrc' && styles.tvChipActive]} onPress={() => setServer('vidsrc')}>
                                        <Text style={[styles.tvChipText, server === 'vidsrc' && styles.tvChipTextActive]}>{SERVERS.vidsrc.label}</Text>
                                    </TouchableOpacity>
                                </ScrollView>
                            </View>
                        )}

                        {activeMediaView === 'movie' && type === 'tv' && tvSeasons.length > 0 && !streamUrl && (
                            <View style={styles.tvControlsContainer}>
                                <Text style={styles.tvControlsLabel}>Select Season</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tvControlsRow}>
                                    {tvSeasons.map((season) => (
                                        <TouchableOpacity key={`season-${season.season_number}`} style={[styles.tvChip, selectedSeason === season.season_number && styles.tvChipActive]} onPress={() => { setSelectedSeason(season.season_number); setSelectedEpisode(1); }}>
                                            <Text style={[styles.tvChipText, selectedSeason === season.season_number && styles.tvChipTextActive]}>Season {season.season_number}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                <Text style={styles.tvControlsLabel}>Select Episode</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tvControlsRow}>
                                    {episodesArray.map((ep) => (
                                        <TouchableOpacity key={`ep-${ep}`} style={[styles.tvChip, selectedEpisode === ep && styles.tvChipActive]} onPress={() => setSelectedEpisode(ep)}>
                                            <Text style={[styles.tvChipText, selectedEpisode === ep && styles.tvChipTextActive]}>Episode {ep}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {activeMediaView === 'movie' && !streamUrl && !ytId && isVidkingAvailable && server === 'vidlink' && (
                            <TouchableOpacity
                                style={styles.watchToggleBtn}
                                activeOpacity={0.8}
                                onPress={() => {
                                    const watchPartyYtId = type === 'tv'
                                        ? `VIDLINK:tv:${id}:${selectedSeason}:${selectedEpisode}`
                                        : `VIDLINK:movie:${id}`;
                                    handleCreateWatchParty(watchPartyYtId, title);
                                }}
                            >
                                <LinearGradient colors={['#00E5FF', '#9B51E0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.watchToggleGradient}>
                                    <Ionicons name="people-circle" size={24} color="#FFF" style={{ marginRight: 8 }} />
                                    <Text style={styles.watchToggleText}>Start Watch Party</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        )}

                        <View style={styles.metaRow}>
                            {year ? <Text style={styles.metaText}>{year}</Text> : null}
                            {year && languages ? <Text style={styles.metaDot}>•</Text> : null}
                            <Text style={styles.metaText}>{languages !== 'Unknown' ? languages : ''}</Text>
                            {mediaDetails.vote_average > 0 && (
                                <><Text style={styles.metaDot}>•</Text><View style={styles.ratingBadge}><Ionicons name="star" size={12} color="#F5C518" /><Text style={styles.ratingText}>{mediaDetails.vote_average?.toFixed(1)}</Text></View></>
                            )}
                        </View>
                        {mediaDetails.overview ? <Text style={styles.overviewText}>{mediaDetails.overview}</Text> : null}
                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#000' },
    container: { flex: 1, backgroundColor: '#0A0A0C' },
    playerContainer: { position: 'relative', backgroundColor: '#000' },
    videoThumbnail: { width: '100%', height: '100%', position: 'absolute' },
    playerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
    noTrailerText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 8 },
    fullscreenExitBtn: { position: 'absolute', top: 20, left: 20, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.7)', padding: 8, borderRadius: 20 },
    videoFitBtn: { position: 'absolute', top: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.7)', padding: 8, borderRadius: 20, zIndex: 99999 },
    videoFitBtnFullscreen: { position: 'absolute', top: 20, right: 20, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.7)', padding: 8, borderRadius: 20 },
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
    liveStreamOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.15)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    liveBadgeContainer: { position: 'absolute', top: 20, left: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 0, 122, 0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255, 0, 122, 0.5)' },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF007A', marginRight: 6 },
    liveBadgeText: { color: '#FF007A', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    gradientPlayWrapper: { width: 56, height: 56, borderRadius: 28, elevation: 8, shadowColor: '#FF007A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8 },
    gradientPlayInner: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 28 }
});