import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

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

        // Save token AND user data to secure storage
        await SecureStore.setItemAsync('userToken', token);
        await SecureStore.setItemAsync('userData', JSON.stringify(userData));

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
        await SecureStore.deleteItemAsync('userData');
        set({ user: null, token: null });
    }
}));