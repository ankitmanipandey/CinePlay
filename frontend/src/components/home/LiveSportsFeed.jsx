// src/components/home/LiveSportsFeed.jsx
import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReAnimated, { FadeIn, FadeOut, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSportsStore } from '../../store/useSportsStore';

export const LiveSportsFeed = ({ selectedSport }) => {
    const { liveMatches, isLoadingSports, fetchLiveScores } = useSportsStore();

    useEffect(() => {
        fetchLiveScores();
        const intervalId = setInterval(() => fetchLiveScores(), 15000);
        return () => clearInterval(intervalId);
    }, []);

    const displayedMatches = useMemo(() => {
        if (!selectedSport || selectedSport === 'all') return liveMatches;
        return liveMatches.filter(match => match.sport === selectedSport);
    }, [liveMatches, selectedSport]);

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