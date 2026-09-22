import { Ionicons } from '@expo/vector-icons';
import { RepeatMode } from '@rntp/player';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Image,
    Modal,
    PanResponder,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatTime } from '../../utils/homehelpers';

export const MusicPlayerUI = ({
    currentTrack, musicQueue, currentMusicIndex, setCurrentMusicIndex,
    musicProgress, musicDuration, isPlaying, setIsPlaying,
    isShuffle, setIsShuffle, loopMode, setLoopMode,
    handleNextTrack, handlePrevTrack, handleSeekTo, handleMusicAction, musicPrefs,
    router, startSleepTimer, sleepTimerRemaining // <-- Added sleep timer props
}) => {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const TAB_BAR_HEIGHT = 88 + insets.bottom;

    const scrollY = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;

    const [barWidth, setBarWidth] = useState(0);
    const [miniBarInteractive, setMiniBarInteractive] = useState(false);
    const [lastTap, setLastTap] = useState(0);

    // --- SLEEP TIMER STATE ---
    const [isSleepTimerModalOpen, setIsSleepTimerModalOpen] = useState(false);
    const [showCustomTimerInput, setShowCustomTimerInput] = useState(false);
    const [customTimerValue, setCustomTimerValue] = useState('');

    const isLoopActive = loopMode !== 0 && loopMode !== 'off' && !!loopMode;
    const isLoopOne = loopMode === 1 || loopMode === 'track' || loopMode === 'one' || loopMode === RepeatMode.Track;

    const SCROLL_RANGE = 260;
    const ART_ORIG_SIZE = width * 0.75;
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
            const shouldBeInteractive = value > 110 + (190 - 110) * 0.5;
            setMiniBarInteractive(prev => (prev !== shouldBeInteractive ? shouldBeInteractive : prev));
        });
        return () => scrollY.removeListener(id);
    }, [scrollY]);

    const handleSeek = (event) => {
        if (barWidth > 0 && musicDuration > 0) {
            const percentage = Math.max(0, Math.min(1, event.nativeEvent.locationX / barWidth));
            const newTime = percentage * musicDuration;
            handleSeekTo(newTime);
        }
    };

    // --- SLEEP TIMER HANDLERS ---
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
        onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dx) > 15 || Math.abs(gestureState.dy) > 15,
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
                Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true }).start(() => router.back());
            } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
                const now = Date.now();
                if (now - lastTap < 300 && currentTrack) handleMusicAction(currentTrack.mediaId, 'toggleLike');
                setLastTap(now);
                Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
            } else {
                Animated.spring(slideAnim, { toValue: 0, bounciness: 8, useNativeDriver: true }).start();
            }
        }
    }), [currentTrack, lastTap, handleNextTrack, handlePrevTrack, height, slideAnim, router]);

    return (
        <Animated.View style={{ flex: 1, backgroundColor: 'transparent', transform: [{ translateY: slideAnim }] }}>
            <SafeAreaView style={styles.safeArea}>
                <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.container}>
                    <View style={styles.musicFixedHeader}>
                        <TouchableOpacity
                            onPress={() => Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true }).start(() => router.back())}
                            style={{ padding: 10, zIndex: 30 }}
                        >
                            <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Animated.View style={{ alignItems: 'center', opacity: heroOpacity }}>
                            <Text style={styles.musicHeaderSubtitle}>NOW PLAYING</Text>
                            <Text style={styles.musicHeaderTitle} numberOfLines={1}>{currentTrack?.title}</Text>
                        </Animated.View>

                        {/* TIMER ICON WITH LIVE COUNTDOWN IN HEADER */}
                        <TouchableOpacity onPress={handleTimerPress} style={{ padding: 10, alignItems: 'center', minWidth: 48, zIndex: 30 }}>
                            <Ionicons name="timer-outline" size={26} color={sleepTimerRemaining ? "#00E5FF" : "#FFFFFF"} />
                            {sleepTimerRemaining > 0 && (
                                <Text style={{ color: '#00E5FF', fontSize: 10, fontWeight: 'bold', marginTop: 2 }}>
                                    {Math.floor(sleepTimerRemaining / 60)}:{(sleepTimerRemaining % 60).toString().padStart(2, '0')}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <Animated.ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 40 }}
                        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
                        scrollEventThrottle={16}
                    >
                        <Animated.View style={{ zIndex: 10, transform: [{ translateY: pinnedTranslateY }] }} {...panResponderMusic.panHandlers}>
                            <Animated.View style={{ position: 'absolute', top: -100, left: 0, right: 0, height: 200, backgroundColor: '#170D22', opacity: headerBgOpacity, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }} />

                            <Animated.View style={[styles.albumArtContainer, { transform: [{ translateX: artTranslateX }, { translateY: artTranslateY }, { scale: artScale }] }]}>
                                <Image source={{ uri: currentTrack?.artwork || currentTrack?.artworkUrl || currentTrack?.image }} style={[styles.albumArt, { width: ART_ORIG_SIZE, height: ART_ORIG_SIZE }]} />
                            </Animated.View>

                            <Animated.View style={[styles.miniPlayerBar, { opacity: miniOpacity }]} pointerEvents={miniBarInteractive ? 'auto' : 'none'}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <Text style={styles.miniPlayerTitle} numberOfLines={1}>{currentTrack?.title}</Text>
                                    <Text style={styles.miniPlayerArtist} numberOfLines={1}>{currentTrack?.artist}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                                    <TouchableOpacity onPress={handlePrevTrack}><Ionicons name="play-skip-back" size={24} color="#FFFFFF" /></TouchableOpacity>
                                    <TouchableOpacity onPress={() => setIsPlaying(!isPlaying)}>
                                        <Ionicons name={isPlaying ? "pause" : "play"} size={28} color="#FFFFFF" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={handleNextTrack}><Ionicons name="play-skip-forward" size={24} color="#FFFFFF" /></TouchableOpacity>
                                </View>
                            </Animated.View>

                            <Animated.View style={{ opacity: heroOpacity }}>
                                {/* DISLIKE, TRACK INFO, AND LIKE BUTTONS */}
                                <View style={[styles.musicTrackInfo, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 }]}>
                                    <TouchableOpacity onPress={() => handleMusicAction(currentTrack?.mediaId, 'dislike')} style={{ padding: 10 }}>
                                        <Ionicons name={musicPrefs?.[currentTrack?.mediaId] === 'dislike' ? "thumbs-down" : "thumbs-down-outline"} size={28} color={musicPrefs?.[currentTrack?.mediaId] === 'dislike' ? "#FF007A" : "#8F98A0"} />
                                    </TouchableOpacity>

                                    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 10 }}>
                                        <Text style={styles.musicLargeTitle} numberOfLines={1}>{currentTrack?.title}</Text>
                                        <Text style={styles.musicLargeArtist} numberOfLines={1}>{currentTrack?.artist}</Text>
                                    </View>

                                    <TouchableOpacity onPress={() => handleMusicAction(currentTrack?.mediaId, 'toggleLike')} style={{ padding: 10 }}>
                                        <Ionicons name={musicPrefs?.[currentTrack?.mediaId] === 'like' ? "heart" : "heart-outline"} size={28} color={musicPrefs?.[currentTrack?.mediaId] === 'like' ? "#FF007A" : "#FFF"} />
                                    </TouchableOpacity>
                                </View>

                                {/* INTERACTIVE PROGRESS / SCRUBBER BAR */}
                                <View style={styles.seekContainer}>
                                    <TouchableOpacity activeOpacity={1} style={styles.progressBarTouchArea} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)} onPress={handleSeek}>
                                        <View style={styles.progressBarBg}>
                                            <LinearGradient colors={['#00E5FF', '#9B51E0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.progressBarFill, { width: `${(musicProgress / (musicDuration || 1)) * 100}%` }]} />
                                            <View style={[styles.progressKnob, { left: `${(musicProgress / (musicDuration || 1)) * 100}%` }]} />
                                        </View>
                                    </TouchableOpacity>
                                    <View style={styles.timeRow}>
                                        <Text style={styles.timeText}>{formatTime(musicProgress)}</Text>
                                        <Text style={styles.timeText}>{formatTime(musicDuration)}</Text>
                                    </View>
                                </View>

                                <View style={styles.musicControlsRow}>
                                    <TouchableOpacity onPress={() => setIsShuffle(!isShuffle)} style={{ padding: 10 }}>
                                        <Ionicons name="shuffle" size={24} color={isShuffle ? "#00E5FF" : "#8F98A0"} />
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={handlePrevTrack} style={styles.skipBtn}>
                                        <Ionicons name="play-skip-back" size={32} color={currentMusicIndex > 0 || isShuffle || isLoopActive ? "#FFFFFF" : "#555"} />
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.neonPlayWrapper} activeOpacity={0.8} onPress={() => setIsPlaying(!isPlaying)}>
                                        <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.neonPlayInner}>
                                            <Ionicons name={isPlaying ? "pause" : "play"} size={36} color="#FFFFFF" style={!isPlaying ? { marginLeft: 6 } : {}} />
                                        </LinearGradient>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={handleNextTrack} style={styles.skipBtn}>
                                        <Ionicons name="play-skip-forward" size={32} color={currentMusicIndex < musicQueue?.length - 1 || isShuffle || isLoopActive ? "#FFFFFF" : "#555"} />
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={setLoopMode} style={{ padding: 10, position: 'relative' }}>
                                        <Ionicons name="repeat" size={24} color={isLoopActive ? "#00E5FF" : "#8F98A0"} />
                                        {isLoopOne && <Text style={{ position: 'absolute', fontSize: 10, color: '#00E5FF', top: 10, right: 6, fontWeight: 'bold' }}>1</Text>}
                                    </TouchableOpacity>
                                </View>
                            </Animated.View>
                        </Animated.View>

                        <View style={styles.queueContainer}>
                            <Text style={styles.queueTitle}>Playlist</Text>
                            {musicQueue?.map((track, index) => {
                                const isActive = index === currentMusicIndex;
                                return (
                                    <TouchableOpacity key={track.mediaId + index} style={[styles.queueItem, isActive && { borderColor: '#00E5FF', backgroundColor: 'rgba(0, 229, 255, 0.1)' }]} onPress={() => setCurrentMusicIndex(index)}>
                                        <Image source={{ uri: track?.artwork || track?.artworkUrl || track?.image }} style={styles.queueImage} />
                                        <View style={styles.queueInfo}>
                                            <Text style={[styles.queueTrackTitle, isActive && { color: '#00E5FF' }]} numberOfLines={1}>{track.title}</Text>
                                            <Text style={styles.queueTrackArtist} numberOfLines={1}>{track.artist}</Text>
                                        </View>
                                        {isActive ? <Ionicons name="stats-chart" size={20} color="#00E5FF" /> : <Ionicons name="play-circle-outline" size={24} color="#8F98A0" />}
                                    </TouchableOpacity>
                                )
                            })}
                        </View>
                    </Animated.ScrollView>
                </LinearGradient>

                {/* DIGITAL SLEEP TIMER MODAL (WITH CUSTOM OPTION) */}
                <Modal visible={isSleepTimerModalOpen} animationType="fade" transparent={true} onRequestClose={closeTimerModal}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}>
                        <View style={{ backgroundColor: '#170D22', padding: 24, borderRadius: 20, width: '85%', borderWidth: 1, borderColor: 'rgba(0,229,255,0.3)', shadowColor: '#00E5FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                                <Ionicons name="timer" size={24} color="#00E5FF" style={{ marginRight: 8 }} />
                                <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold', letterSpacing: 1 }}>SLEEP TIMER</Text>
                            </View>

                            {showCustomTimerInput ? (
                                <View style={{ width: '100%', alignItems: 'center' }}>
                                    <Text style={{ color: '#8F98A0', marginBottom: 12, fontSize: 14 }}>Enter minutes (1 - 180)</Text>
                                    <TextInput
                                        style={styles.customTimerInput}
                                        keyboardType="numeric"
                                        maxLength={3}
                                        value={customTimerValue}
                                        onChangeText={setCustomTimerValue}
                                        placeholder="0"
                                        placeholderTextColor="#555"
                                        autoFocus={true}
                                    />
                                    <TouchableOpacity style={styles.startCustomBtn} onPress={handleStartCustomTimer}>
                                        <Text style={styles.startCustomBtnText}>START TIMER</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={{ marginTop: 24 }} onPress={() => setShowCustomTimerInput(false)}>
                                        <Text style={{ color: '#8F98A0', fontWeight: 'bold', letterSpacing: 1, fontSize: 12 }}>BACK TO PRESETS</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
                                        {[15, 30, 45, 60].map(mins => (
                                            <TouchableOpacity
                                                key={mins}
                                                style={{ width: '47%', backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 20, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                                                onPress={() => { startSleepTimer(mins); closeTimerModal(); }}
                                            >
                                                <Text style={{ color: '#00E5FF', fontSize: 28, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>{mins}</Text>
                                                <Text style={{ color: '#8F98A0', fontSize: 12, marginTop: 4, fontWeight: 'bold', letterSpacing: 1 }}>MINUTES</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    {/* CUSTOM TIMER TOGGLE BUTTON */}
                                    <TouchableOpacity
                                        style={styles.customTimerBtn}
                                        onPress={() => setShowCustomTimerInput(true)}
                                    >
                                        <Ionicons name="create-outline" size={20} color="#00E5FF" style={{ marginRight: 8 }} />
                                        <Text style={{ color: '#00E5FF', fontWeight: 'bold', letterSpacing: 1 }}>CUSTOM TIMER</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <TouchableOpacity
                                style={{ marginTop: 24, paddingVertical: 14, backgroundColor: 'rgba(255, 0, 122, 0.15)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 0, 122, 0.3)' }}
                                onPress={() => { startSleepTimer(0); closeTimerModal(); }}
                            >
                                <Text style={{ color: '#FF007A', fontSize: 14, textAlign: 'center', fontWeight: 'bold', letterSpacing: 1 }}>TURN OFF TIMER</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{ marginTop: 12, paddingVertical: 14 }}
                                onPress={closeTimerModal}
                            >
                                <Text style={{ color: '#8F98A0', fontSize: 14, textAlign: 'center', fontWeight: 'bold' }}>CANCEL</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

            </SafeAreaView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#000' },
    container: { flex: 1, backgroundColor: '#0A0A0C' },
    musicFixedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, zIndex: 10 },
    musicHeaderSubtitle: { color: '#8F98A0', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 4 },
    musicHeaderTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', maxWidth: 250, textAlign: 'center' },
    miniPlayerBar: { position: 'absolute', top: 24, left: 80, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    miniPlayerTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
    miniPlayerArtist: { color: '#8F98A0', fontSize: 12, marginTop: 2 },
    albumArtContainer: { alignItems: 'center', marginTop: 20, marginBottom: 40, shadowColor: '#00E5FF', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 15 },
    albumArt: { borderRadius: 20, backgroundColor: '#1E1428' },
    musicTrackInfo: { marginBottom: 30 },
    musicLargeTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    musicLargeArtist: { color: '#00E5FF', fontSize: 16, fontWeight: '600', textAlign: 'center' },
    musicControlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 40 },
    skipBtn: { padding: 10 },
    neonPlayWrapper: { width: 76, height: 76, borderRadius: 38, elevation: 10, shadowColor: '#FF007A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.6, shadowRadius: 12 },
    neonPlayInner: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 38 },
    queueContainer: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    queueTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    queueItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16161A', padding: 10, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    queueImage: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#2A2A30' },
    queueInfo: { flex: 1, marginLeft: 12, marginRight: 10 },
    queueTrackTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
    queueTrackArtist: { color: '#8F98A0', fontSize: 12 },
    seekContainer: { paddingHorizontal: 30, marginBottom: 20 },
    progressBarTouchArea: { height: 30, justifyContent: 'center' },
    progressBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, position: 'relative' },
    progressBarFill: { height: '100%', borderRadius: 3 },
    progressKnob: { position: 'absolute', top: -5, width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF', elevation: 4, transform: [{ translateX: -8 }] },
    timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    timeText: { color: '#8F98A0', fontSize: 12, fontWeight: '600' },

    // --- CUSTOM TIMER STYLES ---
    customTimerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,229,255,0.1)', paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,229,255,0.3)', marginTop: 12 },
    customTimerInput: { fontSize: 48, fontWeight: '900', color: '#00E5FF', textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#00E5FF', width: 120, marginBottom: 20, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', paddingBottom: 5 },
    startCustomBtn: { backgroundColor: '#00E5FF', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, elevation: 5, shadowColor: '#00E5FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
    startCustomBtnText: { color: '#0A0A0C', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },
});