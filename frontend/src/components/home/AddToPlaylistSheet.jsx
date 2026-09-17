import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS,
} from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// A real animated bottom sheet — always mounted, controlled purely via
// translateY, so it slides up/down instead of popping in/out instantly.
export const AddToPlaylistSheet = ({ visible, track, playlists, onClose, onToggleSong }) => {
    const insets = useSafeAreaInsets();
    const translateY = useSharedValue(SCREEN_HEIGHT);
    const backdropOpacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            translateY.value = withSpring(0, { damping: 22, stiffness: 220, overshootClamping: true });
            backdropOpacity.value = withTiming(1, { duration: 200 });
        } else {
            translateY.value = withTiming(SCREEN_HEIGHT, { duration: 220 });
            backdropOpacity.value = withTiming(0, { duration: 180 });
        }
    }, [visible]);

    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
    const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

    // Drag the grabber handle down to dismiss, same as the main Now Playing sheet.
    const closeGesture = Gesture.Pan()
        .activeOffsetY([-1000, 10])
        .onUpdate((e) => { if (e.translationY > 0) translateY.value = e.translationY; })
        .onEnd((e) => {
            if (e.translationY > 120 || e.velocityY > 800) {
                translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
                runOnJS(onClose)();
            } else {
                translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
            }
        });

    return (
        <View style={StyleSheet.absoluteFillObject} pointerEvents={visible ? 'auto' : 'none'}>
            <Animated.View style={[StyleSheet.absoluteFillObject, styles.backdrop, backdropStyle]}>
                <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
            </Animated.View>

            <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }, sheetStyle]}>
                <GestureDetector gesture={closeGesture}>
                    <View>
                        <View style={styles.grabberBar} />
                        <View style={styles.sheetHeaderRow}>
                            <Text style={styles.modalTitle}>Add to Playlist</Text>
                            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Ionicons name="close" size={26} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </GestureDetector>

                {(!playlists || playlists.length === 0) ? (
                    <Text style={styles.emptyText}>No custom playlists yet.</Text>
                ) : (
                    <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                        {playlists.map(playlist => {
                            const songIdStr = String(track?.id || track?.mediaId);
                            const isAdded = playlist.songs.includes(songIdStr);
                            return (
                                <TouchableOpacity key={playlist._id} style={styles.playlistOption} onPress={() => onToggleSong(playlist._id)}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="musical-notes" size={22} color="#00E5FF" style={{ marginRight: 14 }} />
                                        <Text style={styles.playlistOptionText}>{playlist.name}</Text>
                                    </View>
                                    {isAdded && <Ionicons name="checkmark-circle" size={22} color="#FF007A" />}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    backdrop: { backgroundColor: 'rgba(0,0,0,0.7)' },
    sheet: {
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: '#170D22', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: 20, paddingTop: 12,
    },
    grabberBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', alignSelf: 'center', marginBottom: 14 },
    sheetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
    emptyText: { color: '#8F98A0', textAlign: 'center', marginVertical: 30 },
    playlistOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    playlistOptionText: { color: '#FFF', fontSize: 18, fontWeight: '500' },
});