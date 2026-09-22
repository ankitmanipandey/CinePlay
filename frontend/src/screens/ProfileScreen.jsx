import React from 'react';
import {
    StyleSheet, Text, View, TouchableOpacity, ScrollView, Modal,
    TextInput, ActivityIndicator, useWindowDimensions, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useProfileLogic } from '../hooks/useProfileLogic';

// Reusable MenuRow
const MenuRow = ({ icon, title, subtitle, isDestructive = false, isLoading = false, badgeCount = 0, onPress }) => (
    <TouchableOpacity style={[styles.menuRow, { cursor: isLoading ? 'default' : 'pointer' }]} activeOpacity={0.7} onPress={onPress} disabled={isLoading}>
        <View style={styles.menuRowLeft}>
            <View style={[styles.iconBox, isDestructive && { backgroundColor: 'rgba(229, 57, 53, 0.1)' }]}>
                {isLoading ? <ActivityIndicator size="small" color="#E53935" /> : <Ionicons name={icon} size={20} color={isDestructive ? "#E53935" : "#8F98A0"} />}
            </View>
            <View>
                <Text style={[styles.menuRowTitle, isDestructive && { color: '#E53935' }]}>{isLoading ? 'Logging out...' : title}</Text>
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

export default function ProfileScreenWeb() {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 1024;

    const {
        isLoggedIn, exactName, displayInitial, user,
        isTheatreModalVisible, setIsTheatreModalVisible,
        joinCode, setJoinCode, isLoggingOut,
        unreadNotifsCount, unreadChatCount, TAB_BAR_HEIGHT,
        handleProtectedNavigation, handleLogout, openTheatreModal, handleCreateRoom, handleJoinRoom, router
    } = useProfileLogic();

    // --------------------------------------------------------
    // DESKTOP LAYOUT (Widescreen Dashboard)
    // --------------------------------------------------------
    if (isDesktop) {
        return (
            <View style={styles.container}>
                <LinearGradient colors={['rgba(155, 81, 224, 0.15)', 'transparent']} style={styles.backgroundGlow} />

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.desktopContent}>
                    {!isLoggedIn ? (
                        <View style={styles.loggedOutContainerDesktop}>
                            <View style={[styles.illustrationContainerDesktop, { zIndex: -1 }]}>
                                <Ionicons name="tv" size={110} color="#1E1E24" />
                                <View style={styles.floatingDeviceLeftDesktop}><Ionicons name="phone-landscape" size={45} color="#2A2A30" /></View>
                                <View style={styles.floatingDeviceRightDesktop}><Ionicons name="phone-portrait" size={35} color="#2A2A30" /></View>
                                <View style={styles.orbitLineDesktop} />
                                <Ionicons name="star" size={10} color="#00E5FF" style={[styles.starIconDesktop, { top: 10, left: 30 }]} />
                                <Ionicons name="star" size={12} color="#FF007A" style={[styles.starIconDesktop, { bottom: 20, right: 20 }]} />
                            </View>
                            <Text style={styles.titleDesktop}>Login to CinePlay</Text>
                            <Text style={styles.subtitleDesktop}>Start watching from where you left off, personalise for kids and more</Text>
                            <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/login')} style={{ cursor: 'pointer' }}>
                                <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loginButtonDesktop}>
                                    <Text style={styles.loginButtonTextDesktop}>Log In</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.dashboardLayout}>
                            <View style={styles.leftColumn}>
                                <View style={styles.profileCardDesktop}>
                                    <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarContainerDesktop}>
                                        <Text style={styles.avatarTextDesktop}>{displayInitial}</Text>
                                    </LinearGradient>
                                    <Text style={styles.userNameDesktop}>{exactName}</Text>
                                    <Text style={styles.userEmailDesktop}>{user?.email}</Text>
                                </View>
                                <View style={styles.menuCard}>
                                    <MenuRow icon="log-out-outline" title="Log Out" isDestructive={true} isLoading={isLoggingOut} onPress={handleLogout} />
                                </View>
                            </View>

                            <View style={styles.rightColumn}>
                                <View style={styles.menuSectionDesktop}>
                                    <Text style={styles.sectionTitleDesktop}>Watch Together</Text>
                                    <View style={styles.menuCard}>
                                        <MenuRow icon="people-circle-outline" title="CineTheatre" subtitle="Sync playback real-time with friends" onPress={openTheatreModal} />
                                    </View>
                                </View>

                                <View style={styles.menuSectionDesktop}>
                                    <Text style={styles.sectionTitleDesktop}>My Content</Text>
                                    <View style={styles.menuCard}>
                                        <MenuRow icon="videocam-outline" title="My Videos" onPress={() => handleProtectedNavigation('/my-videos')} />
                                    </View>
                                </View>

                                <View style={styles.menuSectionDesktop}>
                                    <Text style={styles.sectionTitleDesktop}>Social</Text>
                                    <View style={styles.menuCard}>
                                        <MenuRow icon="people-outline" title="CineBuddies" subtitle="Chat & discover friends" badgeCount={unreadChatCount} onPress={() => handleProtectedNavigation('/cinebuddies')} />
                                        <View style={styles.divider} />
                                        <MenuRow icon="notifications-outline" title="Notifications" subtitle="Cinerequests & Invites" badgeCount={unreadNotifsCount} onPress={() => handleProtectedNavigation('/notifications')} />
                                    </View>
                                </View>

                                <View style={styles.menuSectionDesktop}>
                                    <Text style={styles.sectionTitleDesktop}>My Lists</Text>
                                    <View style={styles.menuCard}>
                                        <MenuRow icon="bookmark-outline" title="Watchlist" onPress={() => handleProtectedNavigation('/my-list?tab=watchlist')} />
                                        <View style={styles.divider} />
                                        <MenuRow icon="checkmark-done-circle-outline" title="Watch History" onPress={() => handleProtectedNavigation('/my-list?tab=watched')} />
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}
                </ScrollView>

                <Modal visible={isTheatreModalVisible} transparent={true} animationType="fade" onRequestClose={() => setIsTheatreModalVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContainerDesktop}>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsTheatreModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#8F98A0" />
                            </TouchableOpacity>

                            <Text style={styles.modalTitle}>CineTheatre</Text>
                            <Text style={styles.modalSub}>Watch synchronized videos with friends in real-time.</Text>

                            <TouchableOpacity style={styles.createRoomBtn} activeOpacity={0.8} onPress={handleCreateRoom}>
                                <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.createRoomGradient}>
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
                            <TouchableOpacity style={[styles.joinRoomBtnContainer, joinCode.length !== 5 && styles.joinRoomBtnDisabled]} activeOpacity={0.8} onPress={handleJoinRoom} disabled={joinCode.length !== 5}>
                                <LinearGradient colors={joinCode.length === 5 ? ['#00E5FF', '#9B51E0', '#FF007A'] : ['#2A2A30', '#2A2A30']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.joinRoomGradient}>
                                    <Text style={[styles.joinRoomText, joinCode.length !== 5 && { color: '#8F98A0' }]}>Join Room</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </View>
        );
    }

    // --------------------------------------------------------
    // MOBILE & TABLET LAYOUT (Exact Native Clone)
    // --------------------------------------------------------
    return (
        <View style={styles.container}>
            <LinearGradient colors={['rgba(155, 81, 224, 0.15)', 'transparent']} style={styles.backgroundGlow} />
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContentMobile, { paddingBottom: TAB_BAR_HEIGHT + 20 }]}>

                    {isLoggedIn ? (
                        <View style={styles.profileHeaderMobile}>
                            <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarContainerMobile}>
                                <Text style={styles.avatarTextMobile}>{displayInitial}</Text>
                            </LinearGradient>
                            <Text style={styles.userNameMobile}>{exactName}</Text>
                            <Text style={styles.userEmailMobile}>{user?.email}</Text>
                        </View>
                    ) : (
                        <View style={styles.loggedOutContainerMobile}>
                            <View style={[styles.illustrationContainerMobile, { zIndex: -1 }]}>
                                <Ionicons name="tv" size={110} color="#1E1E24" />
                                <View style={styles.floatingDeviceLeftMobile}><Ionicons name="phone-landscape" size={45} color="#2A2A30" /></View>
                                <View style={styles.floatingDeviceRightMobile}><Ionicons name="phone-portrait" size={35} color="#2A2A30" /></View>
                                <View style={styles.orbitLineMobile} />
                                <Ionicons name="star" size={10} color="#00E5FF" style={[styles.starIconMobile, { top: 10, left: 30 }]} />
                                <Ionicons name="star" size={12} color="#FF007A" style={[styles.starIconMobile, { bottom: 20, right: 20 }]} />
                            </View>
                            <Text style={styles.titleMobile}>Login to CinePlay</Text>
                            <Text style={styles.subtitleMobile}>Start watching from where you left off, personalise for kids and more</Text>
                            <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/login')} style={{ cursor: 'pointer' }}>
                                <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loginButtonMobile}>
                                    <Text style={styles.loginButtonTextMobile}>Log In</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.menuSectionMobile}>
                        <Text style={styles.sectionTitleMobile}>Watch Together</Text>
                        <View style={styles.menuCard}>
                            <MenuRow icon="people-circle-outline" title="CineTheatre" subtitle="Sync playback real-time with friends" onPress={openTheatreModal} />
                        </View>
                    </View>

                    <View style={styles.menuSectionMobile}>
                        <Text style={styles.sectionTitleMobile}>My Content</Text>
                        <View style={styles.menuCard}>
                            <MenuRow icon="videocam-outline" title="My Videos" onPress={() => handleProtectedNavigation('/my-videos')} />
                        </View>
                    </View>

                    <View style={styles.menuSectionMobile}>
                        <Text style={styles.sectionTitleMobile}>Social</Text>
                        <View style={styles.menuCard}>
                            <MenuRow icon="people-outline" title="CineBuddies" subtitle="Chat & discover friends" badgeCount={unreadChatCount} onPress={() => handleProtectedNavigation('/cinebuddies')} />
                            <View style={styles.divider} />
                            <MenuRow icon="notifications-outline" title="Notifications" subtitle="Cinerequests & Invites" badgeCount={unreadNotifsCount} onPress={() => handleProtectedNavigation('/notifications')} />
                        </View>
                    </View>

                    <View style={styles.menuSectionMobile}>
                        <Text style={styles.sectionTitleMobile}>My Lists</Text>
                        <View style={styles.menuCard}>
                            <MenuRow icon="bookmark-outline" title="Watchlist" onPress={() => handleProtectedNavigation('/my-list?tab=watchlist')} />
                            <View style={styles.divider} />
                            <MenuRow icon="checkmark-done-circle-outline" title="Watch History" onPress={() => handleProtectedNavigation('/my-list?tab=watched')} />
                        </View>
                    </View>

                    {isLoggedIn && (
                        <View style={[styles.menuSectionMobile, { marginBottom: 40 }]}>
                            <Text style={styles.sectionTitleMobile}>Account</Text>
                            <View style={styles.menuCard}>
                                <MenuRow icon="log-out-outline" title="Log Out" isDestructive={true} isLoading={isLoggingOut} onPress={handleLogout} />
                            </View>
                        </View>
                    )}

                </ScrollView>
            </SafeAreaView>

            <Modal visible={isTheatreModalVisible} transparent={true} animationType="fade" onRequestClose={() => setIsTheatreModalVisible(false)}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                    <View style={styles.modalContainerMobile}>
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsTheatreModalVisible(false)}>
                            <Ionicons name="close" size={24} color="#8F98A0" />
                        </TouchableOpacity>

                        <Text style={styles.modalTitle}>CineTheatre</Text>
                        <Text style={styles.modalSub}>Watch synchronized videos with friends in real-time.</Text>

                        <TouchableOpacity style={styles.createRoomBtn} activeOpacity={0.8} onPress={handleCreateRoom}>
                            <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.createRoomGradient}>
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
                            style={styles.joinInputMobile}
                            placeholder="Enter 5-digit code"
                            placeholderTextColor="#8F98A0"
                            keyboardType="numeric"
                            maxLength={5}
                            value={joinCode}
                            onChangeText={setJoinCode}
                            selectionColor="#00E5FF"
                        />
                        <TouchableOpacity style={[styles.joinRoomBtnContainer, joinCode.length !== 5 && styles.joinRoomBtnDisabled]} activeOpacity={0.8} onPress={handleJoinRoom} disabled={joinCode.length !== 5}>
                            <LinearGradient colors={joinCode.length === 5 ? ['#00E5FF', '#9B51E0', '#FF007A'] : ['#2A2A30', '#2A2A30']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.joinRoomGradient}>
                                <Text style={[styles.joinRoomText, joinCode.length !== 5 && { color: '#8F98A0' }]}>Join Room</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    // --- SHARED STYLES ---
    container: { flex: 1, backgroundColor: '#0A0A0C' },
    backgroundGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 400, zIndex: -2 },
    menuCard: { backgroundColor: '#17171C', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 20 },
    menuRowLeft: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    menuRowTitle: { color: '#E0E0E0', fontSize: 16, fontWeight: '500' },
    menuRowSubtitle: { color: '#8F98A0', fontSize: 13, marginTop: 4 },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 20 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCloseBtn: { position: 'absolute', top: 20, right: 20, zIndex: 10, padding: 4, cursor: 'pointer' },
    modalTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
    modalSub: { color: '#8F98A0', fontSize: 15, textAlign: 'center', marginBottom: 32 },
    createRoomBtn: { borderRadius: 12, overflow: 'hidden', marginBottom: 32, cursor: 'pointer' },
    createRoomGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
    createRoomText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
    dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
    dividerText: { color: '#8F98A0', fontSize: 12, fontWeight: 'bold', marginHorizontal: 16, letterSpacing: 1 },
    joinRoomBtnContainer: { borderRadius: 12, overflow: 'hidden', cursor: 'pointer' },
    joinRoomBtnDisabled: { opacity: 0.9, cursor: 'not-allowed' },
    joinRoomGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
    joinRoomText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },

    // --- DESKTOP STYLES (>= 1024px) ---
    desktopContent: { padding: 40, maxWidth: 1200, alignSelf: 'center', width: '100%' },
    dashboardLayout: { flexDirection: 'row', gap: 40, alignItems: 'flex-start' },
    leftColumn: { width: 320, flexShrink: 0 },
    rightColumn: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
    profileCardDesktop: { backgroundColor: '#17171C', borderRadius: 16, padding: 32, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    avatarContainerDesktop: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: '#9B51E0', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10 },
    avatarTextDesktop: { color: '#FFFFFF', fontSize: 48, fontWeight: 'bold' },
    userNameDesktop: { color: '#FFFFFF', fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
    userEmailDesktop: { color: '#8F98A0', fontSize: 16, fontWeight: '500' },
    menuSectionDesktop: { width: '47%', minWidth: 300, marginBottom: 8 },
    sectionTitleDesktop: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 16, letterSpacing: 0.3 },
    loggedOutContainerDesktop: { alignItems: 'center', justifyContent: 'center', height: '80vh' },
    illustrationContainerDesktop: { width: 220, height: 140, justifyContent: 'center', alignItems: 'center', marginBottom: 40, position: 'relative' },
    floatingDeviceLeftDesktop: { position: 'absolute', left: 10, top: 30, transform: [{ rotate: '-15deg' }] },
    floatingDeviceRightDesktop: { position: 'absolute', right: 15, bottom: 25, transform: [{ rotate: '15deg' }] },
    orbitLineDesktop: { position: 'absolute', width: '110%', height: 40, borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)', borderRadius: 50, top: '50%', transform: [{ translateY: -10 }] },
    starIconDesktop: { position: 'absolute', opacity: 0.8 },
    titleDesktop: { color: '#FFFFFF', fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
    subtitleDesktop: { color: '#8F98A0', fontSize: 16, textAlign: 'center', marginBottom: 40 },
    loginButtonDesktop: { width: 300, height: 56, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    loginButtonTextDesktop: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    modalContainerDesktop: { backgroundColor: '#1E1E24', borderRadius: 24, width: 420, padding: 32, position: 'relative', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    joinInput: { backgroundColor: '#0A0A0C', color: '#FFFFFF', borderRadius: 12, height: 64, fontSize: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 20, textAlign: 'center', letterSpacing: 8, outlineStyle: 'none' },

    // --- MOBILE & TABLET STYLES (< 1024px) ---
    safeArea: { flex: 1 },
    scrollContentMobile: {},
    profileHeaderMobile: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
    avatarContainerMobile: { width: 86, height: 86, borderRadius: 43, justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: '#9B51E0', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },
    avatarTextMobile: { color: '#FFFFFF', fontSize: 36, fontWeight: 'bold' },
    userNameMobile: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', marginBottom: 4, letterSpacing: 0.3 },
    userEmailMobile: { color: '#8F98A0', fontSize: 14, fontWeight: '500' },
    loggedOutContainerMobile: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 20 },
    illustrationContainerMobile: { width: 220, height: 140, justifyContent: 'center', alignItems: 'center', marginBottom: 30, position: 'relative' },
    floatingDeviceLeftMobile: { position: 'absolute', left: 10, top: 30, transform: [{ rotate: '-15deg' }] },
    floatingDeviceRightMobile: { position: 'absolute', right: 15, bottom: 25, transform: [{ rotate: '15deg' }] },
    orbitLineMobile: { position: 'absolute', width: '110%', height: 40, borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)', borderRadius: 50, top: '50%', transform: [{ translateY: -10 }] },
    starIconMobile: { position: 'absolute', opacity: 0.8 },
    titleMobile: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', marginBottom: 12, letterSpacing: 0.3 },
    subtitleMobile: { color: '#8F98A0', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 32, paddingHorizontal: 10 },
    loginButtonMobile: { width: '100%', minWidth: 300, height: 52, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    loginButtonTextMobile: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    menuSectionMobile: { paddingHorizontal: 20, marginTop: 24 },
    sectionTitleMobile: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginBottom: 12, marginLeft: 4, letterSpacing: 0.3 },
    modalContainerMobile: { backgroundColor: '#1E1E24', borderRadius: 20, width: '100%', padding: 24, position: 'relative', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    joinInputMobile: { backgroundColor: '#0A0A0C', color: '#FFFFFF', borderRadius: 10, height: 56, fontSize: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 16, textAlign: 'center', letterSpacing: 4, outlineStyle: 'none' },
});