import React, { useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, TextInput, Keyboard, ActivityIndicator, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReAnimated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useLiveTvFeedLogic } from '../../hooks/useLiveTvFeedLogic';
import Hls from 'hls.js';

export function LiveTvWebPlayer({ streamUrl, isPlaying }) {
    const videoRef = useRef(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !streamUrl) return;

        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (isPlaying) video.play().catch(() => { });
            });
            return () => hls.destroy();
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari
            video.src = streamUrl;
        }
    }, [streamUrl]);

    return (
        <video
            ref={videoRef}
            style={{ width: '100%', height: '100%' }}
            controls={false}
            autoPlay
            playsInline
        />
    );
}

export const LiveTvFeed = ({ selectedCategory, selectedLanguage, onNavigateToPlayer }) => {
    const { width: windowWidth } = useWindowDimensions();
    const isDesktop = windowWidth >= 1024;

    const {
        isLoadingTv,
        allChannels,
        tvSearchQuery,
        setTvSearchQuery,
        isTvListening,
        toggleTvListening,
        displayedChannels
    } = useLiveTvFeedLogic({ selectedCategory, selectedLanguage });

    if (isLoadingTv && allChannels.length === 0) {
        return (
            <ReAnimated.View entering={FadeIn} exiting={FadeOut} style={[styles.sportsContainer, { alignItems: 'center', paddingTop: 40 }]}>
                <ActivityIndicator size="large" color="#00E5FF" />
            </ReAnimated.View>
        );
    }

    // --------------------------------------------------------
    // DESKTOP LAYOUT (Premium Grid & Larger Controls)
    // --------------------------------------------------------
    if (isDesktop) {
        return (
            <ReAnimated.View layout={LinearTransition} style={styles.desktopContainer}>
                <View style={styles.desktopHeaderRow}>
                    <Text style={styles.desktopRowTitle}>Live TV Channels</Text>

                    <View style={[styles.musicSearchBox, styles.desktopSearchBox, isTvListening && styles.musicSearchBoxActive]}>
                        <Ionicons name="search" size={22} color="#00E5FF" style={styles.musicSearchIcon} />
                        <TextInput
                            style={styles.musicSearchInput}
                            placeholder={isTvListening ? "Listening..." : "Search TV shows, movies..."}
                            placeholderTextColor={isTvListening ? "#00E5FF" : "#8F98A0"}
                            value={tvSearchQuery}
                            onChangeText={setTvSearchQuery}
                            selectionColor="#00E5FF"
                            autoCapitalize="none"
                        />
                        {tvSearchQuery.length > 0 && !isTvListening ? (
                            <TouchableOpacity onPress={() => { setTvSearchQuery(''); Keyboard.dismiss(); }} style={styles.musicRightIcon}>
                                <Ionicons name="close-circle" size={20} color="#8F98A0" />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity onPress={toggleTvListening} style={styles.musicRightIcon}>
                                {isTvListening ? <ActivityIndicator size="small" color="#00E5FF" /> : <Ionicons name="mic-outline" size={24} color="#FFFFFF" />}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {displayedChannels.length === 0 ? (
                    <View style={styles.desktopEmptyState}>
                        <Ionicons name="tv-outline" size={64} color="#8F98A0" style={{ marginBottom: 16, opacity: 0.5 }} />
                        <Text style={styles.desktopEmptyTitle}>No Channels Found</Text>
                        <Text style={styles.emptyStateSub}>
                            {tvSearchQuery ? `We couldn't find any channels matching "${tvSearchQuery}".` : `No channels currently broadcasting for ${selectedCategory} in the selected language.`}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.desktopGrid}>
                        {displayedChannels.map(channel => (
                            <TouchableOpacity
                                key={channel.id}
                                style={styles.desktopTvCard}
                                activeOpacity={0.8}
                                onPress={() => onNavigateToPlayer({ streamUrl: channel.url, channelName: channel.title })}
                            >
                                <View style={styles.desktopTvLogoContainer}>
                                    <Image source={{ uri: channel.logo }} style={styles.desktopTvLogo} resizeMode="contain" />
                                </View>
                                <View style={styles.desktopTvCardInfo}>
                                    <Text style={styles.desktopTvChannelName} numberOfLines={1}>{channel.title}</Text>
                                    <View style={styles.tvLiveBadge}>
                                        <View style={styles.tvLiveDot} />
                                        <Text style={styles.tvCategoryText}>{channel.category}</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ReAnimated.View>
        );
    }

    // --------------------------------------------------------
    // MOBILE & TABLET LAYOUT (Exact Native Clone)
    // --------------------------------------------------------
    return (
        <ReAnimated.View layout={LinearTransition} style={styles.sportsContainer}>
            <Text style={styles.rowTitle}>Live TV Channels</Text>

            <View style={[styles.musicSearchBox, isTvListening && styles.musicSearchBoxActive, { marginHorizontal: 0, marginBottom: 20 }]}>
                <Ionicons name="search" size={20} color="#00E5FF" style={styles.musicSearchIcon} />
                <TextInput style={styles.musicSearchInput} placeholder={isTvListening ? "Listening..." : "Search TV shows, movies..."} placeholderTextColor={isTvListening ? "#00E5FF" : "#8F98A0"} value={tvSearchQuery} onChangeText={setTvSearchQuery} selectionColor="#00E5FF" autoCapitalize="none" />
                {tvSearchQuery.length > 0 && !isTvListening ? (
                    <TouchableOpacity onPress={() => { setTvSearchQuery(''); Keyboard.dismiss(); }} style={styles.musicRightIcon}>
                        <Ionicons name="close-circle" size={18} color="#8F98A0" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={toggleTvListening} style={styles.musicRightIcon}>
                        {isTvListening ? <ActivityIndicator size="small" color="#00E5FF" /> : <Ionicons name="mic-outline" size={22} color="#FFFFFF" />}
                    </TouchableOpacity>
                )}
            </View>

            {displayedChannels.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                    <Ionicons name="tv-outline" size={48} color="#8F98A0" style={{ marginBottom: 12, opacity: 0.5 }} />
                    <Text style={styles.emptyStateTitle}>No Channels Found</Text>
                    <Text style={styles.emptyStateSub}>{tvSearchQuery ? `We couldn't find any channels matching "${tvSearchQuery}".` : `No channels currently broadcasting for ${selectedCategory} in the selected language.`}</Text>
                </View>
            ) : (
                <FlatList
                    keyboardShouldPersistTaps="handled" data={displayedChannels} keyExtractor={(item) => item.id} numColumns={2} scrollEnabled={false}
                    columnWrapperStyle={{ justifyContent: 'space-between' }} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5} removeClippedSubviews={Platform.OS === 'android'} contentContainerStyle={{ paddingBottom: 20 }}
                    renderItem={({ item: channel }) => (
                        <View style={styles.tvCardWrapper}>
                            <TouchableOpacity style={styles.tvCard} activeOpacity={0.8} onPress={() => onNavigateToPlayer({ streamUrl: channel.url, channelName: channel.title })}>
                                <View style={styles.tvLogoContainer}>
                                    <Image source={{ uri: channel.logo }} style={styles.tvLogo} resizeMode="contain" />
                                </View>
                                <View style={styles.tvCardInfo}>
                                    <Text style={styles.tvChannelName} numberOfLines={1}>{channel.title}</Text>
                                    <View style={styles.tvLiveBadge}>
                                        <View style={styles.tvLiveDot} />
                                        <Text style={styles.tvCategoryText}>{channel.category}</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}
                />
            )}
        </ReAnimated.View>
    );
};

const styles = StyleSheet.create({
    // --- DESKTOP STYLES (>= 1024px) ---
    desktopContainer: { paddingHorizontal: 0, paddingBottom: 40 },
    desktopHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    desktopRowTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold', letterSpacing: 0.5 },
    desktopSearchBox: { width: 400, height: 56, borderRadius: 28, marginHorizontal: 0, marginBottom: 0 },

    desktopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
    desktopTvCard: {
        width: '18%',
        minWidth: 200,
        backgroundColor: '#1E1428',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        cursor: 'pointer',
    },
    desktopTvLogoContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#2A2A30',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        overflow: 'hidden'
    },
    desktopTvLogo: { width: '80%', height: '80%' },
    desktopTvCardInfo: { alignItems: 'center', width: '100%' },
    desktopTvChannelName: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 12, textAlign: 'center', letterSpacing: 0.3 },

    desktopEmptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 20 },
    desktopEmptyTitle: { color: '#E0E0E0', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },

    // --- MOBILE & TABLET STYLES (< 1024px) ---
    sportsContainer: { paddingHorizontal: 16, paddingBottom: 20 },
    rowTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', paddingHorizontal: 0, marginBottom: 14, letterSpacing: 0.2 },
    emptyStateContainer: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
    emptyStateTitle: { color: '#E0E0E0', fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    emptyStateSub: { color: '#8F98A0', fontSize: 13, textAlign: 'center', lineHeight: 20 },
    tvCardWrapper: { width: '48%', marginBottom: 16 },
    tvCard: { backgroundColor: '#1E1428', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    tvLogoContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2A2A30', justifyContent: 'center', alignItems: 'center', marginBottom: 12, overflow: 'hidden' },
    tvLogo: { width: '80%', height: '80%' },
    tvCardInfo: { alignItems: 'center', width: '100%' },
    tvChannelName: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },

    // --- SHARED STYLES ---
    musicSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#25252A', borderRadius: 24, height: 52, paddingHorizontal: 16, borderWidth: 1, borderColor: 'transparent' },
    musicSearchBoxActive: { borderColor: '#00E5FF', backgroundColor: '#1C2533' },
    musicSearchIcon: { marginRight: 10 },
    musicSearchInput: { flex: 1, color: '#FFFFFF', fontSize: 16, height: '100%', outlineStyle: 'none' },
    musicRightIcon: { paddingLeft: 10, height: 40, justifyContent: 'center', cursor: 'pointer' },
    tvLiveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 0, 122, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    tvLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF007A', marginRight: 6 },
    tvCategoryText: { color: '#FF007A', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
});