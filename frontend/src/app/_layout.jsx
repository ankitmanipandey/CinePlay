import * as Device from 'expo-device';

import * as Notifications from 'expo-notifications';

import Constants from 'expo-constants';

import axios from 'axios';

import React, { useEffect, useState, useRef } from 'react';

import { View, Text, StyleSheet, ActivityIndicator, Animated, Dimensions, Platform, PermissionsAndroid, Linking } from 'react-native';

import { Stack, useRouter } from 'expo-router';

import Toast from 'react-native-toast-message';

import { LinearGradient } from 'expo-linear-gradient';

import { Ionicons } from '@expo/vector-icons';

import * as SecureStore from 'expo-secure-store';



import { ThemeProvider, DarkTheme } from 'expo-router/react-navigation';



// --- GLOBAL STORES ---

import { useAuthStore } from '../store/useAuthStore';

import { useGlobalSocket } from '../store/useGlobalSocket';



// Get screen width to calculate the starting position off-screen to the right

const { width } = Dimensions.get('window');



// --- PUSH NOTIFICATION CONFIGURATION ---

Notifications.setNotificationHandler({

  handleNotification: async () => ({

    shouldShowAlert: true,

    shouldPlaySound: true,

    shouldSetBadge: true,

  }),

});



// Helper function to ask permissions and generate the token

async function registerForPushNotificationsAsync() {
  let token;



  if (Platform.OS === 'android') {
    if (Platform.Version >= 33) {
      const currentStatus = await PermissionsAndroid.check(

        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS

      );



      if (!currentStatus) {
        const granted = await PermissionsAndroid.request(

          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS

        );



        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Toast.show({

            type: 'hotstarInfo',

            text1: 'Notifications are off',

            text2: 'Tap here to enable them in Settings.',

            onPress: () => Linking.openSettings()

          });

          return null;

        }

      }

    }



    await Notifications.setNotificationChannelAsync('default', {

      name: 'default',

      importance: Notifications.AndroidImportance.MAX,

      vibrationPattern: [0, 250, 250, 250],

      lightColor: '#FF007A',

    });

  }



  if (Device.isDevice) {

    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;



    if (existingStatus !== 'granted') {

      const { status } = await Notifications.requestPermissionsAsync();

      finalStatus = status;

    }



    if (finalStatus !== 'granted') {

      return null;

    }



    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  }



  return token;

}



// --- REUSABLE ANIMATED TOAST COMPONENT ---

const AnimatedToast = ({ text1, text2, colors, iconName, onPress }) => {

  const slideAnim = useRef(new Animated.Value(width)).current;



  useEffect(() => {

    Animated.spring(slideAnim, {

      toValue: 0,

      useNativeDriver: true,

      friction: 8,

      tension: 60,

    }).start();

  }, [slideAnim]);



  return (

    <Animated.View style={[styles.toastWrapper, { transform: [{ translateX: slideAnim }] }]}>

      <LinearGradient

        colors={colors}

        start={{ x: 0, y: 0 }}

        end={{ x: 1, y: 1 }}

        style={styles.toastContainer}

        onTouchEnd={onPress}

      >

        <Ionicons name={iconName} size={20} color="#FFFFFF" />

        <View style={styles.toastTextContainer}>

          <Text style={styles.toastText}>{text1}</Text>

          {text2 && <Text style={styles.toastSubText}>{text2}</Text>}

        </View>

      </LinearGradient>

    </Animated.View>

  );

};



// --- TOAST CONFIG ---

const toastConfig = {

  hotstarSuccess: ({ text1, text2, onPress }) => (

    <AnimatedToast text1={text1} text2={text2} onPress={onPress} colors={['#1F80E0', '#D63484']} iconName="checkmark-circle" />

  ),

  hotstarInfo: ({ text1, text2, onPress }) => (

    <AnimatedToast text1={text1} text2={text2} onPress={onPress} colors={['#1F80E0', '#D63484']} iconName="information-circle" />

  ),

  hotstarError: ({ text1, text2, onPress }) => (

    <AnimatedToast text1={text1} text2={text2} onPress={onPress} colors={['#E53935', '#990000']} iconName="alert-circle" />

  )

};



export default function RootLayout() {

  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();



  const restoreSession = useAuthStore((state) => state.restoreSession);

  const token = useAuthStore((state) => state.token);

  const user = useAuthStore((state) => state.user);



  const connectGlobalSocket = useGlobalSocket((state) => state.connectGlobalSocket);

  const disconnectGlobalSocket = useGlobalSocket((state) => state.disconnectGlobalSocket);

  const setUnreadNotifsCount = useGlobalSocket((state) => state.setUnreadNotifsCount);



  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  const handledNotificationId = useRef(null);



  // 1. Initial Auth Check

  useEffect(() => {

    const checkUserAuth = async () => {

      try {

        const storedToken = await SecureStore.getItemAsync('userToken');

        const userDataString = await SecureStore.getItemAsync('userData');



        if (storedToken) {

          const userData = userDataString ? JSON.parse(userDataString) : { email: 'User', name: 'User' };

          restoreSession(storedToken, userData);

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



  // 2. Global Socket Connection & Push Notification Manager (WITH STABILITY DELAY)

  useEffect(() => {

    if (token && user?._id) {

      connectGlobalSocket(user._id);



      axios.get(`${process.env.EXPO_PUBLIC_API_URL}/buddies/notifications`, {

        headers: { Authorization: `Bearer ${token}` }

      })

        .then(res => {

          const unread = res.data.filter(n => !n.isRead).length;

          setUnreadNotifsCount(unread);

        })

        .catch(err => { });



      // 🕒 Added a 1.5s delay so the UI window is fully loaded before triggering the native OS prompt

      const timer = setTimeout(() => {

        registerForPushNotificationsAsync().then(async (pushToken) => {

          if (pushToken) {

            try {

              await axios.put(`${process.env.EXPO_PUBLIC_API_URL}/user/push-token`,

                { token: pushToken },

                { headers: { Authorization: `Bearer ${token}` } }

              );

            } catch (err) { }

          }

        });

      }, 1500);



      return () => clearTimeout(timer);



    } else {

      disconnectGlobalSocket();

    }

  }, [token, user]);



  // 3. Deep Linking: Handle Tapping on Push Notifications

  useEffect(() => {

    if (!isLoading && user && lastNotificationResponse) {

      const responseId = lastNotificationResponse.notification.request.identifier;



      if (handledNotificationId.current !== responseId) {

        handledNotificationId.current = responseId;

        const data = lastNotificationResponse.notification.request.content.data;



        // Route Theatre Invites

        if (data?.type === 'THEATRE_INVITE' && data?.roomId) {

          setTimeout(() => {

            router.push(`/theatre?roomId=${data.roomId}&isHost=false`);

          }, 800);

        }

        // Route Direct Messages straight to ChatScreen

        else if (data?.type === 'NEW_CHAT' && data?.buddyId) {

          setTimeout(() => {

            router.push(`/chat?buddyId=${data.buddyId}`);

          }, 800);

        }

        // Route Accepted Cinerequest straight to ChatScreen with the new buddy

        else if (data?.type === 'CINEREQUEST_ACCEPTED' && data?.buddyId) {

          setTimeout(() => {

            router.push(`/chat?buddyId=${data.buddyId}`);

          }, 800);

        }

        // Route Incoming Requests / Rejections to Notifications tab

        else if (data?.type === 'CINEREQUEST' || data?.type === 'REJECTED_ALERT') {

          setTimeout(() => {

            router.push('/notifications');

          }, 800);

        }

      }

    }

  }, [lastNotificationResponse, isLoading, user]);



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

  toastTextContainer: {

    marginLeft: 8,

    flexDirection: 'column',

  },

  toastText: {

    color: '#FFFFFF',

    fontWeight: 'bold',

    fontSize: 14,

  },

  toastSubText: {

    color: '#E0E0E0',

    fontSize: 12,

    marginTop: 2,

  }

});