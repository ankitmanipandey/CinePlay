import React, { useState, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    SafeAreaView,
    Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router'; // <-- Added useFocusEffect
import { useSafeAreaInsets } from 'react-native-safe-area-context'; 
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

const ProfileScreen = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // Mock user data for the logged-in state (Replace this when you have user fetch API)
    const userData = {
        name: 'Ankit Mani Pandey',
        email: 'ankit.pandey@example.com'
    };

    // This hook runs every time the Profile tab is opened
    useFocusEffect(
        useCallback(() => {
            const checkLoginStatus = async () => {
                const token = await SecureStore.getItemAsync('userToken');
                setIsLoggedIn(!!token); 
            };
            checkLoginStatus();
        }, [])
    );

    const handleLogout = async () => {
        try {
            await axios.post(`${process.env.EXPO_PUBLIC_API_URL}/logout`);
            await SecureStore.deleteItemAsync('userToken');
            
            setIsLoggedIn(false);

            Toast.show({
                type: 'hotstarSuccess', 
                text1: 'Logged out successfully',
                position: 'top',
                topOffset: insets.top > 0 ? insets.top + 10 : 50,
                visibilityTime: 3000,
            });
        } catch (error) {
            console.error('Error logging out:', error);
            await SecureStore.deleteItemAsync('userToken');
            setIsLoggedIn(false);
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(31, 128, 224, 0.1)', 'transparent']}
                style={styles.backgroundGlow}
            />

            <SafeAreaView style={styles.safeArea}>
                {isLoggedIn ? (
                    <View style={styles.contentContainer}>
                        <View style={styles.profileCard}>
                            <View style={styles.avatarContainer}>
                                <Text style={styles.avatarText}>
                                    {userData.name.charAt(0)}
                                </Text>
                            </View>
                            <Text style={styles.userName}>{userData.name}</Text>
                            <Text style={styles.userEmail}>{userData.email}</Text>
                        </View>

                        <TouchableOpacity
                            style={styles.outlineButton}
                            onPress={handleLogout}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.outlineButtonText}>Log Out</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.contentContainer}>
                        <View style={styles.illustrationContainer}>
                            <Ionicons name="tv" size={110} color="#1E1E24" />
                            <View style={styles.floatingDeviceLeft}>
                                <Ionicons name="phone-landscape" size={45} color="#2A2A30" />
                            </View>
                            <View style={styles.floatingDeviceRight}>
                                <Ionicons name="phone-portrait" size={35} color="#2A2A30" />
                            </View>
                            <View style={styles.orbitLine} />
                            <Ionicons name="star" size={10} color="#1F80E0" style={[styles.starIcon, { top: 10, left: 30 }]} />
                            <Ionicons name="star" size={12} color="#D63484" style={[styles.starIcon, { bottom: 20, right: 20 }]} />
                        </View>

                        <Text style={styles.title}>Login to CinePlay</Text>
                        <Text style={styles.subtitle}>
                            Start watching from where you left off, personalise for kids and more
                        </Text>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => router.push('/login')}
                        >
                            <LinearGradient
                                colors={['#1F80E0', '#D63484']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.loginButton}
                            >
                                <Text style={styles.loginButtonText}>Log In</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}
            </SafeAreaView>
        </View>
    );
};

export default ProfileScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0A0C' },
    backgroundGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
    safeArea: { flex: 1 },
    contentContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    illustrationContainer: {
        width: 220,
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
        position: 'relative',
    },
    floatingDeviceLeft: { position: 'absolute', left: 10, top: 30, transform: [{ rotate: '-15deg' }] },
    floatingDeviceRight: { position: 'absolute', right: 15, bottom: 25, transform: [{ rotate: '15deg' }] },
    orbitLine: {
        position: 'absolute',
        width: '110%',
        height: 40,
        borderWidth: 1,
        borderColor: 'rgba(31, 128, 224, 0.3)',
        borderRadius: 50,
        top: '50%',
        transform: [{ translateY: -10 }],
        zIndex: -1,
    },
    starIcon: { position: 'absolute', opacity: 0.8 },
    title: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', marginBottom: 12, letterSpacing: 0.3 },
    subtitle: {
        color: '#8F98A0',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 32,
        paddingHorizontal: 10,
    },
    loginButton: {
        width: width * 0.85,
        height: 52,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    profileCard: {
        alignItems: 'center',
        width: '100%',
        backgroundColor: '#17171C',
        paddingVertical: 40,
        borderRadius: 16,
        marginBottom: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#1F80E0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#1F80E0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    avatarText: { color: '#FFFFFF', fontSize: 32, fontWeight: 'bold' },
    userName: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', marginBottom: 6 },
    userEmail: { color: '#8F98A0', fontSize: 14 },
    outlineButton: {
        width: width * 0.85,
        height: 52,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#8F98A0',
    },
    outlineButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});