import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import notifee, { EventType } from '@notifee/react-native';
import Constants from 'expo-constants';
import axios from 'axios';
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Animated, Dimensions,
  Platform, PermissionsAndroid, Linking, BackHandler, useWindowDimensions,
  TouchableOpacity, Pressable, ScrollView
} from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { ThemeProvider, DarkTheme } from 'expo-router/react-navigation';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import TrackPlayer, { PlayerCommand, Event } from '../services/trackPlayer';
import { useAuthStore } from '../store/useAuthStore';
import { useGlobalSocket } from '../store/useGlobalSocket';
import { useMovieStore } from '../store/useMovieStore';
import { registerUploadForegroundService } from '../services/uploadManager';
import CinePlayLogo from '../components/Logo/CinePlayLogo';

if (Platform.OS !== 'web') {
  registerUploadForegroundService();
}

if (TrackPlayer) {
  TrackPlayer.registerBackgroundEventHandler(() => async (event) => {
    switch (event.type) {
      case Event.RemotePlay: await TrackPlayer.play(); break;
      case Event.RemotePause: await TrackPlayer.pause(); break;
      case Event.RemoteNext: await TrackPlayer.skipToNext(); break;
      case Event.RemotePrevious: await TrackPlayer.skipToPrevious(); break;
      case Event.RemoteSeek: await TrackPlayer.seekTo(event.position); break;
    }
  });
} else if (Platform.OS !== 'web') {
  console.warn("⚠️ TrackPlayer native module is not linked.");
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }),
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getExpoPushTokenWithRetry(projectId, retries = 3) {
  if (!projectId) return null;
  for (let i = 0; i < retries; i++) {
    try { return (await Notifications.getExpoPushTokenAsync({ projectId })).data; }
    catch (e) { if (i < retries - 1) await sleep(2000 * (i + 1)); }
  }
  return null;
}

// --------------------------------------------------------
// ANIMATED TOAST (Responsive for Desktop & Mobile)
// --------------------------------------------------------
const AnimatedToast = ({ text1, text2, colors, iconName, onPress }) => {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 1024;

  // Start animation from off-screen right
  const slideAnim = useRef(new Animated.Value(windowWidth)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
      tension: 60
    }).start();
  }, [slideAnim]);

  return (
    <Animated.View style={[
      styles.toastWrapper,
      isDesktop && styles.desktopToastWrapper,
      { transform: [{ translateX: slideAnim }] }
    ]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.toastContainer, isDesktop && styles.desktopToastContainer]}
        onTouchEnd={onPress}
      >
        <Ionicons name={iconName} size={isDesktop ? 24 : 20} color="#FFFFFF" />
        <View style={styles.toastTextContainer}>
          <Text style={[styles.toastText, isDesktop && styles.desktopToastText]}>{text1}</Text>
          {text2 && <Text style={[styles.toastSubText, isDesktop && styles.desktopToastSubText]}>{text2}</Text>}
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

export const toastConfig = {
  hotstarSuccess: ({ text1, text2, onPress }) => <AnimatedToast text1={text1} text2={text2} onPress={onPress} colors={['#1F80E0', '#D63484']} iconName="checkmark-circle" />,
  hotstarInfo: ({ text1, text2, onPress }) => <AnimatedToast text1={text1} text2={text2} onPress={onPress} colors={['#1F80E0', '#D63484']} iconName="information-circle" />,
  hotstarError: ({ text1, text2, onPress }) => <AnimatedToast text1={text1} text2={text2} onPress={onPress} colors={['#E53935', '#990000']} iconName="alert-circle" />
};

// ==========================================
// 🔧 HOISTED COMPONENTS
// ==========================================

const NavItem = ({ icon, label, route, router, sidebarOpacity, onPressOverride }) => (
  <TouchableOpacity
    style={styles.navRailItem}
    onPress={() => {
      if (onPressOverride) {
        onPressOverride();
      } else if (route) {
        router.push(route);
      }
    }}
  >
    <Ionicons name={icon} size={22} color="#E0E0E0" style={styles.navIcon} />
    <Animated.Text style={[styles.navLabel, { opacity: sidebarOpacity }]} numberOfLines={1}>
      {label}
    </Animated.Text>
  </TouchableOpacity>
);

const ExpandableNavItem = ({
  icon, label, filterKey, options, scrollIndex,
  filters, setFilter, isSidebarExpanded, sidebarOpacity,
  scrollViewRef, handleSidebarEnter
}) => {
  const [isLocalExpanded, setIsLocalExpanded] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isSidebarExpanded && isLocalExpanded) {
      setIsLocalExpanded(false);
      Animated.timing(heightAnim, { toValue: 0, duration: 150, useNativeDriver: false }).start();
    }
  }, [isSidebarExpanded]);

  const toggleExpand = () => {
    if (!isSidebarExpanded) handleSidebarEnter();
    const nextState = !isLocalExpanded;
    setIsLocalExpanded(nextState);

    Animated.spring(heightAnim, {
      toValue: nextState ? options.length * 42 : 0,
      friction: 8,
      tension: 50,
      useNativeDriver: false
    }).start();

    if (nextState && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current.scrollTo({ y: scrollIndex * 60, animated: true });
      }, 150);
    }
  };

  const handleSelectOption = (optValue) => {
    setFilter(filterKey, optValue);
  };

  const selectedOptionLabel = options.find(o => o.value === filters?.[filterKey])?.label || '';

  return (
    <View>
      <TouchableOpacity style={styles.navRailItem} onPress={toggleExpand}>
        <Ionicons name={icon} size={22} color="#E0E0E0" style={styles.navIcon} />
        <Animated.View style={[styles.expandableHeaderContainer, { opacity: sidebarOpacity }]}>
          <View style={styles.navLabelStack}>
            <Text style={styles.navLabel} numberOfLines={1}>{label}</Text>
            <Text style={[styles.navSubLabel, !selectedOptionLabel && { opacity: 0 }]} numberOfLines={1}>
              {selectedOptionLabel || ' '}
            </Text>
          </View>
          <Ionicons name={isLocalExpanded ? "chevron-up" : "chevron-down"} size={16} color="#B0B5B9" />
        </Animated.View>
      </TouchableOpacity>

      {isSidebarExpanded && (
        <Animated.View style={{ height: heightAnim, overflow: 'hidden', paddingLeft: 60 }}>
          {options.map((opt) => {
            const isSelected = filters?.[filterKey] === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={styles.filterOptionBtn}
                onPress={() => handleSelectOption(opt.value)}
              >
                <Text style={[styles.filterOptionText, isSelected && styles.filterOptionTextActive]} numberOfLines={1}>
                  {opt.label}
                </Text>
                {isSelected && <Ionicons name="checkmark" size={16} color="#00E5FF" />}
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      )}
    </View>
  );
};

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 1024;

  const restoreSession = useAuthStore((state) => state.restoreSession);
  const token = useAuthStore((state) => state.token);

  const connectGlobalSocket = useGlobalSocket((state) => state.connectGlobalSocket);
  const disconnectGlobalSocket = useGlobalSocket((state) => state.disconnectGlobalSocket);

  const filters = useMovieStore((state) => state.filters);
  const setFilter = useMovieStore((state) => state.setFilter);

  // --- Smooth Sidebar Animation Logic ---
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const sidebarWidth = useRef(new Animated.Value(76)).current;
  const sidebarOpacity = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);

  const handleSidebarEnter = () => {
    setIsSidebarExpanded(true);
    Animated.parallel([
      Animated.spring(sidebarWidth, { toValue: 280, friction: 9, tension: 60, useNativeDriver: false }),
      Animated.timing(sidebarOpacity, { toValue: 1, duration: 200, useNativeDriver: false })
    ]).start();
  };

  const handleSidebarLeave = () => {
    Animated.parallel([
      Animated.spring(sidebarWidth, { toValue: 76, friction: 9, tension: 60, useNativeDriver: false }),
      Animated.timing(sidebarOpacity, { toValue: 0, duration: 150, useNativeDriver: false })
    ]).start(() => setIsSidebarExpanded(false));
  };

  // --- HOME BUTTON OVERRIDE ---
  const handleHomePress = () => {
    useMovieStore.setState({
      filters: { region: 'all', type: 'all', language: 'any', platform: 'any' },
      isLoading: true
    });
    useMovieStore.getState().fetchAllData();
    router.push('/tabs/home');
  };

  useEffect(() => {
    const checkUserAuth = async () => {
      try {
        let storedToken = Platform.OS === 'web' ? localStorage.getItem('userToken') : await SecureStore.getItemAsync('userToken');
        let userDataString = Platform.OS === 'web' ? localStorage.getItem('userData') : await SecureStore.getItemAsync('userData');
        if (storedToken) {
          restoreSession(storedToken, userDataString ? JSON.parse(userDataString) : { email: 'User', name: 'User' });
          router.replace('/tabs/home');
        }
      } catch (error) { } finally { setIsLoading(false); }
    };
    checkUserAuth();
  }, []);

  if (isLoading) return (
    <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#1F80E0" />
    </LinearGradient>
  );

  // --- CONDITIONAL LOGIC CHECKERS ---
  const showLiveFeed = filters.type === 'live';

  let showLanguage = true;
  if (filters.type === 'live') {
    const tvFeeds = ['news', 'music', 'entertainment', 'movies'];
    if (!tvFeeds.includes(filters.liveCategory)) {
      showLanguage = false;
    }
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={DarkTheme}>
        <View style={{ flex: 1, backgroundColor: '#0A0A0C' }}>

          {/* DESKTOP ANIMATED ABSOLUTE SIDEBAR */}
          {isDesktop && (
            <Animated.View style={[styles.desktopNavRail, { width: sidebarWidth }]}>

              <View style={{ position: 'absolute', width: 280, height: '100%' }} pointerEvents="none">
                <LinearGradient
                  colors={['rgba(10, 10, 12, 0.95)', 'rgba(19, 14, 33, 0.85)', 'rgba(10, 10, 12, 0)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  locations={[0, 0.70, 1]}
                  style={styles.sidebarGradient}
                />
              </View>

              <Pressable
                onHoverIn={handleSidebarEnter}
                onHoverOut={handleSidebarLeave}
                style={[styles.navHoverArea, { width: 280 }]}
              >
                <View style={styles.fixedHeaderSection}>
                  <View style={styles.logoWrapper}>
                    <CinePlayLogo size={32} />
                    <Animated.Text style={[styles.navAppName, styles.webGradientText, { opacity: sidebarOpacity }]} numberOfLines={1}>
                      CinePlay
                    </Animated.Text>
                  </View>

                  <NavItem icon="home" label="Home" onPressOverride={handleHomePress} sidebarOpacity={sidebarOpacity} />
                  <NavItem icon="search" label="Search" route="/tabs/search" router={router} sidebarOpacity={sidebarOpacity} />
                </View>

                <ScrollView
                  ref={scrollViewRef}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 20 }}
                >
                  <View style={styles.navRailFilters}>
                    <ExpandableNavItem
                      icon="grid-outline" label="Category" filterKey="type" scrollIndex={0}
                      filters={filters} setFilter={setFilter} isSidebarExpanded={isSidebarExpanded}
                      sidebarOpacity={sidebarOpacity} scrollViewRef={scrollViewRef} handleSidebarEnter={handleSidebarEnter}
                      options={[
                        { label: 'All', value: 'all' },
                        { label: 'Movies', value: 'movie' },
                        { label: 'TV Shows/WebSeries', value: 'tv' },
                        { label: 'Music', value: 'music' },
                        { label: 'Live Sports & TV', value: 'live' }
                      ]}
                    />

                    {showLiveFeed && (
                      <ExpandableNavItem
                        icon="radio-outline" label="Live Feed" filterKey="liveCategory" scrollIndex={1}
                        filters={filters} setFilter={setFilter} isSidebarExpanded={isSidebarExpanded}
                        sidebarOpacity={sidebarOpacity} scrollViewRef={scrollViewRef} handleSidebarEnter={handleSidebarEnter}
                        options={[
                          { label: 'Cricket', value: 'Cricket' },
                          { label: 'Football', value: 'Football' },
                          { label: 'Basketball', value: 'Basketball' },
                          { label: 'Live News', value: 'news' },
                          { label: 'Live Music', value: 'music' },
                          { label: 'Entertainment TV', value: 'entertainment' },
                          { label: 'Movies TV', value: 'movies' }
                        ]}
                      />
                    )}

                    <ExpandableNavItem
                      icon="laptop-outline" label="Platform" filterKey="platform" scrollIndex={showLiveFeed ? 2 : 1}
                      filters={filters} setFilter={setFilter} isSidebarExpanded={isSidebarExpanded}
                      sidebarOpacity={sidebarOpacity} scrollViewRef={scrollViewRef} handleSidebarEnter={handleSidebarEnter}
                      options={[
                        { label: 'Any', value: 'any' },
                        { label: 'Netflix', value: '8' },
                        { label: 'Prime Video', value: '119' },
                        { label: 'JioHotstar', value: '122|220|337' },
                        { label: 'SonyLiv', value: '237' },
                        { label: 'Zee5', value: '232' }
                      ]}
                    />
                    <ExpandableNavItem
                      icon="globe-outline" label="Region" filterKey="region" scrollIndex={showLiveFeed ? 3 : 2}
                      filters={filters} setFilter={setFilter} isSidebarExpanded={isSidebarExpanded}
                      sidebarOpacity={sidebarOpacity} scrollViewRef={scrollViewRef} handleSidebarEnter={handleSidebarEnter}
                      options={[
                        { label: 'All', value: 'all' },
                        { label: 'Indian', value: 'indian' },
                        { label: 'Others', value: 'others' }
                      ]}
                    />

                    {showLanguage && (
                      <ExpandableNavItem
                        icon="language-outline" label="Language" filterKey="language" scrollIndex={showLiveFeed ? 4 : 3}
                        filters={filters} setFilter={setFilter} isSidebarExpanded={isSidebarExpanded}
                        sidebarOpacity={sidebarOpacity} scrollViewRef={scrollViewRef} handleSidebarEnter={handleSidebarEnter}
                        options={[
                          { label: 'Any', value: 'any' },
                          { label: 'Hindi', value: 'hi' },
                          { label: 'English', value: 'en' },
                          { label: 'Punjabi', value: 'pa' },
                          { label: 'Tamil', value: 'ta' },
                          { label: 'Others', value: 'others' }
                        ]}
                      />
                    )}
                  </View>
                </ScrollView>

                <View style={styles.navRailBottom}>
                  <NavItem icon="bookmark" label="My List" route="/my-list" router={router} sidebarOpacity={sidebarOpacity} />
                  <NavItem icon="person-circle" label="My Space" route="/tabs/profile" router={router} sidebarOpacity={sidebarOpacity} />
                </View>
              </Pressable>
            </Animated.View>
          )}

          <View style={{ flex: 1, paddingLeft: isDesktop ? 76 : 0 }}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0C' }, animation: 'slide_from_right' }} />
            {/* Desktop uses a 40px top offset to clear any window bezels, Mobile uses 50px for the notch */}
            <Toast config={toastConfig} position="top" topOffset={isDesktop ? 40 : 50} />
          </View>
        </View>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // --- TOAST STYLES (Mobile Defaults) ---
  toastWrapper: { width: '100%', alignItems: 'center', paddingHorizontal: 16 },
  toastContainer: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, elevation: 5 },
  toastTextContainer: { marginLeft: 12, flex: 1 },
  toastText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  toastSubText: { color: '#E0E0E0', fontSize: 12, marginTop: 2 },

  // --- DESKTOP TOAST MODIFIERS ---
  desktopToastWrapper: { alignItems: 'flex-end', paddingRight: 40 }, // Floats to top-right
  desktopToastContainer: {
    width: 350,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    cursor: 'pointer'
  },
  desktopToastText: { fontSize: 16, letterSpacing: 0.2 },
  desktopToastSubText: { fontSize: 13, marginTop: 4 },

  // --- SIDEBAR STYLES ---
  desktopNavRail: { position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 1000, overflow: 'hidden' },
  sidebarGradient: { ...StyleSheet.absoluteFillObject },
  navHoverArea: { flex: 1, paddingVertical: 24, overflow: 'hidden' },
  fixedHeaderSection: { paddingBottom: 8 },
  navRailFilters: { gap: 8, paddingBottom: 20 },
  navRailBottom: { gap: 12, paddingTop: 16, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  logoWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingBottom: 30, gap: 12 },
  navAppName: { fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  webGradientText: { backgroundImage: 'linear-gradient(to right, #00E5FF, #9B51E0, #FF007A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' },

  navRailItem: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 26 },
  navIcon: { minWidth: 30, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  navLabel: { color: '#E0E0E0', fontSize: 17, fontWeight: '700', marginLeft: 14, letterSpacing: 0.2 },
  navSubLabel: { color: '#00E5FF', fontSize: 11, fontWeight: '600', marginLeft: 14, marginTop: 2, textTransform: 'uppercase' },
  navLabelStack: { justifyContent: 'center' },

  expandableHeaderContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1, paddingRight: 20 },
  filterOptionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 42, paddingRight: 20 },
  filterOptionText: { color: '#A0A5AA', fontSize: 14, fontWeight: '600' },
  filterOptionTextActive: { color: '#00E5FF', fontWeight: 'bold' },
});