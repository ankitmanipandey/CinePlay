import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import ReAnimated, { FadeInUp, SlideOutDown, FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useMiniPlayerLogic } from '../../hooks/useMiniPlayerLogic';

export const MiniPlayer = ({
    currentTrack, isMusicPlaying, musicProgress, musicDuration,
    isShuffle, setIsShuffle, loopMode, setLoopMode,
    onTogglePlay, handleNextTrack, handlePrevTrack,
    onOpenModal, onDismiss, bottomOffset, isDesktop,
}) => {
    const { isLoopActive, isLoopOne, panGesture, tapGesture } = useMiniPlayerLogic({
        loopMode, handlePrevTrack, handleNextTrack, onOpenModal, onDismiss, onTogglePlay
    });

    if (!currentTrack) return null;

    // --------------------------------------------------------
    // DESKTOP LAYOUT (Premium Glassmorphic Floating Player)
    // --------------------------------------------------------
    if (isDesktop) {
        return (
            <ReAnimated.View
                entering={FadeIn}
                exiting={FadeOut}
                style={styles.desktopContainer}
            >
                {/* Subtle Close Button Top Right */}
                <TouchableOpacity onPress={onDismiss} style={styles.desktopCloseBtn} hitSlop={8}>
                    <Ionicons name="close" size={16} color="#8F98A0" />
                </TouchableOpacity>

                <View style={styles.desktopContent}>
                    {/* Clickable Artwork to Open Full Player */}
                    <TouchableOpacity activeOpacity={0.8} onPress={onOpenModal} style={styles.desktopArtWrapper}>
                        <Image source={{ uri: currentTrack?.artwork || currentTrack?.artworkUrl || currentTrack?.image }} style={styles.desktopArt} />
                    </TouchableOpacity>

                    {/* Track Info */}
                    <View style={styles.desktopTextWrap}>
                        <Text style={styles.desktopTitle} numberOfLines={1}>{currentTrack.title}</Text>
                        <Text style={styles.desktopArtist} numberOfLines={1}>{currentTrack.artist}</Text>
                    </View>

                    {/* Precision Mouse Controls */}
                    <View style={styles.desktopControls}>
                        <TouchableOpacity onPress={() => setIsShuffle(!isShuffle)} style={styles.desktopBtn} hitSlop={4}>
                            <Ionicons name="shuffle" size={16} color={isShuffle ? "#00E5FF" : "#8F98A0"} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handlePrevTrack} style={styles.desktopBtn} hitSlop={4}>
                            <Ionicons name="play-skip-back" size={18} color="#FFF" />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={onTogglePlay} style={styles.desktopPlayBtn} hitSlop={4}>
                            <Ionicons name={isMusicPlaying ? "pause" : "play"} size={18} color="#000" style={!isMusicPlaying ? { marginLeft: 2 } : {}} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleNextTrack} style={styles.desktopBtn} hitSlop={4}>
                            <Ionicons name="play-skip-forward" size={18} color="#FFF" />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={setLoopMode} style={[styles.desktopBtn, { position: 'relative' }]} hitSlop={4}>
                            <Ionicons name="repeat" size={16} color={isLoopActive ? "#00E5FF" : "#8F98A0"} />
                            {isLoopOne && <Text style={styles.desktopRepeatOneBadge}>1</Text>}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Premium Gradient Progress Bar */}
                <View style={styles.desktopProgressBarBg}>
                    <LinearGradient
                        colors={['#00E5FF', '#9B51E0', '#FF007A']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={[styles.desktopProgressBarFill, { width: `${(musicProgress / Math.max(musicDuration || 1, 1)) * 100}%` }]}
                    />
                </View>
            </ReAnimated.View>
        );
    }

    // --------------------------------------------------------
    // MOBILE & TABLET LAYOUT (Exact Native Clone)
    // --------------------------------------------------------
    return (
        <GestureDetector gesture={panGesture}>
            <ReAnimated.View
                entering={FadeInUp}
                exiting={SlideOutDown.duration(280)}
                style={[styles.miniPlayerContainer, { bottom: bottomOffset }]}
            >
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
    // --- DESKTOP STYLES ---
    desktopContainer: {
        width: '100%',
        backgroundColor: 'rgba(18, 18, 22, 0.92)',
        ...Platform.select({ web: { backdropFilter: 'blur(16px)' } })
    },
    desktopContent: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingTop: 16, paddingBottom: 16 },
    desktopArtWrapper: { cursor: 'pointer' },
    desktopArt: { width: 52, height: 52, borderRadius: 8, backgroundColor: '#2A2A30' },
    desktopTextWrap: { flex: 1, marginLeft: 14, marginRight: 10, justifyContent: 'center' },
    desktopTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', marginBottom: 4, letterSpacing: 0.3 },
    desktopArtist: { color: '#A0A0A5', fontSize: 12, fontWeight: '500' },
    desktopControls: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 4 },
    desktopBtn: { padding: 4, cursor: 'pointer' },
    desktopPlayBtn: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: '#FFF',
        justifyContent: 'center', alignItems: 'center',
        cursor: 'pointer'
    },
    desktopRepeatOneBadge: { position: 'absolute', fontSize: 7, color: '#00E5FF', top: 4, right: 1, fontWeight: 'bold' },
    desktopCloseBtn: { position: 'absolute', top: 6, right: 8, padding: 4, zIndex: 10, cursor: 'pointer' },
    desktopProgressBarBg: { height: 3, backgroundColor: 'rgba(255,255,255,0.05)', width: '100%' },
    desktopProgressBarFill: { height: '100%', borderRadius: 2 },

    // --- MOBILE STYLES (Untouched) ---
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