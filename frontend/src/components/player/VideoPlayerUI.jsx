import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StatusBar, Animated, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import YoutubePlayer from 'react-native-youtube-iframe';
import { VideoView } from 'expo-video';
import { getImageUrl } from '../../constants/config';

import { useVideoPlayerUILogic } from '../../hooks/useVideoPlayerUILogic';

const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const adBlockScript = `
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
                if (t.tagName === 'A' && (t.getAttribute('target') === '_blank' || (!t.href.includes('vidlink.pro') && !t.href.startsWith('blob:')))) {
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

// =========================================================
// WEB-ONLY HLS PLAYER
// Browsers (other than Safari) have no native HLS support in
// <video>, so expo-video's VideoView (which just wraps a plain
// <video> tag on web) silently fails on .m3u8 sources. This
// attaches hls.js's MediaSource-based player instead. Safari
// gets native HLS via canPlayType and skips hls.js entirely.
// =========================================================
const LiveTvWebPlayer = ({ streamUrl, isPlaying, videoRef }) => {
    const internalRef = useRef(null);
    const ref = videoRef || internalRef;
    const hlsRef = useRef(null);

    useEffect(() => {
        const video = ref.current;
        if (!video || !streamUrl) return;

        let cancelled = false;

        const setup = async () => {
            // Safari / native HLS support
            if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = streamUrl;
                return;
            }

            try {
                const Hls = (await import('hls.js')).default;
                if (cancelled) return;

                if (Hls.isSupported()) {
                    const hls = new Hls({
                        enableWorker: true,
                        lowLatencyMode: true,
                    });
                    hlsRef.current = hls;
                    hls.loadSource(streamUrl);
                    hls.attachMedia(video);
                    hls.on(Hls.Events.ERROR, (_evt, data) => {
                        if (data?.fatal) {
                            console.warn('[LiveTvWebPlayer] fatal hls.js error:', data.type, data.details);
                            switch (data.type) {
                                case Hls.ErrorTypes.NETWORK_ERROR:
                                    hls.startLoad();
                                    break;
                                case Hls.ErrorTypes.MEDIA_ERROR:
                                    hls.recoverMediaError();
                                    break;
                                default:
                                    hls.destroy();
                                    break;
                            }
                        }
                    });
                } else {
                    console.warn('[LiveTvWebPlayer] HLS is not supported in this browser.');
                }
            } catch (err) {
                console.warn('[LiveTvWebPlayer] failed to load hls.js:', err);
            }
        };

        setup();

        return () => {
            cancelled = true;
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [streamUrl]);

    useEffect(() => {
        const video = ref.current;
        if (!video) return;
        if (isPlaying) {
            video.play().catch(() => { });
        } else {
            video.pause();
        }
    }, [isPlaying]);

    return (
        <video
            ref={ref}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#000', objectFit: 'contain' }}
            autoPlay
            playsInline
            muted={false}
            controls={false}
        />
    );
};

export const VideoPlayerUI = (props) => {
    const {
        mediaDetails, streamUrl, ytId, trailerKey, isPlaying, setIsPlaying,
        activeMediaView, setActiveMediaView, isVidkingAvailable,
        selectedSeason, setSelectedSeason, selectedEpisode, setSelectedEpisode,
        handleCreateWatchParty, handleAuthAction, handleToggleAction,
        watchlist, watched, livePlayer, id, type, channelName, router, isDesktop
    } = props;

    const {
        insets, isFullScreen, showControls, controlsFadeAnim, webViewRef, isNonYouTubeSource, TAB_BAR_HEIGHT,
        resetControlsTimer, toggleFullScreen, handleBackPress, title, year, languages, isCurrentInWatchlist, isCurrentInWatched,
        tvSeasons, episodesArray, containerWidth, containerHeight, innerVideoWidth, innerVideoHeight
    } = useVideoPlayerUILogic(props);

    const webVideoRef = useRef(null);

    const handleWebPlayPause = () => {
        resetControlsTimer();
        const video = webVideoRef.current;
        if (!video) return;
        if (isPlaying) {
            video.pause();
            setIsPlaying(false);
        } else {
            video.play().catch(() => { });
            setIsPlaying(true);
        }
    };

    // --------------------------------------------------------
    // DESKTOP LAYOUT (Player on Left, Details on Right)
    // --------------------------------------------------------
    if (isDesktop) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
                <View style={[styles.desktopContainer, isFullScreen && styles.desktopContainerFullScreen]}>
                    {!isFullScreen && (
                        <TouchableOpacity onPress={handleBackPress} style={styles.desktopBackBtn}>
                            <Ionicons name="arrow-back" size={28} color="#FFF" />
                        </TouchableOpacity>
                    )}

                    <View style={styles.desktopLayout}>
                        {/* LEFT COLUMN: The actual Video Player */}
                        <View style={[styles.desktopPlayerCol, isFullScreen && styles.desktopPlayerColFullScreen]}>
                            <View style={styles.desktopPlayerWrapper} onStartShouldSetResponderCapture={() => { resetControlsTimer(); return false; }}>
                                {streamUrl ? (
                                    <>
                                        {Platform.OS === 'web' ? (
                                            <LiveTvWebPlayer streamUrl={streamUrl} isPlaying={isPlaying} videoRef={webVideoRef} />
                                        ) : (
                                            <VideoView player={livePlayer} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} contentFit="contain" nativeControls={false} />
                                        )}
                                        <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5, cursor: 'pointer' }} activeOpacity={1} onPress={resetControlsTimer} />
                                        <Animated.View style={[styles.liveStreamOverlay, { opacity: controlsFadeAnim }]} pointerEvents={showControls ? 'box-none' : 'none'}>
                                            <View style={styles.liveBadgeContainer}>
                                                <View style={styles.liveDot} />
                                                <Text style={styles.liveBadgeText}>LIVE</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={[styles.desktopExpandBtn, { cursor: 'pointer' }]}
                                                activeOpacity={0.8}
                                                onPress={() => { resetControlsTimer(); toggleFullScreen(); }}
                                            >
                                                <Ionicons name={isFullScreen ? "contract" : "expand"} size={20} color="#FFFFFF" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.gradientPlayWrapper, { cursor: 'pointer' }]}
                                                activeOpacity={0.8}
                                                onPress={() => {
                                                    if (Platform.OS === 'web') {
                                                        handleWebPlayPause();
                                                        return;
                                                    }
                                                    resetControlsTimer();
                                                    if (isPlaying) { livePlayer.pause(); setIsPlaying(false); } else { livePlayer.play(); setIsPlaying(true); }
                                                }}
                                            >
                                                <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradientPlayInner}>
                                                    <Ionicons name={isPlaying ? "pause" : "play"} size={28} color="#FFFFFF" style={!isPlaying ? { marginLeft: 4 } : {}} />
                                                </LinearGradient>
                                            </TouchableOpacity>
                                        </Animated.View>
                                    </>
                                ) : activeMediaView === 'movie' ? (
                                    Platform.OS === 'web' ? (
                                        <iframe
                                            key={`vidlink-${selectedSeason}-${selectedEpisode}`}
                                            src={type === 'tv' ? `https://vidlink.pro/tv/${id}/${selectedSeason}/${selectedEpisode}?autoplay=1` : `https://vidlink.pro/movie/${id}?autoplay=1`}
                                            style={{ width: '100%', height: '100%', border: 'none' }}
                                            allow="autoplay; encrypted-media; fullscreen"
                                            allowFullScreen
                                            title="Player"
                                        />
                                    ) : (
                                        <WebView
                                            ref={webViewRef}
                                            key={`vidlink-${selectedSeason}-${selectedEpisode}`}
                                            source={{
                                                uri: type === 'tv' ? `https://vidlink.pro/tv/${id}/${selectedSeason}/${selectedEpisode}?autoplay=1` : `https://vidlink.pro/movie/${id}?autoplay=1`,
                                                headers: { 'Referer': 'https://vidlink.pro/', 'User-Agent': DESKTOP_USER_AGENT }
                                            }}
                                            userAgent={DESKTOP_USER_AGENT}
                                            style={{ flex: 1, backgroundColor: '#000' }}
                                            javaScriptEnabled={true} domStorageEnabled={true} allowsFullscreenVideo={true} mediaPlaybackRequiresUserAction={false}
                                            injectedJavaScriptBeforeContentLoaded={adBlockScript}
                                            injectedJavaScript={`(function() { var style = document.createElement('style'); var css = 'iframe[src*="ads"], .ad-overlay { display: none !important; }'; style.innerHTML = css; document.head.appendChild(style); })(); true;`}
                                            onShouldStartLoadWithRequest={(request) => request.url.includes('vidlink.pro') || request.url.includes('about:blank')}
                                        />
                                    )
                                ) : trailerKey ? (
                                    <YoutubePlayer height={'100%'} width={'100%'} play={isPlaying} videoId={trailerKey} onReady={() => setIsPlaying(true)} webViewProps={{ allowsFullscreenVideo: true }} initialPlayerParams={{ controls: 1, modestbranding: 1, rel: 0, autoplay: 1 }} onChangeState={(state) => { if (state === 'playing') setIsPlaying(true); if (state === 'paused' || state === 'ended') setIsPlaying(false); }} />
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
                            </View>
                        </View>

                        {/* RIGHT COLUMN: Metadata & Controls */}
                        {!isFullScreen && (
                            <View style={styles.desktopDetailsCol}>
                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8, paddingBottom: 60 }}>
                                    <Text style={styles.desktopMediaTitle}>{title}</Text>

                                    <View style={styles.desktopMetaRow}>
                                        {year ? <Text style={styles.metaText}>{year}</Text> : null}
                                        {year && languages ? <Text style={styles.metaDot}>•</Text> : null}
                                        <Text style={styles.metaText}>{languages !== 'Unknown' ? languages : ''}</Text>
                                        {mediaDetails.vote_average > 0 && (
                                            <><Text style={styles.metaDot}>•</Text><View style={styles.ratingBadge}><Ionicons name="star" size={14} color="#F5C518" /><Text style={[styles.ratingText, { fontSize: 14 }]}>{mediaDetails.vote_average?.toFixed(1)}</Text></View></>
                                        )}
                                    </View>

                                    {mediaDetails.overview ? <Text style={styles.desktopOverviewText}>{mediaDetails.overview}</Text> : null}

                                    <View style={styles.desktopActionRow}>
                                        {id && !streamUrl && (
                                            <>
                                                <TouchableOpacity onPress={() => handleAuthAction(() => handleToggleAction(id, type, 'watchlist'))} style={styles.desktopActionBtn}>
                                                    <Ionicons name={isCurrentInWatchlist ? "bookmark" : "bookmark-outline"} size={20} color={isCurrentInWatchlist ? "#F5C518" : "#FFFFFF"} />
                                                    <Text style={[styles.desktopActionBtnText, isCurrentInWatchlist && { color: '#F5C518' }]}>Save</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => handleAuthAction(() => handleToggleAction(id, type, 'watched'))} style={styles.desktopActionBtn}>
                                                    <Ionicons name="checkmark-done" size={20} color={isCurrentInWatched ? "#1F80E0" : "#FFFFFF"} />
                                                    <Text style={[styles.desktopActionBtnText, isCurrentInWatched && { color: '#1F80E0' }]}>Watched</Text>
                                                </TouchableOpacity>
                                            </>
                                        )}
                                    </View>

                                    {!streamUrl && (
                                        ytId ? (
                                            <TouchableOpacity style={[styles.watchToggleBtn, { cursor: 'pointer' }]} activeOpacity={0.8} onPress={() => handleCreateWatchParty(ytId, title)}>
                                                <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.watchToggleGradient}>
                                                    <Ionicons name="people-circle" size={24} color="#FFF" style={{ marginRight: 8 }} />
                                                    <Text style={styles.watchToggleText}>Start YouTube Watch Party</Text>
                                                </LinearGradient>
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity
                                                style={[styles.watchToggleBtn, { cursor: 'pointer' }]} activeOpacity={0.8} disabled={activeMediaView === 'trailer' && isVidkingAvailable === false}
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

                                    {activeMediaView === 'movie' && !streamUrl && !ytId && isVidkingAvailable && (
                                        <TouchableOpacity style={[styles.watchToggleBtn, { marginTop: 12, cursor: 'pointer' }]} activeOpacity={0.8} onPress={() => { const watchPartyYtId = type === 'tv' ? `VIDLINK:tv:${id}:${selectedSeason}:${selectedEpisode}` : `VIDLINK:movie:${id}`; handleCreateWatchParty(watchPartyYtId, title); }}>
                                            <LinearGradient colors={['#00E5FF', '#9B51E0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.watchToggleGradient}>
                                                <Ionicons name="people-circle" size={24} color="#FFF" style={{ marginRight: 8 }} />
                                                <Text style={styles.watchToggleText}>Start Watch Party</Text>
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    )}

                                    {activeMediaView === 'movie' && type === 'tv' && tvSeasons.length > 0 && !streamUrl && (
                                        <View style={styles.desktopTvControlsContainer}>
                                            <Text style={styles.tvControlsLabel}>Select Season</Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tvControlsRow}>
                                                {tvSeasons.map((season) => (
                                                    <TouchableOpacity key={`season-${season.season_number}`} style={[styles.tvChip, selectedSeason === season.season_number && styles.tvChipActive, { cursor: 'pointer' }]} onPress={() => { setSelectedSeason(season.season_number); setSelectedEpisode(1); }}>
                                                        <Text style={[styles.tvChipText, selectedSeason === season.season_number && styles.tvChipTextActive]}>Season {season.season_number}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                            <Text style={[styles.tvControlsLabel, { marginTop: 16 }]}>Select Episode</Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tvControlsRow}>
                                                {episodesArray.map((ep) => (
                                                    <TouchableOpacity key={`ep-${ep}`} style={[styles.tvChip, selectedEpisode === ep && styles.tvChipActive, { cursor: 'pointer' }]} onPress={() => setSelectedEpisode(ep)}>
                                                        <Text style={[styles.tvChipText, selectedEpisode === ep && styles.tvChipTextActive]}>Episode {ep}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    )}
                                </ScrollView>
                            </View>
                        )}
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    // --------------------------------------------------------
    // MOBILE & TABLET LAYOUT (Exact Native Clone)
    // --------------------------------------------------------
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
                                {Platform.OS === 'web' ? (
                                    <LiveTvWebPlayer streamUrl={streamUrl} isPlaying={isPlaying} videoRef={webVideoRef} />
                                ) : (
                                    <VideoView player={livePlayer} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} contentFit="contain" nativeControls={false} />
                                )}
                                <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5 }} activeOpacity={1} onPress={resetControlsTimer} />
                                <Animated.View style={[styles.liveStreamOverlay, { opacity: controlsFadeAnim }]} pointerEvents={showControls ? 'box-none' : 'none'} renderToHardwareTextureAndroid={true}>
                                    <View style={styles.liveBadgeContainer}>
                                        <View style={styles.liveDot} />
                                        <Text style={styles.liveBadgeText}>LIVE</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.gradientPlayWrapper}
                                        activeOpacity={0.8}
                                        onPress={() => {
                                            if (Platform.OS === 'web') {
                                                handleWebPlayPause();
                                                return;
                                            }
                                            resetControlsTimer();
                                            if (isPlaying) { livePlayer.pause(); setIsPlaying(false); } else { livePlayer.play(); setIsPlaying(true); }
                                        }}
                                    >
                                        <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradientPlayInner}>
                                            <Ionicons name={isPlaying ? "pause" : "play"} size={24} color="#FFFFFF" style={!isPlaying ? { marginLeft: 4 } : {}} />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </Animated.View>
                            </>
                        ) : activeMediaView === 'movie' ? (
                            Platform.OS === 'web' ? (
                                <iframe
                                    key={`vidlink-${selectedSeason}-${selectedEpisode}`}
                                    src={type === 'tv' ? `https://vidlink.pro/tv/${id}/${selectedSeason}/${selectedEpisode}?autoplay=1` : `https://vidlink.pro/movie/${id}?autoplay=1`}
                                    style={{ width: '100%', height: '100%', border: 'none' }}
                                    allow="autoplay; encrypted-media; fullscreen"
                                    allowFullScreen
                                    title="Player"
                                />
                            ) : (
                                <WebView
                                    ref={webViewRef}
                                    key={`vidlink-${selectedSeason}-${selectedEpisode}`}
                                    source={{ uri: type === 'tv' ? `https://vidlink.pro/tv/${id}/${selectedSeason}/${selectedEpisode}?autoplay=1` : `https://vidlink.pro/movie/${id}?autoplay=1`, headers: { 'Referer': 'https://vidlink.pro/', 'User-Agent': DESKTOP_USER_AGENT } }}
                                    userAgent={DESKTOP_USER_AGENT}
                                    style={{ flex: 1, backgroundColor: '#000' }}
                                    javaScriptEnabled={true} domStorageEnabled={true} allowsFullscreenVideo={false} mediaPlaybackRequiresUserAction={false} allowsInlineMediaPlayback={true} androidLayerType="hardware"
                                    injectedJavaScriptBeforeContentLoaded={adBlockScript}
                                    injectedJavaScript={`(function() { var style = document.createElement('style'); var css = 'iframe[src*="ads"], .ad-overlay { display: none !important; }'; css += '.pjs-fullscreen, .pjs-icon-fullscreen, [aria-label="Fullscreen"], [title="Fullscreen"], .fullscreen-btn { display: none !important; }'; style.innerHTML = css; document.head.appendChild(style); })(); true;`}
                                    onShouldStartLoadWithRequest={(request) => request.url.includes('vidlink.pro') || request.url.includes('about:blank')}
                                />
                            )
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
                            <Animated.View style={[styles.fullscreenExitBtn, { opacity: controlsFadeAnim }]} pointerEvents={showControls ? 'auto' : 'none'} renderToHardwareTextureAndroid={true}>
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

                        {activeMediaView === 'movie' && !streamUrl && !ytId && isVidkingAvailable && (
                            <TouchableOpacity
                                style={styles.watchToggleBtn} activeOpacity={0.8}
                                onPress={() => {
                                    const watchPartyYtId = type === 'tv' ? `VIDLINK:tv:${id}:${selectedSeason}:${selectedEpisode}` : `VIDLINK:movie:${id}`;
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

    // --- DESKTOP STYLES (>= 1024px) ---
    desktopContainer: { flex: 1, padding: 32, paddingBottom: 0, backgroundColor: '#0A0A0C' },
    desktopBackBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', marginBottom: 24, cursor: 'pointer', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    desktopLayout: { flex: 1, flexDirection: 'row', gap: 40 },

    // LEFT COLUMN: Video Player
    desktopPlayerCol: {
        flex: 1,
        height: '100%',
        minHeight: 450,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#000',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.8,
        shadowRadius: 30,
        elevation: 10
    },
    desktopPlayerWrapper: { width: '100%', height: '100%', position: 'relative' },

    // RIGHT COLUMN: Details
    desktopDetailsCol: { width: 420, flexShrink: 0 },

    desktopMediaTitle: { color: '#FFFFFF', fontSize: 40, fontWeight: '900', marginBottom: 16, lineHeight: 46, letterSpacing: 0.5 },
    desktopMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    desktopOverviewText: { color: '#A0A0A5', fontSize: 16, lineHeight: 26, marginTop: 8, marginBottom: 32 },

    desktopActionRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    desktopActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, cursor: 'pointer', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    desktopActionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },

    desktopTvControlsContainer: { marginTop: 24, backgroundColor: 'rgba(20, 20, 25, 0.6)', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },

    // --- MOBILE & TABLET STYLES (< 1024px) ---
    playerContainer: { position: 'relative', backgroundColor: '#000' },
    videoThumbnail: { width: '100%', height: '100%', position: 'absolute' },
    playerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
    noTrailerText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 8 },
    fullscreenExitBtn: { position: 'absolute', top: 20, left: 20, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.7)', padding: 8, borderRadius: 20 },
    externalControlBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#14141A', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
    externalLeftControls: { flexDirection: 'row', gap: 12 },
    externalRightControls: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    externalBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    externalBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
    detailsContainer: { paddingHorizontal: 16, paddingTop: 20 },
    mediaTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold', marginBottom: 8 },

    // --- SHARED STYLES ---
    watchToggleBtn: { marginTop: 4, marginBottom: 16, borderRadius: 12, overflow: 'hidden' },
    watchToggleGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
    watchToggleText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
    tvControlsContainer: { marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    tvControlsLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold', marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
    tvControlsRow: { gap: 10, paddingBottom: 6 },
    tvChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    tvChipActive: { backgroundColor: 'rgba(0, 229, 255, 0.15)', borderColor: '#00E5FF' },
    tvChipText: { color: '#8F98A0', fontSize: 14, fontWeight: '600' },
    tvChipTextActive: { color: '#00E5FF', fontWeight: 'bold' },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    metaText: { color: '#A0A0A5', fontSize: 15, fontWeight: '600' },
    metaDot: { color: '#A0A0A5', fontSize: 15, marginHorizontal: 10 },
    ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 197, 24, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    ratingText: { color: '#F5C518', fontSize: 13, fontWeight: 'bold', marginLeft: 4 },
    overviewText: { color: '#D0D0D5', fontSize: 15, lineHeight: 22, marginTop: 8 },
    liveStreamOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.15)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    liveBadgeContainer: { position: 'absolute', top: 20, left: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 0, 122, 0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255, 0, 122, 0.5)' },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF007A', marginRight: 6 },
    liveBadgeText: { color: '#FF007A', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    gradientPlayWrapper: { width: 56, height: 56, borderRadius: 28, elevation: 8, shadowColor: '#FF007A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8 },
    gradientPlayInner: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 28 },
    desktopContainerFullScreen: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 999999,
        elevation: 999,
        padding: 0,
        backgroundColor: '#000',
    },
    desktopPlayerColFullScreen: {
        borderRadius: 0,
        borderWidth: 0,
        minHeight: '100%',
    },
    desktopExpandBtn: {
        position: 'absolute',
        top: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 8,
        borderRadius: 20,
        zIndex: 20,
    },
});