import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    FlatList,
    Image,
    Dimensions,
    StatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');
const SCREEN_PADDING = 12;
const GAP = 8;
const AVAILABLE_WIDTH = width - (SCREEN_PADDING * 2);
const CARD_WIDTH = (AVAILABLE_WIDTH - (GAP * 2)) / 3;
const CARD_HEIGHT = CARD_WIDTH * 1.5;

// Mock Data matching the grid style in the images, now including ratings
const GRID_MOCK_DATA = [
    { id: '1', poster: 'https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=400&q=80', topBadge: null, bottomBadge: 'NEW RELEASE', bottomBadgeColor: '#E6398A', rating: '8.4' },
    { id: '2', poster: 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=400&q=80', topBadge: 'TOP\n10', bottomBadge: null, bottomText: 'हिन्दी', rating: '9.1' },
    { id: '3', poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&q=80', topBadge: 'TOP\n10', bottomBadge: 'NEW EPISODES FRI', bottomBadgeColor: '#8B22D4', rating: '7.8' },
    { id: '4', poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80', topBadge: null, bottomBadge: null, bottomText: 'हिन्दी', rating: '8.0' },
    { id: '5', poster: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=400&q=80', topBadge: null, bottomBadge: 'NEWLY ADDED', bottomBadgeColor: '#8B22D4', rating: '6.5' },
    { id: '6', poster: 'https://images.unsplash.com/photo-1614729939124-03290b55c9ce?w=400&q=80', topBadge: 'TOP\n10', bottomBadge: null, bottomText: 'हिन्दी', rating: '8.8' },
    { id: '7', poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80', topBadge: null, bottomBadge: 'NEWLY ADDED', bottomBadgeColor: '#8B22D4', rating: '7.2' },
    { id: '8', poster: 'https://images.unsplash.com/photo-1505635552518-3448ff116af3?w=400&q=80', topBadge: null, bottomBadge: null, bottomText: 'हिन्दी', rating: '7.5' },
    { id: '9', poster: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=400&q=80', topBadge: null, bottomBadge: null, bottomText: 'ASK ME WHAT YOU WANT', rating: '8.1' },
    { id: '10', poster: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=400&q=80', topBadge: null, bottomBadge: null, bottomText: 'हिन्दी', rating: '6.9' },
    { id: '11', poster: 'https://images.unsplash.com/photo-1605806616949-1e87b487cb2a?w=400&q=80', topBadge: null, bottomBadge: 'NEW SEASON', bottomBadgeColor: '#8B22D4', rating: '9.3' },
    { id: '12', poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&q=80', topBadge: null, bottomBadge: null, bottomText: 'Wuthering Heights', rating: '8.5' },
];

export default function CategoryScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { title } = useLocalSearchParams(); // Captures the title passed from HomeScreen

    // --- Mutually Exclusive List State Tracker ---
    const [userLists, setUserLists] = useState({
        watchlist: {},
        watched: {}
    });

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

    const renderMovieCard = ({ item }) => {
        const inWatchlist = userLists.watchlist[item.id];
        const inWatched = userLists.watched[item.id];

        return (
            <TouchableOpacity
                style={styles.cardContainer}
                activeOpacity={0.8}
                onPress={() => router.push('/player')}
            >
                <Image source={{ uri: item.poster }} style={styles.cardImage} resizeMode="cover" />

                {/* Dark gradient for text readability if there is bottom text */}
                {item.bottomText && (
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.9)']}
                        style={styles.cardBottomGradient}
                    />
                )}

                {/* IMDb Rating Badge (Top Left) */}
                {item.rating && (
                    <View style={styles.translucentRatingBadge}>
                        <Ionicons name="star" size={10} color="#F5C518" />
                        <Text style={styles.ratingText}>{item.rating}</Text>
                    </View>
                )}

                {/* Action Buttons Overlay (Top Right)
                    Dynamically shifted down if the 'TOP 10' badge is present so they don't overlap 
                */}
                <View style={[styles.cardActions, { top: item.topBadge ? 32 : 6 }]}>
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

                {/* Top 10 Badge */}
                {item.topBadge && (
                    <View style={styles.topBadgeContainer}>
                        <Text style={styles.topBadgeText}>{item.topBadge}</Text>
                    </View>
                )}

                {/* Bottom Solid Badge (e.g., NEW RELEASE) */}
                {item.bottomBadge && (
                    <View style={[styles.bottomBadgeContainer, { backgroundColor: item.bottomBadgeColor }]}>
                        <Text style={styles.bottomBadgeText}>{item.bottomBadge}</Text>
                    </View>
                )}

                {/* Bottom Overlay Text (e.g., हिन्दी) */}
                {item.bottomText && !item.bottomBadge && (
                    <View style={styles.bottomTextContainer}>
                        <Text style={styles.bottomText} numberOfLines={2}>{item.bottomText}</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.background}>
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{title || 'Category'}</Text>
                </View>

                {/* Grid Content */}
                <FlatList
                    data={GRID_MOCK_DATA}
                    keyExtractor={(item) => item.id}
                    numColumns={3}
                    contentContainerStyle={styles.listContent}
                    columnWrapperStyle={styles.columnWrapper}
                    showsVerticalScrollIndicator={false}
                    renderItem={renderMovieCard}
                />
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    background: { flex: 1 },
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 8
    },
    backButton: { marginRight: 16, padding: 4 },
    headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', letterSpacing: 0.3 },

    listContent: {
        paddingHorizontal: SCREEN_PADDING,
        paddingBottom: 40,
    },
    columnWrapper: {
        justifyContent: 'flex-start',
        gap: GAP,
        marginBottom: GAP,
    },
    cardContainer: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: 6,
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

    // --- Badge & Button Styles ---
    translucentRatingBadge: {
        position: 'absolute',
        top: 6,
        left: 6,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        paddingHorizontal: 5,
        paddingVertical: 3,
        borderRadius: 4,
        zIndex: 10
    },
    ratingText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 3,
        marginTop: 1
    },
    cardActions: {
        position: 'absolute',
        right: 6,
        gap: 6,
        zIndex: 10
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

    topBadgeContainer: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: '#E6398A',
        paddingHorizontal: 4,
        paddingVertical: 4,
        borderBottomLeftRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5
    },
    topBadgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '900',
        textAlign: 'center',
        lineHeight: 11,
    },
    bottomBadgeContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingVertical: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomBadgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    bottomTextContainer: {
        position: 'absolute',
        bottom: 8,
        left: 4,
        right: 4,
        alignItems: 'center',
    },
    bottomText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: 'bold',
        textAlign: 'center',
    },
});