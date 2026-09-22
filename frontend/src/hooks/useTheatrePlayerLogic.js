import { useState, useEffect, useRef, useImperativeHandle } from 'react';
import { Animated, Dimensions, PanResponder } from 'react-native';
import { VolumeManager } from 'react-native-volume-manager';
import { useVideoPlayer } from 'expo-video';

const FADE_IN_MS = 200;
const FADE_OUT_MS = 300;

export const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
};

export const useTheatrePlayerLogic = (props, ref) => {
    const {
        ytId, isPlaying, isHostBool, onPlayerStateChange, width, height, isMuted,
        isFullScreen, onExit, onToggleOrientation, onControlsToggle, fadeAnim: fadeAnimProp
    } = props;

    const isCustom = ytId && ytId.startsWith('CUSTOM:');
    const customUrl = isCustom ? ytId.replace('CUSTOM:', '') : null;
    const youtubeId = isCustom ? null : ytId;

    const ytRef = useRef(null);
    const widthRef = useRef(width);
    widthRef.current = width;

    const [controlsVisible, setControlsVisible] = useState(true);
    const internalFade = useRef(new Animated.Value(1)).current;
    const fadeAnim = fadeAnimProp || internalFade;
    const controlsTimer = useRef(null);
    const [showSettings, setShowSettings] = useState(false);

    const [brightness, setBrightness] = useState(1);
    const [volume, setVolume] = useState(1);
    const brightnessRef = useRef(1);
    const volumeRef = useRef(1);

    const [swipeIndicator, setSwipeIndicator] = useState({ visible: false, type: '', value: 0 });

    const lastTap = useRef({ time: 0, timeout: null });
    const swipeState = useRef({ isSwiping: false, startY: 0, startVal: 0, side: '' });

    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                // Wrap in try-catch as VolumeManager is primarily native
                const currentV = await VolumeManager.getVolume();
                const v = typeof currentV === 'number' ? currentV : currentV.volume;
                if (isMounted && v !== undefined) {
                    volumeRef.current = v;
                    setVolume(v);
                }
            } catch (e) { console.log('VolumeManager not supported on this platform'); }
        })();

        let volumeListener;
        try {
            volumeListener = VolumeManager.addVolumeListener((result) => {
                if (isMounted) {
                    volumeRef.current = result.volume;
                    setVolume(result.volume);
                }
            });
        } catch (e) { }

        return () => {
            isMounted = false;
            if (volumeListener) volumeListener.remove();
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
        player.play();
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

        Animated.timing(fadeAnim, { toValue: 1, duration: FADE_IN_MS, useNativeDriver: true }).start();

        if (controlsTimer.current) clearTimeout(controlsTimer.current);
        controlsTimer.current = setTimeout(() => {
            if (!showSettings && isPlaying && !isScrubbingRef.current) {
                Animated.timing(fadeAnim, { toValue: 0, duration: FADE_OUT_MS, useNativeDriver: true }).start(({ finished }) => {
                    if (!finished) return;
                    setControlsVisible(false);
                    if (onControlsToggle) onControlsToggle(false);
                });
            }
        }, 6000);
    };

    showControlsRef.current = showControlsTemporarily;

    toggleControlsRef.current = () => {
        if (controlsVisible) {
            Animated.timing(fadeAnim, { toValue: 0, duration: FADE_OUT_MS, useNativeDriver: true }).start(({ finished }) => {
                if (!finished) return;
                setControlsVisible(false);
                if (onControlsToggle) onControlsToggle(false);
            });
            if (controlsTimer.current) clearTimeout(controlsTimer.current);
        } else {
            showControlsTemporarily();
        }
    };

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
        extendControls: () => showControlsRef.current?.(),
        toggleControls: () => toggleControlsRef.current?.()
    }), [isCustom, youtubeId]);

    useEffect(() => {
        showControlsTemporarily();
        return () => clearTimeout(controlsTimer.current);
    }, [isPlaying, showSettings]);

    useEffect(() => {
        showControlsTemporarily();
    }, [ytId]);

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
                const currentWidth = widthRef.current;
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
                        brightnessRef.current = newVal;
                        setBrightness(newVal);
                        setSwipeIndicator({ visible: true, type: 'brightness', value: Math.round(newVal * 100) });
                    } else {
                        volumeRef.current = newVal;
                        setVolume(newVal);
                        try { VolumeManager.setVolume(newVal); } catch (e) { }
                        setSwipeIndicator({ visible: true, type: 'volume', value: Math.round(newVal * 100) });
                    }
                }
            },
            onPanResponderRelease: (evt, gestureState) => {
                if (swipeState.current.isSwiping) {
                    setSwipeIndicator({ visible: false, type: '', value: 0 });
                } else {
                    const now = Date.now();
                    const currentWidth = widthRef.current;
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
                            if (lastTap.current.time === now) toggleControlsRef.current();
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
                showControlsRef.current?.();

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
                showControlsRef.current?.();
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
        showControlsRef.current?.();
    };

    const handleSpeedChange = (speed) => {
        const player = nativePlayerRef.current;
        if (!player) return;
        try { player.playbackRate = speed; } catch (e) { }
        setShowSettings(false);
    };

    const displayTime = isScrubbing ? scrubTime : currentTime;
    const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;

    return {
        isCustom, customUrl, youtubeId, ytRef,
        controlsVisible, fadeAnim, showSettings, setShowSettings, brightness,
        swipeIndicator, isBuffering, isScrubbing, nativePlayer, mainPanResponder,
        progressPanResponder, togglePlayPause, handleSpeedChange, handleSkipRef,
        progressWidthRef, displayTime, progressPercent, duration
    };
};