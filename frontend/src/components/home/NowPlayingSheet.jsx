import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackPlayer, { useProgress, RepeatMode } from '@rntp/player';
import {
    Gesture,
    GestureDetector,
    GestureHandlerRootView,
    TouchableOpacity as RNGHTouchableOpacity,
} from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';

import { formatTime } from '../../utils/homehelpers';
import { AddToPlaylistSheet } from './AddToPlaylistSheet';

const { width } = Dimensions.get('window');
const ROW_HEIGHT = 68;

// ==========================================
// SCRUBBER — sources its own progress. Only THIS re-renders every tick.
// ==========================================
const PlayerScrubber = React.memo(({ onSeek }) => {
    const { position, duration } = useProgress();
    const [barWidth, setBarWidth] = useState(0);

    const handleSeekTap = useCallback((event) => {
        if (barWidth > 0 && duration > 0) {
            const pct = Math.max(0, Math.min(1, event.nativeEvent.locationX / barWidth));
            onSeek(pct * duration);
        }
    }, [barWidth, duration, onSeek]);

    const progressPct = duration > 0 ? position / duration : 0;

    return (
        <View style={styles.seekContainer}>
            <TouchableOpacity activeOpacity={1} style={styles.progressBarTouchArea} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)} onPress={handleSeekTap}>
                <View style={styles.progressBarBg}>
                    {/* scaleX transform, not width — native-thread animatable */}
                    <View style={[styles.progressBarFill, { transform: [{ scaleX: progressPct || 0.0001 }] }]} />
                    <View style={[styles.progressKnob, { transform: [{ translateX: Math.max(0, progressPct * barWidth - 8) }] }]} />
                </View>
            </TouchableOpacity>
            <View style={styles.timeRow}>
                <Text style={styles.timeText}>{formatTime(position)}</Text>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
        </View>
    );
});

// ==========================================
// TRACK INFO HEADER — default shallow memo (no custom comparator).
// A hand-written comparator here was the cause of "song details gone":
// it could decide props were equal and freeze the header on a stale/blank
// track. Default React.memo compares each prop directly and is reliable
// as long as the parent passes stable (useCallback'd) handlers — which it does.
// ==========================================
const TrackInfoHeader = React.memo(({
    track, isPlaying, isShuffle, loopMode,
    onTogglePlay, onNext, onPrev, onToggleShuffle, onToggleLoop,
    onLike, onDislike, onAddPlaylist, musicPrefs,
}) => {
    const isLoopActive = loopMode !== 0 && loopMode !== 'off' && !!loopMode;
    const isLoopOne = loopMode === 1 || loopMode === 'track' || loopMode === 'one' || loopMode === RepeatMode.Track;
    const mediaId = track?.mediaId || track?.id;

    return (
        <View>
            <View style={styles.albumArtContainer}>
                <Image
                    source={{ uri: track?.artwork || track?.artworkUrl || track?.image }}
                    style={styles.albumArt}
                    cachePolicy="memory-disk"
                    transition={200}
                />
            </View>

            <View style={styles.musicTrackInfo}>
                <TouchableOpacity onPress={() => onDislike(mediaId)} style={{ padding: 10 }}>
                    <Ionicons name="thumbs-down-outline" size={28} color={musicPrefs[mediaId] === 'dislike' ? "#FF007A" : "#8F98A0"} />
                </TouchableOpacity>

                <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 10 }}>
                    <Text style={styles.musicLargeTitle} numberOfLines={1}>{track?.title || track?.name || 'Unknown Track'}</Text>
                    <Text style={styles.musicLargeArtist} numberOfLines={1}>{track?.artist || track?.subtitle || ''}</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => onAddPlaylist(track)} style={{ padding: 10 }}>
                        <Ionicons name="list-circle-outline" size={28} color="#8F98A0" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onLike(mediaId)} style={{ padding: 10 }}>
                        <Ionicons name={musicPrefs[mediaId] === 'like' ? "heart" : "heart-outline"} size={28} color={musicPrefs[mediaId] === 'like' ? "#FF007A" : "#FFF"} />
                    </TouchableOpacity>
                </View>
            </View>

            <PlayerScrubber onSeek={TrackPlayer.seekTo} />

            <View style={styles.musicControlsRow}>
                <TouchableOpacity onPress={onToggleShuffle} style={{ padding: 10 }}>
                    <Ionicons name="shuffle" size={24} color={isShuffle ? "#00E5FF" : "#8F98A0"} />
                </TouchableOpacity>
                <TouchableOpacity onPress={onPrev} style={styles.skipBtn}>
                    <Ionicons name="play-skip-back" size={32} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.neonPlayWrapper} activeOpacity={0.8} onPress={onTogglePlay}>
                    <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.neonPlayInner}>
                        <Ionicons name={isPlaying ? "pause" : "play"} size={36} color="#FFFFFF" style={!isPlaying ? { marginLeft: 6 } : {}} />
                    </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={onNext} style={styles.skipBtn}>
                    <Ionicons name="play-skip-forward" size={32} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onToggleLoop} style={{ padding: 10, position: 'relative' }}>
                    <Ionicons name="repeat" size={24} color={isLoopActive ? "#00E5FF" : "#8F98A0"} />
                    {isLoopOne && <Text style={{ position: 'absolute', fontSize: 10, color: '#00E5FF', top: 10, right: 6, fontWeight: 'bold' }}>1</Text>}
                </TouchableOpacity>
            </View>

            <View style={styles.queueHeader}>
                <Text style={styles.queueTitle}>Up Next</Text>
            </View>
        </View>
    );
});

// ==========================================
// QUEUE ROW — default shallow memo, all touchables from gesture-handler
// (mixing RN's TouchableOpacity with RNGH's inside a Swipeable is a common
// source of unreliable touches — keep it consistent).
// ==========================================
const QueueRow = React.memo(({ track, index, isCurrent, drag, isActive, onRemove, onPlay, onAddPlaylist }) => {
    const renderRightActions = () => (
        <View style={styles.swipeDeleteAction}>
            <Ionicons name="trash" size={24} color="#FFF" />
        </View>
    );

    return (
        <ScaleDecorator activeScale={1.03}>
            <Swipeable renderRightActions={renderRightActions} onSwipeableOpen={() => onRemove(index)} friction={2} overshootRight={false}>
                <View style={[styles.queueItem, isCurrent && styles.queueItemActive, isActive && styles.queueItemDragging]}>
                    <RNGHTouchableOpacity onPressIn={drag} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }} style={styles.dragHandle}>
                        <Ionicons name="menu" size={24} color={isActive ? "#00E5FF" : "#8F98A0"} />
                    </RNGHTouchableOpacity>

                    <RNGHTouchableOpacity style={styles.queueMainPressArea} activeOpacity={0.7} onPress={() => onPlay(index)}>
                        <Image source={{ uri: track?.artwork || track?.artworkUrl || track?.image }} style={styles.queueImage} cachePolicy="memory-disk" />
                        <View style={styles.queueInfo}>
                            <Text style={[styles.queueTrackTitle, isCurrent && { color: '#00E5FF' }]} numberOfLines={1}>{track?.title || track?.name}</Text>
                            <Text style={styles.queueTrackArtist} numberOfLines={1}>{track?.artist || track?.subtitle}</Text>
                        </View>
                    </RNGHTouchableOpacity>

                    <RNGHTouchableOpacity onPress={() => onAddPlaylist(track)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.queueActionBtn}>
                        <Ionicons name="list-circle-outline" size={26} color="#8F98A0" />
                    </RNGHTouchableOpacity>

                    <View style={styles.queueStatusIcon}>
                        {isCurrent ? <Ionicons name="stats-chart" size={18} color="#00E5FF" /> : <Ionicons name="play-circle-outline" size={22} color="#555" />}
                    </View>
                </View>
            </Swipeable>
        </ScaleDecorator>
    );
});

// ==========================================
// MAIN SHEET
// ==========================================
export const NowPlayingSheet = ({
    onClose, currentTrack, musicQueue, currentMusicIndex, setCurrentMusicIndex,
    handleDragEnd, handleSwipeToRemove,
    isPlaying, setIsPlaying, isShuffle, setIsShuffle, loopMode, setLoopMode,
    handleNextTrack, handlePrevTrack, handleMusicAction, musicPrefs,
    addToPlaylistModal, setAddToPlaylistModal, customPlaylists, onToggleSongInPlaylist,
}) => {
    const insets = useSafeAreaInsets();
    const translateY = useSharedValue(0);

    // FIX: this gesture is only attached to the header/handle View below —
    // it does NOT wrap the DraggableFlatList. Previously it wrapped the
    // entire sheet, which meant every row drag/swipe was also being
    // evaluated as a potential whole-screen dismiss — that conflict is
    // what made dragging feel unreliable/janky.
    const dismissGesture = Gesture.Pan()
        .activeOffsetY([-1000, 10]) // only activates on downward movement past 10px
        .onUpdate((e) => { if (e.translationY > 0) translateY.value = e.translationY; })
        .onEnd((e) => {
            if (e.translationY > 100 || e.velocityY > 500) {
                runOnJS(onClose)();
            } else {
                translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

    const handleAddPlaylist = useCallback((track) => setAddToPlaylistModal({ visible: true, track }), [setAddToPlaylistModal]);
    const handleLike = useCallback((id) => handleMusicAction(id, 'toggleLike'), [handleMusicAction]);
    const handleDislike = useCallback((id) => handleMusicAction(id, 'dislike'), [handleMusicAction]);
    const handleTogglePlay = useCallback(() => setIsPlaying(!isPlaying), [isPlaying, setIsPlaying]);
    const handleToggleShuffle = useCallback(() => setIsShuffle(!isShuffle), [isShuffle, setIsShuffle]);

    const renderItem = useCallback(({ item, getIndex, drag, isActive }) => {
        const idx = getIndex();
        return (
            <QueueRow
                track={item}
                index={idx}
                isCurrent={idx === currentMusicIndex}
                drag={drag}
                isActive={isActive}
                onRemove={handleSwipeToRemove}
                onPlay={setCurrentMusicIndex}
                onAddPlaylist={handleAddPlaylist}
            />
        );
    }, [currentMusicIndex, handleSwipeToRemove, setCurrentMusicIndex, handleAddPlaylist]);

    const getItemLayout = useCallback((data, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index }), []);

    return (
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0A0A0C' }}>
            {/* FIX: this gradient is the OUTER, static layer. Previously it lived
                INSIDE the Animated.View that translates down, so dragging the
                sheet revealed the Modal's raw (white) canvas above it. Now,
                only the content below moves within this fixed dark background —
                pulling down reveals the gradient, never white. */}
            <LinearGradient colors={['#170D22', '#0A0A0C']} style={{ flex: 1 }}>
                <Animated.View style={[{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }, animatedStyle]}>

                    <GestureDetector gesture={dismissGesture}>
                        <View>
                            <View style={styles.grabberBar} />
                            <View style={styles.musicHeader}>
                                <TouchableOpacity onPress={onClose} style={{ padding: 10 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
                                </TouchableOpacity>
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={styles.musicHeaderSubtitle}>NOW PLAYING</Text>
                                    <Text style={styles.musicHeaderTitle} numberOfLines={1}>{currentTrack?.title || currentTrack?.name || 'Unknown'}</Text>
                                </View>
                                <View style={{ width: 48 }} />
                            </View>
                        </View>
                    </GestureDetector>

                    <DraggableFlatList
                        data={musicQueue}
                        onDragEnd={handleDragEnd}
                        keyExtractor={(item, index) => `queue-${item.id || item.mediaId}-${index}`}
                        renderItem={renderItem}
                        extraData={currentMusicIndex}
                        getItemLayout={getItemLayout}
                        ListHeaderComponent={
                            <TrackInfoHeader
                                track={currentTrack}
                                isPlaying={isPlaying}
                                isShuffle={isShuffle}
                                loopMode={loopMode}
                                onTogglePlay={handleTogglePlay}
                                onNext={handleNextTrack}
                                onPrev={handlePrevTrack}
                                onToggleShuffle={handleToggleShuffle}
                                onToggleLoop={setLoopMode}
                                onLike={handleLike}
                                onDislike={handleDislike}
                                onAddPlaylist={handleAddPlaylist}
                                musicPrefs={musicPrefs}
                            />
                        }
                        dragItemOverflow={false}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 40 }}
                        activationDistance={10}
                        autoscrollThreshold={40}
                    />
                </Animated.View>

                {/* FIX: real animated slide-up sheet, always mounted, controlled
                    via translateY — instead of the old instant show/hide View. */}
                <AddToPlaylistSheet
                    visible={addToPlaylistModal.visible}
                    track={addToPlaylistModal.track}
                    playlists={customPlaylists}
                    onClose={() => setAddToPlaylistModal({ visible: false, track: addToPlaylistModal.track })}
                    onToggleSong={onToggleSongInPlaylist}
                />
            </LinearGradient>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    grabberBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', alignSelf: 'center', marginTop: 8, marginBottom: 4 },
    musicHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
    musicHeaderSubtitle: { color: '#8F98A0', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 4 },
    musicHeaderTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', maxWidth: 250, textAlign: 'center' },
    albumArtContainer: { alignItems: 'center', marginTop: 10, marginBottom: 30, shadowColor: '#00E5FF', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 15 },
    albumArt: { width: width * 0.75, height: width * 0.75, borderRadius: 20, backgroundColor: '#1E1428' },
    musicTrackInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
    musicLargeTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
    musicLargeArtist: { color: '#00E5FF', fontSize: 16, fontWeight: '600', textAlign: 'center' },
    seekContainer: { paddingHorizontal: 30, marginBottom: 20 },
    progressBarTouchArea: { height: 30, justifyContent: 'center' },
    progressBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, position: 'relative' },
    progressBarFill: { height: '100%', width: '100%', borderRadius: 3, backgroundColor: '#00E5FF', transformOrigin: 'left' },
    progressKnob: { position: 'absolute', top: -5, width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF', elevation: 4 },
    timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    timeText: { color: '#8F98A0', fontSize: 12, fontWeight: '600' },
    musicControlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 30 },
    skipBtn: { padding: 10 },
    neonPlayWrapper: { width: 76, height: 76, borderRadius: 38, elevation: 10, shadowColor: '#FF007A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.6, shadowRadius: 12 },
    neonPlayInner: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 38 },
    queueHeader: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 10 },
    queueTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    queueItem: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', backgroundColor: '#16161A', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginHorizontal: 20 },
    queueItemActive: { borderColor: '#00E5FF', backgroundColor: 'rgba(0, 229, 255, 0.08)' },
    queueItemDragging: { backgroundColor: '#2A253A', borderColor: '#FF007A', borderWidth: 1, elevation: 15, zIndex: 9999 },
    dragHandle: { paddingHorizontal: 8, paddingVertical: 10, justifyContent: 'center', alignItems: 'center' },
    queueMainPressArea: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
    queueImage: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#2A2A30' },
    queueInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
    queueTrackTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
    queueTrackArtist: { color: '#8F98A0', fontSize: 12 },
    queueActionBtn: { padding: 6 },
    queueStatusIcon: { width: 26, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
    swipeDeleteAction: { backgroundColor: '#FF007A', justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 20, borderRadius: 12, marginBottom: 10, height: ROW_HEIGHT - 10, marginHorizontal: 20 },
});