import { create } from 'zustand';
import { io } from 'socket.io-client';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native'; // <-- NEW IMPORT

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

// Helper to safely set badges only on iOS/Android
const setSafeBadgeCount = (count) => {
    if (Platform.OS !== 'web') {
        Notifications.setBadgeCountAsync(count).catch(() => { });
    }
};

export const useGlobalSocket = create((set, get) => ({
    globalSocket: null,
    activeChatId: null,
    unreadNotifsCount: 0,

    setUnreadNotifsCount: (count) => {
        set({ unreadNotifsCount: count });
        setSafeBadgeCount(count);
    },
    incrementNotifs: () => {
        // Removed side-effect from inside the set() function per React best practices
        const newCount = get().unreadNotifsCount + 1;
        set({ unreadNotifsCount: newCount });
        setSafeBadgeCount(newCount);
    },
    clearNotifs: () => {
        set({ unreadNotifsCount: 0 });
        setSafeBadgeCount(0);
    },

    setActiveChat: (id) => set({ activeChatId: id }),

    connectGlobalSocket: (userId, token) => {
        if (!userId || !token || get().globalSocket) return;

        const SOCKET_URL = BACKEND_URL.replace(/\/api\/?$/, '');

        const socket = io(`${SOCKET_URL}/global`, {
            auth: { token }
        });

        socket.on('connect', () => {
            console.log('Global socket connected via JWT');
        });

        // <-- NEW: Handle JWT Expiration 
        socket.on('connect_error', (err) => {
            if (err.message === 'Not authorized') {
                console.error('Socket auth failed: Token expired or invalid.');
                // Optional: You can trigger your auth store's logout function here
                // useAuthStore.getState().logout(); 
            }
        });

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

        socket.on('receive_direct_message', (msg) => {
            // Echo fix: Don't toast if WE are the ones who just sent the message!
            if (get().activeChatId !== msg.sender && msg.sender !== userId) {
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
            setSafeBadgeCount(0);
        }
    }
}));