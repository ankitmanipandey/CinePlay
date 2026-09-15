// src/hooks/useMediaDetails.js
import { useState, useEffect } from 'react';
import { tmdbService } from '../services/tmdbService';
import { fetchYouTubeWithRetry } from '../utils/youtubeHelpers';

export const useMediaDetails = ({ id, type, ytId, streamUrl, channelName, artworkUrl, livePlayer }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [mediaDetails, setMediaDetails] = useState(null);
    const [trailerKey, setTrailerKey] = useState(null);
    const [isVidkingAvailable, setIsVidkingAvailable] = useState(null);

    useEffect(() => {
        const fetchAllData = async () => {
            setIsLoading(true);
            try {
                if (type === 'music') {
                    // Handled entirely by TrackPlayer now, just clear loading
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
                    const [details, videos] = await Promise.all([
                        tmdbService.getDetails(id, type), tmdbService.getVideos(id, type)
                    ]);
                    const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos.find(v => v.site === 'YouTube');
                    setTrailerKey(trailer ? trailer.key : null);

                    setMediaDetails(details);
                    setIsVidkingAvailable(true);
                }
            } catch (error) {
            } finally {
                setIsLoading(false);
            }
        };

        if (livePlayer) fetchAllData();
    }, [id, type, ytId, streamUrl, livePlayer]);

    return { isLoading, mediaDetails, trailerKey, isVidkingAvailable };
};