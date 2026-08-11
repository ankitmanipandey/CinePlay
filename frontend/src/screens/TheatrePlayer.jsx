import React, { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import YoutubePlayer from 'react-native-youtube-iframe';

const TheatrePlayer = forwardRef(({ ytId, isPlaying, isHostBool, onPlayerStateChange, width, height, isMuted }, ref) => {
    return (
        <View style={{ width: width, height: height, backgroundColor: '#000', position: 'relative' }}>
            {ytId ? (
                <View pointerEvents={isHostBool ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
                    <YoutubePlayer
                        ref={ref}
                        height={height}
                        width={width}
                        play={isPlaying}
                        mute={isMuted}
                        volume={isMuted ? 0 : 100} // <--- GUARANTEES SILENCE
                        videoId={ytId}
                        onChangeState={onPlayerStateChange}
                        webViewProps={{ allowsFullscreenVideo: false }}
                        initialPlayerParams={{
                            controls: isHostBool ? 1 : 0,
                            modestbranding: 1,
                            rel: 0,
                        }}
                    />
                </View>
            ) : (
                <View style={styles.emptyPlayer}>
                    <Ionicons name="tv-outline" size={48} color="#8F98A0" />
                    <Text style={styles.emptyText}>
                        {isHostBool
                            ? "Search and select a video to start"
                            : "Waiting for the Host to pick a video..."}
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