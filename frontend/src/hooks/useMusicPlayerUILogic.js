import { useState, useRef, useEffect, useMemo } from 'react';
import { Animated, PanResponder, Alert, useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RepeatMode } from '@rntp/player';

export const useMusicPlayerUILogic = (props) => {
    // 🚨 FIX: Fallback to useWindowDimensions if the parent doesn't provide width/height
    const { width: winWidth, height: winHeight } = useWindowDimensions();

    const {
        currentTrack, musicQueue, currentMusicIndex, setCurrentMusicIndex,
        musicProgress, musicDuration, isPlaying, setIsPlaying,
        isShuffle, setIsShuffle, loopMode, setLoopMode,
        handleNextTrack, handlePrevTrack, handleSeekTo, handleMusicAction, musicPrefs,
        router, startSleepTimer, sleepTimerRemaining,
        width = winWidth, height = winHeight, isDesktop
    } = props;

    const insets = useSafeAreaInsets();
    const TAB_BAR_HEIGHT = 88 + insets.bottom;

    const scrollY = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;

    const [barWidth, setBarWidth] = useState(0);
    const [miniBarInteractive, setMiniBarInteractive] = useState(false);
    const [lastTap, setLastTap] = useState(0);

    const [isSleepTimerModalOpen, setIsSleepTimerModalOpen] = useState(false);
    const [showCustomTimerInput, setShowCustomTimerInput] = useState(false);
    const [customTimerValue, setCustomTimerValue] = useState('');

    const isLoopActive = loopMode !== 0 && loopMode !== 'off' && !!loopMode;
    const isLoopOne = loopMode === 1 || loopMode === 'track' || loopMode === 'one' || loopMode === RepeatMode.Track;

    const SCROLL_RANGE = 260;
    const ART_ORIG_SIZE = isDesktop ? 400 : width * 0.75;
    const ART_TARGET_SIZE = 48;
    const ART_SCALE = ART_TARGET_SIZE / ART_ORIG_SIZE;

    const pinnedTranslateY = scrollY;
    const artScale = scrollY.interpolate({ inputRange: [0, SCROLL_RANGE], outputRange: [1, ART_SCALE], extrapolate: 'clamp' });
    const artTranslateX = scrollY.interpolate({ inputRange: [0, SCROLL_RANGE], outputRange: [0, -(width / 2) + (ART_TARGET_SIZE / 2) + 20], extrapolate: 'clamp' });
    const artTranslateY = scrollY.interpolate({ inputRange: [0, SCROLL_RANGE], outputRange: [0, -(ART_ORIG_SIZE / 2) + 24], extrapolate: 'clamp' });
    const heroOpacity = scrollY.interpolate({ inputRange: [0, SCROLL_RANGE * 0.5], outputRange: [1, 0], extrapolate: 'clamp' });
    const miniOpacity = scrollY.interpolate({ inputRange: [SCROLL_RANGE * 0.7, SCROLL_RANGE], outputRange: [0, 1], extrapolate: 'clamp' });
    const headerBgOpacity = scrollY.interpolate({ inputRange: [SCROLL_RANGE * 0.5, SCROLL_RANGE], outputRange: [0, 0.95], extrapolate: 'clamp' });

    useEffect(() => {
        const id = scrollY.addListener(({ value }) => {
            const shouldBeInteractive = value > SCROLL_RANGE * 0.85;
            setMiniBarInteractive(prev => (prev !== shouldBeInteractive ? shouldBeInteractive : prev));
        });
        return () => scrollY.removeListener(id);
    }, [scrollY]);

    // 🚨 FIX: Handle both Web (offsetX) and Native (locationX) click coordinates
    const handleSeek = (event) => {
        if (barWidth > 0 && musicDuration > 0) {
            const nativeEvent = event.nativeEvent || {};
            const tapX = nativeEvent.offsetX !== undefined ? nativeEvent.offsetX : (nativeEvent.locationX || 0);

            const percentage = Math.max(0, Math.min(1, tapX / barWidth));
            const newTime = percentage * musicDuration;
            handleSeekTo(newTime);
        }
    };

    const handleTimerPress = () => {
        setShowCustomTimerInput(false);
        setCustomTimerValue('');
        if (sleepTimerRemaining > 0) {
            Alert.alert(
                "Sleep Timer Active",
                `Audio will stop in ${Math.floor(sleepTimerRemaining / 60)}m ${(sleepTimerRemaining % 60).toString().padStart(2, '0')}s.\n\nDo you want to cancel or change it?`,
                [
                    { text: "Turn Off Timer", onPress: () => startSleepTimer(0), style: 'destructive' },
                    { text: "Change Time", onPress: () => setIsSleepTimerModalOpen(true) },
                    { text: "Keep Timer", style: 'cancel' }
                ]
            );
        } else {
            setIsSleepTimerModalOpen(true);
        }
    };

    const handleStartCustomTimer = () => {
        const mins = parseInt(customTimerValue, 10);
        if (isNaN(mins) || mins <= 0 || mins > 180) {
            Alert.alert("Invalid Time", "Please enter a valid time between 1 and 180 minutes.");
            return;
        }
        startSleepTimer(mins);
        closeTimerModal();
    };

    const closeTimerModal = () => {
        setIsSleepTimerModalOpen(false);
        setShowCustomTimerInput(false);
        setCustomTimerValue('');
    };

    const panResponderMusic = useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponder: (evt, gestureState) => {
            if (isDesktop) return false;
            return Math.abs(gestureState.dx) > 15 || Math.abs(gestureState.dy) > 15;
        },
        onPanResponderMove: (evt, gestureState) => {
            if (gestureState.dy > 0 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)) {
                slideAnim.setValue(gestureState.dy);
            }
        },
        onPanResponderRelease: (evt, gestureState) => {
            const { dx, dy, vy } = gestureState;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0) handlePrevTrack();
                else handleNextTrack();
                Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
            } else if (dy > 120 || vy > 1.5) {
                router.back();
            } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
                const now = Date.now();
                if (now - lastTap < 300 && currentTrack) handleMusicAction(currentTrack.mediaId, 'toggleLike');
                setLastTap(now);
                Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
            } else {
                Animated.spring(slideAnim, { toValue: 0, bounciness: 8, useNativeDriver: true }).start();
            }
        }
    }), [currentTrack, lastTap, handleNextTrack, handlePrevTrack, height, slideAnim, router, isDesktop, handleMusicAction]);

    const handleBackBtn = () => {
        router.back();
    };

    return {
        insets, TAB_BAR_HEIGHT, ART_ORIG_SIZE,
        scrollY, slideAnim, barWidth, setBarWidth, miniBarInteractive,
        isSleepTimerModalOpen, setIsSleepTimerModalOpen,
        showCustomTimerInput, setShowCustomTimerInput, customTimerValue, setCustomTimerValue,
        isLoopActive, isLoopOne, width, height, // Exporting dimension constants
        pinnedTranslateY, artScale, artTranslateX, artTranslateY, heroOpacity, miniOpacity, headerBgOpacity,
        handleSeek, handleTimerPress, handleStartCustomTimer, closeTimerModal, panResponderMusic, handleBackBtn
    };
};