import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { useGlobalSocket } from '../store/useGlobalSocket';
import { useAuthStore } from '../store/useAuthStore';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

export const useNotificationsLogic = () => {
    const router = useRouter();
    const { token, user } = useAuthStore();
    const { globalSocket, clearNotifs } = useGlobalSocket();

    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isClearModalVisible, setIsClearModalVisible] = useState(false);

    useEffect(() => {
        fetchNotifications();
        markAsRead();

        if (globalSocket) {
            const handleNewNotification = (newNotif) => {
                setNotifications(prev => [{ ...newNotif, isRead: true }, ...prev]);
                clearNotifs();
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

    const markAsRead = async () => {
        try {
            await axios.put(`${BACKEND_URL}/buddies/notifications/read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            clearNotifs();
        } catch (e) {
            console.log("Failed to mark as read", e);
        }
    };

    const confirmClearAll = async () => {
        try {
            await axios.delete(`${BACKEND_URL}/buddies/notifications/clear`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications([]);
            clearNotifs();
            setIsClearModalVisible(false);
            Toast.show({ type: 'hotstarSuccess', text1: 'All notifications cleared' });
        } catch (error) {
            Toast.show({ type: 'hotstarError', text1: 'Failed to clear notifications' });
            setIsClearModalVisible(false);
        }
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

    return {
        notifications, isLoading, isClearModalVisible, setIsClearModalVisible,
        confirmClearAll, handleAction, joinTheatreRoom, router
    };
};