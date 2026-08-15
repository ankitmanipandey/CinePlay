import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
    Animated,
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

// --- CUSTOM GRADIENT SPINNER (100% Transparent Middle) ---
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
                <Circle
                    cx="22"
                    cy="22"
                    r="18"
                    stroke="url(#loaderGrad)"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray="85 113"
                    strokeLinecap="round"
                />
            </Svg>
        </Animated.View>
    );
};

// Helper for formatting time (MM:SS)
const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
};

const TheatrePlayer = forwardRef(({
    ytId, isPlaying, isHostBool, onPlayerStateChange, width, height, isMuted
}, ref) => {

    const isCustom = ytId && ytId.startsWith('CUSTOM:');
    const customUrl = isCustom ? ytId.replace('CUSTOM:', '') : null;
    const youtubeId = isCustom ? null : ytId;

    const ytRef = useRef(null);

    // --- UI OVERLAY STATE ---
    const [controlsVisible, setControlsVisible] = useState(true);
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const controlsTimer = useRef(null);
    const [showSettings, setShowSettings] = useState(false);

    // --- VIDEO METRICS & SCRUBBING STATE ---
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
        if (isPlaying) player.play();
    });

    const nativePlayerRef = useRef(nativePlayer);
    useEffect(() => {
        nativePlayerRef.current = nativePlayer;
    }, [nativePlayer]);

    const durationRef = useRef(duration);
    useEffect(() => {
        durationRef.current = duration;
    }, [duration]);

    // Keep Player Synced
    useEffect(() => {
        if (!nativePlayer || !isCustom) return;
        try {
            nativePlayer.muted = isMuted;
            if (isPlaying && !nativePlayer.playing) nativePlayer.play();
            if (!isPlaying && nativePlayer.playing) nativePlayer.pause();
        } catch (e) { }
    }, [isPlaying, isMuted, nativePlayer, isCustom]);

    // --- FIXED: Smart Listeners that prevent false pauses during buffering ---
    useEffect(() => {
        if (!nativePlayer || !isCustom) return;

        const subStatus = nativePlayer.addListener('statusChange', (status) => {
            if (status.status === 'loading' || status.status === 'buffering') {
                setIsBuffering(true);
            } else if (status.status === 'readyToPlay') {
                setIsBuffering(false);
                stallCounter.current = 0;
                // Force play if the room is meant to be playing
                if (isPlaying && !nativePlayer.playing) {
                    nativePlayer.play();
                }
            }
        });

        const subPlay = nativePlayer.addListener('playingChange', (isPlayingState) => {
            if (isPlayingState.isPlaying) {
                setIsBuffering(false);
                stallCounter.current = 0;
            } else {
                // ONLY tell the room to pause if the video naturally reached the very end.
                // Otherwise, it paused against our will (buffering/seeking) and we ignore it!
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
                    // Video is frozen, but room is playing -> It is buffering!
                    setIsBuffering(true);
                }

                if (!isScrubbingRef.current) {
                    setCurrentTime(currentNativeTime);
                }

                if (nativePlayer.duration) setDuration(nativePlayer.duration);
                lastTimeRef.current = currentNativeTime;
            } catch (e) { }
        }, 500);

        return () => {
            subStatus.remove();
            subPlay.remove();
            clearInterval(interval);
        };
    }, [nativePlayer, isCustom, isPlaying, onPlayerStateChange]); // Added isPlaying to dependencies

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
        }
    }), [isCustom, youtubeId]);

    const showControlsTemporarily = () => {
        setControlsVisible(true);
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();

        if (controlsTimer.current) clearTimeout(controlsTimer.current);
        controlsTimer.current = setTimeout(() => {
            if (!showSettings && isPlaying && !isScrubbingRef.current) {
                Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
                    setControlsVisible(false);
                });
            }
        }, 3500);
    };

    useEffect(() => {
        showControlsTemporarily();
        return () => clearTimeout(controlsTimer.current);
    }, [isPlaying, showSettings]);

    // --- PAN RESPONDER (FIXED: Force playback resume after scrub release) ---
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
                            // Enforce auto-play immediately if the room is playing
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

    const handleSkip = (seconds) => {
        if (!isHostBool) return;
        const player = nativePlayerRef.current;
        if (!player) return;
        try {
            const newTime = Math.max(0, Math.min(durationRef.current, player.currentTime + seconds));
            player.currentTime = newTime;

            // Enforce auto-play immediately if the room is playing
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

    const togglePlayPause = () => {
        if (!isHostBool) return;
        onPlayerStateChange(isPlaying ? 'paused' : 'playing');
        showControlsTemporarily();
    };

    const handleSpeedChange = (speed) => {
        const player = nativePlayerRef.current;
        if (!player) return;
        try {
            player.playbackRate = speed;
        } catch (e) { }
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
                        style={{ position: 'absolute', width: '100%', height: '100%' }}
                        contentFit="contain"
                        nativeControls={false}
                    />

                    <TouchableWithoutFeedback onPress={showControlsTemporarily}>
                        <View style={{ position: 'absolute', width: '100%', height: '100%' }}>
                            {controlsVisible && (
                                <Animated.View style={[styles.overlayWrapper, { opacity: fadeAnim }]}>

                                    <LinearGradient colors={['rgba(0,0,0,0.8)', 'transparent']} style={styles.topShadow} />

                                    <View style={[styles.topBar, { justifyContent: 'flex-end' }]}>
                                        <TouchableOpacity style={styles.topBtn} onPress={() => { setShowSettings(!showSettings); showControlsTemporarily(); }}>
                                            <Ionicons name="settings-outline" size={24} color="#FFF" />
                                        </TouchableOpacity>
                                    </View>

                                    {showSettings && (
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
                                                <TouchableOpacity style={[styles.middleBtn, !isHostBool && { opacity: 0 }]} onPress={() => handleSkip(-10)} disabled={!isHostBool}>
                                                    <Ionicons name="play-back" size={42} color="#FFF" />
                                                    <Text style={styles.skipText}>10s</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity style={[styles.playPauseBtn, !isHostBool && { opacity: 0 }]} onPress={togglePlayPause} disabled={!isHostBool}>
                                                    <Ionicons name={isPlaying ? "pause" : "play"} size={64} color="#FFF" style={{ marginLeft: isPlaying ? 0 : 4 }} />
                                                </TouchableOpacity>

                                                <TouchableOpacity style={[styles.middleBtn, !isHostBool && { opacity: 0 }]} onPress={() => handleSkip(10)} disabled={!isHostBool}>
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
                                            {...progressPanResponder.panHandlers}
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
                    </TouchableWithoutFeedback>
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

    loaderContainer: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }
});