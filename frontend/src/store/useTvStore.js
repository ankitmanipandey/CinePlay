import { create } from 'zustand';
import { Platform } from 'react-native';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

const CHANNELS_API = 'https://iptv-org.github.io/api/channels.json';
const STREAMS_API = 'https://iptv-org.github.io/api/streams.json';
const LOGOS_API = 'https://iptv-org.github.io/api/logos.json';

const SUPPORTED_CATEGORIES = ['news', 'sport', 'sports', 'music', 'movies', 'entertainment'];
const TARGET_COUNTRIES = ['IN'];
const MAX_PER_CATEGORY = 40;

const fetchWithTimeout = async (url, ms = 10000) => {
    const targetUrl = Platform.OS === 'web'
        ? `${BACKEND_URL}/proxy/fetch?url=${encodeURIComponent(url)}`
        : url;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);

    try {
        const res = await fetch(targetUrl, { signal: controller.signal });
        if (!res.ok) {
            const bodyText = await res.text().catch(() => '');
            throw new Error(`Request to ${targetUrl} failed: ${res.status} ${res.statusText} — ${bodyText.slice(0, 200)}`);
        }
        return res;
    } finally {
        clearTimeout(timeout);
    }
};

export const useTvStore = create((set, get) => ({
    allChannels: [],
    activeFeeds: [],
    isLoadingTv: false,
    tvError: null,

    fetchTvData: async () => {
        try {
            set({ isLoadingTv: true, tvError: null });

            // Fetch Channels, Streams, and Logos concurrently
            const [channelsRes, streamsRes, logosRes] = await Promise.all([
                fetchWithTimeout(CHANNELS_API),
                fetchWithTimeout(STREAMS_API),
                fetchWithTimeout(LOGOS_API)
            ]);

            const channels = await channelsRes.json();
            const streams = await streamsRes.json();
            const logos = await logosRes.json();

            // Create O(1) Maps to link streams and logos to the correct channel ID instantly
            const streamMap = new Map();
            streams.forEach(s => {
                if (s.channel && s.url && !streamMap.has(s.channel)) {
                    streamMap.set(s.channel, s.url);
                }
            });

            const logoMap = new Map();
            logos.forEach(l => {
                if (l.channel && l.url && !logoMap.has(l.channel)) {
                    logoMap.set(l.channel, l.url);
                }
            });

            // Filter by targeted country and categories
            const relevantChannels = channels.filter(c =>
                TARGET_COUNTRIES.includes(c.country) &&
                Array.isArray(c.categories) &&
                c.categories.some(cat => SUPPORTED_CATEGORIES.includes(cat.toLowerCase()))
            );

            const perCategoryCounts = {};
            const liveFeeds = [];

            for (const channel of relevantChannels) {
                const streamUrl = streamMap.get(channel.id);
                if (!streamUrl) continue;

                let mainCategory = channel.categories.find(cat =>
                    SUPPORTED_CATEGORIES.includes(cat.toLowerCase())
                ) || 'entertainment';

                let key = mainCategory.toLowerCase();
                if (key === 'sport') key = 'sports'; // Normalize slug

                perCategoryCounts[key] = (perCategoryCounts[key] || 0) + 1;
                if (perCategoryCounts[key] > MAX_PER_CATEGORY) continue;

                // Lookup the official logo, fallback to a dummy TV image if not found
                const officialLogo = logoMap.get(channel.id) || channel.logo || 'https://dummyimage.com/150x150/1C1C22/00E5FF&text=TV';

                liveFeeds.push({
                    id: channel.id,
                    title: channel.name,
                    category: key,
                    url: streamUrl,
                    logo: officialLogo,
                    country: channel.country || 'Global',
                    languages: channel.languages || []
                });
            }

            set({
                allChannels: liveFeeds,
                activeFeeds: liveFeeds,
                isLoadingTv: false
            });

        } catch (error) {
            console.error("Failed to fetch IPTV data:", error);
            set({ isLoadingTv: false, tvError: 'Could not load live channels.', allChannels: [], activeFeeds: [] });
        }
    },

    filterByCategory: (category, language) => {
        const { allChannels } = get();

        let filtered = allChannels;

        // 1. Apply Category Filter
        if (category && category !== 'all') {
            const targetCat = category.toLowerCase() === 'sport' ? 'sports' : category.toLowerCase();
            filtered = filtered.filter(c => c.category === targetCat);
        }

        // 2. Apply Language Filter
        if (language && language !== 'any' && language !== 'others') {
            const langMap = { 'hi': 'hin', 'en': 'eng', 'ta': 'tam', 'te': 'tel', 'pa': 'pan', 'ml': 'mal' };
            const langCode3 = langMap[language] || language;

            filtered = filtered.filter(c => {
                if (c.languages && c.languages.length > 0) {
                    return c.languages.includes(langCode3);
                }
                return true;
            });
        }

        set({ activeFeeds: filtered });
    }
}));