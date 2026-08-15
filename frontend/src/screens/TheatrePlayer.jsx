import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Easing,
    PanResponder,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import Svg, { Circle, Defs, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import YoutubePlayer from 'react-native-youtube-iframe';
import { VolumeManager } from 'react-native-volume-manager';

const GradientLoader = () => {
    const spinValue = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.loop(
            Animated.timing(spinValue, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })
        ).start();
    }, []);
    const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    return (
        <Animated.View style={[styles.loaderContainer, { transform: [{ rotate: spin }] }]}>
            <Svg width="44" height="44" viewBox="0 0 44 44">
                <Defs>
                    <SvgLinearGradient id="loaderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#00E5FF" />
                        <Stop offset="50%" stopColor="#9B51E0" />
                        <Stop offset="100%" stopColor="#FF007A" />
                    </SvgLinearGradient>
                </Defs>
                <Circle cx="22" cy="22" r="18" stroke="url(#loaderGrad)" strokeWidth="4" fill="none" strokeDasharray="85 113" strokeLinecap="round" />
            </Svg>
        </Animated.View>
    );
};

const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
};

const TheatrePlayer = forwardRef(({
    ytId, isPlaying, isHostBool, onPlayerStateChange, width, height, isMuted,
    isFullScreen, onExit, onToggleOrientation, onControlsToggle
}, ref) => {

    const isCustom = ytId && ytId.startsWith('CUSTOM:');
    const customUrl = isCustom ? ytId.replace('CUSTOM:', '') : null;
    const youtubeId = isCustom ? null : ytId;

    const ytRef = useRef(null);

    // --- controlsVisible is the SINGLE SOURCE OF TRUTH for whether any
    // on-screen controls (this component's own bars, AND the parent
    // TheatreScreen's reaction/chat/fullscreen buttons via onControlsToggle)
    // should be visible. There is exactly one 6-second timer that governs
    // this, defined below. Nothing else should independently hide/show
    // these elements — everything routes through showControlsTemporarily /
    // toggleControlsRef so that every visible element appears and
    // disappears together. ---
    const [controlsVisible, setControlsVisible] = useState(true);
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const controlsTimer = useRef(null);
    const [showSettings, setShowSettings] = useState(false);

    // --- Brightness is a purely local, in-app simulation. It does NOT
    // touch the real device brightness (no `expo-brightness` call), which
    // means it never needs the OS "Allow modify system settings" permission
    // and can never trigger that screen — not intermittently, not ever.
    // The visible dimming effect comes entirely from the black overlay
    // `View` below (opacity: 1 - brightness), driven by this state. ---
    const [brightness, setBrightness] = useState(1);
    const [volume, setVolume] = useState(1);
    const brightnessRef = useRef(1);
    const volumeRef = useRef(1);

    const [swipeIndicator, setSwipeIndicator] = useState({ visible: false, type: '', value: 0 });

    const lastTap = useRef({ time: 0, timeout: null });
    const swipeState = useRef({ isSwiping: false, startY: 0, startVal: 0, side: '' });

    // --- Only volume is read on mount. Reading volume does not require any
    // special Android permission, so it's safe to do eagerly. ---
    useEffect(() => {
        let isMounted = true;

        (async () => {
            try {
                const currentV = await VolumeManager.getVolume();
                const v = typeof currentV === 'number' ? currentV : currentV.volume;
                if (isMounted) {
                    volumeRef.current = v;
                    setVolume(v);
                }
            } catch (e) {
                console.log('Volume init failed:', e.message);
            }
        })();

        const volumeListener = VolumeManager.addVolumeListener((result) => {
            if (isMounted) {
                volumeRef.current = result.volume;
                setVolume(result.volume);
            }
        });

        return () => {
            isMounted = false;
            volumeListener?.remove();
        };
    }, []);

    const toggleControlsRef = useRef(null);
    const showControlsRef = useRef(null);
    const handleSkipRef = useRef(null);

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isBuffering, setIsBuffering] = useState(false);

    const progressWidthRef = useRef(0);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [scrubTime, setScrubTime] = useState(0);
    const isScrubbingRef = useRef(false);
    const scrubStartX = useRef(0);

    const lastTimeRef = useRef(0);
    const stallCounter = useRef(0);

    const nativePlayer = useVideoPlayer(customUrl || '', (player) => {
        player.loop = false;
        player.muted = isMuted;
        player.preservesPitch = true;
        // FIXED: Removed player.play() here. Our safe useEffect handles it after mount!
    });

    const nativePlayerRef = useRef(nativePlayer);
    useEffect(() => { nativePlayerRef.current = nativePlayer; }, [nativePlayer]);

    const durationRef = useRef(duration);
    useEffect(() => { durationRef.current = duration; }, [duration]);

    useEffect(() => {
        if (!nativePlayer || !isCustom) return;
        try {
            nativePlayer.muted = isMuted;
            if (isPlaying && !nativePlayer.playing) nativePlayer.play();
            if (!isPlaying && nativePlayer.playing) nativePlayer.pause();
        } catch (e) { }
    }, [isPlaying, isMuted, nativePlayer, isCustom]);

    useEffect(() => {
        if (!nativePlayer || !isCustom) return;

        const subStatus = nativePlayer.addListener('statusChange', (status) => {
            if (status.status === 'loading' || status.status === 'buffering') setIsBuffering(true);
            else if (status.status === 'readyToPlay') {
                setIsBuffering(false);
                stallCounter.current = 0;
                if (isPlaying && !nativePlayer.playing) nativePlayer.play();
            }
        });

        const subPlay = nativePlayer.addListener('playingChange', (isPlayingState) => {
            if (isPlayingState.isPlaying) {
                setIsBuffering(false);
                stallCounter.current = 0;
            } else {
                if (isPlaying && durationRef.current > 0 && nativePlayer.currentTime >= durationRef.current - 0.5) {
                    onPlayerStateChange('paused');
                }
            }
        });

        const interval = setInterval(() => {
            try {
                if (!nativePlayer || !isCustom) return;
                const currentNativeTime = nativePlayer.currentTime;

                if (nativePlayer.playing && !isScrubbingRef.current) {
                    if (currentNativeTime === lastTimeRef.current) {
                        stallCounter.current += 1;
                        if (stallCounter.current >= 2) setIsBuffering(true);
                    } else {
                        stallCounter.current = 0;
                        setIsBuffering(false);
                    }
                } else if (!nativePlayer.playing && !isScrubbingRef.current && isPlaying) {
                    setIsBuffering(true);
                }

                if (!isScrubbingRef.current) setCurrentTime(currentNativeTime);
                if (nativePlayer.duration) setDuration(nativePlayer.duration);
                lastTimeRef.current = currentNativeTime;
            } catch (e) { }
        }, 500);

        return () => {
            subStatus.remove();
            subPlay.remove();
            clearInterval(interval);
        };
    }, [nativePlayer, isCustom, isPlaying, onPlayerStateChange]);

    const showControlsTemporarily = () => {
        setControlsVisible(true);
        if (onControlsToggle) onControlsToggle(true);

        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();

        if (controlsTimer.current) clearTimeout(controlsTimer.current);
        controlsTimer.current = setTimeout(() => {
            if (!showSettings && isPlaying && !isScrubbingRef.current) {
                Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
                    setControlsVisible(false);
                    if (onControlsToggle) onControlsToggle(false);
                });
            }
        }, 6000);
    };

    // Reassigned fresh on every render so it always closes over the LATEST
    // isPlaying / showSettings / controlsVisible — this is what prevents the
    // "auto-hide silently stops working once the video actually starts
    // playing" bug that a stale closure would otherwise cause.
    showControlsRef.current = showControlsTemporarily;

    toggleControlsRef.current = () => {
        if (controlsVisible) {
            Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
                setControlsVisible(false);
                if (onControlsToggle) onControlsToggle(false);
            });
            if (controlsTimer.current) clearTimeout(controlsTimer.current);
        } else {
            showControlsTemporarily();
        }
    };

    // --- Everything exposed to the parent is routed through the *Ref
    // indirections above, never through a function closured directly at the
    // time the imperative handle factory ran. useImperativeHandle only
    // re-runs its factory when [isCustom, youtubeId] change — capturing
    // showControlsTemporarily directly here would freeze it to whatever
    // isPlaying/showSettings were on the render the video type was first
    // determined (usually before playback even started). Routing through
    // the refs guarantees we always call the current-render version. ---
    useImperativeHandle(ref, () => ({
        getCurrentTime: async () => {
            try {
                if (youtubeId && ytRef.current) return (await ytRef.current.getCurrentTime()) ?? 0;
                if (isCustom && nativePlayerRef.current) return nativePlayerRef.current.currentTime ?? 0;
            } catch (e) { }
            return 0;
        },
        seekTo: (seconds, allowSeekAhead) => {
            try {
                if (youtubeId && ytRef.current) {
                    ytRef.current.seekTo(seconds, allowSeekAhead);
                } else if (isCustom && nativePlayerRef.current) {
                    nativePlayerRef.current.currentTime = seconds;
                    setCurrentTime(seconds);
                }
            } catch (e) { }
        },
        // Show controls & reset the 6s auto-hide clock (used by external
        // buttons like the chat/reaction toggles in TheatreScreen).
        extendControls: () => {
            showControlsRef.current?.();
        },
        // Toggle controls on/off (used for taps on the video area where
        // there's no internal gesture layer, e.g. plain YouTube playback).
        toggleControls: () => {
            toggleControlsRef.current?.();
        }
    }), [isCustom, youtubeId]);

    useEffect(() => {
        showControlsTemporarily();
        return () => clearTimeout(controlsTimer.current);
    }, [isPlaying, showSettings]);

    handleSkipRef.current = (seconds) => {
        if (!isHostBool) return;
        const player = nativePlayerRef.current;
        if (!player) return;
        try {
            const newTime = Math.max(0, Math.min(durationRef.current, player.currentTime + seconds));
            player.currentTime = newTime;

            if (isPlaying) {
                setIsBuffering(true);
                stallCounter.current = 2;
                player.play();
            }

            setCurrentTime(newTime);
            lastTimeRef.current = newTime;
            showControlsTemporarily();
        } catch (e) { }
    };

    const mainPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dy) > 10,
            onPanResponderGrant: (evt) => {
                const { width: currentWidth } = Dimensions.get('window');
                const x = evt.nativeEvent.locationX;
                const side = x < currentWidth / 2 ? 'left' : 'right';

                swipeState.current = {
                    isSwiping: false,
                    startY: evt.nativeEvent.locationY,
                    startVal: side === 'left' ? brightnessRef.current : volumeRef.current,
                    side: side
                };
            },
            onPanResponderMove: (evt, gestureState) => {
                if (Math.abs(gestureState.dy) > 10) {
                    swipeState.current.isSwiping = true;

                    const { height: currentHeight } = Dimensions.get('window');
                    const delta = -(gestureState.dy / (currentHeight / 1.5));
                    const newVal = Math.max(0, Math.min(1, swipeState.current.startVal + delta));

                    if (swipeState.current.side === 'left') {
                        // In-app-only brightness simulation — no real device
                        // API call here, so this can never trigger the OS
                        // "Allow modify system settings" permission screen.
                        brightnessRef.current = newVal;
                        setBrightness(newVal);
                        setSwipeIndicator({ visible: true, type: 'brightness', value: Math.round(newVal * 100) });
                    } else {
                        volumeRef.current = newVal;
                        setVolume(newVal);
                        VolumeManager.setVolume(newVal);
                        setSwipeIndicator({ visible: true, type: 'volume', value: Math.round(newVal * 100) });
                    }
                }
            },
            onPanResponderRelease: (evt, gestureState) => {
                if (swipeState.current.isSwiping) {
                    setSwipeIndicator({ visible: false, type: '', value: 0 });
                } else {
                    const now = Date.now();
                    const { width: currentWidth } = Dimensions.get('window');
                    const x = evt.nativeEvent.locationX;
                    const DOUBLE_TAP_DELAY = 300;

                    if (now - lastTap.current.time < DOUBLE_TAP_DELAY) {
                        if (lastTap.current.timeout) clearTimeout(lastTap.current.timeout);
                        lastTap.current.time = 0;

                        if (x < currentWidth / 2) handleSkipRef.current(-10);
                        else handleSkipRef.current(10);
                    } else {
                        lastTap.current.time = now;
                        lastTap.current.timeout = setTimeout(() => {
                            if (lastTap.current.time === now) {
                                // A single tap on empty video space TOGGLES
                                // controls — shows them if hidden, hides them
                                // if visible. This (plus the shared state
                                // above) is what makes every overlay element
                                // appear and disappear together.
                                toggleControlsRef.current();
                            }
                        }, DOUBLE_TAP_DELAY);
                    }
                }
                swipeState.current.isSwiping = false;
            },
            onPanResponderTerminate: () => {
                setSwipeIndicator({ visible: false, type: '', value: 0 });
                swipeState.current.isSwiping = false;
            }
        })
    ).current;

    const progressPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                isScrubbingRef.current = true;
                setIsScrubbing(true);
                showControlsTemporarily();

                const x = evt.nativeEvent.locationX;
                scrubStartX.current = x;

                if (progressWidthRef.current > 0) {
                    const percentage = Math.max(0, Math.min(1, x / progressWidthRef.current));
                    setScrubTime(percentage * durationRef.current);
                }
            },
            onPanResponderMove: (evt, gestureState) => {
                const newX = scrubStartX.current + gestureState.dx;
                if (progressWidthRef.current > 0) {
                    const percentage = Math.max(0, Math.min(1, newX / progressWidthRef.current));
                    setScrubTime(percentage * durationRef.current);
                }
                showControlsTemporarily();
            },
            onPanResponderRelease: (evt, gestureState) => {
                const newX = scrubStartX.current + gestureState.dx;
                let newTime = 0;
                if (progressWidthRef.current > 0) {
                    const percentage = Math.max(0, Math.min(1, newX / progressWidthRef.current));
                    newTime = percentage * durationRef.current;
                }

                const player = nativePlayerRef.current;
                if (player) {
                    try {
                        if (player.duration > 0) {
                            player.currentTime = newTime;
                            if (isPlaying) {
                                setIsBuffering(true);
                                stallCounter.current = 2;
                                player.play();
                            }
                        }
                    } catch (e) { }
                }

                setCurrentTime(newTime);
                setScrubTime(newTime);
                lastTimeRef.current = newTime;
                isScrubbingRef.current = false;
                setIsScrubbing(false);
            },
            onPanResponderTerminate: () => {
                isScrubbingRef.current = false;
                setIsScrubbing(false);
            }
        })
    ).current;

    const togglePlayPause = () => {
        if (!isHostBool) return;
        onPlayerStateChange(isPlaying ? 'paused' : 'playing');
        showControlsTemporarily();
    };

    const handleSpeedChange = (speed) => {
        const player = nativePlayerRef.current;
        if (!player) return;
        try { player.playbackRate = speed; } catch (e) { }
        setShowSettings(false);
    };

    const displayTime = isScrubbing ? scrubTime : currentTime;
    const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;

    return (
        <View style={{ width: width, height: height, backgroundColor: '#000', position: 'relative' }}>
            {youtubeId ? (
                <View pointerEvents={isHostBool ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
                    <YoutubePlayer
                        ref={ytRef} height={height} width={width}
                        play={isPlaying} mute={isMuted} volume={isMuted ? 0 : 100}
                        videoId={youtubeId} onChangeState={onPlayerStateChange}
                        webViewProps={{ allowsFullscreenVideo: false }}
                        initialPlayerParams={{ controls: isHostBool ? 1 : 0, modestbranding: 1, rel: 0 }}
                    />
                </View>
            ) : customUrl ? (
                <View style={{ width: '100%', height: '100%' }}>

                    <VideoView
                        player={nativePlayer}
                        style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 0 }}
                        contentFit="contain"
                        nativeControls={false}
                    />

                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'black', opacity: 1 - brightness, zIndex: 1 }]} pointerEvents="none" />

                    <View style={[StyleSheet.absoluteFill, { zIndex: 2 }]} {...mainPanResponder.panHandlers} />

                    {swipeIndicator.visible && (
                        <View style={styles.swipeIndicatorContainer}>
                            <Ionicons name={swipeIndicator.type === 'brightness' ? 'sunny' : 'volume-high'} size={32} color="#FFF" />
                            <Text style={styles.swipeIndicatorText}>{swipeIndicator.value}%</Text>
                        </View>
                    )}

                    {controlsVisible && (
                        <Animated.View style={[styles.overlayWrapper, { opacity: fadeAnim }]} pointerEvents="box-none">

                            <LinearGradient colors={['rgba(0,0,0,0.8)', 'transparent']} style={styles.topShadow} pointerEvents="none" />

                            <View style={[styles.topBar, { justifyContent: 'flex-end' }]} pointerEvents="box-none">
                                {isHostBool && (
                                    <TouchableOpacity style={styles.topBtn} onPress={() => { setShowSettings(!showSettings); showControlsTemporarily(); }}>
                                        <Ionicons name="settings-outline" size={24} color="#FFF" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {showSettings && isHostBool && (
                                <View style={styles.settingsMenu}>
                                    <Text style={styles.settingsHeader}>Playback Speed</Text>
                                    <View style={styles.speedRow}>
                                        {[0.5, 1, 1.5, 2].map(speed => (
                                            <TouchableOpacity key={speed} style={styles.speedBtn} onPress={() => handleSpeedChange(speed)}>
                                                <Text style={styles.speedText}>{speed}x</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}

                            <View style={styles.middleControls} pointerEvents="box-none">
                                {isBuffering ? (
                                    <GradientLoader />
                                ) : (
                                    <>
                                        <TouchableOpacity style={[styles.middleBtn, !isHostBool && { opacity: 0 }]} onPress={() => handleSkipRef.current(-10)} disabled={!isHostBool}>
                                            <Ionicons name="play-back" size={42} color="#FFF" />
                                            <Text style={styles.skipText}>10s</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity style={[styles.playPauseBtn, !isHostBool && { opacity: 0 }]} onPress={togglePlayPause} disabled={!isHostBool}>
                                            <Ionicons name={isPlaying ? "pause" : "play"} size={64} color="#FFF" style={{ marginLeft: isPlaying ? 0 : 4 }} />
                                        </TouchableOpacity>

                                        <TouchableOpacity style={[styles.middleBtn, !isHostBool && { opacity: 0 }]} onPress={() => handleSkipRef.current(10)} disabled={!isHostBool}>
                                            <Ionicons name="play-forward" size={42} color="#FFF" />
                                            <Text style={styles.skipText}>10s</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>

                            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.bottomShadow} pointerEvents="box-none">
                                <View style={styles.timeRow}>
                                    <Text style={styles.durationText}>
                                        {formatTime(displayTime)} / {formatTime(duration)}
                                    </Text>
                                </View>

                                <View
                                    style={styles.progressBarContainer}
                                    onLayout={(e) => progressWidthRef.current = e.nativeEvent.layout.width}
                                    {...(isHostBool ? progressPanResponder.panHandlers : {})}
                                >
                                    <View style={styles.progressBarTrack} pointerEvents="none">
                                        <LinearGradient
                                            colors={['#00E5FF', '#9B51E0', '#FF007A']}
                                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                            style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
                                        />
                                    </View>
                                    <View style={[styles.progressKnob, { left: `${progressPercent}%` }]} pointerEvents="none" />
                                </View>
                            </LinearGradient>
                        </Animated.View>
                    )}
                </View>
            ) : (
                <View style={styles.emptyPlayer}>
                    <Ionicons name="tv-outline" size={48} color="#8F98A0" />
                    <Text style={styles.emptyText}>{isHostBool ? "Search and select a video to start" : "Waiting for the Host..."}</Text>
                </View>
            )}
        </View>
    );
});

export default TheatrePlayer;

const styles = StyleSheet.create({
    emptyPlayer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
    emptyText: { color: '#8F98A0', marginTop: 12, fontSize: 14 },

    overlayWrapper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', zIndex: 10 },
    topShadow: { position: 'absolute', top: 0, left: 0, right: 0, height: 80 },
    bottomShadow: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 90, justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 12 },

    middleControls: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 40,
        zIndex: 10
    },

    topBar: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, zIndex: 20 },
    topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },

    middleBtn: { alignItems: 'center', justifyContent: 'center', width: 60, height: 60 },
    skipText: { color: '#FFF', fontSize: 13, fontWeight: 'bold', marginTop: -4 },
    playPauseBtn: { width: 76, height: 76, justifyContent: 'center', alignItems: 'center' },

    timeRow: { width: '100%', alignItems: 'flex-end', marginBottom: 8, paddingRight: 4 },
    durationText: { color: '#FFF', fontSize: 13, fontWeight: 'bold', letterSpacing: 0.5 },

    progressBarContainer: { width: '100%', height: 30, justifyContent: 'center' },
    progressBarTrack: { width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 2 },

    progressKnob: {
        position: 'absolute',
        top: '50%',
        marginTop: -7,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#FFFFFF',
        marginLeft: -7,
        elevation: 4,
        shadowColor: '#00E5FF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4
    },

    settingsMenu: { position: 'absolute', top: 60, right: 16, width: 220, backgroundColor: 'rgba(20,20,25,0.95)', borderRadius: 12, padding: 16, zIndex: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    settingsHeader: { color: '#8F98A0', fontSize: 11, textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 12, letterSpacing: 1 },
    speedRow: { flexDirection: 'row', justifyContent: 'space-between' },
    speedBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 },
    speedText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },

    loaderContainer: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

    swipeIndicatorContainer: { position: 'absolute', top: '30%', alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 16, alignItems: 'center', zIndex: 50 },
    swipeIndicatorText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginTop: 8 }
});