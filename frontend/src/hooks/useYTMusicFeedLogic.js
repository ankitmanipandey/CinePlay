import { useState, useEffect, useRef, useMemo } from 'react';
import { Keyboard, Dimensions } from 'react-native';
import Toast from 'react-native-toast-message';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '../store/useAuthStore';
import { safeFetchJson, normalizeString, TOP_ARTISTS } from '../utils/homehelpers';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

// --- MEMORY CACHE FOR INSTANT LOADING ON TAB SWITCH ---
let globalCachedSpeedDial = [];
let globalCachedQuickPicks = [];

export const useYTMusicFeedLogic = ({ onPlayMusic, activeTrackId }) => {
    const { token } = useAuthStore();
    const insets = useSafeAreaInsets();

    const [selectedArtists, setSelectedArtists] = useState([]);
    const [customArtistMap, setCustomArtistMap] = useState({});
    const buildRequestId = useRef(0);
    const [isFeedShuffled, setIsFeedShuffled] = useState(false);

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

    // --- SPEECH RECOGNITION ---
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

    // --- LOAD USER ARTISTS ---
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

    // --- ARTIST SELECTION ---
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

    // --- FETCH LIKED SONGS ---
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

    // --- BUILD MAIN FEED ---
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

    // --- SEARCH BAR TYPING ---
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

    // --- UTILS & COMPUTED ---
    const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));

    const handleSongClick = (track, queueContext = []) => {
        const contextToUse = queueContext.length > 0 ? queueContext : [track];
        const trackInQueue = contextToUse.find(t => String(t.id) === String(track.id));
        if (!trackInQueue) contextToUse.unshift(track);
        onPlayMusic(contextToUse, track.id);
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

    return {
        insets, width: Dimensions.get('window').width,
        selectedArtists, setSelectedArtists, isFeedShuffled, setIsFeedShuffled,
        speedDial, quickPicks, artistPlaylists, loading,
        searchQuery, setSearchQuery, searchResults, isSearching, isListening,
        likedModalOpen, setLikedModalOpen, loadingLiked, likedSongsList,
        toggleListening, toggleArtistSelection, handleSelectArtistFromSearch,
        fetchLikedSongs, chunkArray, handleSongClick,
        displayTopArtists, unifiedArtistQueue, shuffledFeedSongs
    };
};