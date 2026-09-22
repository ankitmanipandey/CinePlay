// src/components/home/LiveTvFeed.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, TextInput, Keyboard, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReAnimated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useTvStore } from '../../store/useTvStore';

export const LiveTvFeed = ({ selectedCategory, selectedLanguage, onNavigateToPlayer }) => {
    const { allChannels, activeFeeds, isLoadingTv, fetchTvData, filterByCategory } = useTvStore();
    const [tvSearchQuery, setTvSearchQuery] = useState('');
    const [isTvListening, setIsTvListening] = useState(false);

    useSpeechRecognitionEvent('start', () => setIsTvListening(true));
    useSpeechRecognitionEvent('end', () => setIsTvListening(false));
    useSpeechRecognitionEvent('result', (e) => {
        if (e.results?.[0]?.transcript) {
            setTvSearchQuery(e.results[0].transcript);
            Keyboard.dismiss();
        }
        if (e.isFinal) ExpoSpeechRecognitionModule.stop();
    });
    useSpeechRecognitionEvent('error', () => setIsTvListening(false));

    const toggleTvListening = async () => {
        if (isTvListening) return ExpoSpeechRecognitionModule.stop();
        const p = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (p.granted) {
            setTvSearchQuery('');
            ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
        }
    };

    useEffect(() => { if (allChannels.length === 0) fetchTvData(); }, []);
    useEffect(() => { filterByCategory(selectedCategory, selectedLanguage); tvSearchQuery && setTvSearchQuery(''); }, [selectedCategory, selectedLanguage, allChannels]);

    const displayedChannels = useMemo(() => {
        if (!tvSearchQuery.trim()) return activeFeeds;
        return activeFeeds.filter(channel => channel.title.toLowerCase().includes(tvSearchQuery.toLowerCase()));
    }, [activeFeeds, tvSearchQuery]);

    if (isLoadingTv && allChannels.length === 0) return <ReAnimated.View entering={FadeIn} exiting={FadeOut} style={[styles.sportsContainer, { alignItems: 'center', paddingTop: 40 }]}><ActivityIndicator size="large" color="#00E5FF" /></ReAnimated.View>;

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
    sportsContainer: { paddingHorizontal: 16, paddingBottom: 20 },
    rowTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', paddingHorizontal: 0, marginBottom: 14, letterSpacing: 0.2 },
    musicSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#25252A', borderRadius: 24, height: 52, paddingHorizontal: 16, borderWidth: 1, borderColor: 'transparent' },
    musicSearchBoxActive: { borderColor: '#00E5FF', backgroundColor: '#1C2533' },
    musicSearchIcon: { marginRight: 10 },
    musicSearchInput: { flex: 1, color: '#FFFFFF', fontSize: 16, height: '100%' },
    musicRightIcon: { paddingLeft: 10, height: 40, justifyContent: 'center' },
    emptyStateContainer: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
    emptyStateTitle: { color: '#E0E0E0', fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    emptyStateSub: { color: '#8F98A0', fontSize: 13, textAlign: 'center', lineHeight: 20 },
    tvCardWrapper: { width: '48%', marginBottom: 16 },
    tvCard: { backgroundColor: '#1E1428', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    tvLogoContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2A2A30', justifyContent: 'center', alignItems: 'center', marginBottom: 12, overflow: 'hidden' },
    tvLogo: { width: '80%', height: '80%' },
    tvCardInfo: { alignItems: 'center', width: '100%' },
    tvChannelName: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
    tvLiveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 0, 122, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    tvLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF007A', marginRight: 6 },
    tvCategoryText: { color: '#FF007A', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
});