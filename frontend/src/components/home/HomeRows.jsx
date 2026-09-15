// src/components/home/HomeRows.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getImageUrl } from '../../constants/config';
import { tmdbService } from '../../services/tmdbService';
import { MOCK_LANGUAGES } from '../../utils/homehelpers';

export const MovieCard = React.memo(({ item, inWatchlist, inWatched, onToggleAction, onNavigateToPlayer }) => {
    const posterUri = getImageUrl(item.poster_path);
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
    return (
        <TouchableOpacity style={styles.smallCard} activeOpacity={0.7} delayPressIn={0} onPress={() => onNavigateToPlayer({ id: item.id, type: mediaType })}>
            <Image source={{ uri: posterUri }} style={styles.smallCardImage} resizeMode="cover" />
            <View style={styles.translucentRatingBadge}>
                <Ionicons name="star" size={10} color="#F5C518" />
                <Text style={styles.smallCardRatingText}>{rating}</Text>
            </View>
            <View style={styles.smallCardActions}>
                <TouchableOpacity style={styles.smallIconBtn} activeOpacity={0.8} onPress={() => onToggleAction(item.id, mediaType, 'watchlist')}>
                    <Ionicons name={inWatchlist ? "bookmark" : "bookmark-outline"} size={14} color={inWatchlist ? "#FF007A" : "#FFFFFF"} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.smallIconBtn} activeOpacity={0.8} onPress={() => onToggleAction(item.id, mediaType, 'watched')}>
                    <Ionicons name="checkmark-done" size={14} color={inWatched ? "#00E5FF" : "#FFFFFF"} />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
});

export const HorizontalRow = React.memo(({ title, data, onAuthAction, watchlist = {}, watched = {}, toggleAction, onNavigateToPlayer }) => {
    if (!data || data.length === 0) return null;
    const handleToggle = useCallback((id, mediaType, listType) => { onAuthAction(() => toggleAction(id, mediaType, listType)); }, [onAuthAction, toggleAction]);

    const safeWatchlist = watchlist || {};
    const safeWatched = watched || {};

    const renderItem = useCallback(({ item }) => (
        <MovieCard item={item} inWatchlist={!!safeWatchlist[item.id]} inWatched={!!safeWatched[item.id]} onToggleAction={handleToggle} onNavigateToPlayer={onNavigateToPlayer} />
    ), [safeWatchlist, safeWatched, handleToggle, onNavigateToPlayer]);

    return (
        <View style={styles.rowContainer}>
            <Text style={styles.rowTitle}>{title}</Text>
            <FlatList horizontal keyboardShouldPersistTaps="handled" data={data} extraData={{ watchlist: safeWatchlist, watched: safeWatched }} keyExtractor={(item) => String(item.id)} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowListContent} renderItem={renderItem} initialNumToRender={4} maxToRenderPerBatch={4} windowSize={3} getItemLayout={(data, index) => ({ length: 122, offset: 122 * index, index })} />
        </View>
    );
});

export const LanguageRow = React.memo(({ router }) => {
    const [dynamicImages, setDynamicImages] = useState({});
    useEffect(() => {
        let isMounted = true;
        const fetchImages = async () => {
            const newImages = {};
            await Promise.all(MOCK_LANGUAGES.map(async (lang) => {
                try {
                    const res = await tmdbService.fetchSection({ type: 'movie', language: lang.code }, {});
                    if (res && res.length > 0) newImages[lang.id] = getImageUrl(res[0].backdrop_path || res[0].poster_path);
                } catch (e) { }
            }));
            if (isMounted) setDynamicImages(newImages);
        };
        fetchImages();
        return () => { isMounted = false; };
    }, []);

    return (
        <View style={styles.rowContainer}>
            <Text style={styles.rowTitle}>Popular Languages</Text>
            <FlatList horizontal keyboardShouldPersistTaps="handled" data={MOCK_LANGUAGES} keyExtractor={(item) => item.id} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowListContent} renderItem={({ item }) => {
                const imageUri = dynamicImages[item.id] || item.fallbackImage;
                return (
                    <TouchableOpacity style={[styles.wideCard, { backgroundColor: item.color }]} activeOpacity={0.85} onPress={() => router.push({ pathname: '/category', params: { title: item.title } })}>
                        <Image source={{ uri: imageUri }} style={styles.languageImage} resizeMode="cover" />
                        <LinearGradient colors={[item.color, `${item.color}E6`, `${item.color}00`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.languageGradient} />
                        <View style={styles.languageTextContainer}>
                            <Text style={styles.languageMainText}>{item.title}</Text>
                            {item.subtitle ? <Text style={styles.languageSubText}>{item.subtitle}</Text> : null}
                        </View>
                    </TouchableOpacity>
                );
            }} />
        </View>
    );
});

export const GenreRow = React.memo(({ router, lists }) => {
    const genres = [
        { id: 'g1', title: 'Action', data: lists.actionList, tint: 'rgba(150, 50, 50, 0.4)' },
        { id: 'g2', title: 'Thriller', data: lists.thrillerList, tint: 'rgba(30, 30, 30, 0.5)' },
        { id: 'g3', title: 'Sci-Fi', data: lists.scifiList, tint: 'rgba(50, 50, 150, 0.4)' },
        { id: 'g4', title: 'Romance', data: lists.romanceList, tint: 'rgba(150, 50, 100, 0.4)' },
        { id: 'g5', title: 'Comedy', data: lists.comedyList, tint: 'rgba(150, 100, 50, 0.4)' },
        { id: 'g6', title: 'Horror', data: lists.horrorList, tint: 'rgba(60, 10, 10, 0.5)' },
    ];

    return (
        <View style={styles.rowContainer}>
            <Text style={styles.rowTitle}>Popular Genres</Text>
            <FlatList horizontal keyboardShouldPersistTaps="handled" data={genres} keyExtractor={(item) => item.id} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowListContent} renderItem={({ item }) => {
                const firstMovie = item.data?.[0];
                const imageUri = firstMovie ? getImageUrl(firstMovie.backdrop_path || firstMovie.poster_path) : 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=300&q=60';
                return (
                    <TouchableOpacity style={styles.wideCard} activeOpacity={0.85} onPress={() => router.push({ pathname: '/category', params: { title: item.title } })}>
                        <Image source={{ uri: imageUri }} style={styles.genreImage} resizeMode="cover" />
                        <View style={[styles.genreTintOverlay, { backgroundColor: item.tint }]} />
                        <Text style={styles.genreTitle}>{item.title}</Text>
                    </TouchableOpacity>
                );
            }} />
        </View>
    );
});

const styles = StyleSheet.create({
    rowContainer: { marginBottom: 28 },
    rowTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 14, letterSpacing: 0.2 },
    rowListContent: { paddingHorizontal: 16, gap: 10 },
    smallCard: { width: 112, height: 162, backgroundColor: '#1E1428', borderRadius: 8, overflow: 'hidden', position: 'relative' },
    smallCardImage: { width: '100%', height: '100%', position: 'absolute' },
    translucentRatingBadge: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
    smallCardRatingText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold', marginLeft: 3, marginTop: 1 },
    smallCardActions: { position: 'absolute', top: 6, right: 6, gap: 6 },
    smallIconBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' },
    wideCard: { width: 145, height: 75, borderRadius: 8, overflow: 'hidden', position: 'relative', justifyContent: 'center' },
    languageImage: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '70%' },
    languageGradient: { ...StyleSheet.absoluteFillObject },
    languageTextContainer: { paddingLeft: 14, justifyContent: 'center' },
    languageMainText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.2 },
    languageSubText: { color: '#A0A0A5', fontSize: 11, marginTop: 2 },
    genreImage: { position: 'absolute', width: '100%', height: '100%' },
    genreTintOverlay: { position: 'absolute', width: '100%', height: '100%' },
    genreTitle: { position: 'absolute', bottom: 10, left: 12, color: '#FFFFFF', fontSize: 15, fontWeight: 'bold', letterSpacing: 0.2, textShadowColor: 'rgba(0, 0, 0, 0.9)', textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 4 },
});