import React, { useCallback, useMemo } from 'react';
import {
    StyleSheet, Text, View, TouchableOpacity, FlatList,
    Image, ActivityIndicator, Platform, useWindowDimensions, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useCategoryLogic } from '../hooks/useCategoryLogic';
import { getImageUrl } from '../constants/config';

// --------------------------------------------------------
// MEMOIZED MOVIE CARD (Shared)
// --------------------------------------------------------
const MovieCard = React.memo(({ item, inWatchlist, inWatched, onToggleAction, handleAuthAction, router, isDesktop, mobileWidth, mobileHeight }) => {
    const posterUri = getImageUrl(item.poster_path || item.backdrop_path);
    const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');

    const isNew = item.release_date && item.release_date > '2024-01-01';
    const bottomBadge = isNew ? 'NEW RELEASE' : null;
    const topBadge = item.popularity > 1500 ? 'TOP\n10' : null;
    const bottomText = mediaType === 'tv' ? 'SERIES' : null;

    const cardStyle = isDesktop
        ? styles.cardContainerDesktop
        : [styles.cardContainerMobile, { width: mobileWidth, height: mobileHeight }];

    return (
        <TouchableOpacity
            style={cardStyle}
            activeOpacity={0.8}
            onPress={() => router.push({ pathname: '/player', params: { id: item.id, type: mediaType } })}
        >
            {posterUri ? (
                <Image source={{ uri: posterUri }} style={styles.cardImage} resizeMode="cover" />
            ) : (
                <View style={[styles.cardImage, { backgroundColor: '#25252A', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="film-outline" size={isDesktop ? 36 : 24} color="#8F98A0" />
                </View>
            )}

            {bottomText && <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.cardBottomGradient} />}

            {rating && (
                <View style={styles.translucentRatingBadge}>
                    <Ionicons name="star" size={10} color="#F5C518" />
                    <Text style={styles.ratingText}>{rating}</Text>
                </View>
            )}

            <View style={[styles.cardActions, { top: topBadge ? (isDesktop ? 40 : 32) : 6 }]}>
                <TouchableOpacity
                    style={isDesktop ? styles.smallIconBtnDesktop : styles.smallIconBtn}
                    activeOpacity={0.8}
                    onPress={() => handleAuthAction(() => onToggleAction(item.id, mediaType, 'watchlist'))}
                >
                    <Ionicons name={inWatchlist ? "bookmark" : "bookmark-outline"} size={isDesktop ? 16 : 14} color={inWatchlist ? "#F5C518" : "#FFFFFF"} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={isDesktop ? styles.smallIconBtnDesktop : styles.smallIconBtn}
                    activeOpacity={0.8}
                    onPress={() => handleAuthAction(() => onToggleAction(item.id, mediaType, 'watched'))}
                >
                    <Ionicons name="checkmark-done" size={isDesktop ? 16 : 14} color={inWatched ? "#1F80E0" : "#FFFFFF"} />
                </TouchableOpacity>
            </View>

            {topBadge && (
                <View style={styles.topBadgeContainer}>
                    <Text style={styles.topBadgeText}>{topBadge}</Text>
                </View>
            )}

            {bottomBadge && (
                <View style={[styles.bottomBadgeContainer, { backgroundColor: '#E6398A' }]}>
                    <Text style={styles.bottomBadgeText}>{bottomBadge}</Text>
                </View>
            )}

            {bottomText && !bottomBadge && (
                <View style={styles.bottomTextContainer}>
                    <Text style={styles.bottomText} numberOfLines={2}>{bottomText}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.inWatchlist === nextProps.inWatchlist &&
        prevProps.inWatched === nextProps.inWatched &&
        prevProps.item.id === nextProps.item.id &&
        prevProps.isDesktop === nextProps.isDesktop &&
        prevProps.mobileWidth === nextProps.mobileWidth
    );
});

export default function CategoryScreenWeb() {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 1024;

    const {
        router, insets, title, data, isLoading,
        watchlist, watched, handleAuthAction, handleToggleAction
    } = useCategoryLogic();

    // Dynamically calculate mobile dimensions to perfectly mirror native
    const SCREEN_PADDING = 12;
    const GAP = 8;
    const AVAILABLE_WIDTH = width - (SCREEN_PADDING * 2);
    const CARD_WIDTH = (AVAILABLE_WIDTH - (GAP * 2)) / 3;
    const CARD_HEIGHT = CARD_WIDTH * 1.5;

    const renderItem = useCallback(({ item }) => (
        <MovieCard
            item={item}
            inWatchlist={!!watchlist[item.id]}
            inWatched={!!watched[item.id]}
            onToggleAction={handleToggleAction}
            handleAuthAction={handleAuthAction}
            router={router}
            isDesktop={isDesktop}
            mobileWidth={CARD_WIDTH}
            mobileHeight={CARD_HEIGHT}
        />
    ), [watchlist, watched, handleToggleAction, handleAuthAction, router, isDesktop, CARD_WIDTH, CARD_HEIGHT]);

    // --------------------------------------------------------
    // DESKTOP LAYOUT (Widescreen Grid)
    // --------------------------------------------------------
    if (isDesktop) {
        return (
            <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.background}>
                <View style={[styles.container, { paddingTop: 32 }]}>
                    <View style={styles.desktopWrapper}>
                        <View style={styles.headerDesktop}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.backButtonDesktop}>
                                <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
                            </TouchableOpacity>
                            <Text style={styles.headerTitleDesktop}>{title || 'Category'}</Text>
                        </View>

                        {isLoading ? (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <ActivityIndicator size="large" color="#1F80E0" />
                            </View>
                        ) : data.length === 0 ? (
                            <Text style={{ color: '#8F98A0', textAlign: 'center', marginTop: 100, fontSize: 18 }}>
                                No titles found for this category.
                            </Text>
                        ) : (
                            <ScrollView contentContainerStyle={styles.desktopGrid}>
                                {data.map(item => <React.Fragment key={item.id}>{renderItem({ item })}</React.Fragment>)}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </LinearGradient>
        );
    }

    // --------------------------------------------------------
    // MOBILE & TABLET LAYOUT (Exact Native Clone)
    // --------------------------------------------------------
    return (
        <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.background}>
            <SafeAreaView style={[styles.container, { paddingTop: insets.top }]} edges={['top']}>
                <View style={styles.headerMobile}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButtonMobile}>
                        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitleMobile}>{title || 'Category'}</Text>
                </View>

                {isLoading ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#1F80E0" />
                    </View>
                ) : (
                    <FlatList
                        data={data}
                        extraData={{ watchlist, watched }}
                        keyExtractor={(item, index) => `${item.id}-${index}`}
                        numColumns={3}
                        contentContainerStyle={styles.listContentMobile}
                        columnWrapperStyle={styles.columnWrapperMobile}
                        showsVerticalScrollIndicator={false}
                        renderItem={renderItem}
                        ListEmptyComponent={
                            <Text style={{ color: '#8F98A0', textAlign: 'center', marginTop: 40 }}>
                                No titles found for this category.
                            </Text>
                        }
                    />
                )}
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    background: { flex: 1 },
    container: { flex: 1 },

    // --- DESKTOP STYLES (>= 1024px) ---
    desktopWrapper: { flex: 1, width: '100%', maxWidth: 1200, alignSelf: 'center', paddingHorizontal: 32 },
    headerDesktop: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
    backButtonDesktop: { marginRight: 24, cursor: 'pointer' },
    headerTitleDesktop: { color: '#FFFFFF', fontSize: 32, fontWeight: 'bold', letterSpacing: 0.5 },
    desktopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, paddingBottom: 60 },
    cardContainerDesktop: { width: '15%', minWidth: 160, aspectRatio: 2 / 3, borderRadius: 8, overflow: 'hidden', backgroundColor: '#1E1428', position: 'relative', cursor: 'pointer' },
    smallIconBtnDesktop: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)', cursor: 'pointer' },

    // --- MOBILE & TABLET STYLES (< 1024px) ---
    headerMobile: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8 },
    backButtonMobile: { marginRight: 16, padding: 4, cursor: 'pointer' },
    headerTitleMobile: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', letterSpacing: 0.3 },
    listContentMobile: { paddingHorizontal: 12, paddingBottom: 40 },
    columnWrapperMobile: { justifyContent: 'flex-start', gap: 8, marginBottom: 8 },
    cardContainerMobile: { borderRadius: 6, overflow: 'hidden', backgroundColor: '#1E1428', position: 'relative', cursor: 'pointer' },
    smallIconBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)', cursor: 'pointer' },

    // --- SHARED STYLES ---
    cardImage: { width: '100%', height: '100%', position: 'absolute' },
    cardBottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%' },
    translucentRatingBadge: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.65)', paddingHorizontal: 5, paddingVertical: 3, borderRadius: 4, zIndex: 10 },
    ratingText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold', marginLeft: 3, marginTop: 1 },
    cardActions: { position: 'absolute', right: 6, gap: 6, zIndex: 10 },
    topBadgeContainer: { position: 'absolute', top: 0, right: 0, backgroundColor: '#E6398A', paddingHorizontal: 4, paddingVertical: 4, borderBottomLeftRadius: 6, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
    topBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', textAlign: 'center', lineHeight: 11 },
    bottomBadgeContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 4, alignItems: 'center', justifyContent: 'center' },
    bottomBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
    bottomTextContainer: { position: 'absolute', bottom: 8, left: 4, right: 4, alignItems: 'center' },
    bottomText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold', textAlign: 'center' },
});