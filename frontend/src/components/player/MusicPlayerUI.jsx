import React from 'react';
import { Animated, Image, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatTime } from '../../utils/homehelpers';

import { useMusicPlayerUILogic } from '../../hooks/useMusicPlayerUILogic';

// Helper to clean up HTML entities from JioSaavn API responses
const decodeText = (text) => {
    if (!text) return '';
    return text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
};

export const MusicPlayerUI = (props) => {
    const {
        currentTrack, musicQueue, currentMusicIndex, setCurrentMusicIndex,
        musicProgress, musicDuration, isPlaying, setIsPlaying,
        isShuffle, setIsShuffle, loopMode, setLoopMode,
        handleNextTrack, handlePrevTrack, handleMusicAction, musicPrefs,
        sleepTimerRemaining, isDesktop
    } = props;

    const {
        insets, TAB_BAR_HEIGHT, ART_ORIG_SIZE,
        scrollY, slideAnim, setBarWidth, miniBarInteractive,
        isSleepTimerModalOpen, showCustomTimerInput, setShowCustomTimerInput,
        customTimerValue, setCustomTimerValue,
        isLoopActive, isLoopOne,
        artScale, artTranslateX, artTranslateY, heroOpacity, miniOpacity,
        handleSeek, handleTimerPress, handleStartCustomTimer, closeTimerModal, panResponderMusic, handleBackBtn
    } = useMusicPlayerUILogic(props);

    const decodedTitle = decodeText(currentTrack?.title);
    const decodedArtist = decodeText(currentTrack?.artist);

    const renderTimerModal = () => (
        <Modal visible={isSleepTimerModalOpen} animationType="fade" transparent={true} onRequestClose={closeTimerModal}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}>
                <View style={{ backgroundColor: '#170D22', padding: 24, borderRadius: 20, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: 'rgba(0,229,255,0.3)', shadowColor: '#00E5FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                        <Ionicons name="timer" size={24} color="#00E5FF" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold', letterSpacing: 1 }}>SLEEP TIMER</Text>
                    </View>

                    {showCustomTimerInput ? (
                        <View style={{ width: '100%', alignItems: 'center' }}>
                            <Text style={{ color: '#8F98A0', marginBottom: 12, fontSize: 14 }}>Enter minutes (1 - 180)</Text>
                            <TextInput
                                style={styles.customTimerInput} keyboardType="numeric" maxLength={3}
                                value={customTimerValue} onChangeText={setCustomTimerValue}
                                placeholder="0" placeholderTextColor="#555" autoFocus={true} outlineStyle="none"
                            />
                            <TouchableOpacity style={[styles.startCustomBtn, isDesktop && { cursor: 'pointer' }]} onPress={handleStartCustomTimer}>
                                <Text style={styles.startCustomBtnText}>START TIMER</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[{ marginTop: 24 }, isDesktop && { cursor: 'pointer' }]} onPress={() => setShowCustomTimerInput(false)}>
                                <Text style={{ color: '#8F98A0', fontWeight: 'bold', letterSpacing: 1, fontSize: 12 }}>BACK TO PRESETS</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
                                {[15, 30, 45, 60].map(mins => (
                                    <TouchableOpacity
                                        key={mins}
                                        style={[styles.timerPresetBtn, isDesktop && { cursor: 'pointer' }]}
                                        onPress={() => { props.startSleepTimer(mins); closeTimerModal(); }}
                                    >
                                        <Text style={styles.timerPresetNumber}>{mins}</Text>
                                        <Text style={styles.timerPresetLabel}>MINUTES</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity style={[styles.customTimerBtn, isDesktop && { cursor: 'pointer' }]} onPress={() => setShowCustomTimerInput(true)}>
                                <Ionicons name="create-outline" size={20} color="#00E5FF" style={{ marginRight: 8 }} />
                                <Text style={{ color: '#00E5FF', fontWeight: 'bold', letterSpacing: 1 }}>CUSTOM TIMER</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <TouchableOpacity style={[{ marginTop: 20, paddingVertical: 14 }, isDesktop && { cursor: 'pointer' }]} onPress={closeTimerModal}>
                        <Text style={{ color: '#8F98A0', fontSize: 14, textAlign: 'center', fontWeight: 'bold' }}>CANCEL</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );

    // --------------------------------------------------------
    // DESKTOP LAYOUT (Balanced 2-Column Widescreen)
    // --------------------------------------------------------
    if (isDesktop) {
        return (
            <View style={styles.desktopContainer}>
                <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.desktopWrapper}>

                    {/* Header */}
                    <View style={styles.desktopHeaderRow}>
                        <TouchableOpacity onPress={handleBackBtn} style={{ padding: 10, cursor: 'pointer', zIndex: 30, flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="chevron-down" size={32} color="#FFFFFF" />
                            <Text style={{ color: '#FFF', marginLeft: 8, fontWeight: 'bold', fontSize: 16 }}>Close Player</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleTimerPress} style={{ padding: 10, alignItems: 'center', minWidth: 48, cursor: 'pointer', zIndex: 30, flexDirection: 'row' }}>
                            <Ionicons name="timer-outline" size={24} color={sleepTimerRemaining ? "#00E5FF" : "#8F98A0"} />
                            {sleepTimerRemaining > 0 && (
                                <Text style={{ color: '#00E5FF', fontSize: 13, fontWeight: 'bold', marginLeft: 6 }}>
                                    {Math.floor(sleepTimerRemaining / 60)}:{(sleepTimerRemaining % 60).toString().padStart(2, '0')}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* TWO-COLUMN LAYOUT */}
                    <View style={styles.desktopTwoColumn}>

                        {/* LEFT COLUMN: Art & Controls (Perfectly Balanced) */}
                        <View style={styles.desktopLeftCol}>
                            <View style={styles.desktopAlbumContainer}>
                                <Image source={{ uri: currentTrack?.artwork || currentTrack?.artworkUrl || currentTrack?.image }} style={styles.desktopAlbumArt} />
                            </View>

                            <View style={styles.desktopTrackInfo}>
                                <TouchableOpacity onPress={() => handleMusicAction(currentTrack?.mediaId, 'dislike')} style={{ padding: 8, cursor: 'pointer' }}>
                                    <Ionicons name={musicPrefs?.[currentTrack?.mediaId] === 'dislike' ? "thumbs-down" : "thumbs-down-outline"} size={26} color={musicPrefs?.[currentTrack?.mediaId] === 'dislike' ? "#FF007A" : "#8F98A0"} />
                                </TouchableOpacity>

                                <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 16 }}>
                                    <Text style={styles.desktopLargeTitle} numberOfLines={1}>{decodedTitle}</Text>
                                    <Text style={styles.desktopLargeArtist} numberOfLines={1}>{decodedArtist}</Text>
                                </View>

                                <TouchableOpacity onPress={() => handleMusicAction(currentTrack?.mediaId, 'toggleLike')} style={{ padding: 8, cursor: 'pointer' }}>
                                    <Ionicons name={musicPrefs?.[currentTrack?.mediaId] === 'like' ? "heart" : "heart-outline"} size={26} color={musicPrefs?.[currentTrack?.mediaId] === 'like' ? "#FF007A" : "#FFF"} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.seekContainerDesktop}>
                                <TouchableOpacity activeOpacity={1} style={[styles.progressBarTouchArea, { cursor: 'pointer' }]} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)} onPress={handleSeek}>
                                    <View style={styles.progressBarBgDesktop}>
                                        <LinearGradient colors={['#00E5FF', '#9B51E0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.progressBarFill, { width: `${(musicProgress / (musicDuration || 1)) * 100}%` }]} />
                                        <View style={[styles.progressKnobDesktop, { left: `${(musicProgress / (musicDuration || 1)) * 100}%` }]} />
                                    </View>
                                </TouchableOpacity>
                                <View style={styles.timeRow}>
                                    <Text style={styles.timeTextDesktop}>{formatTime(musicProgress)}</Text>
                                    <Text style={styles.timeTextDesktop}>{formatTime(musicDuration)}</Text>
                                </View>
                            </View>

                            <View style={styles.musicControlsRowDesktop}>
                                <TouchableOpacity onPress={() => setIsShuffle(!isShuffle)} style={{ padding: 10, cursor: 'pointer' }}>
                                    <Ionicons name="shuffle" size={28} color={isShuffle ? "#00E5FF" : "#8F98A0"} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handlePrevTrack} style={{ padding: 10, cursor: 'pointer' }}>
                                    <Ionicons name="play-skip-back" size={36} color={currentMusicIndex > 0 || isShuffle || isLoopActive ? "#FFFFFF" : "#555"} />
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.neonPlayWrapperDesktop} activeOpacity={0.8} onPress={() => setIsPlaying(!isPlaying)}>
                                    <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.neonPlayInner}>
                                        <Ionicons name={isPlaying ? "pause" : "play"} size={40} color="#FFFFFF" style={!isPlaying ? { marginLeft: 6 } : {}} />
                                    </LinearGradient>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={handleNextTrack} style={{ padding: 10, cursor: 'pointer' }}>
                                    <Ionicons name="play-skip-forward" size={36} color={currentMusicIndex < musicQueue.length - 1 || isShuffle || isLoopActive ? "#FFFFFF" : "#555"} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={setLoopMode} style={{ padding: 10, position: 'relative', cursor: 'pointer' }}>
                                    <Ionicons name="repeat" size={28} color={isLoopActive ? "#00E5FF" : "#8F98A0"} />
                                    {isLoopOne && <Text style={{ position: 'absolute', fontSize: 11, color: '#00E5FF', top: 12, right: 6, fontWeight: 'bold' }}>1</Text>}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* RIGHT COLUMN: Queue */}
                        <View style={styles.desktopRightCol}>
                            <Text style={styles.queueTitleDesktop}>Up Next</Text>
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                                {musicQueue.map((track, index) => {
                                    const isActive = index === currentMusicIndex;
                                    return (
                                        <TouchableOpacity
                                            key={track.mediaId + index}
                                            style={[styles.queueItemDesktop, isActive && { borderColor: '#00E5FF', backgroundColor: 'rgba(0, 229, 255, 0.1)' }]}
                                            onPress={() => setCurrentMusicIndex(index)}
                                        >
                                            <Image source={{ uri: track?.artwork || track?.artworkUrl || track?.image }} style={styles.queueImageDesktop} />
                                            <View style={styles.queueInfo}>
                                                <Text style={[styles.queueTrackTitle, isActive && { color: '#00E5FF' }]} numberOfLines={1}>{decodeText(track.title)}</Text>
                                                <Text style={styles.queueTrackArtist} numberOfLines={1}>{decodeText(track.artist)}</Text>
                                            </View>
                                            {isActive ? <Ionicons name="stats-chart" size={20} color="#00E5FF" /> : <Ionicons name="play-circle-outline" size={24} color="#8F98A0" />}
                                        </TouchableOpacity>
                                    )
                                })}
                            </ScrollView>
                        </View>
                    </View>
                </LinearGradient>
                {renderTimerModal()}
            </View>
        );
    }

    // --------------------------------------------------------
    // MOBILE & TABLET LAYOUT (Exact Native Clone)
    // --------------------------------------------------------
    return (
        <Animated.View style={{ flex: 1, backgroundColor: 'transparent', transform: [{ translateY: slideAnim }] }}>
            <SafeAreaView style={styles.safeArea}>
                <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.container}>

                    {/* STICKY HEADER (Appears on scroll down, contains thumbnail) */}
                    <Animated.View style={[styles.stickyHeader, { opacity: miniOpacity, paddingTop: insets.top + 10 }]}
                        pointerEvents={miniBarInteractive ? 'auto' : 'none'} >
                        <TouchableOpacity onPress={handleBackBtn} style={{ paddingRight: 10 }}>
                            <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Image source={{ uri: currentTrack?.artwork || currentTrack?.artworkUrl || currentTrack?.image }} style={{ width: 40, height: 40, borderRadius: 6, marginRight: 10 }} />

                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={{ color: '#FFF', fontSize: 14, fontWeight: 'bold' }} numberOfLines={1}>{decodedTitle}</Text>
                            <Text style={{ color: '#8F98A0', fontSize: 12 }} numberOfLines={1}>{decodedArtist}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
                            <TouchableOpacity onPress={handleTimerPress} style={{ paddingHorizontal: 8 }}>
                                <Ionicons name="timer-outline" size={24} color={sleepTimerRemaining ? "#00E5FF" : "#FFF"} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleMusicAction(currentTrack?.mediaId, 'toggleLike')} style={{ paddingHorizontal: 8 }}>
                                <Ionicons name={musicPrefs[currentTrack?.mediaId] === 'like' ? "heart" : "heart-outline"} size={22} color={musicPrefs[currentTrack?.mediaId] === 'like' ? "#FF007A" : "#FFF"} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setIsPlaying(!isPlaying)} style={{ paddingHorizontal: 8 }}>
                                <Ionicons name={isPlaying ? "pause" : "play"} size={26} color="#FFF" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleNextTrack} style={{ paddingLeft: 8 }}>
                                <Ionicons name="play-skip-forward" size={22} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    </Animated.View>

                    {/* STATIC TOP HEADER (Fades out on scroll down) */}
                    <Animated.View style={[styles.musicHeader, { opacity: heroOpacity, position: 'absolute', top: insets.top, left: 0, right: 0 }]}
                        pointerEvents={miniBarInteractive ? 'none' : 'auto'}>
                        <TouchableOpacity onPress={handleBackBtn} style={{ padding: 10, width: 60, alignItems: 'flex-start' }}>
                            <Ionicons name="chevron-down" size={32} color="#FFFFFF" />
                        </TouchableOpacity>

                        <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 10 }}>
                            <Text style={styles.musicHeaderSubtitle}>NOW PLAYING</Text>
                            <Text style={styles.musicHeaderTitle} numberOfLines={1}>{decodedTitle}</Text>
                        </View>

                        <TouchableOpacity onPress={handleTimerPress} style={{ padding: 10, alignItems: 'flex-end', width: 60 }}>
                            <Ionicons name="timer-outline" size={26} color={sleepTimerRemaining ? "#00E5FF" : "#FFFFFF"} />
                            {sleepTimerRemaining > 0 && (
                                <Text style={{ color: '#00E5FF', fontSize: 10, fontWeight: 'bold', marginTop: 2 }}>
                                    {Math.floor(sleepTimerRemaining / 60)}:{(sleepTimerRemaining % 60).toString().padStart(2, '0')}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Scrollable Area */}
                    <Animated.ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingTop: 80, paddingBottom: TAB_BAR_HEIGHT + 40 }}
                        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: Platform.OS !== 'web' })}
                        scrollEventThrottle={16}
                    >
                        <Animated.View style={{ opacity: heroOpacity, transform: [{ scale: artScale }, { translateY: artTranslateY }] }} {...panResponderMusic.panHandlers}>

                            <View style={styles.albumArtContainer}>
                                <Image source={{ uri: currentTrack?.artwork || currentTrack?.artworkUrl || currentTrack?.image }} style={[styles.albumArt, { width: ART_ORIG_SIZE, height: ART_ORIG_SIZE }]} />
                            </View>

                            <View style={[styles.musicTrackInfo, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 }]}>
                                <TouchableOpacity onPress={() => handleMusicAction(currentTrack?.mediaId, 'dislike')} style={{ padding: 10 }}>
                                    <Ionicons name={musicPrefs?.[currentTrack?.mediaId] === 'dislike' ? "thumbs-down" : "thumbs-down-outline"} size={28} color={musicPrefs?.[currentTrack?.mediaId] === 'dislike' ? "#FF007A" : "#8F98A0"} />
                                </TouchableOpacity>

                                <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 10 }}>
                                    <Text style={styles.musicLargeTitle} numberOfLines={1}>{decodedTitle}</Text>
                                    <Text style={styles.musicLargeArtist} numberOfLines={1}>{decodedArtist}</Text>
                                </View>

                                <TouchableOpacity onPress={() => handleMusicAction(currentTrack?.mediaId, 'toggleLike')} style={{ padding: 10 }}>
                                    <Ionicons name={musicPrefs?.[currentTrack?.mediaId] === 'like' ? "heart" : "heart-outline"} size={28} color={musicPrefs?.[currentTrack?.mediaId] === 'like' ? "#FF007A" : "#FFF"} />
                                </TouchableOpacity>
                            </View>

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
                                    <Ionicons name="play-skip-forward" size={32} color={currentMusicIndex < musicQueue.length - 1 || isShuffle || isLoopActive ? "#FFFFFF" : "#555"} />
                                </TouchableOpacity>

                                <TouchableOpacity onPress={setLoopMode} style={{ padding: 10, position: 'relative' }}>
                                    <Ionicons name="repeat" size={24} color={isLoopActive ? "#00E5FF" : "#8F98A0"} />
                                    {isLoopOne && <Text style={{ position: 'absolute', fontSize: 10, color: '#00E5FF', top: 10, right: 6, fontWeight: 'bold' }}>1</Text>}
                                </TouchableOpacity>
                            </View>
                        </Animated.View>

                        <View style={styles.queueContainer}>
                            <Text style={styles.queueTitle}>Playlist</Text>
                            {musicQueue.map((track, index) => {
                                const isActive = index === currentMusicIndex;
                                return (
                                    <TouchableOpacity
                                        key={track.mediaId + index}
                                        style={[styles.queueItem, isActive && { borderColor: '#00E5FF', backgroundColor: 'rgba(0, 229, 255, 0.1)' }]}
                                        onPress={() => setCurrentMusicIndex(index)}
                                    >
                                        <Image source={{ uri: track?.artwork || track?.artworkUrl || track?.image }} style={styles.queueImage} />
                                        <View style={styles.queueInfo}>
                                            <Text style={[styles.queueTrackTitle, isActive && { color: '#00E5FF' }]} numberOfLines={1}>{decodeText(track.title)}</Text>
                                            <Text style={styles.queueTrackArtist} numberOfLines={1}>{decodeText(track.artist)}</Text>
                                        </View>
                                        {isActive ? <Ionicons name="stats-chart" size={20} color="#00E5FF" /> : <Ionicons name="play-circle-outline" size={24} color="#8F98A0" />}
                                    </TouchableOpacity>
                                )
                            })}
                        </View>
                    </Animated.ScrollView>
                </LinearGradient>
                {renderTimerModal()}
            </SafeAreaView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#000' },
    container: { flex: 1, backgroundColor: '#0A0A0C' },

    // --- DESKTOP STYLES (>= 1024px) ---
    desktopContainer: { flex: 1, backgroundColor: '#0A0A0C', width: '100%', height: '100%', justifyContent: 'center' },
    desktopWrapper: { flex: 1, width: '100%', backgroundColor: '#170D22' },
    desktopHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 40, paddingTop: 32, paddingBottom: 16 },

    desktopTwoColumn: { flex: 1, flexDirection: 'row', gap: 40, paddingHorizontal: 60, paddingBottom: 40, paddingTop: 10 },

    desktopLeftCol: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingRight: 20 },
    desktopAlbumContainer: { width: 320, height: 320, borderRadius: 16, elevation: 20, shadowColor: '#00E5FF', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 30, marginBottom: 30 },
    desktopAlbumArt: { width: '100%', height: '100%', borderRadius: 16, backgroundColor: '#1E1428' },
    desktopTrackInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 500, marginBottom: 20 },
    desktopLargeTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', marginBottom: 4, letterSpacing: 0.5, textAlign: 'center' },
    desktopLargeArtist: { color: '#00E5FF', fontSize: 16, fontWeight: '600', textAlign: 'center' },

    seekContainerDesktop: { width: '100%', maxWidth: 500, marginBottom: 20, marginTop: 10 },
    progressBarBgDesktop: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, position: 'relative' },
    progressKnobDesktop: { position: 'absolute', top: -5, width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF', elevation: 4, transform: [{ translateX: -8 }] },
    timeTextDesktop: { color: '#8F98A0', fontSize: 13, fontWeight: '600' },

    musicControlsRowDesktop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32, width: '100%' },
    neonPlayWrapperDesktop: { width: 76, height: 76, borderRadius: 38, elevation: 10, shadowColor: '#FF007A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.6, shadowRadius: 12, cursor: 'pointer' },

    desktopRightCol: { flex: 1, maxWidth: 450, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 24, padding: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    queueTitleDesktop: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', marginBottom: 24, letterSpacing: 0.5 },
    queueItemDesktop: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16161A', padding: 14, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', cursor: 'pointer' },
    queueImageDesktop: { width: 64, height: 64, borderRadius: 10, backgroundColor: '#2A2A30' },

    // --- MOBILE / SHARED STYLES ---
    musicFixedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, zIndex: 10 },
    musicHeaderSubtitle: { color: '#8F98A0', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 4 },
    musicHeaderTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', maxWidth: 250, textAlign: 'center' },
    stickyHeader: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, backgroundColor: 'rgba(10, 10, 12, 0.95)', zIndex: 20, elevation: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    musicHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20, elevation: 20, zIndex: 20 },
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

    // --- TIMERS MODAL ---
    timerModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
    timerModalContainer: { backgroundColor: '#170D22', padding: 24, borderRadius: 20, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: 'rgba(0,229,255,0.3)', shadowColor: '#00E5FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10 },
    timerModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    timerModalTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', letterSpacing: 1 },
    customTimerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,229,255,0.1)', paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,229,255,0.3)', marginTop: 12 },
    customTimerInput: { fontSize: 48, fontWeight: '900', color: '#00E5FF', textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#00E5FF', width: 120, marginBottom: 20, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', paddingBottom: 5 },
    startCustomBtn: { backgroundColor: '#00E5FF', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, elevation: 5, shadowColor: '#00E5FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
    startCustomBtnText: { color: '#0A0A0C', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },
    timerPresetBtn: { width: '47%', backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 20, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    timerPresetNumber: { color: '#00E5FF', fontSize: 28, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
    timerPresetLabel: { color: '#8F98A0', fontSize: 12, marginTop: 4, fontWeight: 'bold', letterSpacing: 1 },
    timerActiveNumber: { color: '#00E5FF', fontSize: 42, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', textAlign: 'center', marginBottom: 24 },
    timerActiveChangeBtn: { paddingVertical: 14, backgroundColor: '#00E5FF', borderRadius: 12, marginBottom: 12 },
    timerActiveChangeText: { color: '#0A0A0C', fontSize: 14, textAlign: 'center', fontWeight: 'bold', letterSpacing: 1 },
    timerActiveOffBtn: { paddingVertical: 14, backgroundColor: 'rgba(255, 0, 122, 0.15)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 0, 122, 0.3)', marginBottom: 12 },
    timerActiveOffText: { color: '#FF007A', fontSize: 14, textAlign: 'center', fontWeight: 'bold', letterSpacing: 1 },
});