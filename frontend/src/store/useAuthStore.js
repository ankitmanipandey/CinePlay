import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native'; // <-- IMPORT PLATFORM

export const useAuthStore = create((set) => ({
    user: null,
    token: null,

    // Call this after a successful login/register API call
    setSession: async (token, userDataFromBackend) => {
        // userDataFromBackend contains: { _id, name, email, profilePicture }
        const userData = {
            _id: userDataFromBackend._id,
            email: userDataFromBackend.email,
            name: userDataFromBackend.name,
            profilePicture: userDataFromBackend.profilePicture
        };

        // <-- PLATFORM GUARD ADDED HERE -->
        if (Platform.OS === 'web') {
            localStorage.setItem('userToken', token);
            localStorage.setItem('userData', JSON.stringify(userData));
        } else {
            // Save token AND user data to secure storage on mobile
            await SecureStore.setItemAsync('userToken', token);
            await SecureStore.setItemAsync('userData', JSON.stringify(userData));
        }

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
        // <-- PLATFORM GUARD ADDED HERE -->
        if (Platform.OS === 'web') {
            localStorage.removeItem('userToken');
            localStorage.removeItem('userData');
        } else {
            await SecureStore.deleteItemAsync('userToken');
            await SecureStore.deleteItemAsync('userData');
        }

        set({ user: null, token: null });
    }
}));