import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { useGlobalSocket } from '../store/useGlobalSocket';
import { useAuthStore } from '../store/useAuthStore';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

export default function NotificationsScreen() {
    const router = useRouter();
    const { token, user } = useAuthStore();
    const { globalSocket } = useGlobalSocket();

    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchNotifications();

        // Listen for new notifications in real-time
        if (globalSocket) {
            const handleNewNotification = (newNotif) => {
                // Prepend the new notification to the top of the list
                setNotifications(prev => [newNotif, ...prev]);
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

    const handleAction = async (action, notificationId, senderId) => {
        try {
            await axios.post(`${BACKEND_URL}/buddies/${action}`,
                { notificationId, senderId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            Toast.show({
                type: 'hotstarSuccess',
                text1: `Request ${action === 'accept' ? 'Accepted' : 'Rejected'}`
            });

            // Remove from UI
            setNotifications(prev => prev.filter(n => n._id !== notificationId));
        } catch (error) {
            Toast.show({ type: 'hotstarError', text1: 'Action failed. Try again.' });
        }
    };


    const joinTheatreRoom = async (roomId, notificationId) => {
        // Clear the notification from DB (optional, keeps UI clean)
        try {
            await axios.post(`${BACKEND_URL}/buddies/reject`,
                { notificationId, senderId: user._id }, // Using reject logic just to delete it silently
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (e) { }

        // Go to the room!
        router.push(`/theatre?roomId=${roomId}&isHost=false`);
    };

    const renderNotification = ({ item }) => {
        const isRequest = item.type === 'CINEREQUEST';
        const isInvite = item.type === 'THEATRE_INVITE';
        const senderName = item.senderId?.name || 'Someone';

        // 🚨 FAULT TOLERANCE: Safely extract ID even if population failed
        const safeSenderId = typeof item.senderId === 'object' ? item.senderId._id : item.senderId;

        return (
            <View style={styles.notificationCard}>
                <View style={styles.iconContainer}>
                    <Ionicons
                        name={isRequest ? "person-add" : (isInvite ? "play-circle" : "information-circle")}
                        size={24}
                        color={isRequest ? "#00E5FF" : (isInvite ? "#9B51E0" : "#FF007A")}
                    />
                </View>

                <View style={styles.contentContainer}>
                    <Text style={styles.messageText}>{item.message}</Text>
                    <Text style={styles.timeText}>
                        {new Date(item.createdAt).toLocaleDateString()}
                    </Text>

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
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
            </View>

            {isLoading ? (
                <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={item => item._id}
                    renderItem={renderNotification}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No new notifications.</Text>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0A0C' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    backButton: { marginRight: 16 },
    headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
    listContent: { padding: 16 },
    notificationCard: { flexDirection: 'row', backgroundColor: '#17171C', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    iconContainer: { marginRight: 16, justifyContent: 'center' },
    contentContainer: { flex: 1 },
    messageText: { color: '#FFFFFF', fontSize: 15, fontWeight: '500', marginBottom: 4 },
    timeText: { color: '#8F98A0', fontSize: 12, marginBottom: 12 },
    actionButtons: { flexDirection: 'row', gap: 10 },
    btn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', flex: 1 },
    acceptBtn: { backgroundColor: 'rgba(0, 229, 255, 0.15)', borderWidth: 1, borderColor: '#00E5FF' },
    rejectBtn: { backgroundColor: 'rgba(229, 57, 53, 0.1)', borderWidth: 1, borderColor: '#E53935' },
    btnText: { color: '#00E5FF', fontWeight: 'bold', fontSize: 14 },
    emptyText: { color: '#8F98A0', textAlign: 'center', marginTop: 40, fontSize: 15 }
});