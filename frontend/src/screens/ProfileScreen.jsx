import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, ScrollView, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import Toast from 'react-native-toast-message';

import { useAuthStore } from '../store/useAuthStore';
import { useGlobalSocket } from '../store/useGlobalSocket';

const { width } = Dimensions.get('window');
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

const MenuRow = ({ icon, title, subtitle, isDestructive = false, isLoading = false, badgeCount = 0, onPress }) => (
    <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={onPress} disabled={isLoading}>
        <View style={styles.menuRowLeft}>
            <View style={[styles.iconBox, isDestructive && { backgroundColor: 'rgba(229, 57, 53, 0.1)' }]}>
                {isLoading ? (
                    <ActivityIndicator size="small" color="#E53935" />
                ) : (
                    <Ionicons name={icon} size={20} color={isDestructive ? "#E53935" : "#8F98A0"} />
                )}
            </View>
            <View>
                <Text style={[styles.menuRowTitle, isDestructive && { color: '#E53935' }]}>
                    {isLoading ? 'Logging out...' : title}
                </Text>
                {subtitle && <Text style={styles.menuRowSubtitle}>{subtitle}</Text>}
            </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {badgeCount > 0 && (
                <View style={{ backgroundColor: '#00E5FF', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, marginRight: 8 }}>
                    <Text style={{ color: '#000', fontSize: 12, fontWeight: 'bold' }}>{badgeCount}</Text>
                </View>
            )}
            {!isDestructive && !isLoading && <Ionicons name="chevron-forward" size={20} color="#3A3A40" />}
        </View>
    </TouchableOpacity>
);

const ProfileScreen = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, token, logout } = useAuthStore();
    const { globalSocket } = useGlobalSocket();
    const isLoggedIn = !!token;

    const [isTheatreModalVisible, setIsTheatreModalVisible] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
    const [unreadChatCount, setUnreadChatCount] = useState(0);

    const exactName = user?.name || (user?.email ? user.email.split('@')[0] : 'User');
    const displayInitial = exactName.charAt(0).toUpperCase();

    // Re-sync exact counts on focus as a fallback
    useFocusEffect(
        useCallback(() => {
            if (isLoggedIn) {
                const fetchCounts = async () => {
                    try {
                        const [notifRes, chatRes] = await Promise.all([
                            axios.get(`${BACKEND_URL}/buddies/notifications`, { headers: { Authorization: `Bearer ${token}` } }),
                            axios.get(`${BACKEND_URL}/chat/unread-count`, { headers: { Authorization: `Bearer ${token}` } })
                        ]);
                        setUnreadNotifsCount(notifRes.data.length);
                        setUnreadChatCount(chatRes.data.count);
                    } catch (error) {
                        console.log('Failed to fetch counts');
                    }
                };
                fetchCounts();
            }
        }, [isLoggedIn])
    );

    // Live socket listener to instantly increment AND decrement Chat badge
    useEffect(() => {
        if (!globalSocket) return;

        const handleNewChat = () => setUnreadChatCount(prev => prev + 1);
        const handleRead = ({ count }) => setUnreadChatCount(prev => Math.max(0, prev - count));

        globalSocket.on('receive_direct_message', handleNewChat);
        globalSocket.on('messages_read', handleRead);

        return () => {
            globalSocket.off('receive_direct_message', handleNewChat);
            globalSocket.off('messages_read', handleRead);
        };
    }, [globalSocket]);

    const handleProtectedNavigation = (targetPath) => {
        if (!isLoggedIn) {
            Toast.show({ type: 'hotstarInfo', text1: 'Log in for personalization', topOffset: insets.top > 0 ? insets.top + 10 : 50 });
        } else {
            router.push(targetPath);
        }
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try { await axios.post(`${BACKEND_URL}/auth/logout`); } catch (error) { }
        finally {
            await logout();
            setIsLoggingOut(false);
            Toast.show({ type: 'hotstarSuccess', text1: 'Logged out successfully', topOffset: insets.top > 0 ? insets.top + 10 : 50 });
        }
    };

    const openTheatreModal = () => { setJoinCode(''); setIsTheatreModalVisible(true); };
    const handleCreateRoom = () => { setIsTheatreModalVisible(false); router.push(`/theatre?roomId=${Math.floor(10000 + Math.random() * 90000).toString()}&isHost=true`); };
    const handleJoinRoom = () => {
        if (joinCode.length === 5) { setIsTheatreModalVisible(false); router.push(`/theatre?roomId=${joinCode}&isHost=false`); }
        else { Toast.show({ type: 'error', text1: 'Please enter a valid 5-digit code' }); }
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={['rgba(155, 81, 224, 0.15)', 'transparent']} style={styles.backgroundGlow} />
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                    {isLoggedIn ? (
                        <View style={styles.profileHeader}>
                            <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarContainer}>
                                <Text style={styles.avatarText}>{displayInitial}</Text>
                            </LinearGradient>
                            <Text style={styles.userName}>{exactName}</Text>
                            <Text style={styles.userEmail}>{user?.email}</Text>
                        </View>
                    ) : (
                        <View style={styles.loggedOutContainer}>
                            <View style={[styles.illustrationContainer, { zIndex: -1 }]}>
                                <Ionicons name="tv" size={110} color="#1E1E24" />
                                <View style={styles.floatingDeviceLeft}><Ionicons name="phone-landscape" size={45} color="#2A2A30" /></View>
                                <View style={styles.floatingDeviceRight}><Ionicons name="phone-portrait" size={35} color="#2A2A30" /></View>
                                <View style={styles.orbitLine} />
                                <Ionicons name="star" size={10} color="#00E5FF" style={[styles.starIcon, { top: 10, left: 30 }]} />
                                <Ionicons name="star" size={12} color="#FF007A" style={[styles.starIcon, { bottom: 20, right: 20 }]} />
                            </View>
                            <Text style={styles.title}>Login to CinePlay</Text>
                            <Text style={styles.subtitle}>Start watching from where you left off, personalise for kids and more</Text>
                            <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/login')}>
                                <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loginButton}>
                                    <Text style={styles.loginButtonText}>Log In</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.menuSection}>
                        <Text style={styles.sectionTitle}>Watch Together</Text>
                        <View style={styles.menuCard}>
                            <MenuRow icon="people-circle-outline" title="Theatre Mode" subtitle="Sync playback real-time with friends" onPress={openTheatreModal} />
                        </View>
                    </View>

                    <View style={styles.menuSection}>
                        <Text style={styles.sectionTitle}>Social</Text>
                        <View style={styles.menuCard}>
                            <MenuRow
                                icon="people-outline"
                                title="CineBuddies"
                                subtitle="Chat & discover friends"
                                badgeCount={unreadChatCount}
                                onPress={() => handleProtectedNavigation('/cinebuddies')}
                            />
                            <View style={styles.divider} />
                            <MenuRow
                                icon="notifications-outline"
                                title="Notifications"
                                subtitle="Cinerequests & Invites"
                                badgeCount={unreadNotifsCount}
                                onPress={() => handleProtectedNavigation('/notifications')}
                            />
                        </View>
                    </View>

                    <View style={styles.menuSection}>
                        <Text style={styles.sectionTitle}>My Lists</Text>
                        <View style={styles.menuCard}>
                            <MenuRow icon="bookmark-outline" title="Watchlist" onPress={() => handleProtectedNavigation('/my-list?tab=watchlist')} />
                            <View style={styles.divider} />
                            <MenuRow icon="checkmark-done-circle-outline" title="Watch History" onPress={() => handleProtectedNavigation('/my-list?tab=watched')} />
                        </View>
                    </View>

                    {isLoggedIn && (
                        <View style={[styles.menuSection, { marginBottom: 40 }]}>
                            <Text style={styles.sectionTitle}>Account</Text>
                            <View style={styles.menuCard}>
                                <MenuRow icon="log-out-outline" title="Log Out" isDestructive={true} isLoading={isLoggingOut} onPress={handleLogout} />
                            </View>
                        </View>
                    )}

                </ScrollView>
            </SafeAreaView>

            <Modal
                visible={isTheatreModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsTheatreModalVisible(false)}
            >
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                >
                    <View style={styles.modalContainer}>
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsTheatreModalVisible(false)}>
                            <Ionicons name="close" size={24} color="#8F98A0" />
                        </TouchableOpacity>

                        <Text style={styles.modalTitle}>Theatre Mode</Text>
                        <Text style={styles.modalSub}>Watch synchronized videos with friends in real-time.</Text>

                        <TouchableOpacity style={styles.createRoomBtn} activeOpacity={0.8} onPress={handleCreateRoom}>
                            <LinearGradient
                                colors={['#00E5FF', '#9B51E0', '#FF007A']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                style={styles.createRoomGradient}
                            >
                                <Ionicons name="add-circle-outline" size={20} color="#FFF" />
                                <Text style={styles.createRoomText}>Create New Room</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>OR JOIN EXISTING</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <TextInput
                            style={styles.joinInput}
                            placeholder="Enter 5-digit code"
                            placeholderTextColor="#8F98A0"
                            keyboardType="numeric"
                            maxLength={5}
                            value={joinCode}
                            onChangeText={setJoinCode}
                            selectionColor="#00E5FF"
                        />
                        <TouchableOpacity
                            style={[styles.joinRoomBtnContainer, joinCode.length !== 5 && styles.joinRoomBtnDisabled]}
                            activeOpacity={0.8}
                            onPress={handleJoinRoom}
                            disabled={joinCode.length !== 5}
                        >
                            <LinearGradient
                                colors={joinCode.length === 5 ? ['#00E5FF', '#9B51E0', '#FF007A'] : ['#2A2A30', '#2A2A30']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                style={styles.joinRoomGradient}
                            >
                                <Text style={[styles.joinRoomText, joinCode.length !== 5 && { color: '#8F98A0' }]}>Join Room</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                    </View>
                </KeyboardAvoidingView>
            </Modal>

        </View>
    );
};

export default ProfileScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0A0C' },
    backgroundGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 300, zIndex: -2 },
    safeArea: { flex: 1 },
    scrollContent: { paddingBottom: 100 },

    profileHeader: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
    avatarContainer: { width: 86, height: 86, borderRadius: 43, justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: '#9B51E0', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },
    avatarText: { color: '#FFFFFF', fontSize: 36, fontWeight: 'bold' },
    userName: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', marginBottom: 4, letterSpacing: 0.3 },
    userEmail: { color: '#8F98A0', fontSize: 14, fontWeight: '500' },

    loggedOutContainer: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 20 },
    illustrationContainer: { width: 220, height: 140, justifyContent: 'center', alignItems: 'center', marginBottom: 30, position: 'relative' },
    floatingDeviceLeft: { position: 'absolute', left: 10, top: 30, transform: [{ rotate: '-15deg' }] },
    floatingDeviceRight: { position: 'absolute', right: 15, bottom: 25, transform: [{ rotate: '15deg' }] },
    orbitLine: { position: 'absolute', width: '110%', height: 40, borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)', borderRadius: 50, top: '50%', transform: [{ translateY: -10 }] },
    starIcon: { position: 'absolute', opacity: 0.8 },
    title: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', marginBottom: 12, letterSpacing: 0.3 },
    subtitle: { color: '#8F98A0', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 32, paddingHorizontal: 10 },
    loginButton: { width: width * 0.85, height: 52, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },

    menuSection: { paddingHorizontal: 20, marginTop: 24 },
    sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginBottom: 12, marginLeft: 4, letterSpacing: 0.3 },
    menuCard: { backgroundColor: '#17171C', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 16 },
    menuRowLeft: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    menuRowTitle: { color: '#E0E0E0', fontSize: 15, fontWeight: '500' },
    menuRowSubtitle: { color: '#8F98A0', fontSize: 12, marginTop: 2 },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 16 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContainer: { backgroundColor: '#1E1E24', borderRadius: 20, width: '100%', padding: 24, position: 'relative', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    modalCloseBtn: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 4 },
    modalTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    modalSub: { color: '#8F98A0', fontSize: 14, textAlign: 'center', marginBottom: 28, paddingHorizontal: 10 },

    createRoomBtn: { borderRadius: 10, overflow: 'hidden', marginBottom: 24 },
    createRoomGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
    createRoomText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },

    dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
    dividerText: { color: '#8F98A0', fontSize: 12, fontWeight: 'bold', marginHorizontal: 12, letterSpacing: 1 },

    joinInput: { backgroundColor: '#0A0A0C', color: '#FFFFFF', borderRadius: 10, height: 56, fontSize: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 16, textAlign: 'center', letterSpacing: 4 },
    joinRoomBtnContainer: { borderRadius: 10, overflow: 'hidden' },
    joinRoomBtnDisabled: { opacity: 0.9 },
    joinRoomGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
    joinRoomText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});