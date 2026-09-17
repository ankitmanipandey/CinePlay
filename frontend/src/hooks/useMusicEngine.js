// src/hooks/useMusicEngine.js
import { useState, useEffect, useRef } from 'react';
import Toast from 'react-native-toast-message';
import TrackPlayer, {
    useActiveMediaItem,
    useIsPlaying,
    useProgress,
    RepeatMode
} from '@rntp/player';
import { safeFetchJson, mapSaavnSong } from '../services/jioSaavnApi';
import { normalizeString } from '../utils/homehelpers';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

export const useMusicEngine = (type, token, insets) => {
    const activeTrack = useActiveMediaItem();
    // Rename native playing state so we can wrap it in our own fast UI state
    const { playing: nativePlaying } = useIsPlaying();
    const { position: musicProgress, duration: musicDuration } = useProgress();

    const [musicPrefs, setMusicPrefs] = useState({});
    const [isShuffle, setIsShuffle] = useState(false);
    const [loopMode, setLoopMode] = useState(RepeatMode.Off);

    const [localQueueUI, setLocalQueueUI] = useState([]);

    // Centralized optimistic playing state
    const [isPlaying, setLocalIsPlaying] = useState(false);

    // ==========================================
    // ⏰ SLEEP TIMER STATE & REFS
    // ==========================================
    const [sleepTimerRemaining, setSleepTimerRemaining] = useState(null); // stores seconds
    const sleepTimerRef = useRef(null);

    const currentMusicIndex = localQueueUI.findIndex(
        t => t.mediaId === activeTrack?.mediaId || t.id === activeTrack?.id || t.id === activeTrack?.mediaId
    );

    const isExtendingRef = useRef(false);

    // Keep our fast local state synced with the true native state
    useEffect(() => {
        if (nativePlaying !== undefined) {
            setLocalIsPlaying(nativePlaying);
        }
    }, [nativePlaying]);

    // ==========================================
    // ⏰ SLEEP TIMER LOGIC
    // ==========================================
    const startSleepTimer = (minutes) => {
        // Clear any existing timer first
        if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);

        if (!minutes || minutes <= 0) {
            setSleepTimerRemaining(null);
            Toast.show({ type: 'hotstarInfo', text1: 'Sleep timer cancelled' });
            return;
        }

        const endTime = Date.now() + minutes * 60000;
        setSleepTimerRemaining(minutes * 60); // Store in seconds for the UI
        Toast.show({ type: 'hotstarSuccess', text1: `Sleep timer set for ${minutes} minutes` });

        // Start the countdown
        sleepTimerRef.current = setInterval(() => {
            const remainingSecs = Math.round((endTime - Date.now()) / 1000);

            if (remainingSecs <= 0) {
                // Time's up! Stop the timer and pause the music
                clearInterval(sleepTimerRef.current);
                setSleepTimerRemaining(null);
                handleSetIsPlaying(false); // Pause TrackPlayer natively
            } else {
                setSleepTimerRemaining(remainingSecs);
            }
        }, 1000);
    };

    // Cleanup timer if the component/hook unmounts completely
    useEffect(() => {
        return () => {
            if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
        };
    }, []);

    // ==========================================
    // 🎵 STANDARD MUSIC ENGINE LOGIC
    // ==========================================
    useEffect(() => {
        if (token) {
            fetch(`${BACKEND_URL}/user/lists`, { headers: { Authorization: `Bearer ${token}` } })
                .then(res => res.json())
                .then(data => {
                    if (data.likedSongs) {
                        const initialPrefs = {};
                        data.likedSongs.forEach(sId => { initialPrefs[sId] = 'like'; });
                        setMusicPrefs(initialPrefs);
                    }
                }).catch(() => { });
        }
    }, [token]);

    const setMusicQueue = async (initialQueue, selectedTrackId = null) => {
        const refinedQueue = initialQueue.map(s => {
            const actualStreamUrl = s.downloadUrl?.find?.(d => d.quality === '320kbps')?.url || s.downloadUrl?.[0]?.url || s.url;
            const actualImgUrl = Array.isArray(s.image) ? (s.image?.find?.(i => i.quality === '500x500')?.url || s.image?.[0]?.url) : s.image;

            return {
                id: String(s.id),
                mediaId: String(s.id),
                url: actualStreamUrl,
                title: s.title || s.name,
                artist: s.artist || s.description || s.subtitle || (s.artists?.primary?.map(a => a.name).join(', ') || 'Unknown Artist'),
                artwork: actualImgUrl,
                artworkUrl: actualImgUrl,
                duration: s.duration ? Number(s.duration) : 0,
            };
        }).filter(s => s.url && (s.url.includes('.mp4') || s.url.includes('.aac') || s.url.includes('http')));

        const seenNames = new Set();
        const rntpQueue = [];
        for (const s of refinedQueue) {
            const norm = normalizeString(s.title);
            if (!seenNames.has(norm)) { seenNames.add(norm); rntpQueue.push(s); }
        }

        let selectedIndex = rntpQueue.findIndex(s => s.mediaId === String(selectedTrackId));
        if (selectedIndex === -1) selectedIndex = 0;

        setLocalQueueUI(rntpQueue);

        await TrackPlayer.setMediaItems(rntpQueue, selectedIndex);

        // INSTANT UI FIX: Immediately tell the app it is playing!
        setLocalIsPlaying(true);
        TrackPlayer.play();
    };

    useEffect(() => {
        if (!activeTrack || currentMusicIndex < 0 || localQueueUI.length === 0) return;

        const thresholdIndex = Math.floor(localQueueUI.length * 0.70);
        if (currentMusicIndex < thresholdIndex || isExtendingRef.current) return;

        const extendQueue = async () => {
            isExtendingRef.current = true;
            const seed = localQueueUI[currentMusicIndex];
            try {
                let newTracks = [];
                const searchQ = encodeURIComponent(seed.artist || 'Trending');
                const randomPage = Math.floor(Math.random() * 8) + 1;
                const json = await safeFetchJson(`/search/songs?query=${searchQ}&page=${randomPage}&limit=15`);

                if (json?.success && json.data?.results) {
                    newTracks = json.data.results.map(mapSaavnSong).filter(t => t.url);
                }

                if (newTracks.length > 0) {
                    const existingNames = new Set(localQueueUI.map(t => normalizeString(t.title)));
                    const filteredTracks = newTracks.filter(s => {
                        const normName = normalizeString(s.title);
                        if (!s.url || existingNames.has(normName)) return false;
                        existingNames.add(normName);
                        return true;
                    });

                    const formatForRntp = filteredTracks.slice(0, 10).map(s => ({
                        id: String(s.id),
                        mediaId: String(s.id),
                        url: s.downloadUrl?.find?.(d => d.quality === '320kbps')?.url || s.downloadUrl?.[0]?.url || s.url,
                        title: s.title || s.name,
                        artist: s.artist || s.description || 'Unknown Artist',
                        artwork: Array.isArray(s.image) ? s.image[0]?.url : s.image,
                        artworkUrl: Array.isArray(s.image) ? s.image[0]?.url : s.image,
                        duration: s.duration ? Number(s.duration) : 0,
                    }));

                    if (formatForRntp.length > 0) {
                        setLocalQueueUI(prev => [...prev, ...formatForRntp]);

                        if (typeof TrackPlayer.addMediaItems === 'function') {
                            await TrackPlayer.addMediaItems(formatForRntp);
                        } else if (typeof TrackPlayer.add === 'function') {
                            await TrackPlayer.add(formatForRntp);
                        } else {
                            const currentQueue = await TrackPlayer.getQueue();
                            await TrackPlayer.setMediaItems([...currentQueue, ...formatForRntp]);
                        }
                    }
                }
            } catch (e) {
                console.error("Queue extend failed:", e);
            } finally {
                isExtendingRef.current = false;
            }
        };

        extendQueue();
    }, [activeTrack, currentMusicIndex, localQueueUI]);

    const handleNextTrack = async () => {
        try {
            if (isShuffle && localQueueUI.length > 1) {
                let randomIndex = currentMusicIndex;
                while (randomIndex === currentMusicIndex) {
                    randomIndex = Math.floor(Math.random() * localQueueUI.length);
                }
                await TrackPlayer.skipToIndex(randomIndex);
            } else {
                await TrackPlayer.skipToNext();
            }
        } catch (error) { }
    };

    const handlePrevTrack = async () => {
        try {
            if (isShuffle && localQueueUI.length > 1) {
                let randomIndex = currentMusicIndex;
                while (randomIndex === currentMusicIndex) {
                    randomIndex = Math.floor(Math.random() * localQueueUI.length);
                }
                await TrackPlayer.skipToIndex(randomIndex);
            } else {
                await TrackPlayer.skipToPrevious();
            }
        } catch (error) {
            await TrackPlayer.seekTo(0);
        }
    };

    const handleSeekTo = (time) => TrackPlayer.seekTo(time);

    const handleSetIsPlaying = (playState) => {
        setLocalIsPlaying(playState);
        if (playState) TrackPlayer.play();
        else TrackPlayer.pause();
    };

    const toggleLoopMode = () => {
        const nextMode = loopMode === RepeatMode.Off ? RepeatMode.All :
            loopMode === RepeatMode.All ? RepeatMode.One : RepeatMode.Off;
        setLoopMode(nextMode);
        TrackPlayer.setRepeatMode(nextMode);
    };

    const handleMusicAction = async (songId, action) => {
        if (!token) return Toast.show({ type: 'hotstarInfo', text1: 'Log in for personalization', position: 'top', topOffset: insets.top > 0 ? insets.top + 10 : 50 });
        let finalAction = action === 'toggleLike' ? (musicPrefs[songId] === 'like' ? 'removeLike' : 'like') : action;
        if (action !== 'listen') setMusicPrefs(prev => ({ ...prev, [songId]: finalAction === 'removeLike' ? null : finalAction }));

        try {
            await fetch(`${BACKEND_URL}/user/music/interact`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ songId, action: finalAction }) });
            if (finalAction === 'like') Toast.show({ type: 'hotstarSuccess', text1: 'Saved to Liked Songs' });
            else if (finalAction === 'dislike') handleNextTrack();
        } catch (error) { }
    };

    return {
        musicQueue: localQueueUI,
        setMusicQueue,
        currentMusicIndex,
        setCurrentMusicIndex: (idx) => TrackPlayer.skipToIndex(idx),
        musicPrefs,
        isShuffle,
        setIsShuffle,
        loopMode,
        setLoopMode: toggleLoopMode,
        musicProgress,
        musicDuration,
        isPlaying,
        setIsPlaying: handleSetIsPlaying,
        handleNextTrack,
        handlePrevTrack,
        handleSeekTo,
        handleMusicAction,

        // --- NEW EXPORTS FOR SLEEP TIMER ---
        startSleepTimer,
        sleepTimerRemaining
    };
};