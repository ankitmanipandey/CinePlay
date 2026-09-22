import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, Keyboard, ActivityIndicator, Modal, Dimensions, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReAnimated, { LinearTransition } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { useYTMusicFeedLogic } from '../../hooks/useYTMusicFeedLogic';

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
    const { width: windowWidth } = useWindowDimensions();
    const isDesktop = windowWidth >= 1024;

    const {
        insets, width,
        selectedArtists, setSelectedArtists, isFeedShuffled, setIsFeedShuffled,
        speedDial, quickPicks, artistPlaylists, loading,
        searchQuery, setSearchQuery, searchResults, isSearching, isListening,
        likedModalOpen, setLikedModalOpen, loadingLiked, likedSongsList,
        toggleListening, toggleArtistSelection, handleSelectArtistFromSearch,
        fetchLikedSongs, chunkArray, handleSongClick,
        displayTopArtists, unifiedArtistQueue, shuffledFeedSongs
    } = useYTMusicFeedLogic({ onPlayMusic, activeTrackId });

    if (loading && speedDial.length === 0 && artistPlaylists.length === 0) {
        return <View style={{ alignItems: 'center', paddingTop: 60 }}><ActivityIndicator size="large" color="#FF007A" /></View>;
    }

    // --------------------------------------------------------
    // DESKTOP LAYOUT
    // --------------------------------------------------------
    if (isDesktop) {
        return (
            <ReAnimated.View layout={LinearTransition} style={styles.desktopContainer}>

                {/* LIKED SONGS MODAL DESKTOP (Centered Window) */}
                <Modal visible={likedModalOpen} animationType="fade" transparent={true} onRequestClose={() => setLikedModalOpen(false)}>
                    <View style={styles.desktopModalOverlay}>
                        <View style={styles.desktopModalContent}>
                            <View style={styles.desktopModalHeader}>
                                <Text style={{ color: '#FFF', fontSize: 24, fontWeight: 'bold' }}>Liked Songs</Text>
                                <TouchableOpacity onPress={() => setLikedModalOpen(false)}>
                                    <Ionicons name="close" size={28} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                            {loadingLiked ? (
                                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#FF007A" /></View>
                            ) : likedSongsList.length === 0 ? (
                                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                    <Ionicons name="heart-dislike-outline" size={64} color="#8F98A0" style={{ marginBottom: 16 }} />
                                    <Text style={{ color: '#E0E0E0', fontSize: 18, fontWeight: 'bold' }}>No Liked Songs Yet</Text>
                                </View>
                            ) : (
                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24 }}>
                                    <View style={styles.desktopGrid}>
                                        {likedSongsList.map((track) => {
                                            const imgUrl = Array.isArray(track.image) ? (track.image?.find?.(i => i.quality === '500x500')?.url || track.image?.[0]?.url) : track.image;
                                            const isActiveTrack = String(track.id) === String(activeTrackId);
                                            return (
                                                <TouchableOpacity key={track.id} style={styles.desktopListTile} onPress={() => { handleSongClick(track, likedSongsList); setLikedModalOpen(false); }}>
                                                    <Image source={{ uri: imgUrl }} style={styles.desktopTileImg} />
                                                    <View style={{ flex: 1, justifyContent: 'center', paddingRight: 10 }}>
                                                        <Text style={[styles.ytTileTitle, isActiveTrack && { color: '#00E5FF' }]} numberOfLines={1}>{track.title || track.name}</Text>
                                                        <Text style={styles.ytTileSubtitle} numberOfLines={1}>{track.artist || track.subtitle}</Text>
                                                    </View>
                                                    {isActiveTrack && <Ionicons name="stats-chart" size={16} color="#00E5FF" />}
                                                </TouchableOpacity>
                                            )
                                        })}
                                    </View>
                                </ScrollView>
                            )}
                        </View>
                    </View>
                </Modal>

                {/* DESKTOP SEARCH BAR */}
                <View style={styles.desktopSearchRow}>
                    <View style={[styles.musicSearchBox, styles.desktopSearchBox, isListening && styles.musicSearchBoxActive]}>
                        <Ionicons name="search" size={22} color="#00E5FF" style={styles.musicSearchIcon} />
                        <TextInput style={styles.musicSearchInput} placeholder={isListening ? "Listening..." : "Search songs, artists..."} placeholderTextColor={isListening ? "#00E5FF" : "#8F98A0"} value={searchQuery} onChangeText={setSearchQuery} selectionColor="#00E5FF" autoCapitalize="none" />
                        {searchQuery.length > 0 && !isListening ? (
                            <TouchableOpacity onPress={() => { setSearchQuery(''); Keyboard.dismiss(); }} style={styles.musicRightIcon}>
                                <Ionicons name="close-circle" size={20} color="#8F98A0" />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity onPress={toggleListening} style={styles.musicRightIcon}>
                                {isListening ? <ActivityIndicator size="small" color="#00E5FF" /> : <Ionicons name="mic-outline" size={24} color="#FFFFFF" />}
                            </TouchableOpacity>
                        )}
                    </View>
                    {searchQuery.trim().length === 0 && (
                        <TouchableOpacity style={[styles.libraryChip, { marginLeft: 20 }]} activeOpacity={0.8} onPress={fetchLikedSongs}>
                            <LinearGradient colors={['#FF007A', '#9B51E0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.libraryChipGradient}>
                                <Ionicons name="heart" size={18} color="#FFF" style={{ marginTop: 2 }} />
                            </LinearGradient>
                            <Text style={[styles.libraryChipText, { fontSize: 16 }]}>Liked Songs</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {searchQuery.trim().length > 0 ? (
                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60 }}>
                        {isSearching ? (
                            <ActivityIndicator color="#00E5FF" style={{ marginTop: 30 }} />
                        ) : (
                            <>
                                {searchResults.artists.length > 0 && (
                                    <View style={{ marginBottom: 32 }}>
                                        <Text style={[styles.ytSectionTitle, { marginBottom: 16 }]}>Artists</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 24 }}>
                                            {searchResults.artists.map(artist => {
                                                const artistName = artist.title || artist.name;
                                                const isSelected = selectedArtists.includes(artistName);
                                                return (
                                                    <TouchableOpacity key={artist.id} style={{ alignItems: 'center', width: 100 }} onPress={() => handleSelectArtistFromSearch(artist)}>
                                                        <LinearGradient colors={isSelected ? ['#00E5FF', '#FF007A'] : ['#2A2A30', '#2A2A30']} style={styles.desktopIgStoryRing}>
                                                            <ArtistImage name={artistName} rawImage={artist.image} style={styles.desktopIgArtistImg} />
                                                        </LinearGradient>
                                                        <Text style={[styles.igArtistName, { fontSize: 14 }]} numberOfLines={2}>{artistName}</Text>
                                                    </TouchableOpacity>
                                                )
                                            })}
                                        </ScrollView>
                                    </View>
                                )}
                                {searchResults.songs.length > 0 && (
                                    <View>
                                        <Text style={[styles.ytSectionTitle, { marginBottom: 16 }]}>Songs</Text>
                                        <View style={styles.desktopGrid}>
                                            {searchResults.songs.map(track => {
                                                const imgUrl = track.image?.find?.(i => i.quality === '500x500')?.url || track.image?.[0]?.url || track.image;
                                                const isActiveTrack = String(track.id) === String(activeTrackId);
                                                return (
                                                    <TouchableOpacity key={track.id} style={styles.desktopListTile} onPress={() => handleSongClick(track, searchResults.songs)}>
                                                        <ArtistImage name={track.title || track.name} rawImage={imgUrl} style={styles.desktopTileImg} />
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
                                    <Text style={{ color: '#8F98A0', textAlign: 'center', marginTop: 40, fontSize: 18 }}>No results found</Text>
                                )}
                            </>
                        )}
                    </ScrollView>
                ) : (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={[styles.ytSectionTitle, { marginBottom: 0 }]}>Top Artists</Text>
                            {selectedArtists.length > 0 && (
                                <TouchableOpacity onPress={() => setSelectedArtists([])}>
                                    <Text style={{ color: '#FF007A', fontSize: 14, fontWeight: 'bold', letterSpacing: 0.5 }}>CLEAR ALL</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 24, marginBottom: 40 }}>
                            {displayTopArtists.map(artist => {
                                const isSelected = selectedArtists.includes(artist.name);
                                return (
                                    <TouchableOpacity key={artist.id} style={{ alignItems: 'center', width: 100 }} onPress={() => toggleArtistSelection(artist.name)}>
                                        <LinearGradient colors={isSelected ? ['#00E5FF', '#FF007A'] : ['#2A2A30', '#2A2A30']} style={styles.desktopIgStoryRing}>
                                            <ArtistImage name={artist.name} rawImage={artist.image} style={styles.desktopIgArtistImg} />
                                        </LinearGradient>
                                        <Text style={[styles.igArtistName, { fontSize: 14 }]} numberOfLines={2}>{artist.name}</Text>
                                    </TouchableOpacity>
                                )
                            })}
                        </ScrollView>

                        {selectedArtists.length > 0 ? (
                            <View>
                                {loading ? (
                                    <View style={{ alignItems: 'center', paddingVertical: 40 }}><ActivityIndicator size="large" color="#00E5FF" /></View>
                                ) : (
                                    <>
                                        {artistPlaylists.length > 0 && (
                                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 20 }}>
                                                <TouchableOpacity onPress={() => setIsFeedShuffled(!isFeedShuffled)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isFeedShuffled ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255,255,255,0.05)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: isFeedShuffled ? '#00E5FF' : 'transparent' }}>
                                                    <Ionicons name="shuffle" size={20} color={isFeedShuffled ? "#00E5FF" : "#FFFFFF"} style={{ marginRight: 8 }} />
                                                    <Text style={{ color: isFeedShuffled ? "#00E5FF" : "#FFFFFF", fontSize: 14, fontWeight: 'bold' }}>SHUFFLE PLAYLIST</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}

                                        {isFeedShuffled ? (
                                            <View style={styles.desktopGrid}>
                                                {shuffledFeedSongs.map(track => {
                                                    const imgUrl = track.image?.find?.(i => i.quality === '500x500')?.url || track.image?.[0]?.url || track.image;
                                                    const isActiveTrack = String(track.id) === String(activeTrackId);
                                                    return (
                                                        <TouchableOpacity key={track.id} style={styles.desktopListTile} onPress={() => handleSongClick(track, shuffledFeedSongs)}>
                                                            <ArtistImage name={track.title || track.name} rawImage={imgUrl} style={styles.desktopTileImg} />
                                                            <View style={{ flex: 1, justifyContent: 'center', paddingRight: 10 }}>
                                                                <Text style={[styles.ytTileTitle, isActiveTrack && { color: '#00E5FF' }]} numberOfLines={1}>{track.title || track.name}</Text>
                                                                <Text style={styles.ytTileSubtitle} numberOfLines={1}>{track.artists?.primary?.map(a => a.name).join(', ') || track.subtitle}</Text>
                                                            </View>
                                                            {isActiveTrack && <Ionicons name="stats-chart" size={16} color="#00E5FF" />}
                                                        </TouchableOpacity>
                                                    )
                                                })}
                                            </View>
                                        ) : (
                                            artistPlaylists.map((playlist, pIdx) => (
                                                <View key={pIdx} style={{ marginBottom: 40 }}>
                                                    <Text style={[styles.ytSectionTitle, { fontSize: 26, marginBottom: 20 }]}>{playlist.artist}</Text>
                                                    <View style={styles.desktopGrid}>
                                                        {playlist.songs.map(track => {
                                                            const imgUrl = track.image?.find?.(i => i.quality === '500x500')?.url || track.image?.[0]?.url || track.image;
                                                            const isActiveTrack = String(track.id) === String(activeTrackId);
                                                            return (
                                                                <TouchableOpacity key={track.id} style={styles.desktopListTile} onPress={() => handleSongClick(track, unifiedArtistQueue)}>
                                                                    <ArtistImage name={track.title || track.name} rawImage={imgUrl} style={styles.desktopTileImg} />
                                                                    <View style={{ flex: 1, justifyContent: 'center', paddingRight: 10 }}>
                                                                        <Text style={[styles.ytTileTitle, isActiveTrack && { color: '#00E5FF' }]} numberOfLines={1}>{track.title || track.name}</Text>
                                                                        <Text style={styles.ytTileSubtitle} numberOfLines={1}>{track.artists?.primary?.map(a => a.name).join(', ') || track.subtitle || playlist.artist}</Text>
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
                                    <View style={{ alignItems: 'center', paddingVertical: 40 }}><ActivityIndicator size="large" color="#00E5FF" /></View>
                                ) : (
                                    <>
                                        <Text style={[styles.ytSectionTitle, { marginBottom: 20 }]}>Speed dial</Text>
                                        <View style={styles.desktopGrid}>
                                            {speedDial.map(track => {
                                                const imgUrl = track.image?.find(i => i.quality === '500x500')?.url || track.image?.[0]?.url;
                                                const isActiveTrack = String(track.id) === String(activeTrackId);
                                                return (
                                                    <TouchableOpacity key={track.id} style={styles.desktopListTile} onPress={() => handleSongClick(track, speedDial)}>
                                                        <Image source={{ uri: imgUrl }} style={styles.desktopTileImg} />
                                                        <View style={{ flex: 1, justifyContent: 'center', paddingRight: 10 }}>
                                                            <Text style={[styles.ytTileTitle, isActiveTrack && { color: '#00E5FF' }]} numberOfLines={1}>{track.name || track.title}</Text>
                                                            <Text style={styles.ytTileSubtitle} numberOfLines={1}>{track.artists?.primary?.map(a => a.name).join(', ') || track.subtitle}</Text>
                                                        </View>
                                                        {isActiveTrack && <Ionicons name="stats-chart" size={16} color="#00E5FF" />}
                                                    </TouchableOpacity>
                                                )
                                            })}
                                        </View>

                                        <Text style={[styles.ytSectionTitle, { marginTop: 40 }]}>Quick picks</Text>
                                        <Text style={[styles.ytSectionSubtitle, { marginBottom: 20 }]}>START RADIO FROM A SONG</Text>
                                        <View style={[styles.desktopGrid, { marginBottom: 60 }]}>
                                            {quickPicks.map(track => {
                                                const imgUrl = track.image?.find(i => i.quality === '500x500')?.url || track.image?.[0]?.url;
                                                const isActiveTrack = String(track.id) === String(activeTrackId);
                                                return (
                                                    <TouchableOpacity key={track.id} style={styles.desktopListTile} onPress={() => handleSongClick(track, quickPicks)}>
                                                        <Image source={{ uri: imgUrl }} style={styles.desktopTileImg} />
                                                        <View style={{ flex: 1, justifyContent: 'center', paddingRight: 10 }}>
                                                            <Text style={[styles.ytTileTitle, isActiveTrack && { color: '#00E5FF' }]} numberOfLines={1}>{track.name || track.title}</Text>
                                                            <Text style={styles.ytTileSubtitle} numberOfLines={1}>{track.artists?.primary?.map(a => a.name).join(', ') || track.subtitle}</Text>
                                                        </View>
                                                        {isActiveTrack && <Ionicons name="stats-chart" size={16} color="#00E5FF" />}
                                                    </TouchableOpacity>
                                                )
                                            })}
                                        </View>
                                    </>
                                )}
                            </>
                        )}
                    </ScrollView>
                )}
            </ReAnimated.View>
        );
    }

    // --------------------------------------------------------
    // MOBILE & TABLET LAYOUT (Exact Native Clone)
    // --------------------------------------------------------
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
                                const isActiveTrack = String(track.id) === String(activeTrackId);
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
                                            const isActiveTrack = String(track.id) === String(activeTrackId);
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
                                                const isActiveTrack = String(track.id) === String(activeTrackId);
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
                                                        const isActiveTrack = String(track.id) === String(activeTrackId);
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
                                                    const isActiveTrack = String(track.id) === String(activeTrackId);
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
                                                    const isActiveTrack = String(track.id) === String(activeTrackId);
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

const styles = StyleSheet.create({
    // --- SHARED / MOBILE STYLES ---
    musicSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#25252A', borderRadius: 24, height: 52, paddingHorizontal: 16, borderWidth: 1, borderColor: 'transparent' },
    musicSearchBoxActive: { borderColor: '#00E5FF', backgroundColor: '#1C2533' },
    musicSearchIcon: { marginRight: 10 },
    musicSearchInput: { flex: 1, color: '#FFFFFF', fontSize: 16, height: '100%', outlineStyle: 'none' },
    musicRightIcon: { paddingLeft: 10, height: 40, justifyContent: 'center', cursor: 'pointer' },
    libraryChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1428', paddingRight: 16, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', alignSelf: 'flex-start', cursor: 'pointer' },
    libraryChipGradient: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    libraryChipText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
    igStoryRing: { width: 76, height: 76, borderRadius: 38, padding: 3, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    igArtistImg: { width: '100%', height: '100%', borderRadius: 38, borderWidth: 2, borderColor: '#0A0A0C' },
    igArtistName: { color: '#FFF', fontSize: 12, marginTop: 6, textAlign: 'center', fontWeight: '500' },
    ytSectionTitle: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 2 },
    ytSectionSubtitle: { color: '#8F98A0', fontSize: 11, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 16, letterSpacing: 0.5 },
    ytListTile: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 4, cursor: 'pointer' },
    ytTileImg: { width: 48, height: 48, borderRadius: 6, backgroundColor: '#2A2A30' },
    ytTileImgQuick: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#2A2A30' },
    ytTileTitle: { color: '#FFF', fontSize: 16, fontWeight: '600', marginBottom: 3 },
    ytTileSubtitle: { color: '#A0A0A5', fontSize: 13 },

    // --- DESKTOP SPECIFIC STYLES ---
    desktopContainer: { flex: 1, paddingHorizontal: 40, paddingTop: 20 },
    desktopSearchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 40 },
    desktopSearchBox: { flex: 1, maxWidth: 600, height: 60, borderRadius: 30, paddingHorizontal: 24 },
    desktopIgStoryRing: { width: 100, height: 100, borderRadius: 50, padding: 4, justifyContent: 'center', alignItems: 'center' },
    desktopIgArtistImg: { width: '100%', height: '100%', borderRadius: 50, borderWidth: 3, borderColor: '#0A0A0C' },

    // Grid system replacing the horizontal chunks for desktop
    desktopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
    desktopListTile: { width: '31%', minWidth: 280, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12, cursor: 'pointer', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    desktopTileImg: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#2A2A30' },

    // Desktop Modal
    desktopModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
    desktopModalContent: { width: '80%', maxWidth: 900, height: '80%', backgroundColor: '#170D22', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    desktopModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }
});