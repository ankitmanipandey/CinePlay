import React, { useState, useEffect } from 'react';
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
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';

// --- API & Config Imports ---
import { tmdbService } from '../services/tmdbService';
import { getImageUrl } from '../constants/config';

const { width } = Dimensions.get('window');

// --- Grid Calculations ---
const SCREEN_PADDING = 12;
const GAP = 8;
const AVAILABLE_WIDTH = width - (SCREEN_PADDING * 2);
const STANDARD_CARD_WIDTH = (AVAILABLE_WIDTH - (GAP * 2)) / 3;
const CARD_HEIGHT = STANDARD_CARD_WIDTH * 1.45;

const FILTER_CHIPS = ['Action', 'Comedy', 'Drama', 'Thriller', 'Sci-Fi', 'Horror'];

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeChip, setActiveChip] = useState('Action');

  // Search state
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Mutually Exclusive List State Tracker ---
  const [userLists, setUserLists] = useState({
    watchlist: {},
    watched: {}
  });

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

  // --- API Fetching Effect with Debounce ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      setIsLoading(true);

      try {
        if (searchQuery.trim().length > 0) {
          // 1. If typing in search bar, prioritize text search
          const searchData = await tmdbService.searchMulti(searchQuery);
          setResults(searchData);
        } else {
          // 2. If search bar is empty, filter by the active chip!
          const genreId = GENRE_MAP[activeChip];

          if (genreId) {
            const genreData = await tmdbService.discoverByGenre(genreId);
            setResults(genreData);
          } else {
            // Fallback (just in case a chip has no mapped ID)
            const trendingData = await tmdbService.getTrending();
            setResults(trendingData);
          }
        }
      } catch (error) {
        console.error("Search fetch failed", error);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    // IMPORTANT: activeChip is now in the dependency array
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, activeChip]);

  // --- Helper to convert flat array to grid rows ---
  const getChunkedRows = (data, chunkSize = 3) => {
    const chunked = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunked.push(data.slice(i, i + chunkSize));
    }
    return chunked;
  };

  const gridRows = getChunkedRows(results);


  // --- Voice Commands ---
  useSpeechRecognitionEvent('start', () => setIsListening(true));
  useSpeechRecognitionEvent('end', () => setIsListening(false));

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript;
    if (transcript) {
      setSearchQuery(transcript);
    }
    if (event.isFinal) {
      stopListening();
    }
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
    if (!permissions.granted) {
      console.warn('Speech recognition permissions not granted', permissions);
      return;
    }
    setSearchQuery('');
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      maxAlternatives: 1,
      continuous: false,
      requiresOnDeviceRecognition: false,
      addsPunctuation: false,
    });
  };

  const stopListening = () => {
    ExpoSpeechRecognitionModule.stop();
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // --- Auth & Personalization Actions ---
  const handleAuthAction = async (actionCallback) => {
    const token = await SecureStore.getItemAsync('userToken');
    if (!token) {
      Toast.show({
        type: 'hotstarInfo',
        text1: 'Log in for personalization',
        position: 'top',
        topOffset: insets.top > 0 ? insets.top + 10 : 50,
        visibilityTime: 2500,
      });
    } else {
      actionCallback();
    }
  };

  const handleToggleAction = (id, targetList) => {
    setUserLists(prev => {
      const newWatchlist = { ...prev.watchlist };
      const newWatched = { ...prev.watched };

      if (targetList === 'watchlist') {
        if (newWatchlist[id]) {
          delete newWatchlist[id]; // Toggle Off
        } else {
          newWatchlist[id] = true; // Toggle On
          delete newWatched[id];   // Ensure mutually exclusive
        }
      } else if (targetList === 'watched') {
        if (newWatched[id]) {
          delete newWatched[id]; // Toggle Off
        } else {
          newWatched[id] = true; // Toggle On
          delete newWatchlist[id]; // Ensure mutually exclusive
        }
      }
      return { watchlist: newWatchlist, watched: newWatched };
    });
  };

  const renderBadge = (item) => {
    // Generate a contextual badge based on data
    const badgeText = item.media_type === 'tv' ? 'SERIES' : (item.release_date > '2024-01-01' ? 'NEW' : null);
    if (!badgeText) return null;

    return (
      <LinearGradient
        colors={['#8B22D4', '#E6398A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.badgeContainer}
      >
        <Text style={styles.badgeText}>{badgeText}</Text>
      </LinearGradient>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.innerContainer}>

          {/* --- Search Bar Area --- */}
          <View style={styles.searchHeader}>
            <View style={[styles.searchBox, isListening && styles.searchBoxActive]}>
              <Ionicons name="search" size={20} color="#8F98A0" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={isListening ? "Listening..." : "Search movies, shows..."}
                placeholderTextColor={isListening ? "#1F80E0" : "#8F98A0"}
                value={searchQuery}
                onChangeText={setSearchQuery}
                selectionColor="#1F80E0"
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
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

            {/* --- Dynamic Section Header --- */}
            <Text style={styles.sectionTitle}>
              {searchQuery.length > 0 ? `Results for "${searchQuery}"` : 'Trending Now'}
            </Text>

            {/* --- Filter Chips --- */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsContainer}
            >
              {FILTER_CHIPS.map((chip, index) => {
                const isActive = activeChip === chip;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.chip,
                      isActive && styles.activeChip
                    ]}
                    onPress={() => setActiveChip(chip)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, isActive && styles.activeChipText]}>
                      {chip}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* --- Dynamic Grid Content --- */}
            {isLoading ? (
              <ActivityIndicator size="large" color="#1F80E0" style={{ marginTop: 40 }} />
            ) : (
              <View style={styles.gridContainer}>
                {gridRows.map((row, rowIndex) => (
                  <View key={`row-${rowIndex}`} style={styles.row}>
                    {row.map((item) => {
                      const inWatchlist = userLists.watchlist[item.id];
                      const inWatched = userLists.watched[item.id];
                      const mediaType = item.media_type || 'movie';

                      // Fallback image if poster is missing
                      const imageUri = getImageUrl(item.poster_path || item.backdrop_path);

                      return (
                        <TouchableOpacity
                          key={item.id}
                          activeOpacity={0.8}
                          onPress={() => router.push({ pathname: '/player', params: { id: item.id, type: mediaType } })}
                          style={[styles.card, { width: STANDARD_CARD_WIDTH }]}
                        >
                          {imageUri ? (
                            <Image
                              source={{ uri: imageUri }}
                              style={styles.cardImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={[styles.cardImage, { backgroundColor: '#25252A', justifyContent: 'center', alignItems: 'center' }]}>
                              <Ionicons name="film-outline" size={24} color="#8F98A0" />
                            </View>
                          )}

                          {renderBadge(item)}

                          {/* IMDb Rating Badge */}
                          {item.vote_average > 0 && (
                            <View style={styles.translucentRatingBadge}>
                              <Ionicons name="star" size={10} color="#F5C518" />
                              <Text style={styles.smallCardRatingText}>{(item.vote_average).toFixed(1)}</Text>
                            </View>
                          )}

                          {/* Action Buttons Overlay */}
                          <View style={styles.cardActions}>
                            <TouchableOpacity
                              style={styles.smallIconBtn}
                              activeOpacity={0.8}
                              onPress={() => handleAuthAction(() => handleToggleAction(item.id, 'watchlist'))}
                            >
                              <Ionicons
                                name={inWatchlist ? "bookmark" : "bookmark-outline"}
                                size={14}
                                color={inWatchlist ? "#F5C518" : "#FFFFFF"}
                              />
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.smallIconBtn}
                              activeOpacity={0.8}
                              onPress={() => handleAuthAction(() => handleToggleAction(item.id, 'watched'))}
                            >
                              <Ionicons
                                name="checkmark-done"
                                size={14}
                                color={inWatched ? "#1F80E0" : "#FFFFFF"}
                              />
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}

                {!isLoading && results.length === 0 && (
                  <Text style={{ color: '#8F98A0', textAlign: 'center', marginTop: 40 }}>
                    No results found.
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
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  innerContainer: {
    flex: 1,
  },
  searchHeader: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 8,
    paddingBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25252A',
    borderRadius: 24,
    height: 52,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  searchBoxActive: {
    borderColor: '#1F80E0',
    backgroundColor: '#1C2533',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    height: '100%',
  },
  rightIcon: {
    paddingLeft: 10,
    height: 40,
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 80,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    paddingHorizontal: SCREEN_PADDING,
    marginBottom: 16,
  },
  chipsContainer: {
    paddingHorizontal: SCREEN_PADDING,
    marginBottom: 20,
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E24',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeChip: {
    backgroundColor: '#2A2A30',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  chipText: {
    color: '#A0A0A5',
    fontSize: 14,
    fontWeight: '600',
  },
  activeChipText: {
    color: '#FFFFFF',
  },
  gridContainer: {
    paddingHorizontal: SCREEN_PADDING,
    gap: GAP,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
  },
  card: {
    height: CARD_HEIGHT,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#1E1E24',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 8,
    position: 'relative',
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  badgeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  translucentRatingBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 2,
  },
  smallCardRatingText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 3,
    marginTop: 1,
  },
  cardActions: {
    position: 'absolute',
    top: 6,
    right: 6,
    gap: 6,
    zIndex: 2,
  },
  smallIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
});