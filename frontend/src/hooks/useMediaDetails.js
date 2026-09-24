// src/hooks/useMediaDetails.js
import { useState, useEffect } from 'react';
import { tmdbService } from '../services/tmdbService';
import { fetchYouTubeWithRetry } from '../utils/youtubeHelpers';

export const useMediaDetails = ({ id, type, ytId, streamUrl, channelName, artworkUrl, livePlayer }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [mediaDetails, setMediaDetails] = useState(null);
    const [trailerKey, setTrailerKey] = useState(null);
    const [isVidkingAvailable, setIsVidkingAvailable] = useState(null);
    const [anilistId, setAnilistId] = useState(null); // NEW: Track mapped AniList ID

    useEffect(() => {
        const fetchAllData = async () => {
            setIsLoading(true);
            try {
                if (type === 'music') {
                    setIsLoading(false);
                    return;
                }

                if (streamUrl) {
                    setMediaDetails({ title: channelName || "Live TV Broadcast", overview: "Streaming live broadcast...", vote_average: 0 });
                    try {
                        await livePlayer.replaceAsync({ uri: streamUrl, metadata: { title: channelName, artist: 'Live TV', artwork: artworkUrl } });
                        livePlayer.play();
                    } catch (err) { }
                    setIsLoading(false);
                    return;
                }

                let videoTitle = "";
                if (ytId) {
                    setTrailerKey(ytId);
                    try {
                        const urlTemplate = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ytId}&key=__API_KEY__`;
                        const videoData = await fetchYouTubeWithRetry(urlTemplate);
                        if (!videoData.error) {
                            const snippet = videoData.items?.[0]?.snippet;
                            if (snippet) {
                                videoTitle = snippet.title;
                                setMediaDetails({ title: snippet.title, overview: "", vote_average: 0, spoken_languages: [{ english_name: snippet.channelTitle }], ytThumbnail: snippet.thumbnails?.high?.url });
                            }
                        }
                    } catch (e) { }
                    if (!videoTitle) setMediaDetails({ title: "YouTube Video", overview: "", vote_average: 0 });
                }

                if (id && type !== 'music') {
                    // NEW: Non-blocking fetch for the AniList mapping
                    const fetchAnilist = fetch(`https://api.ani.zip/mappings?tmdb_id=${id}`)
                        .then(res => res.ok ? res.json() : null)
                        .then(data => data?.mappings?.anilist_id || null)
                        .catch(() => null);

                    const [details, videos, mappedAnilistId] = await Promise.all([
                        tmdbService.getDetails(id, type),
                        tmdbService.getVideos(id, type),
                        fetchAnilist
                    ]);

                    const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos.find(v => v.site === 'YouTube');
                    setTrailerKey(trailer ? trailer.key : null);

                    setMediaDetails(details);
                    setAnilistId(mappedAnilistId); // NEW: Save mapping
                    setIsVidkingAvailable(true);
                }
            } catch (error) {
            } finally {
                setIsLoading(false);
            }
        };

        if (livePlayer) fetchAllData();
    }, [id, type, ytId, streamUrl, livePlayer]);

    return { isLoading, mediaDetails, trailerKey, isVidkingAvailable, anilistId }; // NEW: Export the ID
};