import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Components
import { MusicPlayerUI } from '../components/player/MusicPlayerUI';
import { VideoPlayerUI } from '../components/player/VideoPlayerUI';

// Hook
import { usePlayerLogic } from '../hooks/usePlayerLogic';

export default function PlayerScreenWeb() {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 1024;

    const {
        router, id, type, ytId, streamUrl, channelName,
        activeMediaView, setActiveMediaView, selectedSeason, setSelectedSeason,
        selectedEpisode, setSelectedEpisode, isVideoPlaying, setIsVideoPlaying,
        livePlayer, musicState, isLoading, mediaDetails, trailerKey, isVidkingAvailable,
        watchlist, watched, handleAuthAction, handleToggleAction, handleCreateWatchParty
    } = usePlayerLogic();

    if (isLoading) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color="#FF007A" />
                </View>
            </SafeAreaView>
        );
    }

    if (!mediaDetails) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.loaderContainer}>
                    <Text style={{ color: 'white', fontSize: 18 }}>Failed to load media.</Text>
                    <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, cursor: 'pointer' }}>
                        <Text style={{ color: '#00E5FF', fontWeight: 'bold' }}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // --------------------------------------------------------
    // DESKTOP LAYOUT (Widescreen)
    // --------------------------------------------------------
    if (isDesktop) {
        return (
            <View style={styles.desktopContainer}>
                {type === 'music' ? (
                    <MusicPlayerUI
                        {...musicState}
                        currentTrack={musicState.musicQueue[musicState.currentMusicIndex] || {}}
                        livePlayer={livePlayer} router={router}
                        isDesktop={true} // Passes layout state down for inner component styling
                    />
                ) : (
                    <VideoPlayerUI
                        mediaDetails={mediaDetails} streamUrl={streamUrl} ytId={ytId} trailerKey={trailerKey}
                        isPlaying={isVideoPlaying} setIsPlaying={setIsVideoPlaying}
                        activeMediaView={activeMediaView} setActiveMediaView={setActiveMediaView}
                        isVidkingAvailable={isVidkingAvailable}
                        selectedSeason={selectedSeason} setSelectedSeason={setSelectedSeason}
                        selectedEpisode={selectedEpisode} setSelectedEpisode={setSelectedEpisode}
                        handleCreateWatchParty={handleCreateWatchParty} handleAuthAction={handleAuthAction}
                        handleToggleAction={handleToggleAction} watchlist={watchlist} watched={watched}
                        livePlayer={livePlayer} id={id} type={type} channelName={channelName} router={router}
                        isDesktop={true} // Passes layout state down for inner component styling
                    />
                )}
            </View>
        );
    }

    // --------------------------------------------------------
    // MOBILE & TABLET LAYOUT (Exact Native Clone)
    // --------------------------------------------------------
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
            isPlaying={isVideoPlaying} setIsPlaying={setIsVideoPlaying}
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
    loaderContainer: { flex: 1, backgroundColor: '#0A0A0C', justifyContent: 'center', alignItems: 'center' },

    // Desktop wrapper ensures the player takes full browser viewport
    desktopContainer: { flex: 1, backgroundColor: '#0A0A0C', width: '100%', height: '100vh' }
});