import React from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Dimensions,
    ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
// Import SafeAreaView from safe-area-context for proper notch handling
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import Toast from 'react-native-toast-message';

// --- Global Store ---
import { useAuthStore } from '../store/useAuthStore';

const { width } = Dimensions.get('window');
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

// Helper component for the settings menu rows (Kept in case you add real settings later)
const MenuRow = ({ icon, title, isDestructive = false, onPress }) => (
    <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={onPress}>
        <View style={styles.menuRowLeft}>
            <View style={[styles.iconBox, isDestructive && { backgroundColor: 'rgba(229, 57, 53, 0.1)' }]}>
                <Ionicons name={icon} size={20} color={isDestructive ? "#E53935" : "#8F98A0"} />
            </View>
            <Text style={[styles.menuRowTitle, isDestructive && { color: '#E53935' }]}>{title}</Text>
        </View>
        {!isDestructive && <Ionicons name="chevron-forward" size={20} color="#3A3A40" />}
    </TouchableOpacity>
);

const ProfileScreen = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // Pull the user data and token directly from global memory
    const { user, token, logout } = useAuthStore();
    const isLoggedIn = !!token;

    // Get the first letter of their name (or email) for the avatar
    const displayInitial = user?.name
        ? user.name.charAt(0).toUpperCase()
        : (user?.email ? user.email.charAt(0).toUpperCase() : '?');

    const handleLogout = async () => {
        try {
            // Tell the backend to invalidate the session
            await axios.post(`${BACKEND_URL}/auth/logout`);
        } catch (error) {
            console.error('Error logging out from server:', error);
        } finally {
            // Instantly clear Zustand memory & SecureStore (The UI will update immediately)
            await logout();

            Toast.show({
                type: 'hotstarSuccess',
                text1: 'Logged out successfully',
                position: 'top',
                topOffset: insets.top > 0 ? insets.top + 10 : 50,
                visibilityTime: 2500,
            });
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(31, 128, 224, 0.15)', 'transparent']}
                style={styles.backgroundGlow}
            />

            <SafeAreaView style={styles.safeArea} edges={['top']}>
                {isLoggedIn ? (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                        <View style={styles.profileHeader}>
                            <View style={styles.avatarContainer}>
                                <Text style={styles.avatarText}>{displayInitial}</Text>
                            </View>
                            <Text style={styles.userName}>{user?.name || 'User'}</Text>
                            <Text style={styles.userEmail}>{user?.email}</Text>
                        </View>

                        {/* Only keeping the working Log Out button */}
                        <View style={[styles.menuSection, { marginBottom: 40 }]}>
                            <View style={styles.menuCard}>
                                <MenuRow
                                    icon="log-out-outline"
                                    title="Log Out"
                                    isDestructive={true}
                                    onPress={handleLogout}
                                />
                            </View>
                        </View>

                    </ScrollView>
                ) : (
                    <View style={styles.loggedOutContainer}>
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

                        <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/login')}>
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

    // --- LOGGED IN UI ---
    scrollContent: { paddingBottom: 40 },
    profileHeader: {
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 20,
    },
    avatarContainer: {
        width: 86,
        height: 86,
        borderRadius: 43,
        backgroundColor: '#1F80E0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#1F80E0',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 8,
    },
    avatarText: { color: '#FFFFFF', fontSize: 36, fontWeight: 'bold' },
    userName: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', marginBottom: 4, letterSpacing: 0.3 },
    userEmail: { color: '#8F98A0', fontSize: 14, fontWeight: '500' },

    menuSection: { paddingHorizontal: 20, marginTop: 24 },
    menuCard: {
        backgroundColor: '#17171C',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    menuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    menuRowLeft: { flexDirection: 'row', alignItems: 'center' },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    menuRowTitle: { color: '#E0E0E0', fontSize: 15, fontWeight: '500' },

    // --- LOGGED OUT UI ---
    loggedOutContainer: {
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
    },
    loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});