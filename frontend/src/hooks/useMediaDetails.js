// src/hooks/useMediaDetails.js
import { useState, useEffect } from 'react';
import { tmdbService } from '../services/tmdbService';
import { safeFetchJson, mapSaavnSong } from '../services/jioSaavnApi';
import { fetchYouTubeWithRetry } from '../utils/youtubeHelpers';
import { normalizeString } from '../utils/homehelpers';

export const useMediaDetails = ({ id, type, ytId, streamUrl, channelName, artworkUrl, livePlayer, setMusicQueue, setIsPlaying }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [mediaDetails, setMediaDetails] = useState(null);
    const [trailerKey, setTrailerKey] = useState(null);
    const [isVidkingAvailable, setIsVidkingAvailable] = useState(null);

    useEffect(() => {
        const fetchAllData = async () => {
            setIsLoading(true);
            try {
                if (type === 'music') {
                    setMediaDetails({ title: channelName || "Music Player", vote_average: 0 });
                    const initialTrack = { id: ytId || 'init', title: channelName || 'Unknown Song', artist: 'Playing Now', url: streamUrl, image: artworkUrl || 'https://images.unsplash.com/photo-1614680376573-3e4e1ef41090?w=500&q=80' };
                    setMusicQueue([initialTrack]);

                    try {
                        const searchQ = encodeURIComponent(channelName || 'Arijit Singh');
                        const json = await safeFetchJson(`/search/songs?query=${searchQ}`);
                        if (json?.success && json.data?.results) {
                            const fetchedTracks = json.data.results.map(mapSaavnSong).filter(t => t.url);
                            setMusicQueue(prev => {
                                const existingNames = new Set(prev.map(t => normalizeString(t.title)));
                                const filteredTracks = fetchedTracks.filter(s => {
                                    const normName = normalizeString(s.title);
                                    if (existingNames.has(normName)) return false;
                                    existingNames.add(normName);
                                    return true;
                                });
                                return [...prev, ...filteredTracks];
                            });
                        }
                    } catch (e) { }
                    setIsLoading(false);
                    return;
                }

                if (streamUrl) {
                    setMediaDetails({ title: channelName || "Live TV Broadcast", overview: "Streaming live broadcast...", vote_average: 0 });
                    try {
                        await livePlayer.replaceAsync({ uri: streamUrl, metadata: { title: channelName, artist: 'Live TV', artwork: artworkUrl } });
                        livePlayer.play();
                        setIsPlaying(true);
                    } catch (err) { }
                    setIsLoading(false);
                    return;
                }

                let videoTitle = "";
                if (ytId) {
                    setTrailerKey(ytId);
                    setIsPlaying(true);
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
                    if (trailer) setIsPlaying(true);

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