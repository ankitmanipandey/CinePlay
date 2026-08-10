import React, { useCallback, useRef } from 'react';
import { Animated, Dimensions, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import HomeScreen from '../../screens/HomeScreen';
import { tabTracker } from '../../utils/tabState';

const { width } = Dimensions.get('window');

export default function HomeRoute() {
    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useFocusEffect(
        useCallback(() => {
            // If we came from Search (left), slide from Right (width).
            // If we came from Profile (right), slide from Left (-width).
            const startPosition = tabTracker.previous === 'search' ? width : -width;

            slideAnim.setValue(startPosition);
            fadeAnim.setValue(0);

            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    speed: 16,
                    bounciness: 4,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();

            tabTracker.previous = 'home';
        }, [slideAnim, fadeAnim])
    );

    return (
        <Animated.View
            style={[
                styles.container,
                { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
            ]}
        >
            <HomeScreen />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0A0C',
    },
});