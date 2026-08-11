import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

// ✅ FIXED IMPORT FOR EXPO SDK
import { ThemeProvider, DarkTheme } from 'expo-router/react-navigation';

// --- GLOBAL AUTH STORE ---
import { useAuthStore } from '../store/useAuthStore';

const toastConfig = {
  hotstarSuccess: ({ text1 }) => (
    <View style={styles.toastWrapper}>
      <LinearGradient
        colors={['#1F80E0', '#D63484']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.toastContainer}
      >
        <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
        <Text style={styles.toastText}>{text1}</Text>
      </LinearGradient>
    </View>
  ),
  hotstarInfo: ({ text1 }) => (
    <View style={styles.toastWrapper}>
      <LinearGradient
        colors={['#1F80E0', '#D63484']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.toastContainer}
      >
        <Ionicons name="information-circle" size={20} color="#FFFFFF" />
        <Text style={styles.toastText}>{text1}</Text>
      </LinearGradient>
    </View>
  ),
  // --- NEW: HOTSTAR ERROR TOAST ---
  hotstarError: ({ text1 }) => (
    <View style={styles.toastWrapper}>
      <LinearGradient
        colors={['#E53935', '#990000']} // Premium Red Gradient
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.toastContainer}
      >
        <Ionicons name="alert-circle" size={20} color="#FFFFFF" />
        <Text style={styles.toastText}>{text1}</Text>
      </LinearGradient>
    </View>
  )
};

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Grab restoreSession from your global Zustand store
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    const checkUserAuth = async () => {
      try {
        const token = await SecureStore.getItemAsync('userToken');
        if (token) {
          // ✅ CRITICAL FIX: Populate global store with token so the whole app knows you're logged in
          restoreSession(token, { email: 'User' });
          router.replace('/tabs/home');
        }
      } catch (error) {
        console.error('Error checking authentication state:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkUserAuth();
  }, []);

  if (isLoading) {
    return (
      <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1F80E0" />
      </LinearGradient>
    );
  }

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0A0A0C' },
        }}
      />
      <Toast config={toastConfig} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastWrapper: {
    width: '100%',
    alignItems: 'flex-end',
    paddingRight: 20,
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  toastText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 14,
  },
});