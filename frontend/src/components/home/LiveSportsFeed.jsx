import React from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReAnimated, { FadeIn, FadeOut, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useLiveSportsFeedLogic } from '../../hooks/useLiveSportsFeedLogic';

export const LiveSportsFeed = ({ selectedSport }) => {
    const { width: windowWidth } = useWindowDimensions();
    const isDesktop = windowWidth >= 1024;

    const { liveMatches, isLoadingSports, displayedMatches } = useLiveSportsFeedLogic({ selectedSport });

    // --------------------------------------------------------
    // DESKTOP LAYOUT (Premium Grid, Larger Typography)
    // --------------------------------------------------------
    if (isDesktop) {
        if (isLoadingSports && liveMatches.length === 0) {
            return (
                <ReAnimated.View entering={FadeIn} exiting={FadeOut} style={[styles.desktopContainer, { alignItems: 'center', paddingTop: 60 }]}>
                    <ActivityIndicator size="large" color="#00E5FF" />
                </ReAnimated.View>
            );
        }

        if (displayedMatches.length === 0) {
            return (
                <ReAnimated.View entering={FadeIn} exiting={FadeOut} layout={LinearTransition} style={styles.desktopContainer}>
                    <Text style={styles.desktopRowTitle}>Live Matches & Scores</Text>
                    <View style={styles.desktopEmptyState}>
                        <Ionicons name="trophy-outline" size={64} color="#8F98A0" style={{ marginBottom: 16, opacity: 0.5 }} />
                        <Text style={styles.desktopEmptyText}>
                            {selectedSport === 'all' ? "No matches currently scheduled." : `No live ${selectedSport} matches right now.`}
                        </Text>
                    </View>
                </ReAnimated.View>
            );
        }

        return (
            <ReAnimated.View layout={LinearTransition} style={styles.desktopContainer}>
                <Text style={styles.desktopRowTitle}>Live Matches & Scores</Text>
                <View style={styles.desktopGrid}>
                    {displayedMatches.map((match, index) => (
                        <ReAnimated.View
                            key={match.id}
                            entering={FadeInDown.delay(index * 40).duration(300)}
                            exiting={FadeOut.duration(200)}
                            layout={LinearTransition.springify().damping(14)}
                            style={styles.desktopCardWrapper}
                        >
                            <TouchableOpacity style={styles.desktopSportsCard} activeOpacity={0.85}>
                                <View style={styles.desktopSportsCardHeader}>
                                    <Text style={styles.desktopSportsSportText}>{match.sport}</Text>
                                    <View style={[styles.desktopLiveBadge, !match.isLive && { backgroundColor: '#808085' }]}>
                                        <Text style={styles.desktopLiveBadgeText}>{match.status}</Text>
                                    </View>
                                </View>
                                <Text style={styles.desktopSportsTitle}>{match.title}</Text>
                                <View style={styles.desktopSportsMatchInfo}>
                                    <View style={styles.desktopSportsTeamWrap}>
                                        <Image source={{ uri: match.team1Logo }} style={styles.desktopSportsFlag} />
                                        <Text style={styles.desktopSportsScoreText}>{match.team1Score}</Text>
                                    </View>
                                    <Text style={styles.desktopSportsVs}>vs</Text>
                                    <View style={styles.desktopSportsTeamWrapRight}>
                                        <Text style={styles.desktopSportsScoreText}>{match.team2Score}</Text>
                                        <Image source={{ uri: match.team2Logo }} style={styles.desktopSportsFlag} />
                                    </View>
                                </View>
                                <View style={styles.desktopSportsCommentaryBox}>
                                    <Ionicons name="mic" size={16} color="#00E5FF" />
                                    <Text style={styles.desktopSportsCommentaryText} numberOfLines={2}>{match.commentary}</Text>
                                </View>
                            </TouchableOpacity>
                        </ReAnimated.View>
                    ))}
                </View>
            </ReAnimated.View>
        );
    }

    // --------------------------------------------------------
    // MOBILE & TABLET LAYOUT (Exact Native Clone)
    // --------------------------------------------------------
    if (isLoadingSports && liveMatches.length === 0) return <ReAnimated.View entering={FadeIn} exiting={FadeOut} style={[styles.sportsContainer, { alignItems: 'center', paddingTop: 40 }]}><ActivityIndicator size="large" color="#00E5FF" /></ReAnimated.View>;

    if (displayedMatches.length === 0) return (
        <ReAnimated.View entering={FadeIn} exiting={FadeOut} layout={LinearTransition} style={styles.sportsContainer}>
            <Text style={styles.rowTitle}>Live Matches & Scores</Text>
            <Text style={{ color: '#8F98A0', textAlign: 'center', marginTop: 20 }}>{selectedSport === 'all' ? "No matches currently scheduled." : `No live ${selectedSport} matches right now.`}</Text>
        </ReAnimated.View>
    );

    return (
        <ReAnimated.View layout={LinearTransition} style={styles.sportsContainer}>
            <Text style={styles.rowTitle}>Live Matches & Scores</Text>
            {displayedMatches.map((match, index) => (
                <ReAnimated.View key={match.id} entering={FadeInDown.delay(index * 40).duration(300)} exiting={FadeOut.duration(200)} layout={LinearTransition.springify().damping(14)}>
                    <TouchableOpacity style={styles.sportsCard} activeOpacity={0.85}>
                        <View style={styles.sportsCardHeader}>
                            <Text style={styles.sportsSportText}>{match.sport}</Text>
                            <View style={[styles.liveBadge, !match.isLive && { backgroundColor: '#808085' }]}>
                                <Text style={styles.liveBadgeText}>{match.status}</Text>
                            </View>
                        </View>
                        <Text style={styles.sportsTitle}>{match.title}</Text>
                        <View style={styles.sportsMatchInfo}>
                            <View style={styles.sportsTeamWrap}>
                                <Image source={{ uri: match.team1Logo }} style={styles.sportsFlag} />
                                <Text style={styles.sportsScoreText}>{match.team1Score}</Text>
                            </View>
                            <Text style={styles.sportsVs}>vs</Text>
                            <View style={styles.sportsTeamWrapRight}>
                                <Text style={styles.sportsScoreText}>{match.team2Score}</Text>
                                <Image source={{ uri: match.team2Logo }} style={styles.sportsFlag} />
                            </View>
                        </View>
                        <View style={styles.sportsCommentaryBox}>
                            <Ionicons name="mic" size={14} color="#00E5FF" />
                            <Text style={styles.sportsCommentaryText} numberOfLines={2}>{match.commentary}</Text>
                        </View>
                    </TouchableOpacity>
                </ReAnimated.View>
            ))}
        </ReAnimated.View>
    );
};

const styles = StyleSheet.create({
    // --- DESKTOP STYLES (>= 1024px) ---
    desktopContainer: { paddingHorizontal: 0, paddingBottom: 40 },
    desktopRowTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold', letterSpacing: 0.5, marginBottom: 24 },
    desktopEmptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 20 },
    desktopEmptyText: { color: '#8F98A0', fontSize: 18, textAlign: 'center' },

    desktopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
    desktopCardWrapper: { width: '31%', minWidth: 340 },
    desktopSportsCard: {
        backgroundColor: '#1E1428',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        cursor: 'pointer'
    },
    desktopSportsCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    desktopSportsSportText: { color: '#8F98A0', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5 },
    desktopLiveBadge: { backgroundColor: '#FF007A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    desktopLiveBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
    desktopSportsTitle: { color: '#E0E0E0', fontSize: 16, marginBottom: 20, fontWeight: '600', lineHeight: 22 },
    desktopSportsMatchInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    desktopSportsTeamWrap: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 },
    desktopSportsTeamWrapRight: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1, justifyContent: 'flex-end' },
    desktopSportsFlag: { width: 48, height: 32, borderRadius: 6, backgroundColor: '#2A2A30' },
    desktopSportsScoreText: { color: '#FFF', fontSize: 24, fontWeight: '900' },
    desktopSportsVs: { color: '#8F98A0', fontSize: 16, fontWeight: 'bold', paddingHorizontal: 12 },
    desktopSportsCommentaryBox: { flexDirection: 'row', backgroundColor: 'rgba(0, 229, 255, 0.08)', padding: 16, borderRadius: 12, alignItems: 'center', gap: 10 },
    desktopSportsCommentaryText: { color: '#00E5FF', fontSize: 14, flex: 1, fontStyle: 'italic', lineHeight: 20 },

    // --- MOBILE & TABLET STYLES (< 1024px) ---
    sportsContainer: { paddingHorizontal: 16, paddingBottom: 20 },
    rowTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', paddingHorizontal: 0, marginBottom: 14, letterSpacing: 0.2 },
    sportsCard: { backgroundColor: '#1E1428', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    sportsCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sportsSportText: { color: '#8F98A0', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
    liveBadge: { backgroundColor: '#FF007A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
    liveBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
    sportsMatchInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sportsTeamWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    sportsTeamWrapRight: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'flex-end' },
    sportsFlag: { width: 36, height: 26, borderRadius: 4, backgroundColor: '#2A2A30' },
    sportsScoreText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    sportsVs: { color: '#8F98A0', fontSize: 14, fontWeight: 'bold', paddingHorizontal: 10 },
    sportsTitle: { color: '#E0E0E0', fontSize: 14, marginBottom: 16, fontWeight: '600' },
    sportsCommentaryBox: { flexDirection: 'row', backgroundColor: 'rgba(0, 229, 255, 0.08)', padding: 12, borderRadius: 8, alignItems: 'center', gap: 8 },
    sportsCommentaryText: { color: '#00E5FF', fontSize: 13, flex: 1, fontStyle: 'italic' },
});