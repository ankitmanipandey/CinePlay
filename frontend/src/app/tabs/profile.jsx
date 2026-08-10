import React, { useCallback, useRef } from 'react';
import { StyleSheet, Animated, Dimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import ProfileScreen from '../../screens/ProfileScreen';
import { tabTracker } from '../../utils/tabState';

const { width } = Dimensions.get('window');

export default function ProfileRoute() {
    const slideAnim = useRef(new Animated.Value(width)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useFocusEffect(
        useCallback(() => {
            slideAnim.setValue(width);
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

            tabTracker.previous = 'profile';
        }, [slideAnim, fadeAnim])
    );

    return (
        <Animated.View
            style={[
                styles.container,
                { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
            ]}
        >
            <ProfileScreen />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0A0C',
    },
});