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
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';

// --- API & Config Imports ---
import { tmdbService } from '../services/tmdbService';
import { getImageUrl } from '../constants/config';
import { useUserListStore } from '../store/useUserListStore';
import { useAuthStore } from '../store/useAuthStore';

const { width } = Dimensions.get('window');

// --- Grid Calculations ---
const SCREEN_PADDING = 12;
const GAP = 8;
const AVAILABLE_WIDTH = width - (SCREEN_PADDING * 2);
const STANDARD_CARD_WIDTH = (AVAILABLE_WIDTH - (GAP * 2)) / 3;
const CARD_HEIGHT = STANDARD_CARD_WIDTH * 1.45;

const FILTER_CHIPS = ['Action', 'Comedy', 'Drama', 'Thriller', 'Sci-Fi', 'Horror'];
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeChip, setActiveChip] = useState('Action');

  // AI Mode State
  const [isAiMode, setIsAiMode] = useState(false);

  // Search state
  const [rawResults, setRawResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Global State Tracker ---
  const { watchlist, watched, toggleWatchlist, toggleWatched } = useUserListStore();
  const { token } = useAuthStore();

  // Voice State
  const [isListening, setIsListening] = useState(false);

  // --- TMDB Genre ID Mapping ---
  const GENRE_MAP = {
    'Action': 28,
    'Comedy': 35,
    'Drama': 18,
    'Thriller': 53,
    'Sci-Fi': 878,
    'Horror': 27
  };

  // --- AI Orchestration Logic ---
  const fetchAiRecommendations = async (query) => {
    try {
      // 1. Call your own Node.js backend!
      // Ensure BACKEND_URL ends with /api (e.g., https://your-server.onrender.com/api)
      const response = await fetch(`${BACKEND_URL}/ai/recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Optional: 'Authorization': `Bearer ${token}` if you protected the route
        },
        body: JSON.stringify({ query })
      });

     if (!response.ok) {
        // Grab the actual error message from the backend response
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP Status: ${response.status}`);
      }

      // 2. Get the array of titles back from your server
      const data = await response.json();
      const titles = data.titles; // ["Movie 1", "Movie 2"]

      // 3. Fetch TMDB data for each title concurrently
      const tmdbPromises = titles.map(title => tmdbService.searchMulti(title));
      const tmdbResultsArrays = await Promise.all(tmdbPromises);

      // 4. Extract the highest-match result from each search
      const finalResults = tmdbResultsArrays
        .map(results => results.find(item => item.media_type === 'movie' || item.media_type === 'tv'))
        .filter(Boolean); // Remove undefined/nulls

      return finalResults;
    } catch (error) {
      console.error("AI Search Failed:", error);
      Toast.show({ type: 'error', text1: 'AI Search failed to process your request.' });
      return [];
    }
  };

  // --- API Fetching Effect with Dynamic Debounce ---
  useEffect(() => {
    // Increase debounce for AI to prevent API spam while typing
    const debounceTime = isAiMode ? 1500 : 500;

    const delayDebounceFn = setTimeout(async () => {
      setIsLoading(true);

      try {
        let rawData = [];

        if (searchQuery.trim().length > 0) {
          if (isAiMode) {
            // 1. AI Gemini Search
            rawData = await fetchAiRecommendations(searchQuery);
          } else {
            // 2. Standard Text Search
            rawData = await tmdbService.searchMulti(searchQuery);
          }
        } else {
          // 3. Chip search or Trending fallback
          const genreId = GENRE_MAP[activeChip];
          if (genreId) {
            rawData = await tmdbService.discoverByGenre(genreId);
          } else {
            rawData = await tmdbService.getTrending();
          }
        }

        setRawResults(rawData);

      } catch (error) {
        console.error("Search fetch failed", error);
      } finally {
        setIsLoading(false);
      }
    }, debounceTime);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, activeChip, isAiMode]);

  const filteredResults = React.useMemo(() => {
    return rawResults.filter(item => !watched[item.id]);
  }, [rawResults, watched]);

  const getChunkedRows = (data, chunkSize = 3) => {
    const chunked = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunked.push(data.slice(i, i + chunkSize));
    }
    return chunked;
  };

  const gridRows = getChunkedRows(filteredResults);

  // --- Voice Commands ---
  useSpeechRecognitionEvent('start', () => setIsListening(true));
  useSpeechRecognitionEvent('end', () => setIsListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript;
    if (transcript) setSearchQuery(transcript);
    if (event.isFinal) stopListening();
  });
  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'no-speech') {
      setIsListening(false);
      return;
    }
    console.error('Voice Error:', event.error, event.message);
    setIsListening(false);
  });

  const startListening = async () => {
    const permissions = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permissions.granted) return;
    setSearchQuery('');
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, maxAlternatives: 1, continuous: false });
  };

  const stopListening = () => ExpoSpeechRecognitionModule.stop();
  const toggleListening = () => isListening ? stopListening() : startListening();

  // --- Auth & Personalization Actions ---
  const handleAuthAction = useCallback((actionCallback) => {
    if (!token) {
      Toast.show({ type: 'hotstarInfo', text1: 'Log in for personalization', position: 'top', topOffset: insets.top > 0 ? insets.top + 10 : 50, visibilityTime: 2500 });
    } else {
      actionCallback();
    }
  }, [token, insets.top]);

  const handleToggleAction = useCallback(async (id, mediaType, targetList) => {
    if (targetList === 'watchlist') toggleWatchlist(id, mediaType);
    if (targetList === 'watched') toggleWatched(id, mediaType);

    try {
      const tmdbIdWithType = `${id}:${mediaType}`;
      const response = await fetch(`${BACKEND_URL}/user/${targetList}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tmdbId: tmdbIdWithType })
      });

      if (!response.ok) throw new Error('Failed to update on server');

      const data = await response.json();
      const arrayToMap = (arr) => arr.reduce((acc, curr) => {
        const [idStr, typeStr] = String(curr).split(':');
        acc[idStr] = typeStr || 'movie';
        return acc;
      }, {});

      useUserListStore.setState({ watchlist: arrayToMap(data.watchlist), watched: arrayToMap(data.watched) });

    } catch (error) {
      Toast.show({ type: 'error', text1: `Failed to save to ${targetList}` });
      if (targetList === 'watchlist') toggleWatchlist(id, mediaType);
      if (targetList === 'watched') toggleWatched(id, mediaType);
    }
  }, [toggleWatchlist, toggleWatched, token]);

  const renderBadge = (item) => {
    const badgeText = item.media_type === 'tv' ? 'SERIES' : (item.release_date > '2024-01-01' ? 'NEW' : null);
    if (!badgeText) return null;

    return (
      <LinearGradient colors={['#8B22D4', '#E6398A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.badgeContainer}>
        <Text style={styles.badgeText}>{badgeText}</Text>
      </LinearGradient>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.innerContainer}>

          {/* --- Search Header Area --- */}
          <View style={styles.searchHeader}>
            <View style={[styles.searchBox, isAiMode && styles.searchBoxAi, isListening && styles.searchBoxActive]}>
              <Ionicons name={isAiMode ? "sparkles" : "search"} size={20} color={isAiMode ? "#D63484" : "#8F98A0"} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={isListening ? "Listening..." : (isAiMode ? "Describe a mood, plot, or vibe..." : "Search movies, shows...")}
                placeholderTextColor={isListening ? "#1F80E0" : "#8F98A0"}
                value={searchQuery}
                onChangeText={setSearchQuery}
                selectionColor={isAiMode ? "#D63484" : "#1F80E0"}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && !isListening ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.rightIcon}>
                  <Ionicons name="close-circle" size={18} color="#8F98A0" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={toggleListening} style={styles.rightIcon}>
                  {isListening ? (
                    <ActivityIndicator size="small" color="#1F80E0" />
                  ) : (
                    <Ionicons name="mic-outline" size={22} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* AI Toggle UI */}
            <View style={styles.aiToggleContainer}>
              <TouchableOpacity
                style={[styles.toggleBtn, !isAiMode && styles.toggleBtnActiveStandard]}
                onPress={() => setIsAiMode(false)}
                activeOpacity={0.8}
              >
                <Ionicons name="search" size={14} color={!isAiMode ? "#FFF" : "#8F98A0"} />
                <Text style={[styles.toggleText, !isAiMode && styles.toggleTextActive]}>Standard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, isAiMode && styles.toggleBtnActiveAI]}
                onPress={() => setIsAiMode(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="sparkles" size={14} color={isAiMode ? "#FFF" : "#8F98A0"} />
                <Text style={[styles.toggleText, isAiMode && styles.toggleTextActive]}>AI Match</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

            <Text style={styles.sectionTitle}>
              {searchQuery.length > 0
                ? (isAiMode ? `AI Results for "${searchQuery}"` : `Results for "${searchQuery}"`)
                : 'Trending Now'}
            </Text>

            {/* Hide Filter Chips if AI Mode is active and query exists (since AI ignores chips) */}
            {!(isAiMode && searchQuery.length > 0) && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
                {FILTER_CHIPS.map((chip, index) => {
                  const isActive = activeChip === chip;
                  return (
                    <TouchableOpacity key={index} style={[styles.chip, isActive && styles.activeChip]} onPress={() => setActiveChip(chip)} activeOpacity={0.8}>
                      <Text style={[styles.chipText, isActive && styles.activeChipText]}>{chip}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* --- Dynamic Grid Content --- */}
            {isLoading ? (
              <ActivityIndicator size="large" color={isAiMode ? "#D63484" : "#1F80E0"} style={{ marginTop: 40 }} />
            ) : (
              <View style={styles.gridContainer}>
                {gridRows.map((row, rowIndex) => (
                  <View key={`row-${rowIndex}`} style={styles.row}>
                    {row.map((item) => {
                      const inWatchlist = watchlist[item.id];
                      const inWatched = watched[item.id];
                      const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
                      const imageUri = getImageUrl(item.poster_path || item.backdrop_path);

                      return (
                        <TouchableOpacity
                          key={item.id}
                          activeOpacity={0.8}
                          onPress={() => router.push({ pathname: '/player', params: { id: item.id, type: mediaType } })}
                          style={[styles.card, { width: STANDARD_CARD_WIDTH }]}
                        >
                          {imageUri ? (
                            <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" />
                          ) : (
                            <View style={[styles.cardImage, { backgroundColor: '#25252A', justifyContent: 'center', alignItems: 'center' }]}>
                              <Ionicons name="film-outline" size={24} color="#8F98A0" />
                            </View>
                          )}
                          {renderBadge(item)}
                          {item.vote_average > 0 && (
                            <View style={styles.translucentRatingBadge}>
                              <Ionicons name="star" size={10} color="#F5C518" />
                              <Text style={styles.smallCardRatingText}>{(item.vote_average).toFixed(1)}</Text>
                            </View>
                          )}
                          <View style={styles.cardActions}>
                            <TouchableOpacity style={styles.smallIconBtn} activeOpacity={0.8} onPress={() => handleAuthAction(() => handleToggleAction(item.id, mediaType, 'watchlist'))}>
                              <Ionicons name={inWatchlist ? "bookmark" : "bookmark-outline"} size={14} color={inWatchlist ? "#F5C518" : "#FFFFFF"} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.smallIconBtn} activeOpacity={0.8} onPress={() => handleAuthAction(() => handleToggleAction(item.id, mediaType, 'watched'))}>
                              <Ionicons name="checkmark-done" size={14} color={inWatched ? "#1F80E0" : "#FFFFFF"} />
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}

                {!isLoading && filteredResults.length === 0 && (
                  <Text style={{ color: '#8F98A0', textAlign: 'center', marginTop: 40 }}>
                    {isAiMode ? "AI couldn't find matching titles. Try a different prompt." : "No results found."}
                  </Text>
                )}
              </View>
            )}

          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0C' },
  innerContainer: { flex: 1 },
  searchHeader: { paddingHorizontal: SCREEN_PADDING, paddingTop: 8, paddingBottom: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#25252A', borderRadius: 24, height: 52, paddingHorizontal: 16, borderWidth: 1, borderColor: 'transparent' },
  searchBoxActive: { borderColor: '#1F80E0', backgroundColor: '#1C2533' },
  searchBoxAi: { borderColor: 'rgba(214, 52, 132, 0.4)', backgroundColor: '#1A1423' },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 16, height: '100%' },
  rightIcon: { paddingLeft: 10, height: 40, justifyContent: 'center' },

  // AI Toggle Styles
  aiToggleContainer: { flexDirection: 'row', backgroundColor: '#1C1C22', borderRadius: 20, padding: 4, marginTop: 12, alignSelf: 'flex-start' },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, gap: 6 },
  toggleBtnActiveStandard: { backgroundColor: '#2A2A30' },
  toggleBtnActiveAI: { backgroundColor: '#8B22D4' },
  toggleText: { color: '#8F98A0', fontSize: 13, fontWeight: '600' },
  toggleTextActive: { color: '#FFFFFF' },

  scrollContent: { paddingBottom: 80 },
  sectionTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', paddingHorizontal: SCREEN_PADDING, marginBottom: 16 },
  chipsContainer: { paddingHorizontal: SCREEN_PADDING, marginBottom: 20, gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E24', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  activeChip: { backgroundColor: '#2A2A30', borderColor: 'rgba(255, 255, 255, 0.2)' },
  chipText: { color: '#A0A0A5', fontSize: 14, fontWeight: '600' },
  activeChipText: { color: '#FFFFFF' },
  gridContainer: { paddingHorizontal: SCREEN_PADDING, gap: GAP },
  row: { flexDirection: 'row', gap: GAP },
  card: { height: CARD_HEIGHT, borderRadius: 6, overflow: 'hidden', backgroundColor: '#1E1E24', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 8, position: 'relative' },
  cardImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  badgeContainer: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  translucentRatingBadge: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.65)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, zIndex: 2 },
  smallCardRatingText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold', marginLeft: 3, marginTop: 1 },
  cardActions: { position: 'absolute', top: 6, right: 6, gap: 6, zIndex: 2 },
  smallIconBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' },
});