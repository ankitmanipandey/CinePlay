import { create } from 'zustand';
import { io } from 'socket.io-client';
import * as Notifications from 'expo-notifications'; // <-- IMPORT ADDED

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

export const useGlobalSocket = create((set, get) => ({
    globalSocket: null,
    activeChatId: null,

    // Global Notification Count State
    unreadNotifsCount: 0,

    // --- UPDATED: These now sync with the Device App Icon Badge ---
    setUnreadNotifsCount: (count) => {
        set({ unreadNotifsCount: count });
        Notifications.setBadgeCountAsync(count); // Sync with OS App Icon
    },
    incrementNotifs: () => {
        set((state) => {
            const newCount = state.unreadNotifsCount + 1;
            Notifications.setBadgeCountAsync(newCount); // Sync with OS App Icon
            return { unreadNotifsCount: newCount };
        });
    },
    clearNotifs: () => {
        set({ unreadNotifsCount: 0 });
        Notifications.setBadgeCountAsync(0); // Clear OS App Icon Badge
    },
    // --------------------------------------------------------------

    setActiveChat: (id) => set({ activeChatId: id }),

    connectGlobalSocket: (userId) => {
        if (!userId || get().globalSocket) return;

        const SOCKET_URL = BACKEND_URL.replace(/\/api\/?$/, '');
        const socket = io(`${SOCKET_URL}/global`);

        socket.on('connect', () => {
            socket.emit('register_user', userId);
        });

        // 1. Listen for rejections
        socket.on('request_rejected', (alert) => {
            get().incrementNotifs();
            import('react-native-toast-message').then(({ default: Toast }) => {
                Toast.show({
                    type: 'hotstarError',
                    text1: 'Cinerequest Rejected',
                    text2: alert.message,
                    position: 'top',
                    visibilityTime: 4000
                });
            });
        });

        // 2. Listen for Invites, Requests, and Acceptances
        socket.on('new_notification', (notification) => {
            get().incrementNotifs();
            import('react-native-toast-message').then(({ default: Toast }) => {
                let title = '👋 New Notification!';
                let toastType = 'hotstarInfo';

                if (notification.type === 'THEATRE_INVITE') {
                    title = '🎬 Theatre Invite!';
                } else if (notification.type === 'CINEREQUEST') {
                    title = '👋 New Cinerequest!';
                } else if (notification.type === 'ACCEPTED_ALERT') {
                    title = '🎉 Cinerequest Accepted!';
                    toastType = 'hotstarSuccess';
                }

                Toast.show({
                    type: toastType,
                    text1: title,
                    text2: notification.message,
                    position: 'top',
                    visibilityTime: 4000
                });
            });
        });

        // 3. Direct Message Toasts
        socket.on('receive_direct_message', (msg) => {
            if (get().activeChatId !== msg.sender) {
                import('react-native-toast-message').then(({ default: Toast }) => {
                    Toast.show({
                        type: 'hotstarInfo',
                        text1: `💬 ${msg.senderName || 'New Message'}`,
                        text2: msg.text,
                        position: 'top',
                        visibilityTime: 4000
                    });
                });
            }
        });

        set({ globalSocket: socket });
    },

    disconnectGlobalSocket: () => {
        const { globalSocket } = get();
        if (globalSocket) {
            globalSocket.disconnect();
            set({ globalSocket: null, activeChatId: null, unreadNotifsCount: 0 });
            Notifications.setBadgeCountAsync(0); // Clear badge on logout
        }
    }
}));