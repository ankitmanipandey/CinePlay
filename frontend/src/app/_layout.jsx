import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated, Dimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import { ThemeProvider, DarkTheme } from 'expo-router/react-navigation';

// --- GLOBAL AUTH STORE ---
import { useAuthStore } from '../store/useAuthStore';

// Get screen width to calculate the starting position off-screen to the right
const { width } = Dimensions.get('window');

// --- NEW: REUSABLE ANIMATED TOAST COMPONENT ---
const AnimatedToast = ({ text1, colors, iconName }) => {
  // Start the toast completely off-screen to the right
  const slideAnim = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    // Spring animation slides it in from Right to Left
    Animated.spring(slideAnim, {
      toValue: 0, // Target position (original position)
      useNativeDriver: true,
      friction: 8,  // Adjust for bounciness
      tension: 60,  // Adjust for speed
    }).start();
  }, [slideAnim]);

  return (
    <Animated.View style={[styles.toastWrapper, { transform: [{ translateX: slideAnim }] }]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.toastContainer}
      >
        <Ionicons name={iconName} size={20} color="#FFFFFF" />
        <Text style={styles.toastText}>{text1}</Text>
      </LinearGradient>
    </Animated.View>
  );
};

// --- TOAST CONFIG ---
const toastConfig = {
  hotstarSuccess: ({ text1 }) => (
    <AnimatedToast text1={text1} colors={['#1F80E0', '#D63484']} iconName="checkmark-circle" />
  ),
  hotstarInfo: ({ text1 }) => (
    <AnimatedToast text1={text1} colors={['#1F80E0', '#D63484']} iconName="information-circle" />
  ),
  hotstarError: ({ text1 }) => (
    <AnimatedToast text1={text1} colors={['#E53935', '#990000']} iconName="alert-circle" />
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
        const userDataString = await SecureStore.getItemAsync('userData'); // <-- Fetch saved user data

        if (token) {
          // Parse the saved data, or fallback if it somehow doesn't exist
          const userData = userDataString ? JSON.parse(userDataString) : { email: 'User', name: 'User' };

          restoreSession(token, userData);
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
      {/* Set topOffset so it clears the status bar cleanly on the top right */}
      <Toast config={toastConfig} position="top" topOffset={50} />
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
    alignItems: 'flex-end', // This ensures it hugs the right side of the screen
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