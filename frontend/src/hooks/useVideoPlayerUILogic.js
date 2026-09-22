import { useState, useRef, useEffect, useCallback } from 'react';
import { Animated, useWindowDimensions,Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';

export const useVideoPlayerUILogic = (props) => {
    const {
        mediaDetails, streamUrl, ytId, trailerKey, isPlaying, setIsPlaying,
        activeMediaView, setActiveMediaView, isVidkingAvailable,
        selectedSeason, setSelectedSeason, selectedEpisode, setSelectedEpisode,
        handleCreateWatchParty, handleAuthAction, handleToggleAction,
        watchlist, watched, livePlayer, id, type, channelName, router
    } = props;

    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const controlsFadeAnim = useRef(new Animated.Value(1)).current;
    const controlsTimer = useRef(null);
    const webViewRef = useRef(null);

    const isNonYouTubeSource = !!streamUrl || activeMediaView === 'movie';
    const TAB_BAR_HEIGHT = 88 + insets.bottom;

    const resetControlsTimer = useCallback(() => {
        if (controlsTimer.current) clearTimeout(controlsTimer.current);
        setShowControls(true);
        Animated.timing(controlsFadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();

        controlsTimer.current = setTimeout(() => {
            Animated.timing(controlsFadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
                setShowControls(false);
            });
        }, 3000);
    }, [controlsFadeAnim]);

    useEffect(() => {
        resetControlsTimer();
        return () => {
            if (Platform.OS !== 'web') {
                ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => { });
            }
            if (controlsTimer.current) clearTimeout(controlsTimer.current);
        };
    }, [resetControlsTimer]);

    const toggleFullScreen = async () => {
        if (isFullScreen) {
            if (Platform.OS !== 'web') {
                try { await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); } catch (e) { }
            }
            setIsFullScreen(false);
        } else {
            if (Platform.OS !== 'web') {
                try { await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE); } catch (e) { }
            }
            setIsFullScreen(true);
        }
        resetControlsTimer();
    };

    const handleBackPress = async () => {
        if (isFullScreen) await toggleFullScreen();
        else router.back();
    };

    const title = mediaDetails.title || mediaDetails.name;
    const year = (mediaDetails.release_date || mediaDetails.first_air_date || '').substring(0, 4);
    const languages = mediaDetails.spoken_languages?.map(lang => lang.english_name).join(', ') || 'Unknown';
    const isCurrentInWatchlist = watchlist[id];
    const isCurrentInWatched = watched[id];

    const tvSeasons = mediaDetails?.seasons?.filter(s => s.season_number > 0) || [];
    const currentSeasonData = tvSeasons.find(s => s.season_number === selectedSeason) || tvSeasons[0];
    const episodeCount = currentSeasonData?.episode_count || 1;
    const episodesArray = Array.from({ length: episodeCount }, (_, i) => i + 1);

    const actualWidth = Math.max(width, height);
    const actualHeight = Math.min(width, height);

    const containerWidth = isFullScreen ? actualWidth : width;
    const containerHeight = isFullScreen ? actualHeight : width * (9 / 16);
    const innerVideoWidth = isFullScreen ? actualHeight * (16 / 9) : width;
    const innerVideoHeight = isFullScreen ? actualHeight : width * (9 / 16);

    return {
        width, height, insets,
        isFullScreen, showControls, controlsFadeAnim, webViewRef, isNonYouTubeSource, TAB_BAR_HEIGHT,
        resetControlsTimer, toggleFullScreen, handleBackPress,
        title, year, languages, isCurrentInWatchlist, isCurrentInWatched,
        tvSeasons, episodesArray,
        containerWidth, containerHeight, innerVideoWidth, innerVideoHeight
    };
};