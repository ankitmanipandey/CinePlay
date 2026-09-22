import React from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, FlatList,
    TextInput, ActivityIndicator, RefreshControl, Modal, Switch, KeyboardAvoidingView, Platform, useWindowDimensions, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheatreLobbyLogic } from '../hooks/useTheatreLobbyLogic';

export default function TheatreLobbyScreen() {
    const { width: windowWidth } = useWindowDimensions();
    const isDesktop = windowWidth >= 1024;

    const {
        router, user, publicRooms, isLoading, refreshing,
        joinCode, setJoinCode, isCreateModalVisible, setIsCreateModalVisible,
        newRoomName, setNewRoomName, isPublic, setIsPublic,
        newRoomPin, setNewRoomPin, isCreating,
        onRefresh, handleJoinPrivate, handleCreateRoomSubmit
    } = useTheatreLobbyLogic();

    const renderRoomCard = ({ item }) => (
        <TouchableOpacity
            style={isDesktop ? styles.desktopRoomCard : styles.roomCard}
            activeOpacity={0.8}
            onPress={() => router.push(`/theatre?roomId=${item.roomId}&isHost=false`)}
        >
            <View style={styles.roomHeader}>
                <Text style={styles.roomName}>{item.roomName}</Text>
                <View style={styles.badge}>
                    <Ionicons name="people" size={14} color="#FFF" />
                    <Text style={styles.badgeText}>{item.userCount}</Text>
                </View>
            </View>
            <Text style={styles.hostName}>Hosted by {item.hostName}</Text>

            <View style={styles.videoInfo}>
                <Ionicons name="play-circle" size={18} color="#00E5FF" />
                <Text style={styles.videoTitle} numberOfLines={1}>{item.videoTitle}</Text>
            </View>
        </TouchableOpacity>
    );

    // --------------------------------------------------------
    // DESKTOP LAYOUT (Premium Split-Pane UI)
    // --------------------------------------------------------
    if (isDesktop) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.desktopContainer}>
                    {/* LEFT COLUMN: Actions & Join */}
                    <View style={styles.desktopLeftCol}>
                        <View style={styles.desktopHeader}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.desktopBackBtn}>
                                <Ionicons name="arrow-back" size={24} color="#FFF" />
                            </TouchableOpacity>
                            <Text style={styles.desktopHeaderTitle}>CineTheatre</Text>
                        </View>

                        <View style={styles.desktopCard}>
                            <Text style={styles.desktopCardTitle}>Join Private Room</Text>
                            <View style={styles.joinRow}>
                                <TextInput
                                    style={styles.desktopJoinInput}
                                    placeholder="Enter 5-digit code"
                                    placeholderTextColor="#8F98A0"
                                    keyboardType="numeric"
                                    maxLength={5}
                                    value={joinCode}
                                    onChangeText={setJoinCode}
                                />
                                <TouchableOpacity
                                    style={[styles.desktopJoinBtn, joinCode.length !== 5 && styles.joinBtnDisabled]}
                                    disabled={joinCode.length !== 5}
                                    onPress={handleJoinPrivate}
                                >
                                    <LinearGradient colors={joinCode.length === 5 ? ['#00E5FF', '#9B51E0'] : ['#2A2A30', '#2A2A30']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.joinGradient}>
                                        <Text style={[styles.joinBtnText, joinCode.length !== 5 && { color: '#8F98A0' }]}>Join</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.desktopCard}>
                            <Text style={styles.desktopCardTitle}>Host a Room</Text>
                            <Text style={styles.emptySubText}>Watch together with friends in perfect sync.</Text>
                            <TouchableOpacity style={styles.desktopCreateBtn} activeOpacity={0.9} onPress={() => setIsCreateModalVisible(true)}>
                                <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.desktopCreateGradient}>
                                    <Ionicons name="add-circle" size={20} color="#FFF" style={{ marginRight: 8 }} />
                                    <Text style={styles.desktopCreateBtnText}>Create New Theatre</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* RIGHT COLUMN: Public Rooms Grid */}
                    <View style={styles.desktopRightCol}>
                        <View style={styles.listHeaderRow}>
                            <Text style={styles.desktopSectionTitle}>Live Public Theatres</Text>
                            <TouchableOpacity onPress={onRefresh} style={{ cursor: 'pointer', padding: 8 }}>
                                <Ionicons name="refresh" size={24} color="#00E5FF" />
                            </TouchableOpacity>
                        </View>

                        {isLoading ? (
                            <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 60 }} />
                        ) : (
                            <FlatList
                                data={publicRooms}
                                keyExtractor={item => item.roomId}
                                renderItem={renderRoomCard}
                                numColumns={2}
                                columnWrapperStyle={{ gap: 20 }}
                                // flexGrow: 1 ensures the empty state can center itself vertically in the available space
                                contentContainerStyle={{ flexGrow: 1, paddingBottom: 60, paddingTop: 10 }}
                                showsVerticalScrollIndicator={false}
                                ListEmptyComponent={
                                    <View style={styles.desktopEmptyState}>
                                        <Ionicons name="planet-outline" size={90} color="#2A2A30" />
                                        <Text style={styles.desktopEmptyText}>No public rooms right now.</Text>
                                        <Text style={styles.desktopEmptySubText}>Be the first to host one today!</Text>
                                    </View>
                                }
                            />
                        )}
                    </View>
                </View>

                {/* DESKTOP MODAL (Centered Dialog) */}
                <Modal visible={isCreateModalVisible} transparent animationType="fade" onRequestClose={() => setIsCreateModalVisible(false)}>
                    <View style={styles.desktopModalOverlay}>
                        <View style={styles.desktopModalContainer}>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsCreateModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#8F98A0" />
                            </TouchableOpacity>

                            <Text style={styles.modalTitle}>Host a Theatre</Text>

                            <Text style={styles.inputLabel}>Room Name</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder={`${user?.name?.split(' ')[0] || 'My'} Theatre`}
                                placeholderTextColor="#8F98A0"
                                value={newRoomName}
                                onChangeText={setNewRoomName}
                                maxLength={25}
                            />

                            <View style={styles.switchRow}>
                                <View>
                                    <Text style={styles.inputLabel}>Public Room</Text>
                                    <Text style={styles.inputSub}>Anyone can join from the lobby</Text>
                                </View>
                                <Switch
                                    value={isPublic}
                                    onValueChange={(val) => { setIsPublic(val); if (val) setNewRoomPin(''); }}
                                    trackColor={{ false: '#2A2A30', true: '#00E5FF' }}
                                    thumbColor="#FFF"
                                />
                            </View>

                            {!isPublic && (
                                <View style={styles.pinSection}>
                                    <Text style={styles.inputLabel}>Room PIN (Optional)</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Enter a 4-digit PIN"
                                        placeholderTextColor="#8F98A0"
                                        keyboardType="numeric"
                                        maxLength={4}
                                        value={newRoomPin}
                                        onChangeText={setNewRoomPin}
                                        secureTextEntry
                                    />
                                </View>
                            )}

                            <TouchableOpacity style={styles.submitBtnContainer} activeOpacity={0.8} onPress={handleCreateRoomSubmit} disabled={isCreating}>
                                <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtnGradient}>
                                    {isCreating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Start Hosting</Text>}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        );
    }

    // --------------------------------------------------------
    // MOBILE & TABLET LAYOUT (Exact Native Clone)
    // --------------------------------------------------------
    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>CineTheatre Lobby</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.joinSection}>
                <Text style={styles.sectionTitle}>Join Private Room</Text>
                <View style={styles.joinRow}>
                    <TextInput
                        style={styles.joinInput}
                        placeholder="Enter 5-digit code"
                        placeholderTextColor="#8F98A0"
                        keyboardType="numeric"
                        maxLength={5}
                        value={joinCode}
                        onChangeText={setJoinCode}
                    />
                    <TouchableOpacity
                        style={[styles.joinBtn, joinCode.length !== 5 && styles.joinBtnDisabled]}
                        disabled={joinCode.length !== 5}
                        onPress={handleJoinPrivate}
                    >
                        <LinearGradient colors={joinCode.length === 5 ? ['#00E5FF', '#9B51E0'] : ['#2A2A30', '#2A2A30']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.joinGradient}>
                            <Text style={[styles.joinBtnText, joinCode.length !== 5 && { color: '#8F98A0' }]}>Join</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.listContainer}>
                <View style={styles.listHeaderRow}>
                    <Text style={styles.sectionTitle}>Live Public Theatres</Text>
                    <TouchableOpacity onPress={onRefresh}><Ionicons name="refresh" size={20} color="#00E5FF" /></TouchableOpacity>
                </View>

                {isLoading ? (
                    <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 40 }} />
                ) : (
                    <FlatList
                        data={publicRooms}
                        keyExtractor={item => item.roomId}
                        renderItem={renderRoomCard}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E5FF" />}
                        contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Ionicons name="planet-outline" size={60} color="#2A2A30" />
                                <Text style={styles.emptyText}>No public rooms right now.</Text>
                                <Text style={styles.emptySubText}>Hit the + button to host your own!</Text>
                            </View>
                        }
                    />
                )}
            </View>

            {/* Floating Action Button */}
            <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={() => setIsCreateModalVisible(true)}>
                <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGradient}>
                    <Ionicons name="add" size={36} color="#FFF" />
                </LinearGradient>
            </TouchableOpacity>

            {/* Create Room Modal */}
            <Modal visible={isCreateModalVisible} transparent animationType="slide" onRequestClose={() => setIsCreateModalVisible(false)}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                    <View style={styles.modalContainer}>
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsCreateModalVisible(false)}>
                            <Ionicons name="close" size={24} color="#8F98A0" />
                        </TouchableOpacity>

                        <Text style={styles.modalTitle}>Host a Theatre</Text>

                        <Text style={styles.inputLabel}>Room Name</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder={`${user?.name?.split(' ')[0] || 'My'} Theatre`}
                            placeholderTextColor="#8F98A0"
                            value={newRoomName}
                            onChangeText={setNewRoomName}
                            maxLength={25}
                        />

                        <View style={styles.switchRow}>
                            <View>
                                <Text style={styles.inputLabel}>Public Room</Text>
                                <Text style={styles.inputSub}>Anyone can join from the lobby</Text>
                            </View>
                            <Switch
                                value={isPublic}
                                onValueChange={(val) => { setIsPublic(val); if (val) setNewRoomPin(''); }}
                                trackColor={{ false: '#2A2A30', true: '#00E5FF' }}
                                thumbColor="#FFF"
                            />
                        </View>

                        {!isPublic && (
                            <View style={styles.pinSection}>
                                <Text style={styles.inputLabel}>Room PIN (Optional)</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Enter a 4-digit PIN"
                                    placeholderTextColor="#8F98A0"
                                    keyboardType="numeric"
                                    maxLength={4}
                                    value={newRoomPin}
                                    onChangeText={setNewRoomPin}
                                    secureTextEntry
                                />
                            </View>
                        )}

                        <TouchableOpacity style={styles.submitBtnContainer} activeOpacity={0.8} onPress={handleCreateRoomSubmit} disabled={isCreating}>
                            <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtnGradient}>
                                {isCreating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Start Hosting</Text>}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#0A0A0C' },

    // --- DESKTOP STYLES ---
    desktopContainer: { flex: 1, flexDirection: 'row', padding: 50, gap: 60, maxWidth: 1400, alignSelf: 'center', width: '100%' },
    desktopLeftCol: { width: 380, flexShrink: 0 },
    desktopRightCol: { flex: 1 },

    desktopHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 40 },
    desktopBackBtn: { width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 16, cursor: 'pointer' },
    desktopHeaderTitle: { color: '#FFF', fontSize: 30, fontWeight: '900', letterSpacing: 0.5 },

    desktopSectionTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },

    desktopCard: { backgroundColor: '#16161A', borderRadius: 16, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)' },
    desktopCardTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 16 },

    desktopJoinInput: { flex: 1, backgroundColor: '#0A0A0C', color: '#FFF', borderRadius: 12, paddingHorizontal: 16, height: 48, fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', letterSpacing: 2, outlineStyle: 'none' },
    desktopJoinBtn: { borderRadius: 12, overflow: 'hidden', width: 90, height: 48, cursor: 'pointer' },

    desktopCreateBtn: { marginTop: 24, borderRadius: 12, overflow: 'hidden', cursor: 'pointer' },
    desktopCreateGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52 },
    desktopCreateBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },

    desktopRoomCard: { flex: 1, backgroundColor: '#16161A', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)', cursor: 'pointer' },

    desktopEmptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 400 },
    desktopEmptyText: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginTop: 20 },
    desktopEmptySubText: { color: '#8F98A0', fontSize: 15, marginTop: 8 },

    desktopModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
    desktopModalContainer: { width: 450, backgroundColor: '#17171C', borderRadius: 24, padding: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20 },

    // --- SHARED & MOBILE STYLES ---
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    backBtn: { padding: 4 },
    headerTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 },
    joinSection: { padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    sectionTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
    joinRow: { flexDirection: 'row', gap: 12 },
    joinInput: { flex: 1, backgroundColor: '#17171C', color: '#FFF', borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', letterSpacing: 2, outlineStyle: 'none' },
    joinBtn: { borderRadius: 12, overflow: 'hidden', width: 90, cursor: 'pointer' },
    joinBtnDisabled: { opacity: 0.8 },
    joinGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    joinBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    listContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
    listHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    roomCard: { backgroundColor: '#17171C', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
    roomName: { color: '#FFF', fontSize: 18, fontWeight: 'bold', flex: 1, marginRight: 10 },
    badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 229, 255, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)' },
    badgeText: { color: '#00E5FF', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
    hostName: { color: '#8F98A0', fontSize: 13, marginBottom: 16 },
    videoInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0A0A0C', padding: 10, borderRadius: 10 },
    videoTitle: { color: '#E0E0E0', fontSize: 13, marginLeft: 8, flex: 1 },
    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
    emptyText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginTop: 16 },
    emptySubText: { color: '#8F98A0', fontSize: 14, marginTop: 8, lineHeight: 20 },
    fab: { position: 'absolute', bottom: 30, right: 30, width: 64, height: 64, borderRadius: 32, elevation: 8, shadowColor: '#FF007A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
    fabGradient: { flex: 1, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
    modalContainer: { backgroundColor: '#17171C', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderBottomWidth: 0 },
    modalCloseBtn: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 8, cursor: 'pointer' },
    modalTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginBottom: 24 },
    inputLabel: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
    inputSub: { color: '#8F98A0', fontSize: 12, marginTop: -4 },
    modalInput: { backgroundColor: '#0A0A0C', color: '#FFF', borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 20, outlineStyle: 'none' },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, backgroundColor: '#0A0A0C', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    pinSection: { marginBottom: 10 },
    submitBtnContainer: { borderRadius: 12, overflow: 'hidden', marginTop: 10, marginBottom: 20, cursor: 'pointer' },
    submitBtnGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
    submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});