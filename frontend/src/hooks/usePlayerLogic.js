import { useState, useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useVideoPlayer } from 'expo-video';

import { useUserListStore } from '../store/useUserListStore';
import { useAuthStore } from '../store/useAuthStore';
import { useMusicEngine } from '../hooks/useMusicEngine';
import { useMediaDetails } from '../hooks/useMediaDetails';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

export const usePlayerLogic = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { id, type, ytId, streamUrl, channelName, artworkUrl } = useLocalSearchParams();

    const { watchlist, watched, toggleWatchlist, toggleWatched } = useUserListStore();
    const { token } = useAuthStore();

    const [activeMediaView, setActiveMediaView] = useState('trailer');
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [selectedEpisode, setSelectedEpisode] = useState(1);

    const [isVideoPlaying, setIsVideoPlaying] = useState(true);
    const creatingRoomRef = useRef(false);

    const livePlayer = useVideoPlayer(null, (player) => {
        player.loop = false;
        player.staysActiveInBackground = true;
        player.showNowPlayingNotification = true;
    });

    const musicState = useMusicEngine(type, token, insets);

    // Automatically pause background music when opening a movie/show screen
    useEffect(() => {
        if (type !== 'music' && musicState.isPlaying) {
            musicState.setIsPlaying(false);
        }
    }, [type, musicState]);

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
            const response = await fetch(`${BACKEND_URL}/user/${targetList}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ tmdbId: `${mediaId}:${mediaType}` })
            });
            const data = await response.json();
            const arrayToMap = (arr) => arr.reduce((acc, curr) => {
                const [idStr, typeStr] = String(curr).split(':');
                acc[idStr] = typeStr || 'movie';
                return acc;
            }, {});
            useUserListStore.setState({ watchlist: arrayToMap(data.watchlist), watched: arrayToMap(data.watched) });
        } catch (error) {
            if (targetList === 'watchlist') toggleWatchlist(mediaId, mediaType);
            if (targetList === 'watched') toggleWatched(mediaId, mediaType);
        }
    };

    const handleCreateWatchParty = (vidIdArg, titleArg) => {
        handleAuthAction(async () => {
            if (creatingRoomRef.current) return;
            creatingRoomRef.current = true;

            try {
                const res = await fetch(`${BACKEND_URL}/rooms`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok || !data.roomId) throw new Error(data.message || 'Could not create room');

                const vidId = vidIdArg || (
                    (id && type && activeMediaView === 'movie')
                        ? (type === 'tv'
                            ? `VIDLINK:tv:${id}:${selectedSeason}:${selectedEpisode}`
                            : `VIDLINK:movie:${id}`)
                        : (trailerKey || ytId)
                );

                musicState.setIsPlaying(false);
                router.push({
                    pathname: '/theatre',
                    params: {
                        roomId: data.roomId,
                        isHost: 'true',
                        initialYtId: vidId,
                        initialTitle: titleArg || mediaDetails?.title || mediaDetails?.name || 'Watch Party',
                    },
                });
            } catch (error) {
                Toast.show({ type: 'hotstarError', text1: 'Could not start watch party', text2: error.message, position: 'top' });
            } finally {
                creatingRoomRef.current = false;
            }
        });
    };

    return {
        router, id, type, ytId, streamUrl, channelName,
        activeMediaView, setActiveMediaView, selectedSeason, setSelectedSeason,
        selectedEpisode, setSelectedEpisode, isVideoPlaying, setIsVideoPlaying,
        livePlayer, musicState, isLoading, mediaDetails, trailerKey, isVidkingAvailable,
        watchlist, watched, handleAuthAction, handleToggleAction, handleCreateWatchParty
    };
};