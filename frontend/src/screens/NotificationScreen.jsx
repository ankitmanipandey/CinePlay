import React from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Modal, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationsLogic } from '../hooks/useNotificationsLogic';

export default function NotificationsScreenWeb() {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 1024;

    const {
        notifications, isLoading, isClearModalVisible, setIsClearModalVisible,
        confirmClearAll, handleAction, joinTheatreRoom, router
    } = useNotificationsLogic();

    const renderNotification = ({ item }) => {
        const isRequest = item.type === 'CINEREQUEST';
        const isInvite = item.type === 'THEATRE_INVITE';
        const safeSenderId = typeof item.senderId === 'object' ? item.senderId._id : item.senderId;

        const bgColor = item.isRead ? '#17171C' : 'rgba(0, 229, 255, 0.05)';
        const borderColor = item.isRead ? 'rgba(255,255,255,0.05)' : 'rgba(0, 229, 255, 0.2)';

        return (
            <View style={[styles.notificationCard, { backgroundColor: bgColor, borderColor: borderColor }]}>
                <View style={styles.iconContainer}>
                    <Ionicons
                        name={isRequest ? "person-add" : (isInvite ? "play-circle" : "information-circle")}
                        size={24}
                        color={isRequest ? "#00E5FF" : (isInvite ? "#9B51E0" : "#FF007A")}
                    />
                </View>

                <View style={styles.contentContainer}>
                    <Text style={styles.messageText}>{item.message}</Text>
                    <Text style={styles.timeText}>{new Date(item.createdAt).toLocaleDateString()}</Text>

                    {isRequest && (
                        <View style={styles.actionButtons}>
                            <TouchableOpacity style={[styles.btn, styles.acceptBtn]} onPress={() => handleAction('accept', item._id, safeSenderId)}>
                                <Text style={styles.btnText}>Accept</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btn, styles.rejectBtn]} onPress={() => handleAction('reject', item._id, safeSenderId)}>
                                <Text style={[styles.btnText, { color: '#E53935' }]}>Reject</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {isInvite && (
                        <View style={styles.actionButtons}>
                            <TouchableOpacity style={[styles.btn, styles.acceptBtn, { borderColor: '#9B51E0', backgroundColor: 'rgba(155, 81, 224, 0.15)' }]} onPress={() => joinTheatreRoom(item.roomId, item._id)}>
                                <Text style={[styles.btnText, { color: '#9B51E0' }]}>Join Room</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
                {!item.isRead && <View style={styles.unreadDot} />}
            </View>
        );
    };

    // --------------------------------------------------------
    // DESKTOP LAYOUT (Centered Feed)
    // --------------------------------------------------------
    if (isDesktop) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.desktopContentWrapper}>
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>Notifications</Text>
                        </View>
                        {notifications.length > 0 && (
                            <TouchableOpacity onPress={() => setIsClearModalVisible(true)} style={styles.clearBtnDesktop}>
                                <Ionicons name="trash-outline" size={22} color="#E53935" />
                                <Text style={styles.clearBtnText}>Clear All</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {isLoading ? (
                        <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 50 }} />
                    ) : (
                        <FlatList
                            data={notifications}
                            keyExtractor={item => item._id}
                            renderItem={renderNotification}
                            contentContainerStyle={styles.listContentDesktop}
                            ListEmptyComponent={<Text style={styles.emptyText}>No new notifications.</Text>}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </View>

                {/* MODAL (Same for both) */}
                <ClearModal isVisible={isClearModalVisible} onClose={() => setIsClearModalVisible(false)} onConfirm={confirmClearAll} />
            </SafeAreaView>
        );
    }

    // --------------------------------------------------------
    // MOBILE & TABLET LAYOUT (Exact Native Clone)
    // --------------------------------------------------------
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Notifications</Text>
                </View>
                {notifications.length > 0 && (
                    <TouchableOpacity onPress={() => setIsClearModalVisible(true)} style={styles.clearBtn}>
                        <Ionicons name="trash-outline" size={22} color="#E53935" />
                    </TouchableOpacity>
                )}
            </View>

            {isLoading ? (
                <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={item => item._id}
                    renderItem={renderNotification}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={<Text style={styles.emptyText}>No new notifications.</Text>}
                />
            )}

            <ClearModal isVisible={isClearModalVisible} onClose={() => setIsClearModalVisible(false)} onConfirm={confirmClearAll} />
        </SafeAreaView>
    );
}

// Extracted Modal for clean reuse
const ClearModal = ({ isVisible, onClose, onConfirm }) => (
    <Modal visible={isVisible} transparent={true} animationType="fade" onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
                <View style={styles.modalIconWrapper}>
                    <Ionicons name="trash" size={32} color="#E53935" />
                </View>
                <Text style={styles.modalTitle}>Clear Notifications</Text>
                <Text style={styles.modalMessage}>Are you sure you want to delete all notifications? This action cannot be undone.</Text>
                <View style={styles.modalActionRow}>
                    <TouchableOpacity style={[styles.modalBtn, styles.modalCancelBtn]} onPress={onClose} activeOpacity={0.7}>
                        <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, styles.modalConfirmBtn]} onPress={onConfirm} activeOpacity={0.7}>
                        <Text style={styles.modalConfirmText}>Clear All</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    </Modal>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0A0C' },

    // --- DESKTOP STYLES ---
    desktopContentWrapper: { flex: 1, width: '100%', maxWidth: 700, alignSelf: 'center' }, // Centers the feed on large screens
    clearBtnDesktop: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, backgroundColor: 'rgba(229, 57, 53, 0.1)', borderRadius: 8, cursor: 'pointer' },
    clearBtnText: { color: '#E53935', fontWeight: 'bold', fontSize: 14 },
    listContentDesktop: { padding: 24, paddingBottom: 60 },

    // --- SHARED / MOBILE STYLES ---
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    backButton: { marginRight: 16, cursor: 'pointer' },
    headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
    clearBtn: { padding: 4, cursor: 'pointer' },
    listContent: { padding: 16 },

    notificationCard: { flexDirection: 'row', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, position: 'relative' },
    unreadDot: { position: 'absolute', top: 16, right: 16, width: 8, height: 8, borderRadius: 4, backgroundColor: '#00E5FF' },
    iconContainer: { marginRight: 16, justifyContent: 'center' },
    contentContainer: { flex: 1, paddingRight: 10 },
    messageText: { color: '#FFFFFF', fontSize: 15, fontWeight: '500', marginBottom: 4 },
    timeText: { color: '#8F98A0', fontSize: 12, marginBottom: 12 },

    actionButtons: { flexDirection: 'row', gap: 10 },
    btn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', flex: 1, cursor: 'pointer' },
    acceptBtn: { backgroundColor: 'rgba(0, 229, 255, 0.15)', borderWidth: 1, borderColor: '#00E5FF' },
    rejectBtn: { backgroundColor: 'rgba(229, 57, 53, 0.1)', borderWidth: 1, borderColor: '#E53935' },
    btnText: { color: '#00E5FF', fontWeight: 'bold', fontSize: 14 },
    emptyText: { color: '#8F98A0', textAlign: 'center', marginTop: 40, fontSize: 15 },

    // --- MODAL STYLES ---
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalContainer: { width: '100%', maxWidth: 400, backgroundColor: '#17171C', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20 },
    modalIconWrapper: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(229, 57, 53, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    modalTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
    modalMessage: { color: '#8F98A0', fontSize: 15, textAlign: 'center', marginBottom: 28, lineHeight: 22 },
    modalActionRow: { flexDirection: 'row', width: '100%', gap: 12 },
    modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    modalCancelBtn: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    modalConfirmBtn: { backgroundColor: 'rgba(229, 57, 53, 0.15)', borderWidth: 1, borderColor: '#E53935' },
    modalCancelText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    modalConfirmText: { color: '#E53935', fontSize: 16, fontWeight: 'bold' },
});