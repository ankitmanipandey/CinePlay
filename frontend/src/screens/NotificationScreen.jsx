import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { useGlobalSocket } from '../store/useGlobalSocket';
import { useAuthStore } from '../store/useAuthStore';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

export default function NotificationsScreen() {
    const router = useRouter();
    const { token, user } = useAuthStore();
    const { globalSocket, clearNotifs } = useGlobalSocket();

    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchNotifications();
        markAsRead(); // Auto-read instantly when screen opens

        if (globalSocket) {
            const handleNewNotification = (newNotif) => {
                setNotifications(prev => [{ ...newNotif, isRead: true }, ...prev]); // Force visually read if staring at screen
                clearNotifs(); // Keep badge at 0 while actively viewing screen
            };

            globalSocket.on('new_notification', handleNewNotification);
            globalSocket.on('request_rejected', handleNewNotification);

            return () => {
                globalSocket.off('new_notification', handleNewNotification);
                globalSocket.off('request_rejected', handleNewNotification);
            };
        }
    }, [globalSocket]);

    const fetchNotifications = async () => {
        try {
            const res = await axios.get(`${BACKEND_URL}/buddies/notifications`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(res.data);
        } catch (error) {
            Toast.show({ type: 'hotstarError', text1: 'Failed to load notifications' });
        } finally {
            setIsLoading(false);
        }
    };

    // Auto mark as read
    const markAsRead = async () => {
        try {
            await axios.put(`${BACKEND_URL}/buddies/notifications/read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            clearNotifs(); // Reset global dot/badge to 0
        } catch (e) {
            console.log("Failed to mark as read", e);
        }
    };

    // Clear all from DB
    const handleClearAll = () => {
        Alert.alert(
            "Clear Notifications",
            "Are you sure you want to delete all notifications? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear All",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await axios.delete(`${BACKEND_URL}/buddies/notifications/clear`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            setNotifications([]);
                            clearNotifs();
                        } catch (error) {
                            Toast.show({ type: 'hotstarError', text1: 'Failed to clear notifications' });
                        }
                    }
                }
            ]
        );
    };

    const handleAction = async (action, notificationId, senderId) => {
        try {
            await axios.post(`${BACKEND_URL}/buddies/${action}`,
                { notificationId, senderId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            Toast.show({ type: 'hotstarSuccess', text1: `Request ${action === 'accept' ? 'Accepted' : 'Rejected'}` });
            setNotifications(prev => prev.filter(n => n._id !== notificationId));
        } catch (error) {
            Toast.show({ type: 'hotstarError', text1: 'Action failed. Try again.' });
        }
    };

    const joinTheatreRoom = async (roomId, notificationId) => {
        try {
            await axios.post(`${BACKEND_URL}/buddies/reject`,
                { notificationId, senderId: user._id },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (e) { }
        router.push(`/theatre?roomId=${roomId}&isHost=false`);
    };

    const renderNotification = ({ item }) => {
        const isRequest = item.type === 'CINEREQUEST';
        const isInvite = item.type === 'THEATRE_INVITE';
        const safeSenderId = typeof item.senderId === 'object' ? item.senderId._id : item.senderId;

        // Visual distinction for unread vs read (subtle background change)
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
                    <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0A0C' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    backButton: { marginRight: 16 },
    headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
    clearBtn: { padding: 4 },
    listContent: { padding: 16 },
    notificationCard: { flexDirection: 'row', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, position: 'relative' },
    unreadDot: { position: 'absolute', top: 16, right: 16, width: 8, height: 8, borderRadius: 4, backgroundColor: '#00E5FF' },
    iconContainer: { marginRight: 16, justifyContent: 'center' },
    contentContainer: { flex: 1, paddingRight: 10 },
    messageText: { color: '#FFFFFF', fontSize: 15, fontWeight: '500', marginBottom: 4 },
    timeText: { color: '#8F98A0', fontSize: 12, marginBottom: 12 },
    actionButtons: { flexDirection: 'row', gap: 10 },
    btn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', flex: 1 },
    acceptBtn: { backgroundColor: 'rgba(0, 229, 255, 0.15)', borderWidth: 1, borderColor: '#00E5FF' },
    rejectBtn: { backgroundColor: 'rgba(229, 57, 53, 0.1)', borderWidth: 1, borderColor: '#E53935' },
    btnText: { color: '#00E5FF', fontWeight: 'bold', fontSize: 14 },
    emptyText: { color: '#8F98A0', textAlign: 'center', marginTop: 40, fontSize: 15 }
});