import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    StatusBar,
    TouchableOpacity,
    Image,
    Dimensions,
    Animated,
    PanResponder,
    ScrollView,
    FlatList,
    Easing,
    ActivityIndicator,
    Platform,
    UIManager,
    TextInput,
    Modal,
    Keyboard
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import ReAnimated, {
    FadeIn, FadeOut, LinearTransition, FadeInDown, FadeInUp, FadeOutUp,
    useSharedValue, useAnimatedStyle, withSpring, runOnJS
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Circle, Path } from 'react-native-svg';
import { toastConfig } from '../app/_layout'

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';

import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useVideoPlayer, VideoView } from 'expo-video';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- Global Stores ---
import { useMovieStore } from '../store/useMovieStore';
import { useUserListStore } from '../store/useUserListStore';
import { useAuthStore } from '../store/useAuthStore';
import { useSportsStore } from '../store/useSportsStore';
import { useTvStore } from '../store/useTvStore';
import { getImageUrl } from '../constants/config';
import { tmdbService } from '../services/tmdbService';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = 60;
const SWIPE_VELOCITY = 1.0;

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

const normalizeString = (str) => {
    if (!str) return '';
    return str.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();
};

// --- MULTI-API FAST PARALLEL RACING ENGINE ---
const safeFetchJson = (endpoint, options = {}) => {
    const primaryBase = 'https://jiosaavn-api-47fm.onrender.com/api';
    const fallbackBase = 'https://saavn.sumit.co/api';

    const fetchApi = async (baseUrl) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 6000); // 6s max timeout
        const res = await fetch(`${baseUrl}${endpoint}`, { ...options, signal: controller.signal });
        clearTimeout(id);
        if (!res.ok) throw new Error('Not ok');
        return JSON.parse(await res.text());
    };

    return new Promise((resolve) => {
        let failedCount = 0;

        const handleSuccess = (data) => {
            if (data && data.success) resolve(data);
            else handleError();
        };

        const handleError = () => {
            failedCount++;
            if (failedCount === 2) resolve({ success: false, data: { results: [] } }); // Both failed
        };

        fetchApi(primaryBase).then(handleSuccess).catch(handleError);
        fetchApi(fallbackBase).then(handleSuccess).catch(handleError);
    });
};

const MOCK_LANGUAGES = [
    { id: 'l1', title: 'Hindi', code: 'hi', subtitle: 'हिन्दी', fallbackImage: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&q=60', color: '#323246' },
    { id: 'l2', title: 'English', code: 'en', subtitle: 'Hollywood', fallbackImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=60', color: '#5A3732' },
    { id: 'l3', title: 'Tamil', code: 'ta', subtitle: 'தமிழ்', fallbackImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&q=60', color: '#4A3428' },
    { id: 'l4', title: 'Telugu', code: 'te', subtitle: 'తెలుగు', fallbackImage: 'https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?w=300&q=60', color: '#2C3E50' },
    { id: 'l5', title: 'Punjabi', code: 'pa', subtitle: 'ਪੰਜਾਬੀ', fallbackImage: 'https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?w=300&q=60', color: '#4A4A28' },
    { id: 'l6', title: 'Malayalam', code: 'ml', subtitle: 'മലയാളം', fallbackImage: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=300&q=60', color: '#284A3B' },
];

const TOP_ARTISTS = [
    { id: 'a1', name: 'Arijit Singh', image: 'https://c.saavncdn.com/artists/Arijit_Singh_500x500.jpg' },
    { id: 'a2', name: 'Shreya Ghoshal', image: 'https://c.saavncdn.com/artists/Shreya_Ghoshal_500x500.jpg' },
    { id: 'a3', name: 'KK', image: 'https://c.saavncdn.com/artists/KK_500x500.jpg' },
    { id: 'a4', name: 'Sonu Nigam', image: 'https://c.saavncdn.com/artists/Sonu_Nigam_500x500.jpg' },
    { id: 'a5', name: 'Armaan Malik', image: 'https://c.saavncdn.com/artists/Armaan_Malik_500x500.jpg' },
    { id: 'a6', name: 'Udit Narayan', image: 'https://c.saavncdn.com/artists/Udit_Narayan_500x500.jpg' },
    { id: 'a7', name: 'Kumar Sanu', image: 'https://c.saavncdn.com/artists/Kumar_Sanu_500x500.jpg' },
    { id: 'a8', name: 'Alka Yagnik', image: 'https://c.saavncdn.com/artists/Alka_Yagnik_500x500.jpg' },
    { id: 'a9', name: 'Abhijeet Bhattacharya', image: 'https://i.scdn.co/image/ab6761610000e5eb0300a78ed8fc1b9cc0f39384' },
    { id: 'a10', name: 'Shankar Mahadevan', image: 'https://c.saavncdn.com/artists/Shankar_Mahadevan_500x500.jpg' },
    { id: 'a11', name: 'Javed Ali', image: 'https://c.saavncdn.com/artists/Javed_Ali_500x500.jpg' },
    { id: 'a12', name: 'Mohit Chauhan', image: 'https://c.saavncdn.com/artists/Mohit_Chauhan_500x500.jpg' },
    { id: 'a13', name: 'Jubin Nautiyal', image: 'https://i.scdn.co/image/ab6761610000e5eb56eecf73fcdd401eb124af0d' },
    { id: 'a14', name: 'Atif Aslam', image: 'https://c.saavncdn.com/artists/Atif_Aslam_500x500.jpg' },
    { id: 'a15', name: 'Rahat Fateh Ali Khan', image: 'https://c.saavncdn.com/artists/Rahat_Fateh_Ali_Khan_500x500.jpg' },
    { id: 'a16', name: 'Nusrat Fateh Ali Khan', image: 'https://c.saavncdn.com/artists/Nusrat_Fateh_Ali_Khan_500x500.jpg' },
    { id: 'a17', name: 'Kishore Kumar', image: 'https://c.saavncdn.com/artists/Kishore_Kumar_500x500.jpg' },
    { id: 'a18', name: 'Mohammad Rafi', image: 'https://c.saavncdn.com/artists/Mohammed_Rafi_500x500.jpg' },
    { id: 'a19', name: 'Lata Mangeshkar', image: 'https://c.saavncdn.com/artists/Lata_Mangeshkar_500x500.jpg' },
    { id: 'a20', name: 'Asha Bhosle', image: 'https://c.saavncdn.com/artists/Asha_Bhosle_500x500.jpg' },
    { id: 'a21', name: 'Yo Yo Honey Singh', image: 'https://c.saavncdn.com/artists/Yo_Yo_Honey_Singh_500x500.jpg' },
    { id: 'a22', name: 'Badshah', image: 'https://c.saavncdn.com/artists/Badshah_500x500.jpg' },
    { id: 'a23', name: 'Karan Aujla', image: 'https://i.scdn.co/image/ab6761610000e5eb1eabffcd8cc5951d8b2d7119' },
    { id: 'a24', name: 'Diljit Dosanjh', image: 'https://i.scdn.co/image/ab6761610000e5ebb5b8f60183b0f581cd11ba90' },
    { id: 'a25', name: 'Guru Randhawa', image: 'https://c.saavncdn.com/artists/Guru_Randhawa_500x500.jpg' },
    { id: 'a26', name: 'Jass Manak', image: 'https://i.scdn.co/image/ab6761610000e5ebdd2720d297b864a275b9f939' },
    { id: 'a27', name: 'Shafqat Amanat Ali', image: 'https://c.saavncdn.com/artists/Shafqat_Amanat_Ali_500x500.jpg' },
    { id: 'a28', name: 'Pritam', image: 'https://i.scdn.co/image/ab6761610000e5ebcb6926f44f620555ba444fcd' },
    { id: 'a29', name: 'Emraan Hashmi', image: 'https://c.saavncdn.com/artists/Emraan_Hashmi_500x500.jpg' },
    { id: 'a30', name: 'Himesh Reshammiya', image: 'https://c.saavncdn.com/artists/Himesh_Reshammiya_500x500.jpg' },
    { id: 'a31', name: 'Sunidhi Chauhan', image: 'https://c.saavncdn.com/artists/Sunidhi_Chauhan_500x500.jpg' },
];

const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// --- MEMORY CACHE FOR INSTANT LOADING ON TAB SWITCH ---
let globalCachedSpeedDial = [];
let globalCachedQuickPicks = [];

const ArtistImage = ({ name, rawImage, style }) => {
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setHasError(false);
    }, [rawImage]);

    let parsedUrl = null;
    if (typeof rawImage === 'string' && rawImage.startsWith('http')) {
        parsedUrl = rawImage;
    } else if (Array.isArray(rawImage) && rawImage.length > 0) {
        parsedUrl = rawImage.find(i => i.quality === '500x500')?.url || rawImage[0]?.url;
    }

    const encodedName = encodeURIComponent(name || 'Artist');
    const fallbackUrl = `https://ui-avatars.com/api/?name=${encodedName}&background=2A2A30&color=00E5FF&size=200&bold=true&font-size=0.4`;

    return (
        <Image
            source={{ uri: (hasError || !parsedUrl) ? fallbackUrl : parsedUrl }}
            style={style}
            onError={() => setHasError(true)}
        />
    );
};

// ==========================================
// 🎵 FIXED MINI PLAYER COMPONENT (RNGH)
// ==========================================
const MiniPlayer = ({
    currentTrack,
    isMusicPlaying,
    musicProgress,
    musicDuration,
    isShuffle,
    setIsShuffle,
    loopMode,
    setLoopMode,
    onTogglePlay,
    handleNextTrack,
    handlePrevTrack,
    onOpenModal,
    onDismiss,
    bottomOffset,
}) => {

    const panGesture = Gesture.Pan()
        .activeOffsetX([-10, 10])
        .activeOffsetY([-15, 15])
        // REMOVED .onUpdate so it stops physically moving
        .onEnd((e) => {
            const { translationX: dx, translationY: dy, velocityX: vx, velocityY: vy } = e;

            if (dx > 50 || vx > 800) {
                runOnJS(handlePrevTrack)();
            } else if (dx < -50 || vx < -800) {
                runOnJS(handleNextTrack)();
            } else if (dy < -40 || vy < -800) {
                runOnJS(onOpenModal)();
            } else if (dy > 40 || vy > 800) {
                runOnJS(onDismiss)();
            }
        });

    const doubleTap = Gesture.Tap().numberOfTaps(2).maxDuration(250);
    const singleTap = Gesture.Tap().numberOfTaps(1).maxDuration(250);

    const doubleTapAction = doubleTap.onEnd((_, success) => {
        if (success) runOnJS(onTogglePlay)();
    });
    const singleTapAction = singleTap.onEnd((_, success) => {
        if (success) runOnJS(onOpenModal)();
    });

    const tapGesture = Gesture.Exclusive(doubleTapAction, singleTapAction);

    if (!currentTrack) return null;

    return (
        <GestureDetector gesture={panGesture}>
            <ReAnimated.View
                entering={FadeInUp}
                // REMOVED animatedStyle so it stays completely fixed
                style={[styles.miniPlayerContainer, { bottom: bottomOffset }]}
            >
                <View style={styles.miniPlayerContent}>
                    <GestureDetector gesture={tapGesture}>
                        <ReAnimated.View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Image source={{ uri: currentTrack.image }} style={styles.miniPlayerArt} />
                            <View style={styles.miniPlayerTextWrap}>
                                <Text style={styles.miniPlayerTitle} numberOfLines={1}>{currentTrack.title}</Text>
                                <Text style={styles.miniPlayerArtist} numberOfLines={1}>{currentTrack.artist}</Text>
                            </View>
                        </ReAnimated.View>
                    </GestureDetector>

                    {/* Controls strictly independent from gestures */}
                    <View style={styles.miniPlayerControls}>
                        <TouchableOpacity onPress={() => setIsShuffle(!isShuffle)} style={styles.miniPlayerBtn} hitSlop={8}>
                            <Ionicons name="shuffle" size={20} color={isShuffle ? "#00E5FF" : "#8F98A0"} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onTogglePlay} style={styles.miniPlayerBtn} hitSlop={8}>
                            <Ionicons name={isMusicPlaying ? "pause" : "play"} size={26} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleNextTrack} style={styles.miniPlayerBtn} hitSlop={8}>
                            <Ionicons name="play-skip-forward" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setLoopMode((prev) => (prev + 1) % 3)} style={[styles.miniPlayerBtn, { position: 'relative' }]} hitSlop={8}>
                            <Ionicons name="repeat" size={20} color={loopMode !== 0 ? "#00E5FF" : "#8F98A0"} />
                            {loopMode === 2 && (
                                <Text style={{ position: 'absolute', fontSize: 8, color: '#00E5FF', top: 4, right: 2, fontWeight: 'bold' }}>1</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={styles.miniProgressBarBg}>
                    <View style={[styles.miniProgressBarFill, { width: `${(musicProgress / (musicDuration || 1)) * 100}%` }]} />
                </View>
            </ReAnimated.View>
        </GestureDetector>
    );
};


// --- 1. YOUTUBE MUSIC CLONE FEED ---
const YTMusicFeed = ({ onPlayMusic, activeTrackId }) => {
    const { token } = useAuthStore();
    const insets = useSafeAreaInsets();

    const [selectedArtists, setSelectedArtists] = useState([]);
    const [customArtistMap, setCustomArtistMap] = useState({});
    const buildRequestId = useRef(0);

    useEffect(() => {
        let isMounted = true;
        const loadSavedArtists = async () => {
            if (!token) return;
            try {
                const res = await fetch(`${BACKEND_URL}/user/lists`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted && data.favoriteArtists && data.favoriteArtists.length > 0) {
                        setSelectedArtists(data.favoriteArtists);
                    }
                }
            } catch (error) {
                console.log("Failed to load saved artists", error);
            }
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
        if (e.results?.[0]?.transcript) {
            setSearchQuery(e.results[0].transcript);
            Keyboard.dismiss();
        }
        if (e.isFinal) ExpoSpeechRecognitionModule.stop();
    });
    useSpeechRecognitionEvent('error', () => setIsListening(false));

    const toggleListening = async () => {
        if (isListening) {
            ExpoSpeechRecognitionModule.stop();
            return;
        }
        const p = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (p.granted) {
            setSearchQuery('');
            ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
        }
    };

    const toggleArtistSelection = async (artistName) => {
        if (!artistName || typeof artistName !== 'string') return;

        let newSelected = [...selectedArtists.filter(Boolean)];
        const isCurrentlySelected = newSelected.includes(artistName);

        if (isCurrentlySelected) {
            newSelected = newSelected.filter(a => a !== artistName);
        } else {
            newSelected.push(artistName);
        }
        setSelectedArtists(newSelected);

        if (token) {
            try {
                fetch(`${BACKEND_URL}/user/artists/toggle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ artistName })
                });
            } catch (e) {
                console.error('DB Sync Error', e);
            }
        }
    };

    const handleSelectArtistFromSearch = (artist) => {
        const artistName = (artist?.title || artist?.name || '').trim();
        if (!artistName) return;

        const img = Array.isArray(artist.image)
            ? (artist.image.find(i => i.quality === '500x500')?.url || artist.image[0]?.url)
            : artist.image;

        if (img) {
            setCustomArtistMap(prev => ({ ...prev, [artistName]: img }));
        }

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

            if (res.ok && json.data) {
                setLikedSongsList(json.data);
            } else {
                throw new Error(json.error || 'Failed to fetch data');
            }
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
                    results.forEach(res => {
                        if (res && res.success && res.data?.results) allSongs.push(...res.data.results);
                    });

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
                    const validArtists = selectedArtists.filter(a => a && typeof a === 'string');

                    const promises = validArtists.map(async artist => {
                        const res = await safeFetchJson(`/search/songs?query=${encodeURIComponent(artist + " hindi")}&limit=50`);
                        return {
                            artist,
                            songs: res && res.success && res.data?.results ? res.data.results : []
                        };
                    });

                    const results = await Promise.all(promises);

                    const newArtistPlaylists = results.map(result => {
                        if (!result || !result.artist) return { artist: '', songs: [] };

                        const seenNames = new Set();
                        const uniqueSongs = [];
                        const targetLower = String(result.artist).toLowerCase().trim();

                        for (const item of (result.songs || [])) {
                            const songName = item?.name || item?.title;
                            if (!songName || typeof songName !== 'string' || songName.trim() === '' || songName.toLowerCase().includes('undefined')) {
                                continue;
                            }

                            const lang = String(item.language || '').toLowerCase();
                            if (lang && lang !== 'hindi') {
                                continue;
                            }

                            const primaryArtists = (item.artists?.primary || [])
                                .map(a => a?.name ? String(a.name).toLowerCase() : '')
                                .filter(Boolean);
                            const subtitleLower = String(item.subtitle || '').toLowerCase();
                            const descLower = String(item.description || '').toLowerCase();
                            const artistStrLower = String(item.artist || '').toLowerCase();

                            const isGenuine = primaryArtists.some(n => n.includes(targetLower) || targetLower.includes(n))
                                || subtitleLower.includes(targetLower)
                                || descLower.includes(targetLower)
                                || artistStrLower.includes(targetLower);

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

                    if (isMounted && myRequestId === buildRequestId.current) {
                        setArtistPlaylists(newArtistPlaylists);
                    }
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

                const validArtists = artistsJson && artistsJson.success
                    ? artistsJson.data.results.filter(a => {
                        const name = a?.title || a?.name;
                        return name && typeof name === 'string' && name.trim() !== '' && !name.toLowerCase().includes('undefined') && !name.toLowerCase().includes('null');
                    })
                    : [];

                const seenNames = new Set();
                const uniqueValidSongs = validSongs.filter(s => {
                    const normName = normalizeString(s.name || s.title);
                    if (seenNames.has(normName)) return false;
                    seenNames.add(normName);
                    return true;
                });

                if (isMounted) setSearchResults({ songs: uniqueValidSongs, artists: validArtists });
            } catch (e) {
                console.error(e);
            } finally {
                if (isMounted) setIsSearching(false);
            }
        }, 500);

        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
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
        .map(name => ({
            id: `custom_${name}`,
            name,
            image: customArtistMap[name] || null
        })) : [];

    const displayTopArtists = [...TOP_ARTISTS, ...customArtists];

    const unifiedArtistQueue = useMemo(() => {
        const allSongs = artistPlaylists.flatMap(p => p.songs);
        return Array.from(new Map(allSongs.map(s => [s.id, s])).values());
    }, [artistPlaylists]);

    if (loading && speedDial.length === 0 && artistPlaylists.length === 0) {
        return <View style={{ alignItems: 'center', paddingTop: 60 }}><ActivityIndicator size="large" color="#FF007A" /></View>;
    }

    return (
        <ReAnimated.View layout={LinearTransition} style={{ flex: 1, paddingBottom: 40 }}>
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
                                    <TouchableOpacity
                                        key={track.id}
                                        style={[styles.ytListTile, { marginBottom: 16, paddingVertical: 4 }]}
                                        onPress={() => { handleSongClick(track, likedSongsList); setLikedModalOpen(false); }}
                                    >
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
                <TextInput
                    style={styles.musicSearchInput}
                    placeholder={isListening ? "Listening..." : "Search songs, artists..."}
                    placeholderTextColor={isListening ? "#00E5FF" : "#8F98A0"}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    selectionColor="#00E5FF"
                    autoCapitalize="none"
                />
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
                    <TouchableOpacity
                        style={styles.libraryChip}
                        activeOpacity={0.8}
                        onPress={fetchLikedSongs}
                    >
                        <LinearGradient colors={['#FF007A', '#9B51E0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.libraryChipGradient}>
                            <Ionicons name="heart" size={16} color="#FFF" style={{ marginTop: 2 }} />
                        </LinearGradient>
                        <Text style={styles.libraryChipText}>Liked Songs</Text>
                    </TouchableOpacity>
                </View>
            )}

            {searchQuery.trim().length > 0 ? (
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}>
                    {
                        isSearching ? (
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
                                                    <TouchableOpacity
                                                        key={artist.id}
                                                        style={{ alignItems: 'center', width: 80, position: 'relative' }}
                                                        onPress={() => handleSelectArtistFromSearch(artist)}
                                                    >
                                                        <LinearGradient colors={isSelected ? ['#00E5FF', '#FF007A'] : ['#2A2A30', '#2A2A30']} style={styles.igStoryRing}>
                                                            <ArtistImage name={artistName} rawImage={artist.image} style={styles.igArtistImg} />
                                                        </LinearGradient>
                                                        {isSelected && (
                                                            <View style={styles.artistSelectedBadge}>
                                                                <Ionicons name="heart" size={12} color="#FFFFFF" />
                                                            </View>
                                                        )}
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
                                <TouchableOpacity
                                    key={artist.id}
                                    style={{ alignItems: 'center', width: 80, position: 'relative' }}
                                    onPress={() => toggleArtistSelection(artist.name)}
                                >
                                    <LinearGradient colors={isSelected ? ['#00E5FF', '#FF007A'] : ['#2A2A30', '#2A2A30']} style={styles.igStoryRing}>
                                        <ArtistImage name={artist.name} rawImage={artist.image} style={styles.igArtistImg} />
                                    </LinearGradient>
                                    {isSelected && (
                                        <View style={styles.artistSelectedBadge}>
                                            <Ionicons name="heart" size={12} color="#FFFFFF" />
                                        </View>
                                    )}
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

const LiveSportsFeed = ({ selectedSport }) => {
    const { liveMatches, isLoadingSports, fetchLiveScores } = useSportsStore();
    useEffect(() => { fetchLiveScores(); const intervalId = setInterval(() => fetchLiveScores(), 15000); return () => clearInterval(intervalId); }, []);
    const displayedMatches = useMemo(() => { if (!selectedSport || selectedSport === 'all') return liveMatches; return liveMatches.filter(match => match.sport === selectedSport); }, [liveMatches, selectedSport]);
    if (isLoadingSports && liveMatches.length === 0) return <ReAnimated.View entering={FadeIn} exiting={FadeOut} style={[styles.sportsContainer, { alignItems: 'center', paddingTop: 40 }]}><ActivityIndicator size="large" color="#00E5FF" /></ReAnimated.View>;
    if (displayedMatches.length === 0) return (
        <ReAnimated.View entering={FadeIn} exiting={FadeOut} layout={LinearTransition} style={styles.sportsContainer}>
            <Text style={styles.rowTitle}>Live Matches & Scores</Text>
            <Text style={{ color: '#8F98A0', textAlign: 'center', marginTop: 20 }}>{selectedSport === 'all' ? "No matches currently scheduled." : `No live ${selectedSport} matches right now.`}</Text>
        </ReAnimated.View>
    );
    return (
        <ReAnimated.View layout={LinearTransition} style={styles.sportsContainer}>
            <Text style={styles.rowTitle}>Live Matches & Scores</Text>
            {displayedMatches.map((match, index) => (
                <ReAnimated.View key={match.id} entering={FadeInDown.delay(index * 40).duration(300)} exiting={FadeOut.duration(200)} layout={LinearTransition.springify().damping(14)}>
                    <TouchableOpacity style={styles.sportsCard} activeOpacity={0.85}>
                        <View style={styles.sportsCardHeader}>
                            <Text style={styles.sportsSportText}>{match.sport}</Text>
                            <View style={[styles.liveBadge, !match.isLive && { backgroundColor: '#808085' }]}>
                                <Text style={styles.liveBadgeText}>{match.status}</Text>
                            </View>
                        </View>
                        <Text style={styles.sportsTitle}>{match.title}</Text>
                        <View style={styles.sportsMatchInfo}>
                            <View style={styles.sportsTeamWrap}>
                                <Image source={{ uri: match.team1Logo }} style={styles.sportsFlag} />
                                <Text style={styles.sportsScoreText}>{match.team1Score}</Text>
                            </View>
                            <Text style={styles.sportsVs}>vs</Text>
                            <View style={styles.sportsTeamWrapRight}>
                                <Text style={styles.sportsScoreText}>{match.team2Score}</Text>
                                <Image source={{ uri: match.team2Logo }} style={styles.sportsFlag} />
                            </View>
                        </View>
                        <View style={styles.sportsCommentaryBox}>
                            <Ionicons name="mic" size={14} color="#00E5FF" />
                            <Text style={styles.sportsCommentaryText} numberOfLines={2}>{match.commentary}</Text>
                        </View>
                    </TouchableOpacity>
                </ReAnimated.View>
            ))}
        </ReAnimated.View>
    );
};

const LiveTvFeed = ({ selectedCategory, selectedLanguage, onNavigateToPlayer }) => {
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
                        <Ionicons name="close-circle" size={18} color="#8F98A0" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={toggleTvListening} style={styles.musicRightIcon}>
                        {isTvListening ? (
                            <ActivityIndicator size="small" color="#00E5FF" />
                        ) : (
                            <Ionicons name="mic-outline" size={22} color="#FFFFFF" />
                        )}
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
                    keyboardShouldPersistTaps="handled"
                    data={displayedChannels}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    scrollEnabled={false}
                    columnWrapperStyle={{ justifyContent: 'space-between' }}
                    initialNumToRender={8}
                    maxToRenderPerBatch={8}
                    windowSize={5}
                    removeClippedSubviews={Platform.OS === 'android'}
                    contentContainerStyle={{ paddingBottom: 20 }}
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

const FilterDropdown = ({ filters, setFilter, onClose }) => {
    const regionOptions = [{ l: 'All', v: 'all' }, { l: 'Indian', v: 'indian' }, { l: 'Others', v: 'others' }];
    const typeOptions = [{ l: 'All', v: 'all' }, { l: 'Movies', v: 'movie' }, { l: 'TV Shows / Web Series', v: 'tv' }, { l: 'Music', v: 'music' }, { l: 'Live Sports & TV', v: 'live' }];
    const langOptions = [{ l: 'Any', v: 'any' }, { l: 'Hindi', v: 'hi' }, { l: 'English', v: 'en' }, { l: 'Punjabi', v: 'pa' }, { l: 'Tamil', v: 'ta' }, { l: 'Others', v: 'others' }];
    const platformOptions = [{ l: 'Any', v: 'any' }, { l: 'Netflix', v: '8' }, { l: 'Prime Video', v: '119' }, { l: 'JioHotstar', v: '122|220|337' }, { l: 'SonyLIV', v: '237' }, { l: 'Zee5', v: '232' }];
    const liveOptions = [{ l: 'Cricket (Scores)', v: 'Cricket' }, { l: 'Football (Scores)', v: 'Football' }, { l: 'Basketball (Scores)', v: 'Basketball' }, { l: 'Live News', v: 'news' }, { l: 'Live Music', v: 'music' }, { l: 'Entertainment TV', v: 'entertainment' }, { l: 'Movies TV', v: 'movies' }];

    const renderGroup = (title, options, activeValue, filterKey) => (
        <ReAnimated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>{title}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.filterScroll}>
                {options.map(opt => {
                    const isActive = activeValue === opt.v;
                    return (
                        <TouchableOpacity
                            key={opt.v}
                            style={styles.filterChipContainer}
                            onPress={() => {
                                setFilter(filterKey, opt.v);
                                if (filterKey === 'type' && onClose) {
                                    onClose();
                                }
                            }}
                            activeOpacity={0.8}
                        >
                            {isActive ? (
                                <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.filterChipActive}>
                                    <Text style={styles.activeFilterText}>{opt.l}</Text>
                                </LinearGradient>
                            ) : (
                                <View style={styles.filterChipInactive}>
                                    <Text style={styles.filterText}>{opt.l}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </ReAnimated.View>
    );

    const activeLiveCategory = filters.liveCategory || 'Cricket';
    const isLiveSportsFeed = ['Cricket', 'Football', 'Basketball'].includes(activeLiveCategory);

    return (
        <ReAnimated.View layout={LinearTransition} style={styles.filterDropdownContainer}>
            {renderGroup("Category", typeOptions, filters.type, 'type')}
            {filters.type === 'live' ? (
                <>
                    {renderGroup("Live Feed", liveOptions, activeLiveCategory, 'liveCategory')}
                    {!isLiveSportsFeed && renderGroup("Language", langOptions, filters.language || 'any', 'language')}
                </>
            ) : filters.type === 'music' ? null : (
                <>
                    {renderGroup("Platform", platformOptions, filters.platform || 'any', 'platform')}
                    {renderGroup("Region", regionOptions, filters.region, 'region')}
                    {renderGroup("Language", langOptions, filters.language, 'language')}
                </>
            )}
        </ReAnimated.View>
    );
};

const MovieCard = React.memo(({ item, inWatchlist, inWatched, onToggleAction, onNavigateToPlayer }) => {
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

const HorizontalRow = React.memo(({ title, data, onAuthAction, watchlist = {}, watched = {}, toggleAction, onNavigateToPlayer }) => {
    if (!data || data.length === 0) return null;
    const handleToggle = useCallback((id, mediaType, listType) => { onAuthAction(() => toggleAction(id, mediaType, listType)); }, [onAuthAction, toggleAction]);

    const safeWatchlist = watchlist || {};
    const safeWatched = watched || {};

    const renderItem = useCallback(({ item }) => (
        <MovieCard
            item={item}
            inWatchlist={!!safeWatchlist[item.id]}
            inWatched={!!safeWatched[item.id]}
            onToggleAction={handleToggle}
            onNavigateToPlayer={onNavigateToPlayer}
        />
    ), [safeWatchlist, safeWatched, handleToggle, onNavigateToPlayer]);

    return (
        <View style={styles.rowContainer}>
            <Text style={styles.rowTitle}>{title}</Text>
            <FlatList
                horizontal
                keyboardShouldPersistTaps="handled"
                data={data}
                extraData={{ watchlist: safeWatchlist, watched: safeWatched }}
                keyExtractor={(item) => String(item.id)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rowListContent}
                renderItem={renderItem}
                initialNumToRender={4}
                maxToRenderPerBatch={4}
                windowSize={3}
                removeClippedSubviews={Platform.OS === 'android'}
                getItemLayout={(data, index) => ({ length: 122, offset: 122 * index, index })}
            />
        </View>
    );
});

const LanguageRow = React.memo(({ router }) => {
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
            <FlatList
                horizontal
                keyboardShouldPersistTaps="handled"
                data={MOCK_LANGUAGES}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rowListContent}
                renderItem={({ item }) => {
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
                }}
            />
        </View>
    );
});

const GenreRow = React.memo(({ router, lists }) => {
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
            <FlatList
                horizontal
                keyboardShouldPersistTaps="handled"
                data={genres}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rowListContent}
                renderItem={({ item }) => {
                    const firstMovie = item.data?.[0];
                    const imageUri = firstMovie ? getImageUrl(firstMovie.backdrop_path || firstMovie.poster_path) : 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=300&q=60';
                    return (
                        <TouchableOpacity style={styles.wideCard} activeOpacity={0.85} onPress={() => router.push({ pathname: '/category', params: { title: item.title } })}>
                            <Image source={{ uri: imageUri }} style={styles.genreImage} resizeMode="cover" />
                            <View style={[styles.genreTintOverlay, { backgroundColor: item.tint }]} />
                            <Text style={styles.genreTitle}>{item.title}</Text>
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );
});

const CinePlayLogo = ({ size = 38 }) => (
    <Svg viewBox="0 0 500 500" width={size} height={size}>
        <Defs><SvgLinearGradient id="playGrad" x1="0%" y1="0%" x2="100%" y2="100%"><Stop offset="0%" stopColor="#00E5FF" /><Stop offset="50%" stopColor="#9B51E0" /><Stop offset="100%" stopColor="#FF007A" /></SvgLinearGradient></Defs>
        <Circle cx="250" cy="250" r="250" fill="url(#playGrad)" />
        <Path d="M 190 145 L 365 250 L 190 355 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="25" strokeLinejoin="round" />
    </Svg>
);

const HomeScreen = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const {
        filters, setFilter, fetchAllData, isLoading,
        trendingList, topRatedList, latestList, actionList, comedyList,
        thrillerList, horrorList, romanceList, scifiList, feelGoodList, biopicsList
    } = useMovieStore();

    const { watchlist, watched, toggleWatchlist, toggleWatched } = useUserListStore();
    const { token } = useAuthStore();

    const [currentIndex, setCurrentIndex] = useState(0);
    const [showFilters, setShowFilters] = useState(false);
    const toggleFilterMenu = () => setShowFilters(prev => !prev);

    const [pan, setPan] = useState(() => new Animated.ValueXY());
    const isDragging = useRef(false);
    const isTransitioning = useRef(false);

    // ==========================================
    // 🎵 GLOBAL MUSIC PLAYER STATES
    // ==========================================
    const [musicQueue, setMusicQueue] = useState([]);
    const [currentMusicIndex, setCurrentMusicIndex] = useState(-1);
    const [isMusicPlaying, setIsMusicPlaying] = useState(false);
    const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);

    // NEW: Shuffle & Loop states
    const [isShuffle, setIsShuffle] = useState(false);
    const [loopMode, setLoopMode] = useState(0); // 0=off, 1=all, 2=one

    const [musicProgress, setMusicProgress] = useState(0);
    const [musicDuration, setMusicDuration] = useState(0);
    const [barWidth, setBarWidth] = useState(0);
    const [musicPrefs, setMusicPrefs] = useState({});

    // Keep this one for double tapping like in the full-screen modal
    const [lastTap, setLastTap] = useState(0);

    const scrollY = useRef(new Animated.Value(0)).current;

    const playRequestId = useRef(0);
    const playingTrackId = useRef(null);
    const isFetchingQueue = useRef(false);

    const globalMusicPlayer = useVideoPlayer(null, (player) => {
        player.loop = false;
        player.staysActiveInBackground = true;
        player.showNowPlayingNotification = true;
    });

    const handleNavigateToPlayer = useCallback((params) => {
        if (isMusicPlaying) {
            globalMusicPlayer.pause();
            setIsMusicPlaying(false);
        }
        router.push({ pathname: '/player', params });
    }, [isMusicPlaying, globalMusicPlayer, router]);

    const handlePlayMusic = (track, initialQueue) => {
        const refinedQueue = initialQueue
            .map(s => {
                const actualStreamUrl = s.downloadUrl?.find?.(d => d.quality === '320kbps')?.url
                    || s.downloadUrl?.[0]?.url
                    || s.url;

                const actualImgUrl = Array.isArray(s.image)
                    ? (s.image?.find?.(i => i.quality === '500x500')?.url || s.image?.[0]?.url)
                    : s.image;

                return {
                    id: s.id,
                    title: s.title || s.name,
                    artist: s.artist || s.description || s.subtitle || (s.artists?.primary?.map(a => a.name).join(', ') || 'Unknown Artist'),
                    image: actualImgUrl,
                    url: actualStreamUrl,
                };
            })
            .filter(s => {
                const valid = s.url && (s.url.includes('.mp4') || s.url.includes('.aac') || s.url.includes('http'));
                return valid;
            });

        const seenNames = new Set();
        const finalQueue = [];

        for (const s of refinedQueue) {
            const norm = normalizeString(s.title);
            if (!seenNames.has(norm)) {
                seenNames.add(norm);
                finalQueue.push(s);
            }
        }

        const targetTitleNorm = normalizeString(track.title || track.name);
        let selectedIndex = finalQueue.findIndex(s => String(s.id) === String(track.id) || normalizeString(s.title) === targetTitleNorm);

        if (selectedIndex === -1) {
            const formattedTrack = {
                id: track.id,
                title: track.title || track.name,
                artist: track.artist || track.subtitle || track.description || 'Unknown Artist',
                image: Array.isArray(track.image) ? (track.image?.find?.(i => i.quality === '500x500')?.url || track.image?.[0]?.url) : track.image,
                url: track.url || track.downloadUrl?.find?.(d => d.quality === '320kbps')?.url || track.downloadUrl?.[0]?.url
            };
            finalQueue.unshift(formattedTrack);
            selectedIndex = 0;
        }

        playingTrackId.current = null;
        setMusicQueue(finalQueue);
        setCurrentMusicIndex(selectedIndex);
    };

    const extendQueueIfNeeded = useCallback(async (index, queue) => {
        const thresholdIndex = Math.floor(queue.length * 0.60);

        if (index < thresholdIndex || isFetchingQueue.current) return;

        const seed = queue[index];
        if (!seed) return;

        isFetchingQueue.current = true;

        try {
            let newTracks = [];
            if (token) {
                const res = await fetch(`${BACKEND_URL}/user/music/recommendations?seedSongId=${seed.id}&seedArtist=${encodeURIComponent(seed.artist)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const json = await res.json();

                if (json && json.data) {
                    newTracks = json.data.map(t => ({
                        id: t.id,
                        title: t.name,
                        artist: t.artists?.primary?.map(a => a.name).join(', ') || 'Unknown',
                        image: t.image?.find(i => i.quality === '500x500')?.url || t.image?.[0]?.url,
                        url: t.downloadUrl?.find(d => d.quality === '320kbps')?.url || t.downloadUrl?.[0]?.url
                    }));
                }
            } else {
                const searchQ = encodeURIComponent(seed.artist || 'Trending');
                const randomPage = Math.floor(Math.random() * 8) + 1;
                const json = await safeFetchJson(`/search/songs?query=${searchQ}&page=${randomPage}&limit=15`);

                if (json && json.success && json.data?.results) {
                    newTracks = json.data.results.map(t => ({
                        id: t.id,
                        title: t.name,
                        artist: t.artists?.primary?.map(a => a.name).join(', ') || 'Unknown',
                        image: t.image?.find(i => i.quality === '500x500')?.url || t.image?.[0]?.url,
                        url: t.downloadUrl?.find(d => d.quality === '320kbps')?.url || t.downloadUrl?.[0]?.url
                    }));
                }
            }

            if (newTracks.length > 0) {
                setMusicQueue(prev => {
                    const existingNames = new Set(prev.map(t => normalizeString(t.title)));
                    const filteredTracks = newTracks.filter(s => {
                        const normName = normalizeString(s.title);
                        if (!s.url || existingNames.has(normName)) return false;
                        existingNames.add(normName);
                        return true;
                    });

                    const strictly10Tracks = filteredTracks.slice(0, 10);
                    if (strictly10Tracks.length === 0) return prev;

                    return [...prev, ...strictly10Tracks];
                });
            }
        } catch (e) {
        } finally {
            isFetchingQueue.current = false;
        }
    }, [token]);

    useEffect(() => {
        if (currentMusicIndex < 0 || !musicQueue[currentMusicIndex]) return;

        const track = musicQueue[currentMusicIndex];

        if (playingTrackId.current === track.id) return;
        playingTrackId.current = track.id;

        extendQueueIfNeeded(currentMusicIndex, musicQueue);

        const requestId = ++playRequestId.current;

        if (!track.url || track.url.includes('jiosaavn.com/song')) {
            handleNextTrack();
            return;
        }

        const loadAndPlayTrack = async () => {
            try {
                setIsMusicPlaying(false);
                setMusicProgress(0);

                globalMusicPlayer.pause();
                await globalMusicPlayer.replaceAsync({ uri: track.url, metadata: { title: track.title, artist: track.artist, artwork: track.image, }, });

                if (requestId !== playRequestId.current) return;

                globalMusicPlayer.play();
                setIsMusicPlaying(true);

            } catch (err) {
                if (requestId !== playRequestId.current) return;
                setIsMusicPlaying(false);
                Toast.show({ type: 'error', text1: `Couldn't play "${track.title}", skipping...` });
                handleNextTrack();
            }
        };

        loadAndPlayTrack();
    }, [currentMusicIndex, musicQueue, globalMusicPlayer, extendQueueIfNeeded]);

    // NEW: Handle Next and Prev tracks (incorporating Shuffle & Loop states)
    const handleNextTrack = useCallback(() => {
        if (isShuffle) {
            setCurrentMusicIndex(Math.floor(Math.random() * musicQueue.length));
        } else if (currentMusicIndex < musicQueue.length - 1) {
            setCurrentMusicIndex(prev => prev + 1);
        } else if (loopMode === 1) { // Loop All
            setCurrentMusicIndex(0);
        } else {
            globalMusicPlayer.pause();
            setIsMusicPlaying(false);
        }
    }, [isShuffle, loopMode, currentMusicIndex, musicQueue.length, globalMusicPlayer]);

    const handlePrevTrack = useCallback(() => {
        if (musicProgress > 3) {
            globalMusicPlayer.currentTime = 0;
        } else if (isShuffle) {
            setCurrentMusicIndex(Math.floor(Math.random() * musicQueue.length));
        } else if (currentMusicIndex > 0) {
            setCurrentMusicIndex(prev => prev - 1);
        } else if (loopMode === 1) { // Loop All
            setCurrentMusicIndex(musicQueue.length - 1);
        }
    }, [isShuffle, loopMode, currentMusicIndex, musicQueue.length, musicProgress, globalMusicPlayer]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (isMusicPlaying && globalMusicPlayer) {
                setMusicProgress(globalMusicPlayer.currentTime);
                setMusicDuration(globalMusicPlayer.duration);
            }
        }, 1000);

        const sub = globalMusicPlayer.addListener('playToEnd', async () => {
            setIsMusicPlaying(false);
            if (loopMode === 2) { // Loop One
                globalMusicPlayer.currentTime = 0;
                globalMusicPlayer.play();
                setIsMusicPlaying(true);
            } else {
                handleNextTrack();
            }
        });

        return () => { clearInterval(interval); sub.remove(); };
    }, [globalMusicPlayer, isMusicPlaying, loopMode, handleNextTrack]);

    const handleSeek = (event) => {
        if (barWidth > 0 && musicDuration > 0) {
            const tapX = event.nativeEvent.locationX;
            const percentage = Math.max(0, Math.min(1, tapX / barWidth));
            const newTime = percentage * musicDuration;
            globalMusicPlayer.currentTime = newTime;
            setMusicProgress(newTime);
        }
    };

    const handleMusicInteraction = async (songId, action) => {
        if (action === 'listen' && !token) return;
        if (!token) return Toast.show({ type: 'hotstarInfo', text1: 'Log in for personalization', position: 'top', topOffset: 60 });

        let finalAction = action;
        if (action === 'toggleLike') {
            finalAction = musicPrefs[songId] === 'like' ? 'removeLike' : 'like';
        }

        if (action !== 'listen') {
            setMusicPrefs(prev => ({ ...prev, [songId]: finalAction === 'removeLike' ? null : finalAction }));
        }

        try {
            await fetch(`${BACKEND_URL}/user/music/interact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ songId, action: finalAction })
            });
            if (finalAction === 'like') {
                Toast.show({ type: 'hotstarSuccess', text1: 'Saved to Liked Songs' });
            } else if (finalAction === 'dislike') {
                Toast.show({ type: 'hotstarSuccess', text1: 'We will recommend less of this' });
                handleNextTrack();
            }
        } catch (error) {
            console.error('Failed to register interaction:', error?.message || error);
        }
    };

    const handleDoubleTapLike = (songId) => {
        const now = Date.now();
        if (now - lastTap < 300) handleMusicInteraction(songId, 'toggleLike');
        setLastTap(now);
    };

    const panResponderMusic = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderRelease: (evt, gestureState) => {
            const { dx, dy } = gestureState;
            if (Math.abs(dx) > 60) {
                if (dx > 0) handlePrevTrack();
                else handleNextTrack();
            } else if (dy > 60) {
                setIsMusicModalOpen(false); // Swipe down to minimize
            } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
                if (musicQueue[currentMusicIndex]) handleDoubleTapLike(musicQueue[currentMusicIndex].id);
            }
        }
    }), [currentMusicIndex, musicQueue, lastTap, handleNextTrack, handlePrevTrack]);

    useEffect(() => {
        if (currentMusicIndex >= 0 && musicQueue[currentMusicIndex]) {
            handleMusicInteraction(musicQueue[currentMusicIndex].id, 'listen');
        }
    }, [currentMusicIndex]);


    const moviesLengthRef = useRef(0);
    useEffect(() => { moviesLengthRef.current = trendingList.length; }, [trendingList]);

    useEffect(() => { fetchAllData(); }, []);

    useEffect(() => {
        let isMounted = true;
        const syncUserLists = async () => {
            if (!token) return;
            try {
                const response = await fetch(`${BACKEND_URL}/user/lists`, { headers: { Authorization: `Bearer ${token}` } });
                if (response.ok) {
                    const data = await response.json();
                    const arrayToMap = (arr) => arr.reduce((acc, curr) => {
                        const [idStr, typeStr] = String(curr).split(':'); acc[idStr] = typeStr || 'movie'; return acc;
                    }, {});

                    if (isMounted) {
                        useUserListStore.setState({ watchlist: arrayToMap(data.watchlist || []), watched: arrayToMap(data.watched || []) });

                        if (data.likedSongs) {
                            const initialPrefs = {};
                            data.likedSongs.forEach(id => { initialPrefs[id] = 'like'; });
                            setMusicPrefs(initialPrefs);
                        }
                    }
                }
            } catch (error) { }
        };
        syncUserLists();
        return () => { isMounted = false; };
    }, [token]);

    const handleAuthAction = useCallback((actionCallback) => {
        if (!token) { Toast.show({ type: 'hotstarInfo', text1: 'Log in for personalization', position: 'top', topOffset: insets.top > 0 ? insets.top + 10 : 50, visibilityTime: 2500 }); }
        else { actionCallback(); }
    }, [token, insets.top]);

    const handleToggleAction = useCallback(async (id, mediaType, targetList) => {
        if (targetList === 'watchlist') toggleWatchlist(id, mediaType);
        if (targetList === 'watched') toggleWatched(id, mediaType);

        try {
            const response = await fetch(`${BACKEND_URL}/user/${targetList}/toggle`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ tmdbId: `${id}:${mediaType}` }) });
            if (!response.ok) throw new Error('Failed to update on server');
            const data = await response.json();
            const arrayToMap = (arr) => arr.reduce((acc, curr) => { const [idStr, typeStr] = String(curr).split(':'); acc[idStr] = typeStr || 'movie'; return acc; }, {});
            useUserListStore.setState({ watchlist: arrayToMap(data.watchlist), watched: arrayToMap(data.watched) });
        } catch (error) {
            Toast.show({ type: 'error', text1: `Failed to save to ${targetList}` });
            if (targetList === 'watchlist') toggleWatchlist(id, mediaType);
            if (targetList === 'watched') toggleWatched(id, mediaType);
        }
    }, [toggleWatchlist, toggleWatched, token]);

    const forceSwipe = (direction, isAuto = false) => {
        isTransitioning.current = true;
        const x = direction === 'right' ? width * 1.5 : -width * 1.5;
        Animated.timing(pan, { toValue: { x, y: 0 }, duration: isAuto ? 700 : 300, easing: isAuto ? Easing.inOut(Easing.sin) : Easing.out(Easing.quad), useNativeDriver: false }).start(() => onSwipeComplete());
    };

    const onSwipeComplete = () => { setPan(new Animated.ValueXY()); setCurrentIndex((prevIndex) => (prevIndex + 1) % (moviesLengthRef.current || 1)); };

    useEffect(() => { isTransitioning.current = false; }, [pan]);
    const resetPosition = () => { Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: false }).start(); };

    const panResponder = useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => { if (isTransitioning.current) return false; return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 5; },
        onMoveShouldSetPanResponder: (_, gestureState) => { if (isTransitioning.current) return false; return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 5; },
        onPanResponderGrant: () => { isDragging.current = true; pan.stopAnimation(); pan.extractOffset(); },
        onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }),
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, gestureState) => {
            isDragging.current = false; pan.flattenOffset();
            if (gestureState.dx > SWIPE_THRESHOLD || gestureState.vx > SWIPE_VELOCITY) forceSwipe('right', false);
            else if (gestureState.dx < -SWIPE_THRESHOLD || gestureState.vx < -SWIPE_VELOCITY) forceSwipe('left', false);
            else resetPosition();
        },
        onPanResponderTerminate: () => { isDragging.current = false; resetPosition(); }
    }), [pan]);

    useEffect(() => {
        const timer = setInterval(() => { if (!isDragging.current && !isTransitioning.current && trendingList.length > 0 && filters.type !== 'music' && filters.type !== 'live') forceSwipe('left', true); }, 3500);
        return () => clearInterval(timer);
    }, [pan, trendingList.length, filters.type]);

    const rotate = pan.x.interpolate({ inputRange: [-width / 2, 0, width / 2], outputRange: ['-10deg', '0deg', '10deg'], extrapolate: 'clamp' });
    const topCardOpacity = pan.x.interpolate({ inputRange: [-width / 1.5, 0, width / 1.5], outputRange: [0, 1, 0], extrapolate: 'clamp' });
    const nextCardScale = pan.x.interpolate({ inputRange: [-width / 2, 0, width / 2], outputRange: [1, 0.92, 1], extrapolate: 'clamp' });

    const renderCardContent = (item) => {
        const inWatchlist = !!watchlist[item.id];
        const inWatched = !!watched[item.id];
        const posterUri = getImageUrl(item.poster_path);
        const title = item.title || item.name;
        const year = (item.release_date || item.first_air_date || '').substring(0, 4);
        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
        const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');

        return (
            <>
                <Image source={{ uri: posterUri }} style={styles.mainCardImage} resizeMode="cover" />
                <View style={styles.badgeContainer}>
                    <Ionicons name="ticket" size={13} color="#F5C518" style={{ marginRight: 4 }} />
                    <Text style={styles.badgeText}>IMDb {rating}</Text>
                </View>
                <LinearGradient colors={['transparent', 'rgba(10, 10, 12, 0.75)', '#0A0A0C']} style={styles.gradientOverlay}>
                    <View style={styles.movieDetailsContainer}>
                        <Text style={styles.movieTitle} numberOfLines={1}>{title}</Text>
                        <Text style={styles.movieSubtitle} numberOfLines={2}>{item.overview}</Text>
                        <Text style={styles.metadataText}>{year}  •  TMDB</Text>
                    </View>
                </LinearGradient>
                <View style={styles.actionButtonsWrapper}>
                    <TouchableOpacity style={styles.iconActionBtn} activeOpacity={0.8} onPress={() => handleAuthAction(() => handleToggleAction(item.id, mediaType, 'watchlist'))}>
                        <Ionicons name={inWatchlist ? "bookmark" : "bookmark-outline"} size={24} color={inWatchlist ? "#FF007A" : "#FFFFFF"} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconActionBtn} activeOpacity={0.8} onPress={() => handleAuthAction(() => handleToggleAction(item.id, mediaType, 'watched'))}>
                        <Ionicons name="checkmark-done" size={22} color={inWatched ? "#00E5FF" : "#FFFFFF"} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.playButtonWrapper} activeOpacity={0.8} onPress={() => handleNavigateToPlayer({ id: item.id, type: mediaType })}>
                        <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.playButtonGradient}>
                            <Ionicons name="play" size={26} color="#FFFFFF" style={{ marginLeft: 3 }} />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </>
        );
    };

    const renderCardStack = () => {
        if (isLoading || trendingList.length === 0) return <View style={[styles.mainCardContainer, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#00E5FF" /></View>;
        const safeIndex = currentIndex % trendingList.length;
        const nextIndex = (currentIndex + 1) % trendingList.length;
        return (
            <>
                <Animated.View key={`${trendingList[nextIndex].id}-next`} style={[styles.mainCardContainer, { transform: [{ scale: nextCardScale }], zIndex: 1 }]}>
                    {renderCardContent(trendingList[nextIndex])}
                </Animated.View>
                <Animated.View key={`${trendingList[safeIndex].id}-top`} style={[styles.mainCardContainer, { opacity: topCardOpacity, transform: [{ translateX: pan.x }, { rotate: rotate }], zIndex: 99 }]} {...panResponder.panHandlers}>
                    {renderCardContent(trendingList[safeIndex])}
                </Animated.View>
            </>
        );
    };

    const categoryData = [
        { title: "Trending", data: trendingList }, { title: "Top Rated", data: topRatedList }, { title: "Latest", data: latestList }, { title: "Action Blockbusters", data: actionList },
        { title: "Comedy", data: comedyList }, { title: "Thriller", data: thrillerList }, { title: "Horror", data: horrorList }, { title: "Romance", data: romanceList },
        { title: "Sci-Fi", data: scifiList }, { title: "Feel Good", data: feelGoodList }, { title: "Biopics", data: biopicsList }
    ];

    const activeLiveCategory = filters.liveCategory || 'Cricket';
    const isLiveSportsFeed = ['Cricket', 'Football', 'Basketball'].includes(activeLiveCategory);

    const currentTrack = musicQueue[currentMusicIndex] || null;

    const headerOpacity = scrollY.interpolate({ inputRange: [0, 150], outputRange: [0, 1], extrapolate: 'clamp' });
    const mainContentOpacity = scrollY.interpolate({ inputRange: [0, 150], outputRange: [1, 0], extrapolate: 'clamp' });
    const artScale = scrollY.interpolate({ inputRange: [-100, 0, 150], outputRange: [1.2, 1, 0.6], extrapolate: 'clamp' });
    const artTranslateY = scrollY.interpolate({ inputRange: [0, 150], outputRange: [0, -60], extrapolate: 'clamp' });

    return (
        <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.background}>

            <VideoView player={globalMusicPlayer} style={{ width: 0, height: 0, position: 'absolute' }} nativeControls={false} />

            <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <CinePlayLogo size={34} />
                        <MaskedView style={styles.maskedView} maskElement={<Text style={styles.appName}>CinePlay</Text>}>
                            <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}><Text style={[styles.appName, { opacity: 0 }]}>CinePlay</Text></LinearGradient>
                        </MaskedView>
                    </View>
                    <TouchableOpacity style={styles.headerRightBtn} onPress={() => handleAuthAction(() => router.push('/my-list'))}><Ionicons name="bookmarks" size={24} color="#E0E0E0" /></TouchableOpacity>
                </View>

                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.scrollContent, currentTrack ? { paddingBottom: insets.bottom + 160 } : { paddingBottom: 80 }]}
                    bounces={false}
                >

                    {filters.type !== 'live' && filters.type !== 'music' && (
                        <ReAnimated.View entering={FadeInUp.duration(300)} exiting={FadeOutUp.duration(200)} layout={LinearTransition}>
                            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>For You</Text></View>
                            <View style={styles.deckArea}>{renderCardStack()}</View>
                        </ReAnimated.View>
                    )}

                    <ReAnimated.View layout={LinearTransition}>
                        <View style={styles.filterBarHeader}>
                            <Text style={styles.filterTitle}>Explore Collections</Text>
                            <TouchableOpacity style={[styles.funnelBtn, showFilters && styles.funnelBtnActive]} onPress={toggleFilterMenu}><Ionicons name="funnel" size={20} color={showFilters ? "#00E5FF" : "#FFFFFF"} /></TouchableOpacity>
                        </View>
                    </ReAnimated.View>

                    {showFilters && (
                        <ReAnimated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} layout={LinearTransition}>
                            <FilterDropdown filters={filters} setFilter={setFilter} onClose={() => setShowFilters(false)} />
                        </ReAnimated.View>
                    )}

                    <ReAnimated.View layout={LinearTransition.duration(280)} style={styles.categoriesWrapper}>
                        {isLoading && filters.type !== 'music' ? (
                            <ReAnimated.View key="loading" entering={FadeIn} exiting={FadeOut}><ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 40, marginBottom: 80 }} /></ReAnimated.View>
                        ) : filters.type === 'music' ? (
                            <ReAnimated.View key="music" entering={FadeIn} exiting={FadeOut}>
                                <YTMusicFeed onPlayMusic={handlePlayMusic} activeTrackId={currentTrack?.id} />
                            </ReAnimated.View>
                        ) : filters.type === 'live' ? (
                            isLiveSportsFeed ? (
                                <ReAnimated.View key="live-sports" entering={FadeIn} exiting={FadeOut}><LiveSportsFeed selectedSport={activeLiveCategory} /></ReAnimated.View>
                            ) : (
                                <ReAnimated.View key="live-tv" entering={FadeIn} exiting={FadeOut}><LiveTvFeed selectedCategory={activeLiveCategory} selectedLanguage={filters.language} onNavigateToPlayer={handleNavigateToPlayer} /></ReAnimated.View>
                            )
                        ) : (
                            <ReAnimated.View key="movies" entering={FadeIn} exiting={FadeOut}>
                                {categoryData.map((category, index) => (
                                    <HorizontalRow key={index.toString()} title={category.title} data={category.data} onAuthAction={handleAuthAction} watchlist={watched} toggleAction={handleToggleAction} onNavigateToPlayer={handleNavigateToPlayer} />
                                ))}
                            </ReAnimated.View>
                        )}
                    </ReAnimated.View>

                    {filters.type !== 'live' && filters.type !== 'music' && (
                        <ReAnimated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} layout={LinearTransition}>
                            <LanguageRow router={router} />
                            <GenreRow router={router} lists={{ actionList, thrillerList, scifiList, romanceList, comedyList, horrorList }} />
                        </ReAnimated.View>
                    )}
                </ScrollView>
            </SafeAreaView>

            {/* GLOBAL MINI PLAYER (Background Play) */}
            {currentTrack && !isMusicModalOpen && (
                <MiniPlayer
                    currentTrack={currentTrack}
                    isMusicPlaying={isMusicPlaying}
                    musicProgress={musicProgress}
                    musicDuration={musicDuration}
                    isShuffle={isShuffle}
                    setIsShuffle={setIsShuffle}
                    loopMode={loopMode}
                    setLoopMode={setLoopMode}
                    onTogglePlay={() => {
                        if (isMusicPlaying) { globalMusicPlayer.pause(); setIsMusicPlaying(false); }
                        else { globalMusicPlayer.play(); setIsMusicPlaying(true); }
                    }}
                    handleNextTrack={handleNextTrack}
                    handlePrevTrack={handlePrevTrack}
                    onOpenModal={() => setIsMusicModalOpen(true)}
                    onDismiss={() => {
                        globalMusicPlayer.pause();
                        setIsMusicPlaying(false);
                        setCurrentMusicIndex(-1);
                        setMusicQueue([]);
                    }}
                    bottomOffset={insets.bottom + 60}
                />
            )}

            {/* FULL SCREEN MUSIC PLAYER MODAL */}
            <Modal visible={isMusicModalOpen} animationType="slide" transparent={false} onRequestClose={() => setIsMusicModalOpen(false)}>
                <LinearGradient colors={['#170D22', '#0A0A0C']} style={{ flex: 1 }}>
                    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>

                        {/* STICKY HEADER (Appears on scroll) */}
                        <Animated.View style={[styles.stickyHeader, { opacity: headerOpacity, paddingTop: insets.top + 10 }]}>
                            <TouchableOpacity onPress={() => setIsMusicModalOpen(false)} style={{ paddingRight: 10 }}>
                                <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
                            </TouchableOpacity>
                            <Image source={{ uri: currentTrack?.image }} style={{ width: 40, height: 40, borderRadius: 6, marginRight: 10 }} />
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: 'bold' }} numberOfLines={1}>{currentTrack?.title}</Text>
                                <Text style={{ color: '#8F98A0', fontSize: 12 }} numberOfLines={1}>{currentTrack?.artist}</Text>
                            </View>
                            <TouchableOpacity onPress={() => handleMusicInteraction(currentTrack?.id, 'toggleLike')} style={{ paddingHorizontal: 8 }}>
                                <Ionicons name={musicPrefs[currentTrack?.id] === 'like' ? "heart" : "heart-outline"} size={22} color={musicPrefs[currentTrack?.id] === 'like' ? "#FF007A" : "#FFF"} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    if (isMusicPlaying) { globalMusicPlayer.pause(); setIsMusicPlaying(false); }
                                    else { globalMusicPlayer.play(); setIsMusicPlaying(true); }
                                }}
                                style={{ paddingHorizontal: 8 }}
                            >
                                <Ionicons name={isMusicPlaying ? "pause" : "play"} size={26} color="#FFF" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleNextTrack} style={{ paddingLeft: 8 }}>
                                <Ionicons name="play-skip-forward" size={22} color="#FFF" />
                            </TouchableOpacity>
                        </Animated.View>

                        {/* STATIC TOP HEADER (Fades out on scroll) */}
                        <Animated.View style={[styles.musicHeader, { opacity: mainContentOpacity, position: 'absolute', top: insets.top, left: 0, right: 0, zIndex: 10 }]}>
                            <TouchableOpacity onPress={() => setIsMusicModalOpen(false)} style={{ padding: 10 }}>
                                <Ionicons name="chevron-down" size={32} color="#FFFFFF" />
                            </TouchableOpacity>
                            <View style={{ alignItems: 'center' }}>
                                <Text style={styles.musicHeaderSubtitle}>NOW PLAYING</Text>
                                <Text style={styles.musicHeaderTitle} numberOfLines={1}>{currentTrack?.title}</Text>
                            </View>
                            <View style={{ width: 48 }} />
                        </Animated.View>

                        <Animated.ScrollView
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingTop: 80, paddingBottom: 40 }}
                            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
                            scrollEventThrottle={16}
                        >
                            {/* Interactive Main Player Section */}
                            <Animated.View style={{ opacity: mainContentOpacity, transform: [{ scale: artScale }, { translateY: artTranslateY }] }} {...panResponderMusic.panHandlers}>
                                <View style={styles.albumArtContainer}>
                                    <Image source={{ uri: currentTrack?.image }} style={[styles.albumArt, { width: width * 0.75, height: width * 0.75 }]} />
                                </View>

                                <View style={[styles.musicTrackInfo, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 }]}>
                                    <TouchableOpacity onPress={() => handleMusicInteraction(currentTrack?.id, 'dislike')} style={{ padding: 10 }}>
                                        <Ionicons name={musicPrefs[currentTrack?.id] === 'dislike' ? "thumbs-down" : "thumbs-down-outline"} size={28} color="#8F98A0" />
                                    </TouchableOpacity>

                                    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 10 }}>
                                        <Text style={styles.musicLargeTitle} numberOfLines={1}>{currentTrack?.title}</Text>
                                        <Text style={styles.musicLargeArtist} numberOfLines={1}>{currentTrack?.artist}</Text>
                                    </View>

                                    <TouchableOpacity onPress={() => handleMusicInteraction(currentTrack?.id, 'toggleLike')} style={{ padding: 10 }}>
                                        <Ionicons name={musicPrefs[currentTrack?.id] === 'like' ? "heart" : "heart-outline"} size={28} color={musicPrefs[currentTrack?.id] === 'like' ? "#FF007A" : "#FFF"} />
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
                                    {/* SHUFFLE BUTTON */}
                                    <TouchableOpacity onPress={() => setIsShuffle(!isShuffle)} style={{ padding: 10 }}>
                                        <Ionicons name="shuffle" size={24} color={isShuffle ? "#00E5FF" : "#8F98A0"} />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={handlePrevTrack}
                                        style={styles.skipBtn}
                                    >
                                        <Ionicons name="play-skip-back" size={32} color={currentMusicIndex > 0 || isShuffle || loopMode === 1 ? "#FFFFFF" : "#555"} />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.neonPlayWrapper}
                                        activeOpacity={0.8}
                                        onPress={() => {
                                            if (isMusicPlaying) { globalMusicPlayer.pause(); setIsMusicPlaying(false); }
                                            else { globalMusicPlayer.play(); setIsMusicPlaying(true); }
                                        }}
                                    >
                                        <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.neonPlayInner}>
                                            <Ionicons name={isMusicPlaying ? "pause" : "play"} size={36} color="#FFFFFF" style={!isMusicPlaying ? { marginLeft: 6 } : {}} />
                                        </LinearGradient>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={handleNextTrack}
                                        style={styles.skipBtn}
                                    >
                                        <Ionicons name="play-skip-forward" size={32} color={currentMusicIndex < musicQueue.length - 1 || isShuffle || loopMode === 1 ? "#FFFFFF" : "#555"} />
                                    </TouchableOpacity>

                                    {/* LOOP BUTTON */}
                                    <TouchableOpacity onPress={() => setLoopMode((prev) => (prev + 1) % 3)} style={{ padding: 10, position: 'relative' }}>
                                        <Ionicons name="repeat" size={24} color={loopMode !== 0 ? "#00E5FF" : "#8F98A0"} />
                                        {loopMode === 2 && <Text style={{ position: 'absolute', fontSize: 10, color: '#00E5FF', top: 10, right: 6, fontWeight: 'bold' }}>1</Text>}
                                    </TouchableOpacity>
                                </View>
                            </Animated.View>

                            <View style={styles.queueContainer}>
                                <Text style={styles.queueTitle}>Playlist</Text>
                                {musicQueue.map((track, index) => {
                                    const isActive = index === currentMusicIndex;
                                    return (
                                        <TouchableOpacity
                                            key={track.id + index}
                                            style={[styles.queueItem, isActive && { borderColor: '#00E5FF', backgroundColor: 'rgba(0, 229, 255, 0.1)' }]}
                                            onPress={() => setCurrentMusicIndex(index)}
                                        >
                                            <Image source={{ uri: track.image }} style={styles.queueImage} />
                                            <View style={styles.queueInfo}>
                                                <Text style={[styles.queueTrackTitle, isActive && { color: '#00E5FF' }]} numberOfLines={1}>{track.title}</Text>
                                                <Text style={styles.queueTrackArtist} numberOfLines={1}>{track.artist}</Text>
                                            </View>
                                            {isActive ? (
                                                <Ionicons name="stats-chart" size={20} color="#00E5FF" />
                                            ) : (
                                                <Ionicons name="play-circle-outline" size={24} color="#8F98A0" />
                                            )}
                                        </TouchableOpacity>
                                    )
                                })}
                            </View>
                        </Animated.ScrollView>
                    </View>
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999, elevation: 9999 }} pointerEvents="box-none">
                        <Toast
                            config={toastConfig}
                            position="top"
                            topOffset={insets.top > 0 ? insets.top + 10 : 50}
                        />
                    </View>
                </LinearGradient>
            </Modal>
        </LinearGradient>
    );
};

export default HomeScreen;

const styles = StyleSheet.create({
    background: { flex: 1 },
    container: { flex: 1 },
    header: { paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    maskedView: { height: 32, flexDirection: 'row', alignItems: 'center' },
    appName: { fontSize: 26, fontWeight: '900', letterSpacing: 0.5, lineHeight: 32, includeFontPadding: false },
    headerRightBtn: { padding: 4 },
    scrollContent: { paddingBottom: 60 },
    sectionHeader: { paddingHorizontal: 16, marginTop: 10, marginBottom: 6 },
    sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    deckArea: { height: 440, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },

    filterBarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 14 },
    filterTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    funnelBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    funnelBtnActive: { backgroundColor: 'rgba(0, 229, 255, 0.15)', borderColor: '#00E5FF' },
    filterDropdownContainer: { backgroundColor: 'rgba(20, 15, 30, 0.8)', paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 20 },
    filterGroup: { marginBottom: 16 },
    filterGroupTitle: { color: '#808085', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', paddingHorizontal: 16, marginBottom: 8, letterSpacing: 1 },
    filterScroll: { paddingHorizontal: 16, gap: 10 },
    filterChipContainer: { borderRadius: 20, overflow: 'hidden' },
    filterChipActive: { paddingHorizontal: 16, paddingVertical: 8, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
    filterChipInactive: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
    filterText: { color: '#A0A0A5', fontSize: 13, fontWeight: '600' },
    activeFilterText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },

    categoriesWrapper: { paddingTop: 4 },
    rowContainer: { marginBottom: 28 },
    rowTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 14, letterSpacing: 0.2 },
    rowListContent: { paddingHorizontal: 16, gap: 10 },

    mainCardContainer: { width: width * 0.85, height: 430, backgroundColor: '#2A1E39', borderRadius: 22, overflow: 'hidden', position: 'absolute', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 8 },
    mainCardImage: { width: '100%', height: '100%', position: 'absolute' },
    badgeContainer: { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15, 15, 20, 0.75)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)' },
    badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
    gradientOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 16 },
    movieDetailsContainer: { width: '72%' },
    movieTitle: { color: '#F5C518', fontSize: 26, fontWeight: '900', letterSpacing: 0.5, textShadowColor: 'rgba(0, 0, 0, 0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
    movieSubtitle: { color: '#E0E0E0', fontSize: 10, fontWeight: '500', lineHeight: 14, marginVertical: 4 },
    metadataText: { color: '#B0B5B9', fontSize: 11, fontWeight: 'bold' },
    actionButtonsWrapper: { position: 'absolute', bottom: 18, right: 14, alignItems: 'center', gap: 12 },
    iconActionBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(30, 30, 35, 0.65)', justifyContent: 'center', alignItems: 'center', borderWidth: 1.2, borderColor: 'rgba(255, 255, 255, 0.35)' },
    playButtonWrapper: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', elevation: 6, shadowColor: '#FF007A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 4 },
    playButtonGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

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

    sportsContainer: { paddingHorizontal: 16, paddingBottom: 20 },
    sportsCard: { backgroundColor: '#1E1428', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    sportsCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sportsSportText: { color: '#8F98A0', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
    liveBadge: { backgroundColor: '#FF007A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
    liveBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
    sportsMatchInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sportsTeamWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    sportsTeamWrapRight: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'flex-end' },
    sportsFlag: { width: 36, height: 26, borderRadius: 4, backgroundColor: '#2A2A30' },
    sportsScoreText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    sportsVs: { color: '#8F98A0', fontSize: 14, fontWeight: 'bold', paddingHorizontal: 10 },
    sportsTitle: { color: '#E0E0E0', fontSize: 14, marginBottom: 16, fontWeight: '600' },
    sportsCommentaryBox: { flexDirection: 'row', backgroundColor: 'rgba(0, 229, 255, 0.08)', padding: 12, borderRadius: 8, alignItems: 'center', gap: 8 },
    sportsCommentaryText: { color: '#00E5FF', fontSize: 13, flex: 1, fontStyle: 'italic' },

    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 20, 40, 0.6)', borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', height: 52, shadowColor: '#00E5FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, color: '#FFFFFF', fontSize: 15, height: '100%', fontWeight: '500', letterSpacing: 0.3 },
    clearSearchBtn: { padding: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12 },
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

    musicSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#25252A', borderRadius: 24, height: 52, paddingHorizontal: 16, borderWidth: 1, borderColor: 'transparent' },
    musicSearchBoxActive: { borderColor: '#00E5FF', backgroundColor: '#1C2533' },
    musicSearchIcon: { marginRight: 10 },
    musicSearchInput: { flex: 1, color: '#FFFFFF', fontSize: 16, height: '100%' },
    musicRightIcon: { paddingLeft: 10, height: 40, justifyContent: 'center' },
    ytMoodTag: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    ytMoodTagActive: { backgroundColor: '#FFFFFF' },
    ytMoodText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
    igStoryRing: { width: 76, height: 76, borderRadius: 38, padding: 3, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    artistSelectedBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#FF007A', borderRadius: 10, padding: 4, borderWidth: 2, borderColor: '#0A0A0C' },
    igArtistImg: { width: '100%', height: '100%', borderRadius: 38, borderWidth: 2, borderColor: '#0A0A0C' },
    igArtistName: { color: '#FFF', fontSize: 12, marginTop: 6, textAlign: 'center', fontWeight: '500' },
    ytSectionTitle: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 2 },
    ytSectionSubtitle: { color: '#8F98A0', fontSize: 11, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 16, letterSpacing: 0.5 },
    ytListTile: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 4 },
    ytTileImg: { width: 48, height: 48, borderRadius: 6, backgroundColor: '#2A2A30' },
    ytTileImgQuick: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#2A2A30' },
    ytTileTitle: { color: '#FFF', fontSize: 16, fontWeight: '600', marginBottom: 3 },
    ytTileSubtitle: { color: '#A0A0A5', fontSize: 13 },

    libraryChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1428', paddingRight: 16, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', alignSelf: 'flex-start' },
    libraryChipGradient: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    libraryChipText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },

    miniPlayerContainer: { position: 'absolute', left: 10, right: 10, backgroundColor: '#1E1E24', borderRadius: 12, elevation: 10, shadowColor: '#00E5FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    miniPlayerContent: { flexDirection: 'row', alignItems: 'center', padding: 10 },
    miniPlayerArt: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#2A2A30' },
    miniPlayerTextWrap: { flex: 1, marginLeft: 12, marginRight: 8 },
    miniPlayerTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
    miniPlayerArtist: { color: '#8F98A0', fontSize: 11 },
    miniPlayerControls: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 4 },
    miniPlayerBtn: { padding: 4 },
    miniProgressBarBg: { height: 3, backgroundColor: 'rgba(255,255,255,0.1)', width: '100%' },
    miniProgressBarFill: { height: '100%', backgroundColor: '#00E5FF' },

    musicHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 },
    stickyHeader: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, backgroundColor: 'rgba(10, 10, 12, 0.95)', zIndex: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    musicHeaderSubtitle: { color: '#8F98A0', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 4 },
    musicHeaderTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', maxWidth: 250, textAlign: 'center' },
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
});