import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
  ActivityIndicator,
  FlatList,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';

// --- API & Config Imports ---
import { tmdbService, filterValidMedia } from '../services/tmdbService';
import { getImageUrl } from '../constants/config';
import { useUserListStore } from '../store/useUserListStore';
import { useAuthStore } from '../store/useAuthStore';
import { useMovieStore } from '../store/useMovieStore';

const FILTER_CHIPS = ['Action', 'Comedy', 'Drama', 'Thriller', 'Sci-Fi', 'Horror'];
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

// --- MULTI-KEY ROUND ROBIN SETUP ---
const RAW_KEYS = process.env.EXPO_PUBLIC_YOUTUBE_API_KEYS || process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || '';
let ACTIVE_YT_KEYS = RAW_KEYS.split(',').map(k => k.trim()).filter(Boolean);

const fetchYouTubeWithRetry = async (urlTemplate) => {
  while (ACTIVE_YT_KEYS.length > 0) {
    const currentKey = ACTIVE_YT_KEYS[0];
    const url = urlTemplate.replace('__API_KEY__', currentKey);

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data.error && (data.error.code === 403 || data.error.code === 429)) {
        console.warn(`[YouTube] API Key exhausted quota. Removing from active rotation.`);
        ACTIVE_YT_KEYS.shift();
        continue;
      }

      return data;
    } catch (err) {
      console.error("[YouTube Fetch Error]", err);
      return { error: { code: 500, message: "Network error occurred." } };
    }
  }

  return { error: { code: 429, message: 'All YouTube API keys have exhausted their daily quota.' } };
};

// --- CRASH-PROOF HELPER FUNCTIONS ---
const formatDuration = (pt) => {
  if (!pt || typeof pt !== 'string') return '';
  const match = pt.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';

  const h = match[1] ? parseInt(match[1]) : 0;
  const m = match[2] ? parseInt(match[2]) : 0;
  const s = match[3] ? parseInt(match[3]) : 0;

  if (h === 0 && m === 0 && s === 0) return '';
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatViews = (views) => {
  if (!views) return '';
  const n = parseInt(views);
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M views';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K views';
  return n + ' views';
};

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // --- Dynamic Grid Calculations ---
  const { width } = useWindowDimensions();
  const SCREEN_PADDING = 12;
  const GAP = 8;
  const AVAILABLE_WIDTH = width - (SCREEN_PADDING * 2);

  // Dynamically adapt columns based on screen width (Portrait: 3, Landscape: 5 or 6)
  const numColumns = width > 768 ? 6 : width > 480 ? 4 : 3;
  const STANDARD_CARD_WIDTH = (AVAILABLE_WIDTH - (GAP * (numColumns - 1))) / numColumns;
  const CARD_HEIGHT = STANDARD_CARD_WIDTH * 1.45;

  // Use up to 2 columns for Youtube cards in landscape to prevent them from becoming massively tall
  const ytColumns = width > 480 ? 2 : 1;
  const YT_CARD_WIDTH = (AVAILABLE_WIDTH - (GAP * (ytColumns - 1))) / ytColumns;
  const YT_CARD_HEIGHT = YT_CARD_WIDTH * (9 / 16);

  const { isYoutubeMode } = useMovieStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeChip, setActiveChip] = useState('Action');

  const [searchMode, setSearchMode] = useState(isYoutubeMode ? 'youtube' : 'standard');
  const isYtMode = searchMode === 'youtube';
  const isAiMode = searchMode === 'ai';

  const [rawResults, setRawResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [ytPageToken, setYtPageToken] = useState('');

  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { watchlist, watched, toggleWatchlist, toggleWatched } = useUserListStore();
  const { token } = useAuthStore();
  const [isListening, setIsListening] = useState(false);

  const GENRE_MAP = {
    'Action': 28, 'Comedy': 35, 'Drama': 18, 'Thriller': 53, 'Sci-Fi': 878, 'Horror': 27
  };

  useEffect(() => {
    setSearchMode(isYoutubeMode ? 'youtube' : 'standard');
    setRawResults([]);
  }, [isYoutubeMode]);

  const fetchAiRecommendations = async (query) => {
    try {
      const fetchHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      };

      const response = await fetch(`${BACKEND_URL}/ai/recommend`, {
        method: 'POST',
        headers: fetchHeaders,
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AI Search Error] HTTP Status: ${response.status}`, errorText);
        throw new Error(`AI Fetch failed with status ${response.status}`);
      }

      const data = await response.json();

      if (!data.titles || !Array.isArray(data.titles)) {
        throw new Error("Invalid titles array returned from AI API");
      }

      const titlesToFetch = data.titles.slice(0, 12);
      const tmdbPromises = titlesToFetch.map(title => tmdbService.searchMulti(title));
      const tmdbResultsArrays = await Promise.all(tmdbPromises);

      const rawFinalResults = tmdbResultsArrays
        .map(results => results.find(item => item?.media_type === 'movie' || item?.media_type === 'tv'))
        .filter(Boolean)
        .filter(item => item.poster_path || item.backdrop_path);

      return rawFinalResults;
    } catch (error) {
      console.error("[AI Search Error] Caught inside try/catch:", error);
      Toast.show({ type: 'hotstarError', text1: 'AI Search failed to process.' });
      return [];
    }
  };

  const fetchResults = async (pageNum = 1, currentYtToken = '') => {
    try {
      let newData = [];
      let nextYtToken = '';

      if (isYtMode) {
        if (!searchQuery.trim()) {
          setIsLoading(false);
          return;
        }

        const searchUrlTemplate = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&maxResults=10&pageToken=${currentYtToken}&key=__API_KEY__`;

        const ytData = await fetchYouTubeWithRetry(searchUrlTemplate);

        if (ytData.error) {
          Toast.show({ type: 'hotstarError', text1: ytData.error.message });
          setIsLoading(false);
          return;
        }

        let items = ytData.items || [];
        nextYtToken = ytData.nextPageToken || '';

        if (items.length > 0) {
          const videoIds = items.map(item => item.id.videoId).filter(Boolean).join(',');
          const detailsUrlTemplate = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds}&key=__API_KEY__`;

          const detailsData = await fetchYouTubeWithRetry(detailsUrlTemplate);

          if (!detailsData.error) {
            const detailsMap = {};
            detailsData.items?.forEach(d => {
              detailsMap[d.id] = { duration: d.contentDetails?.duration, viewCount: d.statistics?.viewCount };
            });
            items = items.map(item => ({ ...item, extraDetails: detailsMap[item.id?.videoId] || {} }));
          }
        }

        newData = items;
        if (!nextYtToken) setHasMore(false);
        setYtPageToken(nextYtToken);

      } else {
        if (searchQuery.trim().length > 0) {
          if (isAiMode) {
            if (pageNum === 1) { newData = await fetchAiRecommendations(searchQuery); setHasMore(false); }
          } else {
            newData = await tmdbService.smartSearch(searchQuery, pageNum);
          }
        } else {
          const genreId = GENRE_MAP[activeChip];
          if (genreId) { newData = await tmdbService.discoverByGenre(genreId, pageNum); }
          else { newData = await tmdbService.getTrending(pageNum); }
        }
        if (newData.length === 0) setHasMore(false);
      }

      setRawResults(prev => {
        const combined = (pageNum === 1 && !currentYtToken) ? newData : [...prev, ...newData];

        const uniqueMap = new Map();
        combined.forEach(item => {
          const id = item.id?.videoId || item.id;
          if (id && !uniqueMap.has(id)) {
            uniqueMap.set(id, item);
          }
        });

        return Array.from(uniqueMap.values());
      });

    } catch (error) {
      console.error("[Search Fetch Failed]", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    setPage(1); setYtPageToken(''); setHasMore(true); setRawResults([]); setIsLoading(true);

    let debounceTime = 0;
    if (searchQuery.trim().length > 0) {
      if (isAiMode) debounceTime = 1500;
      else if (isYtMode) debounceTime = 800;
      else debounceTime = 500;
    }

    const delayDebounceFn = setTimeout(() => {
      fetchResults(1, '');
    }, debounceTime);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, activeChip, searchMode]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore && rawResults.length > 0) {
      setIsLoadingMore(true);
      if (isYtMode) { fetchResults(page, ytPageToken); }
      else if (!isAiMode) { setPage(p => p + 1); fetchResults(page + 1); }
      else { setIsLoadingMore(false); }
    }
  };

  const filteredResults = React.useMemo(() => {
    if (isYtMode) return rawResults;
    return rawResults.filter(item => {
      const safeId = typeof item.id === 'object' ? item.id?.videoId : item.id;
      return !watched[safeId];
    });
  }, [rawResults, watched, isYtMode]);

  // --- Dynamic Row Chunking ---
  const gridRows = [];
  const itemsPerChunk = isYtMode ? ytColumns : numColumns;
  for (let i = 0; i < filteredResults.length; i += itemsPerChunk) {
    gridRows.push(filteredResults.slice(i, i + itemsPerChunk));
  }

  useSpeechRecognitionEvent('start', () => setIsListening(true));
  useSpeechRecognitionEvent('end', () => setIsListening(false));
  useSpeechRecognitionEvent('result', (e) => { if (e.results?.[0]?.transcript) setSearchQuery(e.results[0].transcript); if (e.isFinal) ExpoSpeechRecognitionModule.stop(); });
  useSpeechRecognitionEvent('error', () => setIsListening(false));

  const toggleListening = async () => {
    if (isListening) return ExpoSpeechRecognitionModule.stop();
    const p = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (p.granted) { setSearchQuery(''); ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false }); }
  };

  const handleAuthAction = useCallback((actionCallback) => {
    if (!token) Toast.show({ type: 'hotstarInfo', text1: 'Log in for personalization', position: 'top', topOffset: insets.top > 0 ? insets.top + 10 : 50 });
    else actionCallback();
  }, [token, insets.top]);

  const handleToggleAction = useCallback(async (id, mediaType, targetList) => {
    if (targetList === 'watchlist') toggleWatchlist(id, mediaType);
    if (targetList === 'watched') toggleWatched(id, mediaType);
    try {
      const res = await fetch(`${BACKEND_URL}/user/${targetList}/toggle`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ tmdbId: `${id}:${mediaType}` }) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const arrayToMap = (arr) => arr.reduce((acc, curr) => { const [idStr, typeStr] = String(curr).split(':'); acc[idStr] = typeStr || 'movie'; return acc; }, {});
      useUserListStore.setState({ watchlist: arrayToMap(data.watchlist), watched: arrayToMap(data.watched) });
    } catch {
      Toast.show({ type: 'hotstarError', text1: `Failed to save to ${targetList}` });
      if (targetList === 'watchlist') toggleWatchlist(id, mediaType);
      if (targetList === 'watched') toggleWatched(id, mediaType);
    }
  }, [toggleWatchlist, toggleWatched, token]);

  const renderYtRow = ({ item: row, index: rowIndex }) => (
    <View style={styles.row}>
      {row.map((item, colIndex) => {
        const duration = formatDuration(item.extraDetails?.duration);
        const views = formatViews(item.extraDetails?.viewCount);
        const uniqueKey = item.id?.videoId || `yt-${rowIndex}-${colIndex}`;

        return (
          <TouchableOpacity key={uniqueKey} style={[styles.ytFeedCard, { width: YT_CARD_WIDTH }]} activeOpacity={0.8} onPress={() => router.push({ pathname: '/player', params: { ytId: item.id?.videoId } })}>
            <View style={[styles.ytImageContainer, { height: YT_CARD_HEIGHT }]}>
              <Image source={{ uri: item.snippet?.thumbnails?.high?.url }} style={styles.ytFeedImage} />
              <View style={styles.ytPlayOverlay}>
                <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.8)" />
              </View>
              {duration ? <View style={styles.durationBadge}><Text style={styles.durationText}>{duration}</Text></View> : null}
            </View>
            <View style={styles.ytDetails}>
              <Text style={styles.ytTitle} numberOfLines={2}>{item.snippet?.title}</Text>
              <Text style={styles.ytChannel}>{item.snippet?.channelTitle}{views ? `  •  ${views}` : ''}</Text>
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  );

  const renderTmdbRow = ({ item: row, index: rowIndex }) => (
    <View style={styles.row}>
      {row.map((item, colIndex) => {
        const safeId = typeof item.id === 'object' ? item.id?.videoId : item.id;
        const uniqueKey = safeId ? `${safeId}-${rowIndex}-${colIndex}` : `fallback-${rowIndex}-${colIndex}`;

        const inWatchlist = watchlist[safeId];
        const inWatched = watched[safeId];
        const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
        const imageUri = getImageUrl(item.poster_path || item.backdrop_path);

        return (
          <TouchableOpacity key={uniqueKey} activeOpacity={0.8} onPress={() => router.push({ pathname: '/player', params: { id: safeId, type: mediaType } })} style={[styles.card, { width: STANDARD_CARD_WIDTH, height: CARD_HEIGHT }]}>
            {imageUri ? <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" /> : <View style={[styles.cardImage, { backgroundColor: '#25252A', justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="film-outline" size={24} color="#8F98A0" /></View>}

            {item.vote_average > 0 && (<View style={styles.translucentRatingBadge}><Ionicons name="star" size={10} color="#F5C518" /><Text style={styles.smallCardRatingText}>{(item.vote_average).toFixed(1)}</Text></View>)}
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.smallIconBtn} activeOpacity={0.8} onPress={() => handleAuthAction(() => handleToggleAction(safeId, mediaType, 'watchlist'))}>
                <Ionicons name={inWatchlist ? "bookmark" : "bookmark-outline"} size={14} color={inWatchlist ? "#FF007A" : "#FFFFFF"} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallIconBtn} activeOpacity={0.8} onPress={() => handleAuthAction(() => handleToggleAction(safeId, mediaType, 'watched'))}>
                <Ionicons name="checkmark-done" size={14} color={inWatched ? "#00E5FF" : "#FFFFFF"} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.innerContainer}>

          <View style={styles.searchHeader}>
            <View style={[styles.searchBox, isAiMode && styles.searchBoxAi, isListening && styles.searchBoxActive]}>
              <Ionicons
                name={isAiMode ? "sparkles" : (isYtMode ? "logo-youtube" : "search")}
                size={20}
                color={isAiMode ? "#9B51E0" : (isYtMode ? "#FF007A" : "#8F98A0")}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder={isListening ? "Listening..." : (isAiMode ? "Describe a mood or plot..." : (isYtMode ? "Search YouTube..." : "Search movies, shows..."))}
                placeholderTextColor={isListening ? "#00E5FF" : "#8F98A0"}
                value={searchQuery}
                onChangeText={setSearchQuery}
                selectionColor={isAiMode ? "#9B51E0" : (isYtMode ? "#FF007A" : "#00E5FF")}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && !isListening ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.rightIcon}><Ionicons name="close-circle" size={18} color="#8F98A0" /></TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={toggleListening} style={styles.rightIcon}>{isListening ? <ActivityIndicator size="small" color="#00E5FF" /> : <Ionicons name="mic-outline" size={22} color="#FFFFFF" />}</TouchableOpacity>
              )}
            </View>

            <View style={styles.aiToggleContainer}>
              <TouchableOpacity style={[styles.toggleBtn, searchMode === 'standard' && styles.toggleBtnActiveStandard]} onPress={() => { setSearchMode('standard'); setRawResults([]); }} activeOpacity={0.8}>
                <Ionicons name="search" size={14} color={searchMode === 'standard' ? "#00E5FF" : "#8F98A0"} />
                <Text style={[styles.toggleText, searchMode === 'standard' && { color: '#00E5FF' }]}>Standard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, searchMode === 'ai' && styles.toggleBtnActiveAI]} onPress={() => { setSearchMode('ai'); setRawResults([]); }} activeOpacity={0.8}>
                <Ionicons name="sparkles" size={14} color={searchMode === 'ai' ? "#9B51E0" : "#8F98A0"} />
                <Text style={[styles.toggleText, searchMode === 'ai' && { color: '#9B51E0' }]}>AI Match</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, searchMode === 'youtube' && styles.toggleBtnActiveYT]} onPress={() => { setSearchMode('youtube'); setRawResults([]); }} activeOpacity={0.8}>
                <Ionicons name="logo-youtube" size={14} color={searchMode === 'youtube' ? "#FF007A" : "#8F98A0"} />
                <Text style={[styles.toggleText, searchMode === 'youtube' && { color: '#FF007A' }]}>YT Search</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>
              {searchQuery.length > 0
                ? (isAiMode ? `AI Results for "${searchQuery}"` : `Results for "${searchQuery}"`)
                : (isYtMode ? 'Search YouTube to get started' : 'Trending Now')}
            </Text>

            {!(isAiMode && searchQuery.length > 0) && !isYtMode && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipsScrollView}
                contentContainerStyle={styles.chipsContainer}
              >
                {FILTER_CHIPS.map((c, i) => {
                  const isActive = activeChip === c;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={styles.chipWrapper}
                      onPress={() => setActiveChip(c)}
                      activeOpacity={0.8}
                    >
                      {isActive ? (
                        <LinearGradient
                          colors={['#00E5FF', '#9B51E0', '#FF007A']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.chipActive}
                        >
                          <Text style={styles.activeChipText}>{c}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={styles.chipInactive}>
                          <Text style={styles.chipText}>{c}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            )}

            {isLoading && page === 1 && !ytPageToken ? (
              <ActivityIndicator size="large" color={isAiMode ? "#9B51E0" : (isYtMode ? "#FF007A" : "#00E5FF")} style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                key={`${searchMode}-${numColumns}`}
                data={gridRows}
                keyExtractor={(item, index) => `row-${index}`}
                contentContainerStyle={[isYtMode ? styles.ytFeedContainer : styles.gridContainer, { paddingTop: 8 }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={() => isLoadingMore ? <ActivityIndicator size="small" color="#00E5FF" style={{ marginVertical: 20 }} /> : <View style={{ height: 40 }} />}
                ListEmptyComponent={<Text style={{ color: '#8F98A0', textAlign: 'center', marginTop: 40 }}>{isAiMode ? "AI couldn't find matching titles. Try a different prompt." : (isYtMode && !searchQuery.trim() ? "" : "No results found.")}</Text>}
                renderItem={isYtMode ? renderYtRow : renderTmdbRow}
              />
            )}
          </View>

        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0C' },
  innerContainer: { flex: 1 },
  searchHeader: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#25252A', borderRadius: 24, height: 52, paddingHorizontal: 16, borderWidth: 1, borderColor: 'transparent' },
  searchBoxActive: { borderColor: '#00E5FF', backgroundColor: '#1C2533' },
  searchBoxAi: { borderColor: 'rgba(155, 81, 224, 0.4)', backgroundColor: '#1A1423' },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 16, height: '100%' },
  rightIcon: { paddingLeft: 10, height: 40, justifyContent: 'center' },

  aiToggleContainer: { flexDirection: 'row', backgroundColor: '#1C1C22', borderRadius: 20, padding: 4, marginTop: 12, alignSelf: 'flex-start' },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, gap: 6, borderWidth: 1, borderColor: 'transparent' },

  toggleBtnActiveStandard: { backgroundColor: 'rgba(0, 229, 255, 0.15)', borderColor: '#00E5FF' },
  toggleBtnActiveAI: { backgroundColor: 'rgba(155, 81, 224, 0.15)', borderColor: '#9B51E0' },
  toggleBtnActiveYT: { backgroundColor: 'rgba(255, 0, 122, 0.15)', borderColor: '#FF007A' },

  toggleText: { color: '#8F98A0', fontSize: 13, fontWeight: '600' },

  sectionTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', paddingHorizontal: 12, marginBottom: 12 },
  chipsScrollView: {
    flexGrow: 0,
    flexShrink: 0,
    height: 48,        // explicit height ≥ chip's real height
    marginBottom: 24,
    marginTop: 4
  },
  chipsContainer: {
    paddingHorizontal: 12,
    gap: 10,
    alignItems: 'center'   // vertically center chips within the 48px row
  },

  chipWrapper: { borderRadius: 20, overflow: 'hidden' },
  chipActive: { paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center', alignItems: 'center' },
  chipInactive: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
  chipText: { color: '#A0A0A5', fontSize: 14, fontWeight: '600' },
  activeChipText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },

  gridContainer: { paddingHorizontal: 12, paddingBottom: 40 },
  row: { gap: 8, marginBottom: 8, justifyContent: 'flex-start', flexDirection: 'row' },

  card: { borderRadius: 6, overflow: 'hidden', backgroundColor: '#1E1E24', position: 'relative' },
  cardImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },

  translucentRatingBadge: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.65)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, zIndex: 2 },
  smallCardRatingText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold', marginLeft: 3, marginTop: 1 },
  cardActions: { position: 'absolute', top: 6, right: 6, gap: 6, zIndex: 2 },
  smallIconBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' },

  ytFeedContainer: { paddingHorizontal: 12, paddingBottom: 40 },
  ytFeedCard: { marginBottom: 24 },
  ytImageContainer: { position: 'relative', width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#1E1E24' },
  ytFeedImage: { width: '100%', height: '100%' },
  ytPlayOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  durationBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  durationText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  ytDetails: { marginTop: 12, paddingHorizontal: 4 },
  ytTitle: { color: '#FFF', fontSize: 16, fontWeight: '600', lineHeight: 22 },
  ytChannel: { color: '#8F98A0', fontSize: 13, marginTop: 4 },
});