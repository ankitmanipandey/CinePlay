import { useEffect, useMemo } from 'react';
import { useSportsStore } from '../store/useSportsStore';

export const useLiveSportsFeedLogic = ({ selectedSport }) => {
    const { liveMatches, isLoadingSports, fetchLiveScores } = useSportsStore();

    useEffect(() => {
        fetchLiveScores();
        const intervalId = setInterval(() => fetchLiveScores(), 15000); // Poll every 15s
        return () => clearInterval(intervalId);
    }, []);

    const displayedMatches = useMemo(() => {
        if (!selectedSport || selectedSport === 'all') return liveMatches;
        return liveMatches.filter(match => match.sport === selectedSport);
    }, [liveMatches, selectedSport]);

    return {
        liveMatches,
        isLoadingSports,
        displayedMatches
    };
};