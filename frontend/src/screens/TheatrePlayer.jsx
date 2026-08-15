import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import YoutubePlayer from 'react-native-youtube-iframe';
import { useVideoPlayer, VideoView } from 'expo-video';

const TheatrePlayer = forwardRef(({ ytId, isPlaying, isHostBool, onPlayerStateChange, width, height, isMuted }, ref) => {
    const isCustom = ytId?.startsWith('CUSTOM:');
    const customUrl = isCustom ? ytId.replace('CUSTOM:', '') : null;
    const youtubeRef = useRef(null);

    const player = useVideoPlayer(customUrl, (p) => {
        p.loop = true;
    });

    useEffect(() => {
        if (!isCustom || !player) return;
        isPlaying ? player.play() : player.pause();
    }, [isPlaying, isCustom, player]);

    useEffect(() => {
        if (!isCustom || !player) return;
        player.muted = isMuted;
    }, [isMuted, isCustom, player]);

    // Always expose real methods — never an empty object — regardless of which player is active
    useImperativeHandle(ref, () => ({
        getCurrentTime: async () => {
            if (isCustom) return player?.currentTime || 0;
            return (await youtubeRef.current?.getCurrentTime?.()) ?? 0;
        },
        seekTo: (time, allowSeekAhead) => {
            if (isCustom) {
                if (player) player.currentTime = time;
            } else {
                youtubeRef.current?.seekTo?.(time, allowSeekAhead);
            }
        },
    }), [isCustom, player]);

    return (
        <View style={{ width, height, backgroundColor: '#000', position: 'relative' }}>
            {ytId ? (
                isCustom ? (
                    <VideoView
                        player={player}
                        style={{ width, height }}
                        contentFit="contain"
                        nativeControls={isHostBool}
                    />
                ) : (
                    <View pointerEvents={isHostBool ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
                        <YoutubePlayer
                            ref={youtubeRef}
                            height={height}
                            width={width}
                            play={isPlaying}
                            mute={isMuted}
                            volume={isMuted ? 0 : 100}
                            videoId={ytId}
                            onChangeState={onPlayerStateChange}
                            webViewProps={{ allowsFullscreenVideo: false }}
                            initialPlayerParams={{ controls: isHostBool ? 1 : 0, modestbranding: 1, rel: 0 }}
                        />
                    </View>
                )
            ) : (
                <View style={styles.emptyPlayer}>
                    <Ionicons name="tv-outline" size={48} color="#8F98A0" />
                    <Text style={styles.emptyText}>
                        {isHostBool ? "Search and select a video to start" : "Waiting for the Host to pick a video..."}
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
});