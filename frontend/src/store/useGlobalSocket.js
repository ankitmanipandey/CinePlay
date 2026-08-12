import { create } from 'zustand';
import { io } from 'socket.io-client';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

export const useGlobalSocket = create((set, get) => ({
    globalSocket: null,

    connectGlobalSocket: (userId) => {
        if (!userId || get().globalSocket) return;

        // Strip /api from the base URL so it connects directly to /global
        const SOCKET_URL = BACKEND_URL.replace(/\/api\/?$/, '');
        const socket = io(`${SOCKET_URL}/global`);

        socket.on('connect', () => {
            socket.emit('register_user', userId);
        });

        // 1. Listen for rejections
        socket.on('request_rejected', (alert) => {
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

        // 2. Listen for Invites & Requests
        socket.on('new_notification', (notification) => {
            import('react-native-toast-message').then(({ default: Toast }) => {
                Toast.show({
                    type: 'hotstarInfo',
                    text1: notification.type === 'THEATRE_INVITE' ? '🎬 Theatre Invite!' : '👋 New Cinerequest!',
                    text2: notification.message,
                    position: 'top',
                    visibilityTime: 4000
                });
            });
        });

        set({ globalSocket: socket });
    },

    disconnectGlobalSocket: () => {
        const { globalSocket } = get();
        if (globalSocket) {
            globalSocket.disconnect();
            set({ globalSocket: null });
        }
    }
}));