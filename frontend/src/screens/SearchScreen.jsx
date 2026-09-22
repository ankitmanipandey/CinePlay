import React from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, useWindowDimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // <-- Imported SafeAreaView
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { useSearchLogic, FILTER_CHIPS, formatDuration, formatViews } from '../hooks/useSearchLogic';
import { getImageUrl } from '../constants/config';

export default function SearchScreenWeb() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // Define our responsive breakpoint
  // Mobile: < 768px | Tablet: 768px - 1024px | Desktop: >= 1024px
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  const {
    searchQuery, setSearchQuery, activeChip, setActiveChip, searchMode, setSearchMode,
    isYtMode, isAiMode, isLoading, isLoadingMore, isListening, filteredResults,
    handleLoadMore, toggleListening, handleAuthAction, handleToggleAction, watchlist, watched
  } = useSearchLogic();

  // --------------------------------------------------------
  // DESKTOP LAYOUT (Widescreen)
  // --------------------------------------------------------
  if (isDesktop) {
    return (
      <SafeAreaView style={styles.desktopContainer}>
        <View style={styles.desktopHeaderRow}>
          <View style={[styles.searchBox, isAiMode && styles.searchBoxAi, isListening && styles.searchBoxActive]}>
            <Ionicons name={isAiMode ? "sparkles" : (isYtMode ? "logo-youtube" : "search")} size={22} color={isAiMode ? "#9B51E0" : (isYtMode ? "#FF007A" : "#8F98A0")} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={isListening ? "Listening..." : (isAiMode ? "Describe a mood or plot..." : (isYtMode ? "Search YouTube..." : "Search movies, shows..."))}
              placeholderTextColor={isListening ? "#00E5FF" : "#8F98A0"}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && !isListening ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.rightIcon}><Ionicons name="close-circle" size={20} color="#8F98A0" /></TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={toggleListening} style={styles.rightIcon}>
                {isListening ? <ActivityIndicator size="small" color="#00E5FF" /> : <Ionicons name="mic-outline" size={24} color="#FFFFFF" />}
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.aiToggleContainerDesktop}>
            <TouchableOpacity style={[styles.toggleBtnDesktop, searchMode === 'standard' && styles.toggleBtnActiveStandard]} onPress={() => setSearchMode('standard')}>
              <Ionicons name="search" size={16} color={searchMode === 'standard' ? "#00E5FF" : "#8F98A0"} />
              <Text style={[styles.toggleTextDesktop, searchMode === 'standard' && { color: '#00E5FF' }]}>Standard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtnDesktop, searchMode === 'ai' && styles.toggleBtnActiveAI]} onPress={() => setSearchMode('ai')}>
              <Ionicons name="sparkles" size={16} color={searchMode === 'ai' ? "#9B51E0" : "#8F98A0"} />
              <Text style={[styles.toggleTextDesktop, searchMode === 'ai' && { color: '#9B51E0' }]}>AI Match</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtnDesktop, searchMode === 'youtube' && styles.toggleBtnActiveYT]} onPress={() => setSearchMode('youtube')}>
              <Ionicons name="logo-youtube" size={16} color={searchMode === 'youtube' ? "#FF007A" : "#8F98A0"} />
              <Text style={[styles.toggleTextDesktop, searchMode === 'youtube' && { color: '#FF007A' }]}>YouTube</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.contentArea}>
          <View style={styles.titleAndChipsRow}>
            <Text style={styles.sectionTitleDesktop}>
              {searchQuery.length > 0 ? (isAiMode ? `AI Results for "${searchQuery}"` : `Results for "${searchQuery}"`) : (isYtMode ? 'Search YouTube to get started' : 'Trending Now')}
            </Text>
            {!(isAiMode && searchQuery.length > 0) && !isYtMode && (
              <View style={styles.chipsContainerDesktop}>
                {FILTER_CHIPS.map((c, i) => (
                  <TouchableOpacity key={i} style={styles.chipWrapperDesktop} onPress={() => setActiveChip(c)}>
                    {activeChip === c ? (
                      <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chipActiveDesktop}>
                        <Text style={styles.activeChipText}>{c}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.chipInactiveDesktop}><Text style={styles.chipText}>{c}</Text></View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color={isAiMode ? "#9B51E0" : (isYtMode ? "#FF007A" : "#00E5FF")} style={{ marginTop: 60 }} />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false} // <-- HIDES DESKTOP SCROLLBAR
              contentContainerStyle={styles.scrollContent}
              onScroll={({ nativeEvent }) => { if (nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >= nativeEvent.contentSize.height - 200) handleLoadMore(); }}
              scrollEventThrottle={400}
            >
              <View style={styles.desktopGrid}>
                {filteredResults.length === 0 && <Text style={styles.emptyText}>{isAiMode ? "AI couldn't find matching titles." : "No results found."}</Text>}

                {filteredResults.map((item, index) => {
                  if (isYtMode) {
                    const uniqueKey = item.id?.videoId || `yt-${index}`;
                    return (
                      <TouchableOpacity key={uniqueKey} style={styles.ytFeedCardDesktop} onPress={() => router.push({ pathname: '/player', params: { ytId: item.id?.videoId } })}>
                        <View style={styles.ytImageContainerDesktop}>
                          <Image source={{ uri: item.snippet?.thumbnails?.high?.url }} style={styles.ytFeedImage} />
                          {item.extraDetails?.duration && <View style={styles.durationBadge}><Text style={styles.durationText}>{formatDuration(item.extraDetails.duration)}</Text></View>}
                        </View>
                        <View style={styles.ytDetails}>
                          <Text style={styles.ytTitleDesktop} numberOfLines={2}>{item.snippet?.title}</Text>
                          <Text style={styles.ytChannel}>{item.snippet?.channelTitle} • {formatViews(item.extraDetails?.viewCount)}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  } else {
                    const safeId = typeof item.id === 'object' ? item.id?.videoId : item.id;
                    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
                    return (
                      <TouchableOpacity key={safeId} style={styles.tmdbCardDesktop} onPress={() => router.push({ pathname: '/player', params: { id: safeId, type: mediaType } })}>
                        {getImageUrl(item.poster_path || item.backdrop_path) ? <Image source={{ uri: getImageUrl(item.poster_path || item.backdrop_path) }} style={styles.cardImage} /> : <View style={styles.cardPlaceholder}><Ionicons name="film-outline" size={32} color="#8F98A0" /></View>}
                        {item.vote_average > 0 && (<View style={styles.translucentRatingBadge}><Ionicons name="star" size={12} color="#F5C518" /><Text style={styles.smallCardRatingText}>{(item.vote_average).toFixed(1)}</Text></View>)}
                        <View style={styles.cardActions}>
                          <TouchableOpacity style={styles.smallIconBtn} onPress={() => handleAuthAction(() => handleToggleAction(safeId, mediaType, 'watchlist'))}>
                            <Ionicons name={watchlist[safeId] ? "bookmark" : "bookmark-outline"} size={16} color={watchlist[safeId] ? "#FF007A" : "#FFFFFF"} />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    );
                  }
                })}
              </View>
              {isLoadingMore && <ActivityIndicator size="large" color="#00E5FF" style={{ marginVertical: 30 }} />}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // --------------------------------------------------------
  // MOBILE & TABLET LAYOUT (Exact Native Clone)
  // --------------------------------------------------------
  return (
    <SafeAreaView style={styles.mobileContainer}>
      <View style={styles.mobileSearchHeader}>
        <View style={[styles.mobileSearchBox, isAiMode && styles.searchBoxAi, isListening && styles.searchBoxActive]}>
          <Ionicons name={isAiMode ? "sparkles" : (isYtMode ? "logo-youtube" : "search")} size={20} color={isAiMode ? "#9B51E0" : (isYtMode ? "#FF007A" : "#8F98A0")} style={styles.searchIcon} />
          <TextInput
            style={styles.mobileSearchInput}
            placeholder={isListening ? "Listening..." : (isAiMode ? "Describe a mood..." : "Search movies, shows...")}
            placeholderTextColor={isListening ? "#00E5FF" : "#8F98A0"}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && !isListening ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.rightIcon}><Ionicons name="close-circle" size={18} color="#8F98A0" /></TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={toggleListening} style={styles.rightIcon}>
              {isListening ? <ActivityIndicator size="small" color="#00E5FF" /> : <Ionicons name="mic-outline" size={22} color="#FFFFFF" />}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.aiToggleContainerMobile}>
          <TouchableOpacity style={[styles.toggleBtnMobile, searchMode === 'standard' && styles.toggleBtnActiveStandard]} onPress={() => setSearchMode('standard')}>
            <Ionicons name="search" size={14} color={searchMode === 'standard' ? "#00E5FF" : "#8F98A0"} />
            <Text style={[styles.toggleTextMobile, searchMode === 'standard' && { color: '#00E5FF' }]}>Standard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toggleBtnMobile, searchMode === 'ai' && styles.toggleBtnActiveAI]} onPress={() => setSearchMode('ai')}>
            <Ionicons name="sparkles" size={14} color={searchMode === 'ai' ? "#9B51E0" : "#8F98A0"} />
            <Text style={[styles.toggleTextMobile, searchMode === 'ai' && { color: '#9B51E0' }]}>AI Match</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toggleBtnMobile, searchMode === 'youtube' && styles.toggleBtnActiveYT]} onPress={() => setSearchMode('youtube')}>
            <Ionicons name="logo-youtube" size={14} color={searchMode === 'youtube' ? "#FF007A" : "#8F98A0"} />
            <Text style={[styles.toggleTextMobile, searchMode === 'youtube' && { color: '#FF007A' }]}>YT Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitleMobile}>
          {searchQuery.length > 0 ? (isAiMode ? `AI Results for "${searchQuery}"` : `Results for "${searchQuery}"`) : (isYtMode ? 'Search YouTube' : 'Trending Now')}
        </Text>

        {!(isAiMode && searchQuery.length > 0) && !isYtMode && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScrollViewMobile} contentContainerStyle={styles.chipsContainerMobile}>
            {FILTER_CHIPS.map((c, i) => (
              <TouchableOpacity key={i} style={styles.chipWrapperMobile} onPress={() => setActiveChip(c)}>
                {activeChip === c ? (
                  <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chipActiveMobile}>
                    <Text style={styles.activeChipTextMobile}>{c}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.chipInactiveMobile}><Text style={styles.chipTextMobile}>{c}</Text></View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {isLoading ? (
          <ActivityIndicator size="large" color={isAiMode ? "#9B51E0" : (isYtMode ? "#FF007A" : "#00E5FF")} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false} // <-- HIDES MOBILE SCROLLBAR
            contentContainerStyle={styles.mobileGridContainer}
            onScroll={({ nativeEvent }) => { if (nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >= nativeEvent.contentSize.height - 200) handleLoadMore(); }}
            scrollEventThrottle={400}
          >
            <View style={styles.mobileGrid}>
              {filteredResults.length === 0 && <Text style={styles.emptyText}>{isAiMode ? "AI couldn't find matching titles." : "No results found."}</Text>}

              {filteredResults.map((item, index) => {
                if (isYtMode) {
                  const uniqueKey = item.id?.videoId || `yt-${index}`;
                  return (
                    <TouchableOpacity key={uniqueKey} style={[styles.ytFeedCardMobile, { width: isTablet ? '48%' : '100%' }]} onPress={() => router.push({ pathname: '/player', params: { ytId: item.id?.videoId } })}>
                      <View style={styles.ytImageContainerMobile}>
                        <Image source={{ uri: item.snippet?.thumbnails?.high?.url }} style={styles.ytFeedImage} />
                        <View style={styles.ytPlayOverlay}><Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.8)" /></View>
                        {item.extraDetails?.duration && <View style={styles.durationBadge}><Text style={styles.durationText}>{formatDuration(item.extraDetails.duration)}</Text></View>}
                      </View>
                      <View style={styles.ytDetails}>
                        <Text style={styles.ytTitleMobile} numberOfLines={2}>{item.snippet?.title}</Text>
                        <Text style={styles.ytChannel}>{item.snippet?.channelTitle} • {formatViews(item.extraDetails?.viewCount)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                } else {
                  const safeId = typeof item.id === 'object' ? item.id?.videoId : item.id;
                  const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
                  const cardWidth = isTablet ? '23%' : '31.5%';

                  return (
                    <TouchableOpacity key={safeId} style={[styles.tmdbCardMobile, { width: cardWidth }]} onPress={() => router.push({ pathname: '/player', params: { id: safeId, type: mediaType } })}>
                      {getImageUrl(item.poster_path || item.backdrop_path) ? <Image source={{ uri: getImageUrl(item.poster_path || item.backdrop_path) }} style={styles.cardImage} /> : <View style={styles.cardPlaceholder}><Ionicons name="film-outline" size={24} color="#8F98A0" /></View>}
                      {item.vote_average > 0 && (<View style={styles.translucentRatingBadge}><Ionicons name="star" size={10} color="#F5C518" /><Text style={styles.smallCardRatingText}>{(item.vote_average).toFixed(1)}</Text></View>)}
                      <View style={styles.cardActions}>
                        <TouchableOpacity style={styles.smallIconBtnMobile} onPress={() => handleAuthAction(() => handleToggleAction(safeId, mediaType, 'watchlist'))}>
                          <Ionicons name={watchlist[safeId] ? "bookmark" : "bookmark-outline"} size={14} color={watchlist[safeId] ? "#FF007A" : "#FFFFFF"} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                }
              })}
            </View>
            {isLoadingMore && <ActivityIndicator size="small" color="#00E5FF" style={{ marginVertical: 20 }} />}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // --- DESKTOP STYLES (>= 1024px) ---
  desktopContainer: { flex: 1, backgroundColor: '#0A0A0C', padding: 24 },
  desktopHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, gap: 24 },
  searchBox: { flex: 1, maxWidth: 600, flexDirection: 'row', alignItems: 'center', backgroundColor: '#25252A', borderRadius: 28, height: 56, paddingHorizontal: 20 },
  searchBoxActive: { borderWidth: 1, borderColor: '#00E5FF', backgroundColor: '#1C2533' },
  searchBoxAi: { borderWidth: 1, borderColor: 'rgba(155, 81, 224, 0.4)', backgroundColor: '#1A1423' },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 18, height: '100%', outlineStyle: 'none' },
  rightIcon: { paddingLeft: 10, cursor: 'pointer' },

  aiToggleContainerDesktop: { flexDirection: 'row', backgroundColor: '#1C1C22', borderRadius: 24, padding: 6, gap: 8 },
  toggleBtnDesktop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, gap: 8, cursor: 'pointer' },
  toggleBtnActiveStandard: { backgroundColor: 'rgba(0, 229, 255, 0.15)' },
  toggleBtnActiveAI: { backgroundColor: 'rgba(155, 81, 224, 0.15)' },
  toggleBtnActiveYT: { backgroundColor: 'rgba(255, 0, 122, 0.15)' },
  toggleTextDesktop: { color: '#8F98A0', fontSize: 14, fontWeight: '600' },

  contentArea: { flex: 1 },
  titleAndChipsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  sectionTitleDesktop: { color: '#FFFFFF', fontSize: 28, fontWeight: 'bold' },
  chipsContainerDesktop: { flexDirection: 'row', gap: 12 },
  chipWrapperDesktop: { borderRadius: 24, cursor: 'pointer' },
  chipActiveDesktop: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24 },
  chipInactiveDesktop: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 24 },
  chipText: { color: '#A0A0A5', fontSize: 14, fontWeight: '600' },
  activeChipText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },

  scrollContent: { paddingBottom: 60 },
  desktopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  emptyText: { color: '#8F98A0', fontSize: 18, width: '100%', textAlign: 'center', marginTop: 40 },

  tmdbCardDesktop: { width: '15%', minWidth: 160, aspectRatio: 2 / 3, borderRadius: 8, overflow: 'hidden', backgroundColor: '#1E1E24', cursor: 'pointer' },
  ytFeedCardDesktop: { width: '23%', minWidth: 280, marginBottom: 32, cursor: 'pointer' },
  ytImageContainerDesktop: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1E1E24' },
  ytTitleDesktop: { color: '#FFF', fontSize: 16, fontWeight: '600', lineHeight: 24 },

  // --- MOBILE & TABLET STYLES (< 1024px, Exact Native Match) ---
  mobileContainer: { flex: 1, backgroundColor: '#0A0A0C' },
  mobileSearchHeader: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 16 },
  mobileSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#25252A', borderRadius: 24, height: 52, paddingHorizontal: 16 },
  mobileSearchInput: { flex: 1, color: '#FFFFFF', fontSize: 16, height: '100%', outlineStyle: 'none' },

  aiToggleContainerMobile: { flexDirection: 'row', backgroundColor: '#1C1C22', borderRadius: 20, padding: 4, marginTop: 12, alignSelf: 'flex-start' },
  toggleBtnMobile: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, gap: 6, cursor: 'pointer' },
  toggleTextMobile: { color: '#8F98A0', fontSize: 13, fontWeight: '600' },

  sectionTitleMobile: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', paddingHorizontal: 12, marginBottom: 12 },

  chipsScrollViewMobile: { flexGrow: 0, flexShrink: 0, height: 48, marginBottom: 24, marginTop: 4 },
  chipsContainerMobile: { paddingHorizontal: 12, gap: 10, alignItems: 'center' },
  chipWrapperMobile: { borderRadius: 20, cursor: 'pointer' },
  chipActiveMobile: { paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
  chipInactiveMobile: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
  chipTextMobile: { color: '#A0A0A5', fontSize: 14, fontWeight: '600' },
  activeChipTextMobile: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },

  mobileGridContainer: { paddingHorizontal: 12, paddingBottom: 40 },
  mobileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },

  tmdbCardMobile: { aspectRatio: 1 / 1.45, borderRadius: 6, overflow: 'hidden', backgroundColor: '#1E1E24', marginBottom: 8, cursor: 'pointer' },
  smallIconBtnMobile: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' },

  ytFeedCardMobile: { marginBottom: 24, cursor: 'pointer' },
  ytImageContainerMobile: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1E1E24', position: 'relative' },
  ytPlayOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  ytTitleMobile: { color: '#FFF', fontSize: 16, fontWeight: '600', lineHeight: 22 },

  // --- SHARED STYLES ---
  cardImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  cardPlaceholder: { flex: 1, backgroundColor: '#25252A', justifyContent: 'center', alignItems: 'center' },
  translucentRatingBadge: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.65)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, zIndex: 2 },
  smallCardRatingText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', marginLeft: 3, marginTop: 1 },
  cardActions: { position: 'absolute', top: 6, right: 6, gap: 6, zIndex: 2 },
  smallIconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },

  ytFeedImage: { width: '100%', height: '100%' },
  durationBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  durationText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  ytDetails: { marginTop: 12, paddingHorizontal: 4 },
  ytChannel: { color: '#8F98A0', fontSize: 13, marginTop: 4 },
});