import React, { forwardRef, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import YoutubePlayer from 'react-native-youtube-iframe';
import { VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useTheatrePlayerLogic, formatTime } from '../hooks/useTheatrePlayerLogic';

// Reusable Loading Animation
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

const TheatrePlayer = forwardRef((props, ref) => {
    const { width, height, isPlaying, isMuted, isHostBool, onPlayerStateChange } = props;
    const { width: windowWidth } = useWindowDimensions();
    const isDesktop = windowWidth >= 1024;

    const {
        isCustom, customUrl, youtubeId, ytRef,
        controlsVisible, fadeAnim, showSettings, setShowSettings, brightness,
        swipeIndicator, isBuffering, isScrubbing, nativePlayer, mainPanResponder,
        progressPanResponder, togglePlayPause, handleSpeedChange, handleSkipRef,
        progressWidthRef, displayTime, progressPercent, duration
    } = useTheatrePlayerLogic(props, ref);

    return (
        <View style={{ width: width, height: height, backgroundColor: '#000', position: 'relative' }}>
            {youtubeId ? (
                <View pointerEvents={isHostBool ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
                    <YoutubePlayer
                        ref={ytRef} height={height} width={width}
                        play={isPlaying} mute={isMuted} volume={isMuted ? 0 : 100}
                        videoId={youtubeId} onChangeState={onPlayerStateChange}
                        webViewProps={{ allowsFullscreenVideo: false }}
                        initialPlayerParams={{ controls: isHostBool ? 1 : 0, modestbranding: 1, rel: 0, autoplay: 1 }}
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

                    {/* Gesture layer for brightness/volume/tap-to-toggle */}
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
                                    <TouchableOpacity
                                        style={[styles.topBtn, isDesktop && { cursor: 'pointer' }]}
                                        onPress={() => setShowSettings(!showSettings)}
                                    >
                                        <Ionicons name="settings-outline" size={isDesktop ? 28 : 24} color="#FFF" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {showSettings && isHostBool && (
                                <View style={isDesktop ? styles.settingsMenuDesktop : styles.settingsMenu}>
                                    <Text style={styles.settingsHeader}>Playback Speed</Text>
                                    <View style={styles.speedRow}>
                                        {[0.5, 1, 1.5, 2].map(speed => (
                                            <TouchableOpacity key={speed} style={[styles.speedBtn, isDesktop && { cursor: 'pointer' }]} onPress={() => handleSpeedChange(speed)}>
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
                                        <TouchableOpacity
                                            style={[styles.middleBtn, !isHostBool && { opacity: 0 }, isDesktop && { cursor: 'pointer' }]}
                                            onPress={() => handleSkipRef.current(-10)} disabled={!isHostBool}
                                        >
                                            <Ionicons name="play-back" size={isDesktop ? 52 : 42} color="#FFF" />
                                            <Text style={isDesktop ? styles.skipTextDesktop : styles.skipText}>10s</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.playPauseBtn, !isHostBool && { opacity: 0 }, isDesktop && { cursor: 'pointer' }]}
                                            onPress={togglePlayPause} disabled={!isHostBool}
                                        >
                                            <Ionicons name={isPlaying ? "pause" : "play"} size={isDesktop ? 84 : 64} color="#FFF" style={{ marginLeft: isPlaying ? 0 : 4 }} />
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.middleBtn, !isHostBool && { opacity: 0 }, isDesktop && { cursor: 'pointer' }]}
                                            onPress={() => handleSkipRef.current(10)} disabled={!isHostBool}
                                        >
                                            <Ionicons name="play-forward" size={isDesktop ? 52 : 42} color="#FFF" />
                                            <Text style={isDesktop ? styles.skipTextDesktop : styles.skipText}>10s</Text>
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
                                    <View style={[styles.progressBarTrack, isDesktop && { height: 6 }]} pointerEvents="none">
                                        <LinearGradient
                                            colors={['#00E5FF', '#9B51E0', '#FF007A']}
                                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                            style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
                                        />
                                    </View>
                                    <View style={[styles.progressKnob, isDesktop && { width: 16, height: 16, marginTop: -8, marginLeft: -8 }, { left: `${progressPercent}%` }]} pointerEvents="none" />
                                </View>
                            </LinearGradient>
                        </Animated.View>
                    )}
                </View>
            ) : (
                <View style={styles.emptyPlayer}>
                    <Ionicons name="tv-outline" size={isDesktop ? 64 : 48} color="#8F98A0" />
                    <Text style={[styles.emptyText, isDesktop && { fontSize: 16 }]}>
                        {isHostBool ? "Search and select a video to start" : "Waiting for the Host..."}
                    </Text>
                </View>
            )}
        </View>
    );
});

export default TheatrePlayer;

const styles = StyleSheet.create({
    emptyPlayer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
    emptyText: { color: '#8F98A0', marginTop: 12, fontSize: 14 },
    loaderContainer: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

    overlayWrapper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', zIndex: 9999, elevation: 100 },
    topShadow: { position: 'absolute', top: 0, left: 0, right: 0, height: 80 },
    bottomShadow: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 90, justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 12 },

    middleControls: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 40, zIndex: 100, elevation: 100 },
    topBar: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, zIndex: 100, elevation: 100 },
    topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', elevation: 10 },

    middleBtn: { alignItems: 'center', justifyContent: 'center', width: 60, height: 60 },
    skipText: { color: '#FFF', fontSize: 13, fontWeight: 'bold', marginTop: -4 },
    skipTextDesktop: { color: '#FFF', fontSize: 15, fontWeight: 'bold', marginTop: -4 },
    playPauseBtn: { width: 76, height: 76, justifyContent: 'center', alignItems: 'center' },

    timeRow: { width: '100%', alignItems: 'flex-end', marginBottom: 8, paddingRight: 4, zIndex: 100, elevation: 100 },
    durationText: { color: '#FFF', fontSize: 13, fontWeight: 'bold', letterSpacing: 0.5 },

    progressBarContainer: { width: '100%', height: 30, justifyContent: 'center', zIndex: 100, elevation: 100 },
    progressBarTrack: { width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 2 },

    progressKnob: {
        position: 'absolute', top: '50%', marginTop: -7, width: 14, height: 14,
        borderRadius: 7, backgroundColor: '#FFFFFF', marginLeft: -7,
        elevation: 10, shadowColor: '#00E5FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4
    },

    settingsMenu: { position: 'absolute', top: 60, right: 16, width: 220, backgroundColor: 'rgba(20,20,25,0.95)', borderRadius: 12, padding: 16, zIndex: 1000, elevation: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    settingsMenuDesktop: { position: 'absolute', top: 60, right: 16, width: 260, backgroundColor: 'rgba(20,20,25,0.95)', borderRadius: 12, padding: 20, zIndex: 1000, elevation: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    settingsHeader: { color: '#8F98A0', fontSize: 11, textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 12, letterSpacing: 1 },
    speedRow: { flexDirection: 'row', justifyContent: 'space-between' },
    speedBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 },
    speedText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },

    swipeIndicatorContainer: { position: 'absolute', top: '30%', alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 16, alignItems: 'center', zIndex: 50 },
    swipeIndicatorText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginTop: 8 }
});