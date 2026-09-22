import { useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import Toast from 'react-native-toast-message';

import { useAuthStore } from '../store/useAuthStore';
import { useGlobalSocket } from '../store/useGlobalSocket';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

export const useProfileLogic = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, token, logout } = useAuthStore();
    const { globalSocket, unreadNotifsCount, setUnreadNotifsCount } = useGlobalSocket();

    const isLoggedIn = !!token;

    const [isTheatreModalVisible, setIsTheatreModalVisible] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [unreadChatCount, setUnreadChatCount] = useState(0);

    const exactName = user?.name || (user?.email ? user.email.split('@')[0] : 'User');
    const displayInitial = exactName.charAt(0).toUpperCase();

    // Dynamically calculate the custom tab bar height
    const TAB_BAR_HEIGHT = (Platform.OS === 'ios' ? 88 : 65) + insets.bottom;

    useFocusEffect(
        useCallback(() => {
            if (isLoggedIn) {
                const fetchCounts = async () => {
                    try {
                        const [notifRes, chatRes] = await Promise.all([
                            axios.get(`${BACKEND_URL}/buddies/notifications`, { headers: { Authorization: `Bearer ${token}` } }),
                            axios.get(`${BACKEND_URL}/chat/unread-count`, { headers: { Authorization: `Bearer ${token}` } })
                        ]);
                        const unread = notifRes.data.filter(n => !n.isRead).length;
                        setUnreadNotifsCount(unread);
                        setUnreadChatCount(chatRes.data.count);
                    } catch (error) {
                        console.log('Failed to fetch counts');
                    }
                };
                fetchCounts();
            }
        }, [isLoggedIn, token, setUnreadNotifsCount])
    );

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
            Toast.show({ type: 'hotstarInfo', text1: 'Log in to use this feature', topOffset: insets.top > 0 ? insets.top + 10 : 50 });
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

    const openTheatreModal = () => {
        if (!isLoggedIn) {
            Toast.show({ type: 'hotstarInfo', text1: 'Log in to use this feature', topOffset: insets.top > 0 ? insets.top + 10 : 50 });
            return;
        }
        router.push('/theatre-lobby');
    };

    const handleCreateRoom = () => {
        setIsTheatreModalVisible(false);
        router.push(`/theatre?roomId=${Math.floor(10000 + Math.random() * 90000).toString()}&isHost=true`);
    };

    const handleJoinRoom = () => {
        if (joinCode.length === 5) {
            setIsTheatreModalVisible(false);
            router.push(`/theatre?roomId=${joinCode}&isHost=false`);
        } else {
            Toast.show({ type: 'error', text1: 'Please enter a valid 5-digit code' });
        }
    };

    return {
        isLoggedIn, exactName, displayInitial, user,
        isTheatreModalVisible, setIsTheatreModalVisible,
        joinCode, setJoinCode, isLoggingOut,
        unreadNotifsCount, unreadChatCount, TAB_BAR_HEIGHT,
        handleProtectedNavigation, handleLogout, openTheatreModal, handleCreateRoom, handleJoinRoom, router
    };
};