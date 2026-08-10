import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export const useAuthStore = create((set) => ({
    user: null,
    token: null,

    // Call this after a successful login/register API call
    setSession: async (token, email, providedName = null) => {
        // Fallback to email prefix if name is not provided
        const displayName = providedName || email.split('@')[0];

        const userData = { email, name: displayName };

        // Save token to secure storage
        await SecureStore.setItemAsync('userToken', token);

        set({
            token: token,
            user: userData
        });
    },

    // Call this on app load to restore session
    restoreSession: async (token, userData) => {
        set({ token, user: userData });
    },

    logout: async () => {
        await SecureStore.deleteItemAsync('userToken');
        set({ user: null, token: null });
    }
}));