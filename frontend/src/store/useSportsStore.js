import { create } from 'zustand';
import { Platform } from 'react-native';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

// ESPN's Public CDN Endpoints (No API Key Required!)
const ENDPOINTS = [
    { sport: 'Cricket', url: 'https://site.api.espn.com/apis/site/v2/sports/cricket/scoreboard' },
    { sport: 'Football', url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard' }, // EPL
    { sport: 'Basketball', url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard' }
];

export const useSportsStore = create((set) => ({
    liveMatches: [],
    isLoadingSports: true,

    fetchLiveScores: async () => {
        try {
            // Fetch all sports simultaneously
            const responses = await Promise.all(
                ENDPOINTS.map(endpoint => {
                    const targetUrl = Platform.OS === 'web'
                        ? `${BACKEND_URL}/proxy/fetch?url=${encodeURIComponent(endpoint.url)}`
                        : endpoint.url;

                    return fetch(targetUrl)
                        .then(res => res.json())
                        .then(data => ({ sport: endpoint.sport, data }))
                        .catch(error => {
                            console.warn(`Failed to fetch ${endpoint.sport}:`, error);
                            return null;
                        });
                })
            );

            // Filter out any failed CORS/network requests
            const validResponses = responses.filter(res => res !== null);

            let allMappedMatches = [];

            validResponses.forEach(({ sport, data }) => {
                if (!data.events) return;

                const mapped = data.events.map((match) => {
                    const comp = match.competitions[0];
                    const team1 = comp.competitors[0];
                    const team2 = comp.competitors[1];

                    // ESPN uses 'pre', 'in', and 'post' for match states
                    const state = match.status.type.state;
                    let displayStatus = 'UPCOMING';
                    let isLive = false;

                    if (state === 'in') {
                        displayStatus = 'LIVE';
                        isLive = true;
                    } else if (state === 'post') {
                        displayStatus = 'FT'; // Full Time
                    }

                    return {
                        id: match.id,
                        sport: sport,
                        title: match.name,
                        status: displayStatus,
                        // Provide fallback dummy images just in case ESPN omits a logo
                        team1Logo: team1.team?.logo || 'https://dummyimage.com/80x50/333/fff&text=T1',
                        team1Score: team1.score || '-',
                        team2Logo: team2.team?.logo || 'https://dummyimage.com/80x50/333/fff&text=T2',
                        team2Score: team2.score || '-',
                        // ESPN provides current game context (e.g., "Bottom 4th", "Half Time", or "Day 3, Session 2")
                        commentary: match.status.type.detail || 'Match starting soon',
                        isLive: isLive
                    };
                });

                allMappedMatches = [...allMappedMatches, ...mapped];
            });

            // Sort so LIVE matches appear at the top of your feed
            allMappedMatches.sort((a, b) => (a.isLive === b.isLive ? 0 : a.isLive ? -1 : 1));

            set({ liveMatches: allMappedMatches, isLoadingSports: false });

        } catch (error) {
            console.error("Failed to fetch ESPN sports:", error);
            set({ isLoadingSports: false });
        }
    }
}));