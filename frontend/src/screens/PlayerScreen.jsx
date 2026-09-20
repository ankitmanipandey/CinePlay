import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useVideoPlayer } from 'expo-video';

// Components
import { MusicPlayerUI } from '../components/player/MusicPlayerUI';
import { VideoPlayerUI } from '../components/player/VideoPlayerUI';

// Stores & Hooks
import { useUserListStore } from '../store/useUserListStore';
import { useAuthStore } from '../store/useAuthStore';
import { useMusicEngine } from '../hooks/useMusicEngine';
import { useMediaDetails } from '../hooks/useMediaDetails';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

export default function PlayerScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { id, type, ytId, streamUrl, channelName, artworkUrl } = useLocalSearchParams();

    const { watchlist, watched, toggleWatchlist, toggleWatched } = useUserListStore();
    const { token } = useAuthStore();

    const [activeMediaView, setActiveMediaView] = useState('trailer');
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [selectedEpisode, setSelectedEpisode] = useState(1);

    // NEW: Separate local state specifically for the Video/Trailer player
    const [isVideoPlaying, setIsVideoPlaying] = useState(true);

    const livePlayer = useVideoPlayer(null, (player) => {
        player.loop = false;
        player.staysActiveInBackground = true;
        player.showNowPlayingNotification = true;
    });

    // 1. Music Logic Hook
    const musicState = useMusicEngine(type, livePlayer, token, insets);

    // NEW: Automatically pause background music when opening a movie/show screen
    useEffect(() => {
        if (type !== 'music' && musicState.isPlaying) {
            musicState.setIsPlaying(false);
        }
    }, [type]);

    // 2. Data Fetching Hook
    const { isLoading, mediaDetails, trailerKey, isVidkingAvailable } = useMediaDetails({
        id, type, ytId, streamUrl, channelName, artworkUrl,
        livePlayer,
        setMusicQueue: musicState.setMusicQueue,
        setIsPlaying: musicState.setIsPlaying
    });

    const handleAuthAction = (actionCallback) => {
        if (!token) Toast.show({ type: 'hotstarInfo', text1: 'Log in to use this feature', position: 'top', topOffset: 50 });
        else actionCallback();
    };

    const handleToggleAction = async (mediaId, mediaType, targetList) => {
        if (!mediaId || !mediaType) return;
        if (targetList === 'watchlist') toggleWatchlist(mediaId, mediaType);
        if (targetList === 'watched') toggleWatched(mediaId, mediaType);

        try {
            const response = await fetch(`${BACKEND_URL}/user/${targetList}/toggle`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ tmdbId: `${mediaId}:${mediaType}` }) });
            const data = await response.json();
            const arrayToMap = (arr) => arr.reduce((acc, curr) => { const [idStr, typeStr] = String(curr).split(':'); acc[idStr] = typeStr || 'movie'; return acc; }, {});
            useUserListStore.setState({ watchlist: arrayToMap(data.watchlist), watched: arrayToMap(data.watched) });
        } catch (error) {
            if (targetList === 'watchlist') toggleWatchlist(mediaId, mediaType);
            if (targetList === 'watched') toggleWatched(mediaId, mediaType);
        }
    };

    const handleCreateWatchParty = (vidIdArg, titleArg) => {
        handleAuthAction(() => {
            const newRoomId = Math.floor(10000 + Math.random() * 90000).toString();

            // Use what VideoPlayerUI sends; fall back only if it sent nothing
            const vidId = vidIdArg || (
                (id && type && activeMediaView === 'movie')
                    ? (type === 'tv'
                        ? `EMBEDMASTER:tv:${id}:${selectedSeason}:${selectedEpisode}`
                        : `EMBEDMASTER:movie:${id}`)
                    : (trailerKey || ytId)
            );

            musicState.setIsPlaying(false);
            router.push({
                pathname: '/theatre',
                params: {
                    roomId: newRoomId,
                    isHost: 'true',
                    initialYtId: vidId,
                    initialTitle: titleArg || mediaDetails?.title || mediaDetails?.name || 'Watch Party',
                },
            });
        });
    };

    if (isLoading) return <SafeAreaView style={styles.safeArea}><View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#FF007A" /></View></SafeAreaView>;
    if (!mediaDetails) return <SafeAreaView style={styles.safeArea}><View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><Text style={{ color: 'white' }}>Failed to load media.</Text><TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}><Text style={{ color: '#00E5FF' }}>Go Back</Text></TouchableOpacity></View></SafeAreaView>;

    if (type === 'music') {
        return (
            <MusicPlayerUI
                {...musicState}
                currentTrack={musicState.musicQueue[musicState.currentMusicIndex] || {}}
                livePlayer={livePlayer} router={router}
            />
        );
    }

    return (
        <VideoPlayerUI
            mediaDetails={mediaDetails} streamUrl={streamUrl} ytId={ytId} trailerKey={trailerKey}
            isPlaying={isVideoPlaying} setIsPlaying={setIsVideoPlaying} // UPDATED: Now uses local video state
            activeMediaView={activeMediaView} setActiveMediaView={setActiveMediaView}
            isVidkingAvailable={isVidkingAvailable}
            selectedSeason={selectedSeason} setSelectedSeason={setSelectedSeason}
            selectedEpisode={selectedEpisode} setSelectedEpisode={setSelectedEpisode}
            handleCreateWatchParty={handleCreateWatchParty} handleAuthAction={handleAuthAction}
            handleToggleAction={handleToggleAction} watchlist={watchlist} watched={watched}
            livePlayer={livePlayer} id={id} type={type} channelName={channelName} router={router}
        />
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#000' },
    container: { flex: 1, backgroundColor: '#0A0A0C' }
});