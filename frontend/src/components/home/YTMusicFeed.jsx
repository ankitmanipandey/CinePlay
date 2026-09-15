// src/components/home/YTMusicFeed.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, Keyboard, ActivityIndicator, Modal, Dimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReAnimated, { LinearTransition } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

import { useAuthStore } from '../../store/useAuthStore';
import { safeFetchJson, normalizeString, TOP_ARTISTS } from '../../utils/homehelpers.js'

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;
const { width } = Dimensions.get('window');

// --- MEMORY CACHE FOR INSTANT LOADING ON TAB SWITCH ---
let globalCachedSpeedDial = [];
let globalCachedQuickPicks = [];

const ArtistImage = ({ name, rawImage, style }) => {
    const [hasError, setHasError] = useState(false);
    useEffect(() => { setHasError(false); }, [rawImage]);

    let parsedUrl = null;
    if (typeof rawImage === 'string' && rawImage.startsWith('http')) parsedUrl = rawImage;
    else if (Array.isArray(rawImage) && rawImage.length > 0) parsedUrl = rawImage.find(i => i.quality === '500x500')?.url || rawImage[0]?.url;

    const encodedName = encodeURIComponent(name || 'Artist');
    const fallbackUrl = `https://ui-avatars.com/api/?name=${encodedName}&background=2A2A30&color=00E5FF&size=200&bold=true&font-size=0.4`;

    return <Image source={{ uri: (hasError || !parsedUrl) ? fallbackUrl : parsedUrl }} style={style} onError={() => setHasError(true)} />;
};

export const YTMusicFeed = ({ onPlayMusic, activeTrackId }) => {
    const { token } = useAuthStore();
    const insets = useSafeAreaInsets();

    const [selectedArtists, setSelectedArtists] = useState([]);
    const [customArtistMap, setCustomArtistMap] = useState({});
    const buildRequestId = useRef(0);
    const [isFeedShuffled, setIsFeedShuffled] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const loadSavedArtists = async () => {
            if (!token) return;
            try {
                const res = await fetch(`${BACKEND_URL}/user/lists`, { headers: { Authorization: `Bearer ${token}` } });
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted && data.favoriteArtists && data.favoriteArtists.length > 0) setSelectedArtists(data.favoriteArtists);
                }
            } catch (error) { console.log("Failed to load saved artists", error); }
        };
        loadSavedArtists();
        return () => { isMounted = false; };
    }, [token]);

    const [speedDial, setSpeedDial] = useState(globalCachedSpeedDial);
    const [quickPicks, setQuickPicks] = useState(globalCachedQuickPicks);
    const [artistPlaylists, setArtistPlaylists] = useState([]);

    const [loading, setLoading] = useState(globalCachedSpeedDial.length === 0);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState({ songs: [], artists: [] });
    const [isSearching, setIsSearching] = useState(false);
    const [isListening, setIsListening] = useState(false);

    const [likedModalOpen, setLikedModalOpen] = useState(false);
    const [loadingLiked, setLoadingLiked] = useState(false);
    const [likedSongsList, setLikedSongsList] = useState([]);

    useSpeechRecognitionEvent('start', () => setIsListening(true));
    useSpeechRecognitionEvent('end', () => setIsListening(false));
    useSpeechRecognitionEvent('result', (e) => {
        if (e.results?.[0]?.transcript) { setSearchQuery(e.results[0].transcript); Keyboard.dismiss(); }
        if (e.isFinal) ExpoSpeechRecognitionModule.stop();
    });
    useSpeechRecognitionEvent('error', () => setIsListening(false));

    const toggleListening = async () => {
        if (isListening) return ExpoSpeechRecognitionModule.stop();
        const p = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (p.granted) {
            setSearchQuery('');
            ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
        }
    };

    const toggleArtistSelection = async (artistName) => {
        if (!artistName || typeof artistName !== 'string') return;
        let newSelected = [...selectedArtists.filter(Boolean)];
        if (newSelected.includes(artistName)) newSelected = newSelected.filter(a => a !== artistName);
        else newSelected.push(artistName);

        setSelectedArtists(newSelected);

        if (token) {
            try {
                fetch(`${BACKEND_URL}/user/artists/toggle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ artistName })
                });
            } catch (e) { console.error('DB Sync Error', e); }
        }
    };

    const handleSelectArtistFromSearch = (artist) => {
        const artistName = (artist?.title || artist?.name || '').trim();
        if (!artistName) return;
        const img = Array.isArray(artist.image) ? (artist.image.find(i => i.quality === '500x500')?.url || artist.image[0]?.url) : artist.image;
        if (img) setCustomArtistMap(prev => ({ ...prev, [artistName]: img }));
        toggleArtistSelection(artistName);
        setSearchQuery('');
        Keyboard.dismiss();
    };

    const fetchLikedSongs = async () => {
        if (!token) return Toast.show({ type: 'hotstarInfo', text1: 'Log in for personalization', position: 'top', topOffset: insets.top > 0 ? insets.top + 10 : 50 });
        setLoadingLiked(true);
        setLikedModalOpen(true);
        try {
            const res = await fetch(`${BACKEND_URL}/user/music/liked`, { headers: { Authorization: `Bearer ${token}` } });
            const json = await res.json();
            if (res.ok && json.data) setLikedSongsList(json.data);
            else throw new Error(json.error || 'Failed to fetch data');
        } catch (e) {
            Toast.show({ type: 'error', text1: 'Failed to load liked songs' });
        } finally {
            setLoadingLiked(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        const myRequestId = ++buildRequestId.current;

        const buildFeed = async () => {
            if (selectedArtists.length === 0 && globalCachedSpeedDial.length > 0) {
                if (isMounted) setLoading(false);
                return;
            }

            setLoading(true);
            try {
                if (selectedArtists.length === 0) {
                    const queries = ['Trending Bollywood', 'Global Top 50'];
                    const promises = queries.map(q => safeFetchJson(`/search/songs?query=${encodeURIComponent(q)}&limit=15`));
                    const results = await Promise.all(promises);

                    let allSongs = [];
                    results.forEach(res => { if (res && res.success && res.data?.results) allSongs.push(...res.data.results); });
                    allSongs = allSongs.sort(() => 0.5 - Math.random());

                    const seenNames = new Set();
                    const uniqueSongs = [];
                    for (const item of allSongs) {
                        const normName = normalizeString(item.name || item.title);
                        if (!seenNames.has(normName) && item.image && item.downloadUrl) {
                            seenNames.add(normName);
                            uniqueSongs.push(item);
                        }
                    }

                    if (isMounted && myRequestId === buildRequestId.current) {
                        globalCachedSpeedDial = uniqueSongs.slice(0, 12);
                        globalCachedQuickPicks = uniqueSongs.slice(12, 24);
                        setSpeedDial(globalCachedSpeedDial);
                        setQuickPicks(globalCachedQuickPicks);
                        setArtistPlaylists([]);
                    }
                } else {
                    const validArtists = [...selectedArtists].filter(a => a && typeof a === 'string').reverse();
                    const promises = validArtists.map(async artist => {
                        const res = await safeFetchJson(`/search/songs?query=${encodeURIComponent(artist + " hindi")}&limit=50`);
                        return { artist, songs: res && res.success && res.data?.results ? res.data.results : [] };
                    });

                    const results = await Promise.all(promises);
                    const newArtistPlaylists = results.map(result => {
                        if (!result || !result.artist) return { artist: '', songs: [] };
                        const seenNames = new Set();
                        const uniqueSongs = [];
                        const targetLower = String(result.artist).toLowerCase().trim();

                        for (const item of (result.songs || [])) {
                            const songName = item?.name || item?.title;
                            if (!songName || typeof songName !== 'string' || songName.trim() === '' || songName.toLowerCase().includes('undefined')) continue;

                            const lang = String(item.language || '').toLowerCase();
                            if (lang && lang !== 'hindi') continue;

                            const primaryArtists = (item.artists?.primary || []).map(a => a?.name ? String(a.name).toLowerCase() : '').filter(Boolean);
                            const subtitleLower = String(item.subtitle || '').toLowerCase();
                            const descLower = String(item.description || '').toLowerCase();
                            const artistStrLower = String(item.artist || '').toLowerCase();

                            const isGenuine = primaryArtists.some(n => n.includes(targetLower) || targetLower.includes(n)) || subtitleLower.includes(targetLower) || descLower.includes(targetLower) || artistStrLower.includes(targetLower);
                            const rawName = songName.toLowerCase();
                            const isVague = rawName.includes('karaoke') || rawName.includes('cover') || rawName.includes('instrumental') || rawName.includes('mashup');
                            const normName = normalizeString(songName);

                            if (isGenuine && !isVague && !seenNames.has(normName) && item.image && item.downloadUrl) {
                                seenNames.add(normName);
                                uniqueSongs.push(item);
                            }
                        }
                        return { artist: result.artist, songs: uniqueSongs.slice(0, 30) };
                    }).filter(playlist => playlist.songs.length > 0);

                    if (isMounted && myRequestId === buildRequestId.current) setArtistPlaylists(newArtistPlaylists);
                }
            } catch (e) {
                console.error(e)
            } finally {
                if (isMounted && myRequestId === buildRequestId.current) setLoading(false);
            }
        };
        buildFeed();
        return () => { isMounted = false; };
    }, [selectedArtists]);

    useEffect(() => {
        let isMounted = true;
        if (searchQuery.trim().length < 2) {
            setSearchResults({ songs: [], artists: [] });
            setIsSearching(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const [songsJson, artistsJson] = await Promise.all([
                    safeFetchJson(`/search/songs?query=${encodeURIComponent(searchQuery)}`),
                    safeFetchJson(`/search/artists?query=${encodeURIComponent(searchQuery)}`)
                ]);

                const validSongs = songsJson && songsJson.success ? songsJson.data.results.filter(s => s.image && s.image.length > 0) : [];
                const validArtists = artistsJson && artistsJson.success ? artistsJson.data.results.filter(a => {
                    const name = a?.title || a?.name;
                    return name && typeof name === 'string' && name.trim() !== '' && !name.toLowerCase().includes('undefined') && !name.toLowerCase().includes('null');
                }) : [];

                const seenNames = new Set();
                const uniqueValidSongs = validSongs.filter(s => {
                    const normName = normalizeString(s.name || s.title);
                    if (seenNames.has(normName)) return false;
                    seenNames.add(normName);
                    return true;
                });

                if (isMounted) setSearchResults({ songs: uniqueValidSongs, artists: validArtists });
            } catch (e) { console.error(e); }
            finally { if (isMounted) setIsSearching(false); }
        }, 500);

        return () => { isMounted = false; clearTimeout(timer); };
    }, [searchQuery]);

    const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));

    const handleSongClick = (track, queueContext = []) => {
        const imgUrl = Array.isArray(track.image) ? (track.image?.find?.(i => i.quality === '500x500')?.url || track.image?.[0]?.url) : track.image;
        const streamUrl = track.url || track.downloadUrl?.find?.(d => d.quality === '320kbps')?.url || track.downloadUrl?.[0]?.url;

        onPlayMusic({
            ...track,
            id: track.id,
            title: track.title || track.name,
            artist: track.artist || track.description || track.subtitle || track.artists?.primary?.map(a => a.name).join(', ') || 'Unknown',
            image: imgUrl,
            url: streamUrl,
        }, queueContext.length > 0 ? queueContext : [track]);
    };

    const customArtists = token ? selectedArtists
        .filter(name => !TOP_ARTISTS.some(ta => ta.name.toLowerCase() === name.toLowerCase()))
        .map(name => ({ id: `custom_${name}`, name, image: customArtistMap[name] || null })) : [];

    const displayTopArtists = [...customArtists, ...TOP_ARTISTS];

    const unifiedArtistQueue = useMemo(() => {
        const allSongs = artistPlaylists.flatMap(p => p.songs);
        return Array.from(new Map(allSongs.map(s => [s.id, s])).values());
    }, [artistPlaylists]);

    const shuffledFeedSongs = useMemo(() => {
        if (!isFeedShuffled) return [];
        const allSongs = artistPlaylists.flatMap(p => p.songs);
        const uniqueSongs = Array.from(new Map(allSongs.map(s => [s.id, s])).values());
        return uniqueSongs.sort(() => 0.5 - Math.random());
    }, [artistPlaylists, isFeedShuffled]);

    if (loading && speedDial.length === 0 && artistPlaylists.length === 0) {
        return <View style={{ alignItems: 'center', paddingTop: 60 }}><ActivityIndicator size="large" color="#FF007A" /></View>;
    }

    return (
        <ReAnimated.View layout={LinearTransition} style={{ flex: 1, paddingBottom: 40 }}>
            {/* YOUR ENTIRE EXISTING MODAL & RENDER LOGIC GOES HERE... */}
            <Modal visible={likedModalOpen} animationType="slide" transparent={false} onRequestClose={() => setLikedModalOpen(false)}>
                <View style={{ flex: 1, backgroundColor: '#0A0A0C' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: insets.top + 20, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: '#170D22' }}>
                        <TouchableOpacity onPress={() => setLikedModalOpen(false)} style={{ paddingRight: 20 }}>
                            <Ionicons name="arrow-back" size={28} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={{ color: '#FFF', fontSize: 22, fontWeight: 'bold' }}>Liked Songs</Text>
                    </View>
                    {loadingLiked ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="large" color="#FF007A" />
                        </View>
                    ) : likedSongsList.length === 0 ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="heart-dislike-outline" size={64} color="#8F98A0" style={{ marginBottom: 16 }} />
                            <Text style={{ color: '#E0E0E0', fontSize: 18, fontWeight: 'bold' }}>No Liked Songs Yet</Text>
                            <Text style={{ color: '#8F98A0', fontSize: 14, marginTop: 8 }}>Tap the heart on any playing song to save it here.</Text>
                        </View>
                    ) : (
                        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                            {likedSongsList.map((track) => {
                                const imgUrl = Array.isArray(track.image) ? (track.image?.find?.(i => i.quality === '500x500')?.url || track.image?.[0]?.url) : track.image;
                                const isActiveTrack = track.id === activeTrackId;
                                return (
                                    <TouchableOpacity key={track.id} style={[styles.ytListTile, { marginBottom: 16, paddingVertical: 4 }]} onPress={() => { handleSongClick(track, likedSongsList); setLikedModalOpen(false); }}>
                                        <Image source={{ uri: imgUrl }} style={styles.ytTileImgQuick} />
                                        <View style={{ flex: 1, justifyContent: 'center', paddingRight: 10 }}>
                                            <Text style={[styles.ytTileTitle, { fontSize: 16 }, isActiveTrack && { color: '#00E5FF' }]} numberOfLines={1}>{track.title || track.name}</Text>
                                            <Text style={[styles.ytTileSubtitle, { fontSize: 14 }]} numberOfLines={1}>{track.artist || track.subtitle}</Text>
                                        </View>
                                        {isActiveTrack && <Ionicons name="stats-chart" size={16} color="#00E5FF" />}
                                    </TouchableOpacity>
                                )
                            })}
                        </ScrollView>
                    )}
                </View>
            </Modal>

            <View style={[styles.musicSearchBox, isListening && styles.musicSearchBoxActive, { marginHorizontal: 16, marginBottom: 20 }]}>
                <Ionicons name="search" size={20} color="#00E5FF" style={styles.musicSearchIcon} />
                <TextInput style={styles.musicSearchInput} placeholder={isListening ? "Listening..." : "Search songs, artists..."} placeholderTextColor={isListening ? "#00E5FF" : "#8F98A0"} value={searchQuery} onChangeText={setSearchQuery} selectionColor="#00E5FF" autoCapitalize="none" />
                {searchQuery.length > 0 && !isListening ? (
                    <TouchableOpacity onPress={() => { setSearchQuery(''); Keyboard.dismiss(); }} style={styles.musicRightIcon}>
                        <Ionicons name="close-circle" size={18} color="#8F98A0" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={toggleListening} style={styles.musicRightIcon}>
                        {isListening ? <ActivityIndicator size="small" color="#00E5FF" /> : <Ionicons name="mic-outline" size={22} color="#FFFFFF" />}
                    </TouchableOpacity>
                )}
            </View>

            {searchQuery.trim().length === 0 && (
                <View style={{ paddingHorizontal: 16, marginBottom: 24, flexDirection: 'row' }}>
                    <TouchableOpacity style={styles.libraryChip} activeOpacity={0.8} onPress={fetchLikedSongs}>
                        <LinearGradient colors={['#FF007A', '#9B51E0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.libraryChipGradient}>
                            <Ionicons name="heart" size={16} color="#FFF" style={{ marginTop: 2 }} />
                        </LinearGradient>
                        <Text style={styles.libraryChipText}>Liked Songs</Text>
                    </TouchableOpacity>
                </View>
            )}

            {searchQuery.trim().length > 0 ? (
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}>
                    {isSearching ? (
                        <ActivityIndicator color="#00E5FF" style={{ marginTop: 30 }} />
                    ) : (
                        <>
                            {searchResults.artists.length > 0 && (
                                <View style={{ marginBottom: 24 }}>
                                    <Text style={[styles.ytSectionTitle, { paddingHorizontal: 0 }]}>Artists</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16, paddingTop: 10 }}>
                                        {searchResults.artists.map(artist => {
                                            const artistName = artist.title || artist.name;
                                            const isSelected = selectedArtists.includes(artistName);
                                            return (
                                                <TouchableOpacity key={artist.id} style={{ alignItems: 'center', width: 80, position: 'relative' }} onPress={() => handleSelectArtistFromSearch(artist)}>
                                                    <LinearGradient colors={isSelected ? ['#00E5FF', '#FF007A'] : ['#2A2A30', '#2A2A30']} style={styles.igStoryRing}>
                                                        <ArtistImage name={artistName} rawImage={artist.image} style={styles.igArtistImg} />
                                                    </LinearGradient>
                                                    <Text style={styles.igArtistName} numberOfLines={2}>{artistName}</Text>
                                                </TouchableOpacity>
                                            )
                                        })}
                                    </ScrollView>
                                </View>
                            )}
                            {searchResults.songs.length > 0 && (
                                <View>
                                    <Text style={[styles.ytSectionTitle, { paddingHorizontal: 0 }]}>Songs</Text>
                                    <View style={{ gap: 12, marginTop: 10 }}>
                                        {searchResults.songs.map(track => {
                                            const imgUrl = track.image?.find?.(i => i.quality === '500x500')?.url || track.image?.[0]?.url || track.image;
                                            const isActiveTrack = track.id === activeTrackId;
                                            return (
                                                <TouchableOpacity key={track.id} style={styles.ytListTile} onPress={() => handleSongClick(track, searchResults.songs)}>
                                                    <ArtistImage name={track.title || track.name} rawImage={imgUrl} style={styles.ytTileImgQuick} />
                                                    <View style={{ flex: 1, justifyContent: 'center', paddingRight: 10 }}>
                                                        <Text style={[styles.ytTileTitle, isActiveTrack && { color: '#00E5FF' }]} numberOfLines={1}>{track.title || track.name}</Text>
                                                        <Text style={styles.ytTileSubtitle} numberOfLines={1}>{track.description || track.subtitle || 'Song'}</Text>
                                                    </View>
                                                    {isActiveTrack && <Ionicons name="stats-chart" size={16} color="#00E5FF" />}
                                                </TouchableOpacity>
                                            )
                                        })}
                                    </View>
                                </View>
                            )}
                            {searchResults.artists.length === 0 && searchResults.songs.length === 0 && (
                                <Text style={{ color: '#8F98A0', textAlign: 'center', marginTop: 20 }}>No results found</Text>
                            )}
                        </>
                    )}
                </ScrollView >
            ) : (
                <>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
                        <Text style={[styles.ytSectionTitle, { paddingHorizontal: 0, marginBottom: 0 }]}>Top Artists</Text>
                        {selectedArtists.length > 0 && (
                            <TouchableOpacity onPress={() => setSelectedArtists([])}>
                                <Text style={{ color: '#FF007A', fontSize: 12, fontWeight: 'bold' }}>CLEAR ALL</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, gap: 16, marginBottom: 30 }}>
                        {displayTopArtists.map(artist => {
                            const isSelected = selectedArtists.includes(artist.name);
                            return (
                                <TouchableOpacity key={artist.id} style={{ alignItems: 'center', width: 80, position: 'relative' }} onPress={() => toggleArtistSelection(artist.name)}>
                                    <LinearGradient colors={isSelected ? ['#00E5FF', '#FF007A'] : ['#2A2A30', '#2A2A30']} style={styles.igStoryRing}>
                                        <ArtistImage name={artist.name} rawImage={artist.image} style={styles.igArtistImg} />
                                    </LinearGradient>
                                    <Text style={styles.igArtistName} numberOfLines={2}>{artist.name}</Text>
                                </TouchableOpacity>
                            )
                        })}
                    </ScrollView>

                    {selectedArtists.length > 0 ? (
                        <View>
                            {loading ? (
                                <View style={{ alignItems: 'center', paddingVertical: 40 }}><ActivityIndicator color="#00E5FF" /></View>
                            ) : (
                                <>
                                    {artistPlaylists.length > 0 && (
                                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, marginBottom: 16 }}>
                                            <TouchableOpacity onPress={() => setIsFeedShuffled(!isFeedShuffled)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isFeedShuffled ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255,255,255,0.05)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: isFeedShuffled ? '#00E5FF' : 'transparent' }}>
                                                <Ionicons name="shuffle" size={18} color={isFeedShuffled ? "#00E5FF" : "#FFFFFF"} style={{ marginRight: 6 }} />
                                                <Text style={{ color: isFeedShuffled ? "#00E5FF" : "#FFFFFF", fontSize: 13, fontWeight: 'bold' }}>SHUFFLE</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    {isFeedShuffled ? (
                                        <View style={{ paddingHorizontal: 16, gap: 16, marginBottom: 30 }}>
                                            {shuffledFeedSongs.map(track => {
                                                const imgUrl = track.image?.find?.(i => i.quality === '500x500')?.url || track.image?.[0]?.url || track.image;
                                                const isActiveTrack = track.id === activeTrackId;
                                                return (
                                                    <TouchableOpacity key={track.id} style={styles.ytListTile} onPress={() => handleSongClick(track, shuffledFeedSongs)}>
                                                        <ArtistImage name={track.title || track.name} rawImage={imgUrl} style={styles.ytTileImgQuick} />
                                                        <View style={{ flex: 1, justifyContent: 'center', paddingRight: 10 }}>
                                                            <Text style={[styles.ytTileTitle, { fontSize: 16 }, isActiveTrack && { color: '#00E5FF' }]} numberOfLines={1}>{track.title || track.name}</Text>
                                                            <Text style={[styles.ytTileSubtitle, { fontSize: 14 }]} numberOfLines={1}>{track.artists?.primary?.map(a => a.name).join(', ') || track.subtitle}</Text>
                                                        </View>
                                                        {isActiveTrack && <Ionicons name="stats-chart" size={16} color="#00E5FF" />}
                                                    </TouchableOpacity>
                                                )
                                            })}
                                        </View>
                                    ) : (
                                        artistPlaylists.map((playlist, pIdx) => (
                                            <View key={pIdx} style={{ marginBottom: 30 }}>
                                                <Text style={[styles.ytSectionTitle, { paddingHorizontal: 16, fontSize: 20, marginBottom: 12 }]}>{playlist.artist}</Text>
                                                <View style={{ paddingHorizontal: 16, gap: 16 }}>
                                                    {playlist.songs.map(track => {
                                                        const imgUrl = track.image?.find?.(i => i.quality === '500x500')?.url || track.image?.[0]?.url || track.image;
                                                        const isActiveTrack = track.id === activeTrackId;
                                                        return (
                                                            <TouchableOpacity key={track.id} style={styles.ytListTile} onPress={() => handleSongClick(track, unifiedArtistQueue)}>
                                                                <ArtistImage name={track.title || track.name} rawImage={imgUrl} style={styles.ytTileImgQuick} />
                                                                <View style={{ flex: 1, justifyContent: 'center', paddingRight: 10 }}>
                                                                    <Text style={[styles.ytTileTitle, { fontSize: 16 }, isActiveTrack && { color: '#00E5FF' }]} numberOfLines={1}>{track.title || track.name}</Text>
                                                                    <Text style={[styles.ytTileSubtitle, { fontSize: 14 }]} numberOfLines={1}>{track.artists?.primary?.map(a => a.name).join(', ') || track.subtitle || playlist.artist}</Text>
                                                                </View>
                                                                {isActiveTrack && <Ionicons name="stats-chart" size={16} color="#00E5FF" />}
                                                            </TouchableOpacity>
                                                        )
                                                    })}
                                                </View>
                                            </View>
                                        ))
                                    )}
                                </>
                            )}
                        </View>
                    ) : (
                        <>
                            {loading && speedDial.length === 0 ? (
                                <View style={{ alignItems: 'center', paddingVertical: 20 }}><ActivityIndicator color="#00E5FF" /></View>
                            ) : (
                                <>
                                    <Text style={[styles.ytSectionTitle, { paddingHorizontal: 16 }]}>Speed dial</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" snapToInterval={width * 0.85} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: 16, gap: 16, marginBottom: 30 }}>
                                        {chunkArray(speedDial, 4).map((col, colIdx) => (
                                            <View key={colIdx} style={{ width: width * 0.85, gap: 12 }}>
                                                {col.map(track => {
                                                    const imgUrl = track.image?.find(i => i.quality === '500x500')?.url || track.image?.[0]?.url;
                                                    const isActiveTrack = track.id === activeTrackId;
                                                    return (
                                                        <TouchableOpacity key={track.id} style={styles.ytListTile} onPress={() => handleSongClick(track, speedDial)}>
                                                            <Image source={{ uri: imgUrl }} style={styles.ytTileImg} />
                                                            <View style={{ flex: 1, justifyContent: 'center', paddingRight: 10 }}>
                                                                <Text style={[styles.ytTileTitle, isActiveTrack && { color: '#00E5FF' }]} numberOfLines={1}>{track.name || track.title}</Text>
                                                                <Text style={styles.ytTileSubtitle} numberOfLines={1}>{track.artists?.primary?.map(a => a.name).join(', ') || track.subtitle}</Text>
                                                            </View>
                                                            {isActiveTrack && <Ionicons name="stats-chart" size={16} color="#00E5FF" />}
                                                        </TouchableOpacity>
                                                    )
                                                })}
                                            </View>
                                        ))}
                                    </ScrollView>

                                    <Text style={[styles.ytSectionTitle, { paddingHorizontal: 16 }]}>Quick picks</Text>
                                    <Text style={styles.ytSectionSubtitle}>START RADIO FROM A SONG</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" snapToInterval={width * 0.85} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
                                        {chunkArray(quickPicks, 4).map((col, colIdx) => (
                                            <View key={colIdx} style={{ width: width * 0.85, gap: 12 }}>
                                                {col.map(track => {
                                                    const imgUrl = track.image?.find(i => i.quality === '500x500')?.url || track.image?.[0]?.url;
                                                    const isActiveTrack = track.id === activeTrackId;
                                                    return (
                                                        <TouchableOpacity key={track.id} style={styles.ytListTile} onPress={() => handleSongClick(track, quickPicks)}>
                                                            <Image source={{ uri: imgUrl }} style={styles.ytTileImgQuick} />
                                                            <View style={{ flex: 1, justifyContent: 'center', paddingRight: 10 }}>
                                                                <Text style={[styles.ytTileTitle, isActiveTrack && { color: '#00E5FF' }]} numberOfLines={1}>{track.name || track.title}</Text>
                                                                <Text style={styles.ytTileSubtitle} numberOfLines={1}>{track.artists?.primary?.map(a => a.name).join(', ') || track.subtitle}</Text>
                                                            </View>
                                                            {isActiveTrack && <Ionicons name="stats-chart" size={16} color="#00E5FF" />}
                                                        </TouchableOpacity>
                                                    )
                                                })}
                                            </View>
                                        ))}
                                    </ScrollView>
                                </>
                            )}
                        </>
                    )}
                </>
            )}
        </ReAnimated.View >
    );
};

// Copy the relevant styles from your HomeScreen file over to here
const styles = StyleSheet.create({
    musicSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#25252A', borderRadius: 24, height: 52, paddingHorizontal: 16, borderWidth: 1, borderColor: 'transparent' },
    musicSearchBoxActive: { borderColor: '#00E5FF', backgroundColor: '#1C2533' },
    musicSearchIcon: { marginRight: 10 },
    musicSearchInput: { flex: 1, color: '#FFFFFF', fontSize: 16, height: '100%' },
    musicRightIcon: { paddingLeft: 10, height: 40, justifyContent: 'center' },
    libraryChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1428', paddingRight: 16, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', alignSelf: 'flex-start' },
    libraryChipGradient: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    libraryChipText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
    igStoryRing: { width: 76, height: 76, borderRadius: 38, padding: 3, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    igArtistImg: { width: '100%', height: '100%', borderRadius: 38, borderWidth: 2, borderColor: '#0A0A0C' },
    igArtistName: { color: '#FFF', fontSize: 12, marginTop: 6, textAlign: 'center', fontWeight: '500' },
    ytSectionTitle: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 2 },
    ytSectionSubtitle: { color: '#8F98A0', fontSize: 11, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 16, letterSpacing: 0.5 },
    ytListTile: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 4 },
    ytTileImg: { width: 48, height: 48, borderRadius: 6, backgroundColor: '#2A2A30' },
    ytTileImgQuick: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#2A2A30' },
    ytTileTitle: { color: '#FFF', fontSize: 16, fontWeight: '600', marginBottom: 3 },
    ytTileSubtitle: { color: '#A0A0A5', fontSize: 13 }
});