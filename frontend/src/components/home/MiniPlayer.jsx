import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import ReAnimated, { FadeInUp, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { RepeatMode } from '@rntp/player';

export const MiniPlayer = ({
    currentTrack, isMusicPlaying, musicProgress, musicDuration,
    isShuffle, setIsShuffle, loopMode, setLoopMode,
    onTogglePlay, handleNextTrack, handlePrevTrack,
    onOpenModal, onDismiss, bottomOffset,
}) => {

    // Safe loop checks
    const isLoopActive = loopMode !== 0 && loopMode !== 'off' && !!loopMode;
    const isLoopOne = loopMode === 1 || loopMode === 'track' || loopMode === 'one' || loopMode === RepeatMode.Track;

    const panGesture = Gesture.Pan()
        .activeOffsetX([-10, 10])
        .activeOffsetY([-15, 15])
        .onEnd((e) => {
            const { translationX: dx, translationY: dy, velocityX: vx, velocityY: vy } = e;
            if (dx > 50 || vx > 800) runOnJS(handlePrevTrack)();
            else if (dx < -50 || vx < -800) runOnJS(handleNextTrack)();
            else if (dy < -40 || vy < -800) runOnJS(onOpenModal)();
            else if (dy > 40 || vy > 800) runOnJS(onDismiss)();
        });

    const doubleTap = Gesture.Tap().numberOfTaps(2).maxDuration(250);
    const singleTap = Gesture.Tap().numberOfTaps(1).maxDuration(250);

    const doubleTapAction = doubleTap.onEnd((_, success) => {
        if (success) runOnJS(onTogglePlay)();
    });
    const singleTapAction = singleTap.onEnd((_, success) => {
        if (success) runOnJS(onOpenModal)();
    });

    const tapGesture = Gesture.Exclusive(doubleTapAction, singleTapAction);

    if (!currentTrack) return null;

    return (
        <GestureDetector gesture={panGesture}>
            <ReAnimated.View entering={FadeInUp} style={[styles.miniPlayerContainer, { bottom: bottomOffset }]}>
                <View style={styles.miniPlayerContent}>
                    <GestureDetector gesture={tapGesture}>
                        <ReAnimated.View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Image source={{ uri: currentTrack?.artwork || currentTrack?.artworkUrl || currentTrack?.image }} style={styles.miniPlayerArt} />
                            <View style={styles.miniPlayerTextWrap}>
                                <Text style={styles.miniPlayerTitle} numberOfLines={1}>{currentTrack.title}</Text>
                                <Text style={styles.miniPlayerArtist} numberOfLines={1}>{currentTrack.artist}</Text>
                            </View>
                        </ReAnimated.View>
                    </GestureDetector>

                    <View style={styles.miniPlayerControls}>
                        <TouchableOpacity onPress={() => setIsShuffle(!isShuffle)} style={styles.miniPlayerBtn} hitSlop={8}>
                            <Ionicons name="shuffle" size={20} color={isShuffle ? "#00E5FF" : "#8F98A0"} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={onTogglePlay} style={styles.miniPlayerBtn} hitSlop={8}>
                            <Ionicons name={isMusicPlaying ? "pause" : "play"} size={26} color="#FFF" />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleNextTrack} style={styles.miniPlayerBtn} hitSlop={8}>
                            <Ionicons name="play-skip-forward" size={24} color="#FFF" />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={setLoopMode} style={[styles.miniPlayerBtn, { position: 'relative' }]} hitSlop={8}>
                            <Ionicons name="repeat" size={20} color={isLoopActive ? "#00E5FF" : "#8F98A0"} />
                            {isLoopOne && <Text style={{ position: 'absolute', fontSize: 8, color: '#00E5FF', top: 4, right: 2, fontWeight: 'bold' }}>1</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={styles.miniProgressBarBg}>
                    <View style={[styles.miniProgressBarFill, { width: `${(musicProgress / (musicDuration || 1)) * 100}%` }]} />
                </View>
            </ReAnimated.View>
        </GestureDetector>
    );
};

const styles = StyleSheet.create({
    miniPlayerContainer: { position: 'absolute', left: 10, right: 10, backgroundColor: '#1E1E24', borderRadius: 12, elevation: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    miniPlayerContent: { flexDirection: 'row', alignItems: 'center', padding: 10 },
    miniPlayerArt: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#2A2A30' },
    miniPlayerTextWrap: { flex: 1, marginLeft: 12, marginRight: 8 },
    miniPlayerTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
    miniPlayerArtist: { color: '#8F98A0', fontSize: 11 },
    miniPlayerControls: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 4 },
    miniPlayerBtn: { padding: 4 },
    miniProgressBarBg: { height: 3, backgroundColor: 'rgba(255,255,255,0.1)', width: '100%' },
    miniProgressBarFill: { height: '100%', backgroundColor: '#00E5FF' },
});