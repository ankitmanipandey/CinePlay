import { useState, useEffect, useMemo } from 'react';
import { Keyboard } from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useTvStore } from '../store/useTvStore';

export const useLiveTvFeedLogic = ({ selectedCategory, selectedLanguage }) => {
    const { allChannels, activeFeeds, isLoadingTv, fetchTvData, filterByCategory } = useTvStore();
    const [tvSearchQuery, setTvSearchQuery] = useState('');
    const [isTvListening, setIsTvListening] = useState(false);

    useSpeechRecognitionEvent('start', () => setIsTvListening(true));
    useSpeechRecognitionEvent('end', () => setIsTvListening(false));
    useSpeechRecognitionEvent('result', (e) => {
        if (e.results?.[0]?.transcript) {
            setTvSearchQuery(e.results[0].transcript);
            Keyboard.dismiss();
        }
        if (e.isFinal) ExpoSpeechRecognitionModule.stop();
    });
    useSpeechRecognitionEvent('error', () => setIsTvListening(false));

    const toggleTvListening = async () => {
        if (isTvListening) return ExpoSpeechRecognitionModule.stop();
        const p = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (p.granted) {
            setTvSearchQuery('');
            ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
        }
    };

    useEffect(() => {
        if (allChannels.length === 0) fetchTvData();
    }, []);

    useEffect(() => {
        filterByCategory(selectedCategory, selectedLanguage);
        if (tvSearchQuery) setTvSearchQuery('');
    }, [selectedCategory, selectedLanguage, allChannels]);

    const displayedChannels = useMemo(() => {
        if (!tvSearchQuery.trim()) return activeFeeds;
        return activeFeeds.filter(channel => channel.title.toLowerCase().includes(tvSearchQuery.toLowerCase()));
    }, [activeFeeds, tvSearchQuery]);

    return {
        isLoadingTv,
        allChannels,
        tvSearchQuery,
        setTvSearchQuery,
        isTvListening,
        toggleTvListening,
        displayedChannels
    };
};