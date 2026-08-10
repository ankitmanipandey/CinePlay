import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    Image,
    Dimensions,
    FlatList,
    StatusBar
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');
const PLAYER_HEIGHT = width * (9 / 16); // Standard 16:9 Aspect Ratio

// --- Initial Data ---
const INITIAL_PLAYING_MEDIA = {
    id: 'p1',
    title: 'Live Concert',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
    language: 'English',
    rating: '9.0'
};

const INITIAL_MORE_LIKE_THIS = [
    { id: '1', title: 'Fear Below', image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80', language: 'हिन्दी', rating: '8.4' },
    { id: '2', title: 'Becky', image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&q=80', language: 'हिन्दी', rating: '7.1' },
    { id: '3', title: 'Black Site', image: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=400&q=80', language: 'English', rating: '6.8' },
    { id: '4', title: 'Mirzapur', image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80', language: 'हिन्दी', rating: '9.2' },
    { id: '5', title: 'Asur', image: 'https://images.unsplash.com/photo-1605806616949-1e87b487cb2a?w=400&q=80', language: 'हिन्दी', rating: '8.9' },
];

export default function PlayerScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [currentMedia, setCurrentMedia] = useState(INITIAL_PLAYING_MEDIA);
    const [moreLikeThisList, setMoreLikeThisList] = useState(INITIAL_MORE_LIKE_THIS);

    // --- Mutually Exclusive List State Tracker ---
    const [userLists, setUserLists] = useState({
        watchlist: {},
        watched: {}
    });

    // Reusable function to check auth state before taking an action
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

    // Toggles the state making sure an item cannot be in both simultaneously
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

    // Swap the playing media with the clicked card
    const handleCardClick = (selectedItem) => {
        setMoreLikeThisList((prevList) => {
            const filteredList = prevList.filter((item) => item.id !== selectedItem.id);
            return [currentMedia, ...filteredList];
        });
        setCurrentMedia(selectedItem);
    };

    const isCurrentInWatchlist = userLists.watchlist[currentMedia.id];
    const isCurrentInWatched = userLists.watched[currentMedia.id];

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#000" translucent={false} />

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                    {/* =========================================
                                 VIDEO PLAYER SECTION
                       ========================================= */}
                    <View style={styles.playerContainer}>
                        <Image
                            source={{ uri: currentMedia.image }}
                            style={styles.videoThumbnail}
                        />

                        <LinearGradient
                            colors={['rgba(0,0,0,0.8)', 'transparent']}
                            style={styles.topGradient}
                        />
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.8)']}
                            style={styles.bottomGradient}
                        />

                        <View style={styles.playerOverlay}>
                            <View style={styles.playerTopBar}>
                                {/* CRITICAL FIX: Changed to router.back() and removed press delay */}
                                <TouchableOpacity
                                    onPress={() => router.back()}
                                    style={styles.iconButton}
                                    activeOpacity={0.6}
                                    delayPressIn={0}
                                >
                                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                                </TouchableOpacity>

                                <View style={styles.topRightControls}>
                                    {/* Watchlist Button */}
                                    <TouchableOpacity
                                        onPress={() => handleAuthAction(() => handleToggleAction(currentMedia.id, 'watchlist'))}
                                        style={styles.iconButton}
                                    >
                                        <Ionicons
                                            name={isCurrentInWatchlist ? "bookmark" : "bookmark-outline"}
                                            size={24}
                                            color={isCurrentInWatchlist ? "#F5C518" : "#FFFFFF"}
                                        />
                                    </TouchableOpacity>

                                    {/* Watched Button */}
                                    <TouchableOpacity
                                        onPress={() => handleAuthAction(() => handleToggleAction(currentMedia.id, 'watched'))}
                                        style={styles.iconButton}
                                    >
                                        <Ionicons
                                            name="checkmark-done"
                                            size={26}
                                            color={isCurrentInWatched ? "#1F80E0" : "#FFFFFF"}
                                        />
                                    </TouchableOpacity>

                                    {/* Fullscreen/Scan Button */}
                                    <TouchableOpacity style={styles.iconButton}>
                                        <Ionicons name="scan" size={20} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <TouchableOpacity style={styles.centerPlayButton} activeOpacity={0.7}>
                                <Ionicons name="play" size={38} color="#FFFFFF" style={{ marginLeft: 4 }} />
                            </TouchableOpacity>

                            <Text style={styles.timeText}>00:00</Text>

                            <View style={styles.timelineBackground}>
                                <View style={styles.timelineFill} />
                            </View>
                        </View>
                    </View>

                    {/* =========================================
                                MORE LIKE THIS ROW
                       ========================================= */}
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>More Like This</Text>
                        <FlatList
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            data={moreLikeThisList}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.listContent}
                            renderItem={({ item }) => {
                                const inWatchlist = userLists.watchlist[item.id];
                                const inWatched = userLists.watched[item.id];

                                return (
                                    <TouchableOpacity
                                        style={styles.standardCard}
                                        activeOpacity={0.7}
                                        delayPressIn={0}
                                        onPress={() => handleCardClick(item)}
                                    >
                                        <Image source={{ uri: item.image }} style={styles.cardImage} />

                                        <LinearGradient
                                            colors={['transparent', 'rgba(0,0,0,0.9)']}
                                            style={styles.cardBottomGradient}
                                        />

                                        <View style={styles.translucentRatingBadge}>
                                            <Ionicons name="star" size={10} color="#F5C518" />
                                            <Text style={styles.smallCardRatingText}>{item.rating}</Text>
                                        </View>

                                        {/* Action Buttons Stack (Top Right) */}
                                        <View style={styles.smallCardActions}>
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

                                        <View style={styles.languageBadge}>
                                            <Text style={styles.languageText}>{item.language}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>

                </ScrollView>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#000',
    },
    container: {
        flex: 1,
        backgroundColor: '#0A0A0C',
    },
    scrollContent: {
        paddingBottom: 40,
    },

    /* --- Player Section --- */
    playerContainer: {
        width: width,
        height: PLAYER_HEIGHT,
        backgroundColor: '#000',
        position: 'relative',
    },
    videoThumbnail: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
    topGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
    },
    bottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
    },
    playerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
    },
    playerTopBar: {
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    topRightControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconButton: {
        padding: 4,
    },
    centerPlayButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    timeText: {
        position: 'absolute',
        bottom: 12,
        left: 16,
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    timelineBackground: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    timelineFill: {
        width: '0%', // Reset to 0 since it's a new video
        height: '100%',
        backgroundColor: '#FF8C00',
    },

    /* --- Sections --- */
    sectionContainer: {
        marginTop: 24,
    },
    sectionTitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
        paddingHorizontal: 16,
        marginBottom: 16,
        letterSpacing: 0.2,
    },
    listContent: {
        paddingHorizontal: 16,
        gap: 12,
    },

    /* --- More Like This Cards --- */
    standardCard: {
        width: 125,
        height: 175,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#1E1428',
        position: 'relative',
    },
    cardImage: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
    cardBottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '40%',
    },
    translucentRatingBadge: {
        position: 'absolute',
        top: 6,
        left: 6,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
    },
    smallCardRatingText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 3,
        marginTop: 1,
    },

    smallCardActions: {
        position: 'absolute',
        top: 6,
        right: 6,
        gap: 6
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

    languageBadge: {
        position: 'absolute',
        bottom: 12,
        alignSelf: 'center',
    },
    languageText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
});