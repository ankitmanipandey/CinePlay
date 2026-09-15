// src/hooks/useMusicEngine.js
import { useState, useEffect, useCallback, useRef } from 'react';
import Toast from 'react-native-toast-message';
import { safeFetchJson, mapSaavnSong } from '../services/jioSaavnApi';
import { normalizeString } from '../utils/homehelpers';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

export const useMusicEngine = (type, livePlayer, token, insets) => {
    const [musicQueue, setMusicQueue] = useState([]);
    const [currentMusicIndex, setCurrentMusicIndex] = useState(0);
    const [musicPrefs, setMusicPrefs] = useState({});
    const [isShuffle, setIsShuffle] = useState(false);
    const [loopMode, setLoopMode] = useState(0);
    const [musicProgress, setMusicProgress] = useState(0);
    const [musicDuration, setMusicDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    const playRequestId = useRef(0);
    const playingTrackId = useRef(null);
    const isFetchingQueue = useRef(false);

    // Fetch User Liked Songs
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

    const extendQueueIfNeeded = useCallback(async (index, queue) => {
        const thresholdIndex = Math.floor(queue.length * 0.70);
        if (queue.length < 5 || index < thresholdIndex || isFetchingQueue.current) return;
        const seed = queue[index];
        if (!seed) return;

        isFetchingQueue.current = true;
        try {
            let newTracks = [];
            const searchQ = encodeURIComponent(seed.artist || 'Trending');
            const randomPage = Math.floor(Math.random() * 8) + 1;
            const json = await safeFetchJson(`/search/songs?query=${searchQ}&page=${randomPage}&limit=15`);
            if (json?.success && json.data?.results) newTracks = json.data.results.map(mapSaavnSong).filter(t => t.url);

            if (newTracks.length > 0) {
                setMusicQueue(prev => {
                    const existingNames = new Set(prev.map(t => normalizeString(t.title)));
                    const filteredTracks = newTracks.filter(s => {
                        const normName = normalizeString(s.title);
                        if (!s.url || existingNames.has(normName)) return false;
                        existingNames.add(normName);
                        return true;
                    });
                    return [...prev, ...filteredTracks.slice(0, 10)];
                });
            }
        } catch (e) { }
        finally { isFetchingQueue.current = false; }
    }, []);

    const handleNextTrack = useCallback(() => {
        if (isShuffle) setCurrentMusicIndex(Math.floor(Math.random() * musicQueue.length));
        else if (currentMusicIndex < musicQueue.length - 1) setCurrentMusicIndex(prev => prev + 1);
        else if (loopMode === 1) setCurrentMusicIndex(0);
        else { livePlayer?.pause(); setIsPlaying(false); }
    }, [isShuffle, loopMode, currentMusicIndex, musicQueue.length, livePlayer]);

    const handlePrevTrack = useCallback(() => {
        if (musicProgress > 3) livePlayer.currentTime = 0;
        else if (isShuffle) setCurrentMusicIndex(Math.floor(Math.random() * musicQueue.length));
        else if (currentMusicIndex > 0) setCurrentMusicIndex(prev => prev - 1);
        else if (loopMode === 1) setCurrentMusicIndex(musicQueue.length - 1);
    }, [isShuffle, loopMode, currentMusicIndex, musicQueue.length, musicProgress, livePlayer]);

    useEffect(() => {
        if (type !== 'music' || currentMusicIndex < 0 || !musicQueue[currentMusicIndex] || !livePlayer) return;
        const track = musicQueue[currentMusicIndex];
        if (playingTrackId.current === track.id) return;
        playingTrackId.current = track.id;

        extendQueueIfNeeded(currentMusicIndex, musicQueue);
        const requestId = ++playRequestId.current;

        if (!track.url) { handleNextTrack(); return; }

        (async () => {
            try {
                setIsPlaying(false); setMusicProgress(0);
                await livePlayer.replaceAsync({ uri: track.url, metadata: { title: track.title, artist: track.artist, artwork: track.image } });
                if (requestId !== playRequestId.current) return;
                livePlayer.play();
                setIsPlaying(true);
            } catch (err) {
                if (requestId !== playRequestId.current) return;
                setIsPlaying(false);
                handleNextTrack();
            }
        })();
    }, [currentMusicIndex, musicQueue, type, livePlayer, extendQueueIfNeeded, handleNextTrack]);

    useEffect(() => {
        if (type !== 'music' || !livePlayer) return;
        const interval = setInterval(() => {
            if (isPlaying && livePlayer) {
                setMusicProgress(livePlayer.currentTime);
                setMusicDuration(livePlayer.duration);
            }
        }, 1000);

        const sub = livePlayer.addListener('playToEnd', async () => {
            setIsPlaying(false);
            if (loopMode === 2) { livePlayer.currentTime = 0; livePlayer.play(); setIsPlaying(true); }
            else { handleNextTrack(); }
        });
        return () => { clearInterval(interval); sub?.remove(); };
    }, [livePlayer, currentMusicIndex, musicQueue, isPlaying, type, loopMode, handleNextTrack]);

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
        musicQueue, setMusicQueue, currentMusicIndex, setCurrentMusicIndex,
        musicPrefs, isShuffle, setIsShuffle, loopMode, setLoopMode,
        musicProgress, musicDuration, isPlaying, setIsPlaying,
        handleNextTrack, handlePrevTrack, handleMusicAction
    };
};